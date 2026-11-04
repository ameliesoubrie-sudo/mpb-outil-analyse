# Convertit l'application de démonstration (app/bilan.html, connexion Supabase dans le navigateur) en contenu de l'outil servi
# par le serveur : public/app.js, public/app.css, public/app-modele.html, public/page.css.
#  - plus aucun client Supabase dans le navigateur : toutes les données passent par les routes métier /api/... ;
#  - écran de connexion supprimé : la connexion se fait par le compte Pro ;
#  - formule dérivée des droits du Pro (affichage seulement), liens « Modifier ma fiche » fournis par le Pro ;
#  - contenu isolé dans un Shadow DOM, entre le header et le footer du Pro.
# À relancer après chaque évolution de app/bilan.html : chaque remplacement est vérifié, le script s'arrête si l'un échoue.
#   python3 outils/convertir_front.py [chemin/vers/bilan.html]
import re, sys, pathlib

ICI = pathlib.Path(__file__).resolve().parent.parent
SOURCE = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ICI.parent / "app" / "bilan.html"
PUBLIC = ICI / "public"
src = SOURCE.read_text(encoding="utf-8")

def entre(texte, debut, fin, depuis=0):
    i = texte.index(debut, depuis) + len(debut)
    return texte[i:texte.index(fin, i)], i

css, _ = entre(src, "<style>", "</style>")
corps_html, pos_body = entre(src, "<body>", "<script>")
js, _ = entre(src, "<script>\n// ===== CONFIGURATION", "</script>")
js = "// ===== CONFIGURATION" + js

def remplacer(texte, ancien, nouveau, n=1, nom=""):
    c = texte.count(ancien)
    if c != n:
        sys.exit(f"[{nom or ancien[:50]!r}] trouvé {c} fois au lieu de {n}")
    return texte.replace(ancien, nouveau)

def remplacer_re(texte, motif, nouveau, n=1, flags=re.S, nom=""):
    nb = len(re.findall(motif, texte, flags))
    if nb != n:
        sys.exit(f"[{nom or motif[:50]!r}] motif trouvé {nb} fois au lieu de {n}")
    return re.sub(motif, lambda m: nouveau, texte, flags=flags)

def fonction(texte, signature):
    """Renvoie (début, fin) d'une fonction de premier niveau : de sa signature à l'accolade fermante en début de ligne."""
    i = texte.index(signature)
    j = texte.index("\n}\n", i) + 3
    return i, j

def remplacer_fonction(texte, signature, nouveau):
    i, j = fonction(texte, signature)
    return texte[:i] + nouveau.strip("\n") + "\n" + texte[j:]

# ---------------------------------------------------------------- CSS
css = remplacer(css, "html,body{margin:0}", ":host{display:block}.mpb-racine{margin:0}", nom="reset html")
# Isolation : les propriétés héritées du document principal (styles du Pro) ne traversent pas la racine de l'outil
css = ".mpb-racine{all:initial;display:block}\n" + css
css = re.sub(r"(^|[}\s,])body\.sc-ouvert", r"\1.mpb-racine.sc-ouvert", css)
css = re.sub(r"(^|[}\n,])body\{", r"\1.mpb-racine{", css)
css = re.sub(r"(^|[}\n,]):root\{", r"\1:host{", css)
if re.search(r"(^|[}\s,])(body|html)[\s{.,:]", css): sys.exit("sélecteur body/html restant dans le CSS")
css += """
/* ===== Intégration dans l'espace Pro (header et footer fournis par le Pro) ===== */
.mpb-racine{min-height:60vh}
.conteneur{max-width:1240px}
.nav-outil{display:flex;gap:.25rem;flex-wrap:wrap;align-items:center;padding-block:14px;border-bottom:1px solid var(--trait);margin-bottom:8px}
.nav-outil .nav-titre{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-right:auto}
@media (max-width:720px){.nav-outil{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.nav-outil::-webkit-scrollbar{display:none}.nav-outil .nav-titre{display:none}}
/* Formules sans identité ni branding : une seule carte de bilan, à sa taille habituelle */
.bilans:has(> :only-child){grid-template-columns:minmax(260px,420px)}
.cookies-fond{position:fixed;inset:0;background:rgba(71,71,70,.35);z-index:200;display:grid;place-items:center;padding:16px}
.cookies-boite{background:var(--fond);border-radius:24px;max-width:520px;width:100%;padding:32px;display:flex;flex-direction:column;gap:14px}
"""

