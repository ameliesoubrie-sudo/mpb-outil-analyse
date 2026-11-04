// Tests du parcours de connexion par le compte Pro, des sessions et de la déconnexion.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { creerBase, demarrerFauxPro, demarrerFaussesFonctions, demarrerOutil, Navigateur, DROITS } from "./aide.js";

let base, pro, fonctions, outil;
const journaux = [];
const logOrig = console.log, errOrig = console.error;

before(async () => {
  console.log = (...a) => journaux.push(a.join(" "));
  console.error = (...a) => journaux.push(a.join(" "));
  base = creerBase();
  pro = await demarrerFauxPro();
  fonctions = await demarrerFaussesFonctions();
  outil = await demarrerOutil({ pro, fonctions, dbUrl: base.url });
  pro.etat.comptes.set("201", { email: "nouvelle@pro.test", name: "Nina", droits: { ...DROITS.studios }, actif: true, fiche: "https://www.monphotographebebe.fr/photographe/nina" });
  pro.etat.comptes.set("202", { email: "autre@pro.test", name: "Olga", droits: { ...DROITS.gratuit }, actif: true });
});
after(async () => {
  await outil?.fermer(); await pro?.fermer(); await fonctions?.fermer(); base?.supprimer();
  console.log = logOrig; console.error = errOrig;
});

async function connecter(sub, { retour = "/" } = {}) {
  const nav = new Navigateur();
  pro.etat.connecte = sub;
  const r = await nav.suivre(`${outil.origin}/auth/login?retour=${encodeURIComponent(retour)}`);
  return { nav, ...r };
}
const api = (nav, chemin, init = {}) => nav.aller(outil.origin + chemin, init);
async function moi(nav) { const r = await api(nav, "/api/moi"); return { statut: r.status, corps: await r.json() }; }
const ecrire = async (nav, methode, chemin, corps, csrf, origine = outil.origin) => api(nav, chemin, {
  method: methode, headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf, Origin: origine }, body: JSON.stringify(corps),
});