# ---------------------------------------------------------------- HTML
nav_ancienne, _ = entre(corps_html, '<nav aria-label="Espace photographe">', "</nav>")
for attendu in ['id="nav-bilan"', 'id="nav-programme"', 'id="nav-studio"', 'id="nav-ressources"']:
    if attendu not in nav_ancienne: sys.exit("menu interne inattendu : " + attendu)
liens = "\n".join(l for l in nav_ancienne.splitlines() if 'id="nav-' in l)
main = corps_html[corps_html.index('<main class="conteneur" id="app">'):]
main = main[:main.index("</main>") + len("</main>")]
modele = f"""<link rel="stylesheet" href="/static/app.css?v={{{{VERSION}}}}">
<div class="mpb-racine" style="visibility:hidden">
<nav class="nav-outil conteneur" aria-label="Notre outil d'analyse">
  <span class="nav-titre">Notre outil d'analyse</span>
{liens}
</nav>
{main}
</div>
"""

# ---------------------------------------------------------------- JS
js = remplacer_re(js, r"// ===== CONFIGURATION =====\n.*?\nconst sb = supabase\.createClient\(SUPABASE_URL, SUPABASE_KEY\);\n", """// ===== Intégration =====
// Le contenu de l'outil vit dans un Shadow DOM, entre le header et le footer fournis par le Pro.
// Aucune clé ni client Supabase dans le navigateur : toutes les données passent par le serveur de l'outil (/api/...).
const MPB_DONNEES = (() => { try { return JSON.parse(__DOC__.getElementById("mpb-donnees")?.textContent || "{}"); } catch { return {}; } })();
const HOTE = __DOC__.getElementById("mpb-outil");
const RACINE = HOTE.attachShadow({ mode: "open" });
RACINE.append(__DOC__.getElementById("mpb-outil-modele").content.cloneNode(true));
const RACINE_CORPS = RACINE.querySelector(".mpb-racine");
{ const l = RACINE.querySelector('link[rel="stylesheet"]'); const montrer = () => RACINE_CORPS.style.visibility = ""; if (l) { l.addEventListener("load", montrer); l.addEventListener("error", montrer); setTimeout(montrer, 3000); } else montrer(); }

let MOI = null, DROITS = { analysis: false, training: false, studios: false };
class ErreurApi extends Error { constructor(m, statut, code) { super(m); this.statut = statut; this.code = code; } }
const retourCourant = () => "/" + (/^#[A-Za-z0-9][A-Za-z0-9_\\/-]{0,80}$/.test(location.hash) && location.hash !== "#_" ? location.hash : "");
const lienReconnexion = () => "/auth/login?retour=" + encodeURIComponent(retourCourant());
let finSessionAffichee = false;
function finDeSession(code) {
  if (finSessionAffichee) return; finSessionAffichee = true;
  // Expiration connue : une seule relance automatique. Révocation ou refus : un lien, jamais de boucle d'autorisation.
  let t = 0; try { t = Number(sessionStorage.getItem("mpb-sso-tentative") || 0); } catch { /* sans stockage */ }
  if (code === "session_expiree" && Date.now() - t > 120000) {
    try { sessionStorage.setItem("mpb-sso-tentative", String(Date.now())); } catch { /* sans stockage */ }
    location.assign(lienReconnexion()); return;
  }
  app.innerHTML = `<div class="carte pile" style="max-width:560px;margin:2rem auto;text-align:center;align-items:center">
    <h1 class="equerre">Votre session a pris <span class="manuscrit">fin</span></h1>
    <p class="discret">Reconnectez-vous pour retrouver vos bilans. Tout ce qui a été enregistré est conservé.</p>
    <a class="bouton principal" href="${esc(lienReconnexion())}">Me reconnecter</a></div>`;
}
async function appelApi(methode, chemin, corps) {
  const init = { method: methode, credentials: "same-origin", headers: { Accept: "application/json" } };
  if (methode !== "GET") { init.headers["Content-Type"] = "application/json"; init.headers["X-CSRF-Token"] = MOI?.csrf || ""; init.body = JSON.stringify(corps ?? {}); }
  let r;
  try { r = await fetch(chemin, init); } catch { throw new ErreurApi("Connexion impossible. Vérifiez votre réseau, puis réessayez.", 0, "reseau"); }
  let out = {}; try { out = await r.json(); } catch { out = {}; }
  if (r.status === 401) { finDeSession(out.erreur); throw new ErreurApi("Votre session a pris fin.", 401, out.erreur); }
  if (!r.ok) throw new ErreurApi(out.message || out.error || `Erreur ${r.status}`, r.status, out.erreur);
  return out;
}
const api = { get: (c) => appelApi("GET", c), post: (c, b) => appelApi("POST", c, b), put: (c, b) => appelApi("PUT", c, b), patch: (c, b) => appelApi("PATCH", c, b), del: (c) => appelApi("DELETE", c) };
// Pour le code existant qui attend { data, error }
async function essai(p) { try { return { data: await p, error: null }; } catch (e) { return { data: null, error: e }; } }
// Mémoire locale du calculateur : séparée par membre (clé opaque fournie par le serveur), effacée à la déconnexion
const cleCalc = (id) => "mpb-calc:" + (MOI?.cle_stockage || "anonyme") + ":" + id;
function nettoyerStockageAncien() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith("mpb-calc-") || k.startsWith("mpb-calc:anonyme:")) localStorage.removeItem(k); } catch { /* sans stockage */ }
}
// Préférences de cookies : le footer du Pro émet l'événement, l'outil ouvre ses propres préférences
document.addEventListener(MPB_DONNEES.evenementCookies || "mpb:cookie-settings", () => ouvrirPreferencesCookies());
function ouvrirPreferencesCookies() {
  if (RACINE.getElementById("cookies-outil")) return;
  const f = document.createElement("div"); f.className = "cookies-fond"; f.id = "cookies-outil";
  f.innerHTML = `<div class="cookies-boite" role="dialog" aria-modal="true" aria-labelledby="cookies-titre">
    <h2 id="cookies-titre">Cookies de notre outil d'analyse</h2>
    <p>Notre outil n'utilise que les cookies nécessaires à votre connexion et à la sécurité de vos données. Aucun cookie de mesure d'audience ni de publicité n'est déposé : il n'y a donc rien à accepter ou refuser ici.</p>
    <p class="petit discret">Les préférences de votre espace Mon Photographe Bébé se règlent depuis cet espace.</p>
    <div><button class="bouton principal" type="button" data-fermer>Fermer</button></div></div>`;
  const fermer = () => { f.remove(); document.removeEventListener("keydown", echap); };
  const echap = (e) => { if (e.key === "Escape") fermer(); };
  f.addEventListener("click", (e) => { if (e.target === f || e.target.closest("[data-fermer]")) fermer(); });
  document.addEventListener("keydown", echap);
  RACINE_CORPS.appendChild(f); f.querySelector("[data-fermer]").focus();
}
""", nom="configuration")

# Recherches DOM : dans la racine de l'outil (le préambule utilise __DOC__ pour le document principal)
js = js.replace("document.getElementById(", "RACINE.getElementById(")
js = js.replace("document.querySelectorAll(", "RACINE.querySelectorAll(")
js = js.replace("document.querySelector(", "RACINE.querySelector(")
js = js.replace("document.body.contains(", "RACINE.contains(")
js = js.replace("document.body.appendChild(", "RACINE_CORPS.appendChild(")
js = js.replace("document.body.append(", "RACINE_CORPS.append(")
js = js.replace("document.activeElement", "RACINE.activeElement")
js = remplacer(js, 'document.body.classList.add("sc-ouvert");', 'RACINE_CORPS.classList.add("sc-ouvert"); document.documentElement.style.overflow = "hidden";', nom="sc-ouvert")
js = remplacer(js, 'document.body.classList.remove("sc-ouvert");', 'RACINE_CORPS.classList.remove("sc-ouvert"); document.documentElement.style.overflow = "";', nom="sc-ferme")
js = remplacer(js, 'document.addEventListener("click", (e) => { if (e.target.closest?.("[data-studio]")) ouvrirStudioContenu(); });',
               'RACINE.addEventListener("click", (e) => { if (e.target.closest?.("[data-studio]")) ouvrirStudioContenu(); });', nom="clic studio")