test("arrivée directe sans session : page d'amorce qui capture le fragment, sans appel au Pro", async () => {
  const nav = new Navigateur();
  const r = await api(nav, "/");
  const t = await r.text();
  assert.equal(r.status, 200);
  assert.match(t, /location\.replace\(dest\)/);
  assert.match(r.headers.get("content-security-policy"), /script-src 'self' [^;]*'nonce-[A-Za-z0-9_-]+'/);
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("ouverture depuis un Pro connecté : retour direct sur la mission demandée, cookie de session conforme", async () => {
  const nav = new Navigateur();
  pro.etat.connecte = "201";
  const l = await nav.aller(`${outil.origin}/auth/login?retour=${encodeURIComponent("/#mission-MG09")}`);
  assert.equal(l.status, 303);
  const autoriser = new URL(l.headers.get("location"));
  assert.equal(autoriser.origin + autoriser.pathname, pro.base + "/connexion/outils/autoriser");
  const p = autoriser.searchParams;
  assert.deepEqual([...p.keys()].sort(), ["client_id", "code_challenge", "code_challenge_method", "redirect_uri", "response_type", "state"]);
  assert.equal(p.get("redirect_uri"), `${outil.origin}/auth/callback`);
  assert.equal(p.get("code_challenge").length, 43);
  assert.ok(p.get("state").length >= 43);
  const tx = l.headers.getSetCookie().find((c) => c.startsWith(outil.config.nomCookieTx));
  assert.match(tx, /HttpOnly/); assert.match(tx, /SameSite=Lax/); assert.match(tx, /Path=\//); assert.doesNotMatch(tx, /Domain/i);
  const a = await nav.aller(autoriser.toString());
  const cb = new URL(a.headers.get("location"));
  assert.equal(cb.hash, "#_");
  cb.hash = "";
  const c = await nav.aller(cb.toString());
  assert.equal(c.status, 303);
  assert.equal(c.headers.get("location"), "/#mission-MG09");
  assert.equal(c.headers.get("referrer-policy"), "no-referrer");
  assert.equal(c.headers.get("cache-control"), "no-store");
  const sess = c.headers.getSetCookie().find((x) => x.startsWith(outil.config.nomCookie + "="));
  assert.match(sess, /HttpOnly/); assert.match(sess, /SameSite=Lax/); assert.match(sess, /Path=\//); assert.doesNotMatch(sess, /Domain/i);
  const m = await moi(nav);
  assert.equal(m.statut, 200);
  assert.deepEqual(m.corps.droits, DROITS.studios);
  assert.equal(m.corps.formule, "complete");
  assert.equal(m.corps.etat_compte, "actif");
  assert.equal(m.corps.liens.fiche_publique, "https://www.monphotographebebe.fr/photographe/nina");
  // Page de l'outil : header/footer du Pro, contenu isolé, aucun secret
  const page = await (await api(nav, "/")).text();
  assert.match(page, /class="pro-header"/); assert.match(page, /class="pro-footer"/);
  assert.match(page, /<body class="brand-site member-area">/);
  assert.match(page, /<template id="mpb-outil-modele">/);
  for (const jeton of pro.etat.jetons.keys()) assert.ok(!page.includes(jeton), "le jeton MPB ne doit jamais atteindre le navigateur");
  assert.ok(!page.includes(pro.etat.secret));
  // Le Pro n'a jamais reçu de cookie de l'outil, ni l'outil celui du Pro
  assert.ok(pro.etat.appels.filter((x) => x.chemin.startsWith("/api/")).every((x) => !x.cookie));
});

test("Pro non connecté : l'écran de connexion du Pro s'affiche, puis la connexion reprend", async () => {
  const nav = new Navigateur();
  pro.etat.connecte = null;
  const r = await nav.suivre(`${outil.origin}/auth/login`);
  assert.equal(r.texte, "ecran de connexion pro");
  pro.etat.connecte = "201";
  const r2 = await nav.suivre(r.url);   // le Pro reprend l'autorisation après connexion
  assert.equal(new URL(r2.url).pathname, "/");
  assert.equal((await moi(nav)).statut, 200);
});

test("session existante : /auth/login renvoie directement à la destination, sans nouvelle autorisation", async () => {
  const { nav } = await connecter("201");
  const avant = pro.etat.appels.filter((x) => x.chemin === "/connexion/outils/autoriser").length;
  const r = await api(nav, "/auth/login?retour=" + encodeURIComponent("/#mission-MR01"));
  assert.equal(r.status, 303);
  assert.equal(r.headers.get("location"), "/#mission-MR01");
  assert.equal(pro.etat.appels.filter((x) => x.chemin === "/connexion/outils/autoriser").length, avant);
});

test("destination externe ou piégée : toujours ramenée à /", async () => {
  for (const retour of ["//evil.example", "https://evil.example/", "/\\evil", "/#a\u0000b", "javascript:alert(1)", "/autre"]) {
    const nav = new Navigateur(); pro.etat.connecte = "201";
    const r = await nav.suivre(`${outil.origin}/auth/login?retour=${encodeURIComponent(retour)}`);
    assert.equal(new URL(r.url).pathname, "/", retour);
    assert.equal(r.fragment === "" || r.fragment === "#_", true, retour);
  }
});

async function transaction(nav) {
  const l = await nav.aller(`${outil.origin}/auth/login`);
  const a = await nav.aller(l.headers.get("location"));
  const cb = new URL(a.headers.get("location")); cb.hash = "";
  return cb;
}

test("state erroné, rejoué, d'un autre navigateur, émetteur faux, paramètres répétés : refusés", async () => {
  pro.etat.connecte = "201";
  const nav = new Navigateur();
  const cb = await transaction(nav);
  const faux = new URL(cb); faux.searchParams.set("state", "x".repeat(43));
  assert.equal((await nav.aller(faux.toString())).status, 400);
  const iss = new URL(cb); iss.searchParams.set("iss", "https://pirate.example");
  assert.equal((await nav.aller(iss.toString())).status, 400);
  const double = new URL(cb); double.searchParams.append("state", cb.searchParams.get("state"));
  assert.equal((await nav.aller(double.toString())).status, 400);
  const extra = new URL(cb); extra.searchParams.set("retour", "https://evil.example");
  assert.equal((await nav.aller(extra.toString())).status, 400);
  // Autre navigateur : la transaction n'est pas consommée et reste utilisable par le bon navigateur
  const intrus = new Navigateur();
  assert.equal((await intrus.aller(cb.toString())).status, 400);
  const ok = await nav.aller(cb.toString());
  assert.equal(ok.status, 303);
  // Rejeu du même callback : refusé
  const nav2 = new Navigateur(); nav2.cookies = new Map([...nav.cookies].map(([h, j]) => [h, new Map(j)]));
  assert.equal((await nav2.aller(cb.toString())).status, 400);
  assert.ok(journaux.every((l) => !l.includes(cb.searchParams.get("code"))), "le code n'apparaît dans aucun journal");
});

test("code expiré ou PKCE incorrect : échange refusé par le Pro, aucune session", async () => {
  pro.etat.connecte = "201";
  const nav = new Navigateur();
  const cb = await transaction(nav);
  pro.etat.codes.get(cb.searchParams.get("code")).expire = Date.now() - 1;
  const r = await nav.aller(cb.toString());
  assert.equal(r.status, 400);
  assert.equal((await moi(nav)).statut, 401);
  // PKCE : un code émis pour un autre challenge (autre transaction) ne s'échange pas avec ce verifier
  const nav3 = new Navigateur();
  const cbA = await transaction(nav3);
  const cbB = await transaction(nav3);
  const croise = new URL(cbA); croise.searchParams.set("code", cbB.searchParams.get("code"));
  assert.equal((await nav3.aller(croise.toString())).status, 400);
});

test("onglets concurrents : deux transactions indépendantes aboutissent toutes les deux", async () => {
  pro.etat.connecte = "201";
  const nav = new Navigateur();
  const l1 = await nav.aller(`${outil.origin}/auth/login?retour=${encodeURIComponent("/#mission-MG01")}`);
  const l2 = await nav.aller(`${outil.origin}/auth/login?retour=${encodeURIComponent("/#mission-MS02")}`);
  const cb1 = new URL((await nav.aller(l1.headers.get("location"))).headers.get("location")); cb1.hash = "";
  const cb2 = new URL((await nav.aller(l2.headers.get("location"))).headers.get("location")); cb2.hash = "";
  const r2 = await nav.aller(cb2.toString());
  const r1 = await nav.aller(cb1.toString());
  assert.equal(r2.headers.get("location"), "/#mission-MS02");
  assert.equal(r1.headers.get("location"), "/#mission-MG01");
  assert.equal((await moi(nav)).statut, 200);
});

test("rotation : une nouvelle connexion change l'identifiant de session et révoque l'ancienne autorisation", async () => {
  pro.etat.connecte = "201";
  const nav = new Navigateur();
  const l1 = await nav.aller(`${outil.origin}/auth/login`);
  const l2 = await nav.aller(`${outil.origin}/auth/login`);
  const cb1 = new URL((await nav.aller(l1.headers.get("location"))).headers.get("location")); cb1.hash = "";
  const cb2 = new URL((await nav.aller(l2.headers.get("location"))).headers.get("location")); cb2.hash = "";
  await nav.aller(cb1.toString());
  const ancien = nav.entete(outil.origin);
  const jetonsAvant = new Set(pro.etat.jetons.keys());
  await nav.aller(cb2.toString());
  assert.notEqual(nav.entete(outil.origin), ancien);
  assert.ok([...jetonsAvant].some((j) => pro.etat.revoques.includes(j)), "l'ancien jeton est révoqué");
  assert.equal((await moi(nav)).statut, 200);
  const vieux = new Navigateur(); vieux.cookies.set(new URL(outil.origin).host, new Map(ancien.split("; ").map((x) => x.split("="))));
  assert.equal((await moi(vieux)).statut, 401);
});

test("secrets : jeton chiffré en base, jamais dans le cookie, la page, ni les journaux", async () => {
  const { nav } = await connecter("201");
  const { rows } = await outil.pool.query("select id_hash, jeton_chiffre from mpb_prive.sessions");
  const jetons = [...pro.etat.jetons.keys()];
  for (const r of rows) for (const j of jetons) { assert.ok(!r.jeton_chiffre.includes(j)); assert.notEqual(r.id_hash, nav.entete(outil.origin)); }
  for (const j of jetons) {
    assert.ok(!(nav.entete(outil.origin) || "").includes(j));
    assert.ok(journaux.every((l) => !l.includes(j)), "aucun jeton dans les journaux");
  }
  assert.ok(journaux.every((l) => !l.includes(pro.etat.secret)));
});

test("révocation distante ou compte désactivé : session détruite, lien « Me reconnecter » sans boucle", async () => {
  const { nav } = await connecter("201");
  for (const j of pro.etat.jetons.values()) if (j.sub === "201") j.actif = false;
  const r = await moi(nav);
  assert.equal(r.statut, 401); assert.equal(r.corps.erreur, "session_revoquee"); assert.equal(r.corps.reconnexion, "/auth/login");
  const page = await (await api(nav, "/")).text();
  assert.match(page, /Me reconnecter/);
  assert.match(page, /if \(false &&/, "pas de redémarrage automatique après une révocation");
  const { nav: nav2 } = await connecter("201");
  pro.etat.comptes.get("201").actif = false;
  assert.equal((await moi(nav2)).statut, 401);
  pro.etat.comptes.get("201").actif = true;
});

test("droits modifiés : effet dès la requête suivante", async () => {
  pro.etat.comptes.set("203", { email: "droits@pro.test", name: "Paule", droits: { ...DROITS.studios }, actif: true });
  const { nav } = await connecter("203");
  assert.equal((await api(nav, "/api/identite")).status, 200);
  pro.etat.comptes.get("203").droits = { ...DROITS.visibilite };
  assert.equal((await api(nav, "/api/identite")).status, 403);
  assert.equal((await moi(nav)).corps.formule, "intermediaire");
  // studios n'est jamais accordé sans training
  pro.etat.comptes.get("203").droits = { analysis: true, training: false, studios: true };
  assert.equal((await moi(nav)).corps.droits.studios, false);
});

test("panne du Pro : opération privée refusée avec un message de réessai, session conservée", async () => {
  const { nav } = await connecter("201");
  pro.etat.panne = true;
  const r = await moi(nav);
  assert.equal(r.statut, 503); assert.equal(r.corps.erreur, "pro_indisponible");
  const page = await api(nav, "/");
  assert.equal(page.status, 503); assert.match(await page.text(), /Réessayer/);
  pro.etat.panne = false;
  assert.equal((await moi(nav)).statut, 200);
});

test("expiration du jeton : session détruite, une seule relance automatique", async () => {
  pro.etat.dureeJeton = 1;
  const { nav } = await connecter("201");
  pro.etat.dureeJeton = undefined;
  await new Promise((ok) => setTimeout(ok, 1300));
  const r = await moi(nav);
  assert.equal(r.statut, 401); assert.equal(r.corps.erreur, "session_expiree");
  const page = await (await api(nav, "/")).text();
  assert.match(page, /if \(true && Date\.now\(\) - t > 120000\)/, "relance automatique unique, gardée par sessionStorage");
});

test("hôte inattendu refusé", async () => {
  const http = await import("node:http");
  const u = new URL(outil.origin);
  const statut = await new Promise((ok, ko) => http.get({ hostname: "127.0.0.1", port: u.port, path: "/", headers: { Host: "pirate.example" } }, (r) => { r.resume(); ok(r.statusCode); }).on("error", ko));
  assert.equal(statut, 421);
});

test("header/footer avec une ressource hors du Pro : refusés, page d'indisponibilité", async () => {
  const { nav } = await connecter("201");
  pro.etat.chromeInvalide = true;
  const r = await api(nav, "/");
  assert.equal(r.status, 503);
  pro.etat.chromeInvalide = false;
});

test("déconnexion : confirmation en GET, POST protégé, révocation, cookie effacé, retour au Pro", async () => {
  const { nav } = await connecter("201");
  const g = await api(nav, "/auth/logout");
  const t = await g.text();
  assert.equal(g.status, 200);
  assert.equal((await moi(nav)).statut, 200, "GET ne déconnecte pas");
  const csrf = /name="csrf" value="([^"]+)"/.exec(t)[1];
  const form = (c, origine = outil.origin) => api(nav, "/auth/logout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: origine }, body: new URLSearchParams({ csrf: c }).toString() });
  assert.equal((await form(csrf, "https://pirate.example")).status, 400);
  assert.equal((await form("faux")).status, 400);
  assert.equal((await moi(nav)).statut, 200);
  const sessionAvant = nav.entete(outil.origin);
  const avant = pro.etat.revoques.length;
  const p = await form(csrf);
  assert.equal(p.status, 200);
  assert.match(p.headers.get("clear-site-data"), /storage/);
  assert.match(await p.text(), new RegExp(`location\\.replace\\("${pro.base}/deconnexion"\\)`));
  assert.equal(pro.etat.revoques.length, avant + 1);
  assert.equal((await moi(nav)).statut, 401);
  // Le cookie précédent, rejoué, ne sert plus à rien
  const vieux = new Navigateur(); vieux.cookies.set(new URL(outil.origin).host, new Map(sessionAvant.split("; ").map((x) => x.split("="))));
  assert.equal((await moi(vieux)).statut, 401);
});

test("déconnexion sans en-tête Origin (réglage de confidentialité) : acceptée avec le jeton CSRF", async () => {
  const { nav } = await connecter("201");
  const t = await (await api(nav, "/auth/logout")).text();
  const csrf = /name="csrf" value="([^"]+)"/.exec(t)[1];
  const p = await api(nav, "/auth/logout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Sec-Fetch-Site": "same-origin" }, body: "csrf=" + encodeURIComponent(csrf) });
  assert.equal(p.status, 200);
  assert.equal((await moi(nav)).statut, 401);
  const x = await connecter("201");
  const p2 = await api(x.nav, "/auth/logout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Sec-Fetch-Site": "cross-site" }, body: "csrf=x" });
  assert.equal(p2.status, 400);
});