# Les éléments de premier niveau de la racine restent accessibles par RACINE.getElementById (évite les getters implicites window.id)
js = remplacer(js, 'const app = RACINE.getElementById("app");', 'const app = RACINE.getElementById("app");', nom="app")

# ---------- Données ----------
js = remplacer_fonction(js, "async function loadCatalogue() {", """async function loadCatalogue() {
  const c = await api.get("/api/catalogue");
  const qs = c.questions || [], os = c.options || [];
  S.missions = Object.fromEntries((c.missions || []).map((m) => [m.id, m]));
  const opts = {}; os.forEach((o) => (opts[o.question_id] ||= []).push(o));
  S.cat = { qs, opts, byId: Object.fromEntries(qs.map((q) => [q.id, q])) };
}""")
js = remplacer(js, '''  const { data } = await sb.from("bilan_bilans").select("*").order("created_at", { ascending: false }).limit(1);
  S.bilan = data?.[0] || null;''', '''  const d = await api.get("/api/bilan");
  S.bilan = d.bilan || null;''', nom="loadBilan début")
js = remplacer_re(js, r'  const \[\{ data: reps \}, \{ data: cs \}, \{ data: pl \}\] = await Promise\.all\(\[\n    sb\.from\("bilan_reponses"\).*?\n  \]\);\n',
                  '  const reps = d.reponses || [], cs = d.constats || [], pl = d.a_un_plan ? [1] : [];\n', nom="loadBilan données")
js = remplacer_re(js, r'  const \{ data: pl \} = await sb\.from\("bilan_plans"\)\.select\("id, created_at.*?\n  \]\);\n', '''  const d = await api.get(`/api/bilans/${S.bilan.id}/plan`);
  S.dernierPlan = d.plan || null;
  const pm = d.plan_missions || [], su = d.suivi || [], an = d.analyses || [];
''', nom="loadPlan")
js = remplacer(js, '  const { error } = await sb.from("bilan_mission_suivi").upsert(row);',
               '  const { error } = await essai(api.put(`/api/bilans/${S.bilan.id}/suivi/${encodeURIComponent(mission_id)}`, { statut: row.statut, etapes_faites: row.etapes_faites, note: row.note, reporte_jusqu: row.reporte_jusqu, termine_at: row.termine_at }));', nom="saveSuivi")
js = remplacer(js, '  const { error } = await sb.from("bilan_reponses").upsert(row);',
               '  const { error } = await essai(api.put(`/api/bilans/${S.bilan.id}/reponses/${encodeURIComponent(question_id)}`, { valeur: row.valeur, texte_libre: row.texte_libre, source: row.source }));', nom="save")
js = remplacer_fonction(js, "async function callFn(name, body) {", """async function callFn(name, body) {
  // Les fonctions sont appelées par le serveur de l'outil, qui y ajoute la session Pro vérifiée
  return api.post(`/api/fonctions/${encodeURIComponent(name)}`, body);
}""")
js = remplacer(js, 'await sb.from("bilan_bilans").update({ site_url: inp.value.trim() }).eq("id", S.bilan.id);',
               'await essai(api.patch(`/api/bilans/${S.bilan.id}`, { site_url: inp.value.trim() }));', nom="site_url")
js = remplacer(js, 'await sb.from("bilan_constats").update({ statut: "corrige" }).eq("bilan_id", S.bilan.id).eq("question_id", inp.dataset.q);',
               'await essai(api.post(`/api/bilans/${S.bilan.id}/constats/${encodeURIComponent(inp.dataset.q)}/corriger`));', nom="constat")
js = remplacer(js, 'localStorage.getItem("mpb-calc-" + id)', 'localStorage.getItem(cleCalc(id))', nom="calc get")
js = remplacer(js, 'localStorage.setItem("mpb-calc-" + id,', 'localStorage.setItem(cleCalc(id),', nom="calc set")
js = remplacer(js, '  const { data } = await sb.from("bilan_contenus").select("id, created_at, format, resultat, brief").eq("mission_id", id).eq("agent", "calculateur").order("created_at", { ascending: false }).limit(10);',
               '  const { data } = await essai(api.get(`/api/contenus?mission_id=${encodeURIComponent(id)}&agent=calculateur`).then((x) => x.contenus));', nom="hist calc")
js = remplacer(js, '  const { data } = await sb.from("bilan_contenus").select("id, created_at, format, persona_prenom, resultat, brief").eq("mission_id", id).order("created_at", { ascending: false }).limit(10);',
               '  const { data } = await essai(api.get(`/api/contenus?mission_id=${encodeURIComponent(id)}`).then((x) => x.contenus));', nom="hist studio")
js = remplacer_re(js, r'  const \[\{ data: qs \}, \{ data: \{ user \} \}\] = await Promise\.all\(\[\n    sb\.from\("bilan_identite_questions"\).*?\n  \]\);\n  S\.uid = user\?\.id;\n',
                  '  const d = await api.get("/api/identite");\n  const qs = d.questions || [];\n  S.uid = null;\n', nom="loadIdentite")
js = remplacer(js, '  const { data: row } = await sb.from("bilan_identite").select("*").maybeSingle();\n  S.ident = row || { member_id: S.uid, reponses: {}, carte: null, statut: "en_cours" };',
               '  const row = d.identite;\n  S.ident = row || { reponses: {}, carte: null, statut: "en_cours" };', nom="identite ligne")
js = remplacer(js, '    const { error } = await sb.from("bilan_identite").upsert(row);',
               '    const { error } = await essai(api.put("/api/identite", { reponses: row.reponses }));', nom="saveIdentite")
js = remplacer(js, 'await sb.from("bilan_identite").upsert({ member_id: S.uid, reponses: S.ident.reponses, carte: S.ident.carte, updated_at: new Date().toISOString() });',
               'await essai(api.put("/api/identite", { reponses: S.ident.reponses, carte: S.ident.carte }));', n=2, nom="carte")
js = remplacer(js, 'const { error } = await sb.from("bilan_identite").upsert({ member_id: S.uid, reponses: S.ident.reponses, carte: S.ident.carte, statut: "validee", valide_at: now, updated_at: now });',
               'const { error } = await essai(api.put("/api/identite", { reponses: S.ident.reponses, carte: S.ident.carte, statut: "validee" }));', nom="valider carte")
js = remplacer_fonction(js, "async function loadRessources() {", """async function loadRessources() {
  try {
    const d = await api.get("/api/ressources");
    S.ressources = d.ressources || []; S.evenements = d.evenements || []; S.inscriptions = new Set(d.inscriptions || []);
  } catch (e) { if (e.statut === 401) throw e; S.ressources = null; S.evenements = []; S.inscriptions = new Set(); }
}""")
js = remplacer(js, 'const accesOk = (r) => (NIVEAU_FORMULE[FORMULE] ?? 2) >= (NIVEAU_ACCES[r.acces] ?? 0);',
               '// Le serveur indique l\'accès de chaque ressource et contrôle aussi le téléchargement\nconst accesOk = (r) => typeof r.accessible === "boolean" ? r.accessible : (NIVEAU_FORMULE[FORMULE] ?? 0) >= (NIVEAU_ACCES[r.acces] ?? 2);', nom="accesOk")