test("échec au retour de connexion : page sans aucune ressource tierce", async () => {
  const r = await api(new Navigateur(), "/auth/callback?code=" + "a".repeat(30) + "&state=" + "b".repeat(43) + "&iss=https%3A%2F%2Fpro.test");
  const t = await r.text();
  assert.equal(r.status, 400);
  assert.doesNotMatch(t, /https?:\/\/(?!pro\.test)/, "aucune URL externe dans la page");
});

test("déconnexion même si la révocation distante échoue", async () => {
  const { nav } = await connecter("201");
  const t = await (await api(nav, "/auth/logout")).text();
  const csrf = /name="csrf" value="([^"]+)"/.exec(t)[1];
  pro.etat.panne = true;
  const p = await api(nav, "/auth/logout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: outil.origin }, body: "csrf=" + encodeURIComponent(csrf) });
  pro.etat.panne = false;
  assert.equal(p.status, 200);
  assert.equal((await moi(nav)).statut, 401);
});

test("CSRF : mutation sans jeton, avec un mauvais jeton ou depuis une autre origine refusée", async () => {
  const { nav } = await connecter("201");
  const { corps } = await moi(nav);
  assert.equal((await ecrire(nav, "POST", "/api/bilans", {}, "")).status, 403);
  assert.equal((await ecrire(nav, "POST", "/api/bilans", {}, "faux")).status, 403);
  assert.equal((await ecrire(nav, "POST", "/api/bilans", {}, corps.csrf, "https://pro.test")).status, 403);
  assert.equal((await ecrire(nav, "POST", "/api/bilans", {}, corps.csrf)).status, 200);
});

test("API sans session : JSON 401, jamais une page de connexion", async () => {
  const r = await api(new Navigateur(), "/api/bilan");
  assert.equal(r.status, 401);
  assert.match(r.headers.get("content-type"), /application\/json/);
});