js = remplacer(js, 'accesOk({ acces: e.acces })', 'accesOk(e)', nom="accesOk événement")
js = remplacer(js, 'const { error } = await sb.from("bilan_inscriptions").insert({ evenement_id: e.id });',
               'const { error } = await essai(api.post(`/api/inscriptions/${e.id}`));', nom="inscription")
js = remplacer(js, 'await sb.from("bilan_inscriptions").delete().eq("evenement_id", e.id);',
               'await essai(api.del(`/api/inscriptions/${e.id}`));', nom="désinscription")
js = remplacer(js, 'const { data, error } = await sb.from("bilan_bilans").insert({}).select().single();',
               'const { data, error } = await essai(api.post("/api/bilans").then((x) => x.bilan));', nom="nouveau bilan")
js = remplacer_re(js, r'const LIEN_MODIFIER_FICHE = "#";[^\n]*\n', 'let LIEN_MODIFIER_FICHE = "#"; // lien « Modifier ma fiche » fourni par le Pro (links.profile_edit)\n', nom="lien fiche")
js = remplacer_re(js, r'const FORMULE = "complete";[^\n]*\n', 'let FORMULE = "gratuite"; // dérivée des droits du compte Pro au démarrage : affichage seulement, le serveur contrôle chaque droit\n', nom="formule")
js = js.replace("NIVEAU_FORMULE[FORMULE] ?? 2", "NIVEAU_FORMULE[FORMULE] ?? 0")
# Notre outil d'analyse est ouvert à tout photographe actif (droit analysis) ; le programme et les ressources demandent une offre payante
js = remplacer(js, 'txt: "Votre activité, puis vos pratiques sur Google et les IA, votre site, vos réseaux et vos recommandations.", niv: 1 }',
               'txt: "Votre activité, puis vos pratiques sur Google et les IA, votre site, vos réseaux et vos recommandations.", niv: 0 }', nom="étape bilan")
js = remplacer(js, 'txt: "Notre outil d\'analyse lit votre site et votre fiche comme un parent, et croise avec vos réponses.", niv: 1 }',
               'txt: "Notre outil d\'analyse lit votre site et votre fiche comme un parent, et croise avec vos réponses.", niv: 0 }', nom="étape analyse")
js = remplacer(js, '"Votre fiche est en ligne. Le bilan, l\'analyse et le programme sont inclus dans les offres payantes."',
               '"Votre fiche et notre outil d\'analyse sont inclus. Le programme personnalisé et les ressources sont dans les offres payantes."', nom="texte parcours")
js = remplacer(js, '    return S.section === "tableau" ? renderTableau(c) :',
               '    if (["tableau", "programme", "mission"].includes(S.section) && !DROITS.training) return renderVerrouProgramme(c);\n    return S.section === "tableau" ? renderTableau(c) :', nom="verrou programme")

# Écran de connexion Supabase : supprimé
i, j = fonction(js, "function screenLogin(")
js = js[:i] + js[j:]

js = remplacer_fonction(js, "async function boot() {", """function ecranRattachement() {
  app.innerHTML = `<div class="carte pile" style="max-width:640px;margin:2rem auto;gap:.9rem">
    <h1 class="equerre">Retrouvons vos <span class="manuscrit">bilans</span></h1>
    <p>Un compte de la première version de notre outil d'analyse semble correspondre à votre adresse e-mail. Pour protéger vos données, notre équipe le rattache à votre compte Mon Photographe Bébé après une courte vérification.</p>
    <p class="discret">Écrivez-nous depuis votre espace : une fois le rattachement fait, vous retrouverez vos réponses, votre programme et vos contenus.</p>
    <div><a class="bouton principal" href="${esc(MOI.liens.tableau_de_bord)}">Aller à mon espace</a></div></div>`;
}
function renderVerrouProgramme(el) {
  el.innerHTML = `<div class="carte pile" style="gap:.9rem">
    <p class="surtitre-p">Votre programme personnalisé</p>
    <h1 class="equerre">Une mission par <span class="manuscrit">semaine</span></h1>
    <p>Votre analyse est prête. Le programme personnalisé, avec ses missions, ses fiches pratiques et ses vidéos, est inclus dans les offres payantes.</p>
    <div><a class="bouton principal" href="${esc(MOI.liens.tableau_de_bord)}">Découvrir les offres</a></div></div>`;
}
async function boot() {
  RACINE.getElementById("nav-ressources").onclick = (e) => { e.preventDefault(); if (S.cat) allerA("ressources"); };
  RACINE.getElementById("nav-bilan").onclick = (e) => { e.preventDefault(); if (!S.cat) return; S.section = null; majNav(); screenHome(); window.scrollTo(0, 0); };
  RACINE.getElementById("nav-programme").onclick = (e) => { e.preventDefault(); if (!S.cat) return; if (S.planMissions?.length) return allerA("programme"); S.section = null; majNav(); screenHome(); window.scrollTo(0, 0); };
  RACINE.getElementById("nav-studio").onclick = (e) => { e.preventDefault(); if (S.cat) ouvrirStudioContenu(); };
  try { MOI = await api.get("/api/moi"); }
  catch (e) { if (e.statut !== 401) app.innerHTML = `<div class="message erreur">${esc(e.message)} <a href="/">Réessayer</a></div>`; return; }
  DROITS = MOI.droits; FORMULE = MOI.formule; LIEN_MODIFIER_FICHE = MOI.liens.modifier_fiche || "#";
  try { sessionStorage.removeItem("mpb-sso-tentative"); } catch { /* sans stockage */ }
  nettoyerStockageAncien();
  if (location.hash === "#_") { try { history.replaceState(null, "", location.pathname + location.search); } catch { /* sans historique */ } }
  if (MOI.etat_compte !== "actif") return ecranRattachement();
  majNav();
  try { if (!S.cat) await loadCatalogue(); await loadBilan(); screenHome(); ouvrirLienFiche(); installerStudioContenu(); }
  catch (e) { if (e.statut !== 401) app.innerHTML = `<div class="message erreur">${esc(e.message)} <a href="/">Réessayer</a></div>`; }
}""")

restants = [js[max(0, m.start() - 70):m.start() + 70] for m in re.finditer(r"\bsb\.(from|auth|functions|storage|rpc)\b", js)]
if restants: sys.exit("appels Supabase restants :\n" + "\n".join(restants))
if re.search(r"\bsupabase\b\.|SUPABASE_KEY|SUPABASE_URL", js): sys.exit("référence Supabase restante")
js = js.replace("__DOC__.", "document.")
reste = sorted(set(re.findall(r"document\.[a-zA-Z]+", js)))
autorises = {"document.addEventListener", "document.removeEventListener", "document.createElement", "document.getElementById", "document.documentElement", "document.createElementNS", "document.fonts", "document.visibilityState", "document.hidden", "document.title"}
inattendus = [x for x in reste if x not in autorises]
if inattendus: sys.exit("accès au document principal à revoir : " + ", ".join(inattendus))
# getElementById sur document : seulement pour les éléments du document principal (hôte, modèle, données)
for m in re.findall(r'document\.getElementById\("([^"]+)"\)', js):
    if m not in ("mpb-donnees", "mpb-outil", "mpb-outil-modele"): sys.exit("document.getElementById inattendu : " + m)

PUBLIC.mkdir(exist_ok=True)
(PUBLIC / "app.css").write_text(css.strip() + "\n", encoding="utf-8")
(PUBLIC / "app.js").write_text('"use strict";\n// Généré par outils/convertir_front.py depuis app/bilan.html : ne pas modifier à la main.\n' + js.strip() + "\n", encoding="utf-8")
(PUBLIC / "app-modele.html").write_text(modele, encoding="utf-8")
(PUBLIC / "page.css").write_text("""/* Document principal : seulement l'emplacement de l'outil. Les styles du Pro (header, footer) s'appliquent tels quels. */
#mpb-outil{display:block;min-height:60vh}
""", encoding="utf-8")
print(f"app.js {len(js)//1024} Ko, app.css {len(css)//1024} Ko, modèle {len(modele)} octets")
