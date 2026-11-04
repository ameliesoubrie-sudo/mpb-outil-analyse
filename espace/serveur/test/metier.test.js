// Tests des routes métier : isolation entre membres, droits par formule, relais des fonctions, rattachement des comptes historiques.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { creerBase, demarrerFauxPro, demarrerFaussesFonctions, demarrerOutil, Navigateur, DROITS } from "./aide.js";

let base, pro, fonctions, outil;
const logOrig = console.log, errOrig = console.error;
before(async () => {
  console.log = () => {}; console.error = () => {};
  base = creerBase();
  pro = await demarrerFauxPro();
  fonctions = await demarrerFaussesFonctions();
  outil = await demarrerOutil({ pro, fonctions, dbUrl: base.url });
  pro.etat.comptes.set("A", { email: "a@pro.test", name: "Alice", droits: { ...DROITS.studios }, actif: true, fiche: "https://www.monphotographebebe.fr/photographe/alice" });
  pro.etat.comptes.set("B", { email: "b@pro.test", name: "Berthe", droits: { ...DROITS.studios }, actif: true });
  pro.etat.comptes.set("G", { email: "g@pro.test", name: "Gaëlle", droits: { ...DROITS.gratuit }, actif: true });
  pro.etat.comptes.set("V", { email: "v@pro.test", name: "Vera", droits: { ...DROITS.visibilite }, actif: true });
  pro.etat.comptes.set("H", { email: "camille@test.fr", name: "Camille", droits: { ...DROITS.studios }, actif: true });   // compte historique (même e-mail)
});
after(async () => { await outil?.fermer(); await pro?.fermer(); await fonctions?.fermer(); base?.supprimer(); console.log = logOrig; console.error = errOrig; });

async function membre(sub) {
  const nav = new Navigateur(); pro.etat.connecte = sub;
  await nav.suivre(`${outil.origin}/auth/login`);
  const moi = await (await nav.aller(outil.origin + "/api/moi")).json();
  const req = async (methode, chemin, corps) => {
    const init = { method: methode, headers: {} };
    if (methode !== "GET") { init.headers = { "Content-Type": "application/json", "X-CSRF-Token": moi.csrf, Origin: outil.origin }; init.body = JSON.stringify(corps ?? {}); }
    const r = await nav.aller(outil.origin + chemin, init);
    let j = null; try { j = await r.clone().json(); } catch { /* redirection */ }
    return { statut: r.status, corps: j, r };
  };
  return { nav, moi, req };
}

let A, B;
test("deux membres : chacun ne voit et ne modifie que ses propres données", async () => {
  A = await membre("A"); B = await membre("B");
  const bA = (await A.req("POST", "/api/bilans")).corps.bilan;
  const bB = (await B.req("POST", "/api/bilans", { member_id: A.moi.cle_stockage })).corps.bilan;
  assert.notEqual(bA.member_id, bB.member_id, "le member_id envoyé par le navigateur est ignoré");
  assert.equal((await A.req("PUT", `/api/bilans/${bA.id}/reponses/G01`, { valeur: ["A"] })).statut, 200);
  // B tente d'agir sur le bilan de A en connaissant son UUID : 404, comme s'il n'existait pas
  for (const [m, c, corps] of [
    ["PUT", `/api/bilans/${bA.id}/reponses/G01`, { valeur: ["C"] }],
    ["PATCH", `/api/bilans/${bA.id}`, { site_url: "https://pirate.example" }],
    ["GET", `/api/bilans/${bA.id}/plan`],
    ["PUT", `/api/bilans/${bA.id}/suivi/MG01`, { statut: "termine" }],
    ["POST", `/api/bilans/${bA.id}/constats/G01/corriger`],
  ]) {
    const r = await B.req(m, c, corps);
    assert.equal(r.statut, 404, `${m} ${c}`);
    assert.equal(r.corps.erreur, "introuvable");
  }
  const lu = (await A.req("GET", "/api/bilan")).corps;
  assert.equal(lu.bilan.id, bA.id);
  assert.deepEqual(lu.reponses.map((x) => x.valeur), [["A"]]);
  assert.equal((await B.req("GET", "/api/bilan")).corps.bilan.id, bB.id);
});

test("contenus et identité : toujours ceux du membre connecté", async () => {
  const { rows: [{ member_id: idA }] } = await outil.pool.query(`select member_id from public.bilan_bilans b join mpb_prive.correspondances c using (member_id) where c.mpb_subject = 'A' limit 1`);
  await outil.pool.query(`insert into public.bilan_contenus (member_id, mission_id, format, resultat, agent) values ($1, 'MG01', 'bio', '{"t":"secret A"}', 'studio-instagram')`, [idA]);
  assert.equal((await A.req("GET", "/api/contenus?mission_id=MG01")).corps.contenus.length, 1);
  assert.equal((await B.req("GET", "/api/contenus?mission_id=MG01")).corps.contenus.length, 0);
  assert.equal((await A.req("PUT", "/api/identite", { reponses: { ID01: { v: ["Grossesse"] } }, member_id: "00000000-0000-0000-0000-0000000000bb" })).statut, 200);
  assert.equal((await B.req("GET", "/api/identite")).corps.identite, null);
  assert.deepEqual((await A.req("GET", "/api/identite")).corps.identite.reponses, { ID01: { v: ["Grossesse"] } });
  const v = await A.req("PUT", "/api/identite", { reponses: { ID01: { v: ["Grossesse"] } }, carte: { histoire: "x" }, statut: "validee" });
  assert.equal(v.corps.identite.statut, "validee"); assert.ok(v.corps.identite.valide_at);
  assert.equal((await A.req("PUT", "/api/identite", { reponses: {}, statut: "carte_proposee" })).statut, 400, "seul le statut validee peut être demandé");
});

test("champs bornés : valeurs, sources, questions inconnues ou inactives refusées", async () => {
  const b = (await A.req("GET", "/api/bilan")).corps.bilan;
  assert.equal((await A.req("PUT", `/api/bilans/${b.id}/reponses/G99`, { valeur: ["A"] })).statut, 400);
  assert.equal((await A.req("PUT", `/api/bilans/${b.id}/reponses/G01`, { valeur: "A" })).statut, 400);
  assert.equal((await A.req("PUT", `/api/bilans/${b.id}/reponses/G01`, { valeur: ["A"], source: "admin" })).statut, 400);
  assert.equal((await A.req("PUT", `/api/bilans/${b.id}/suivi/MXX`, { statut: "termine" })).statut, 400);
  assert.equal((await A.req("PUT", `/api/bilans/${b.id}/suivi/MG01`, { statut: "termine", etapes_faites: [0, 1], termine_at: new Date().toISOString() })).statut, 200);
  assert.equal((await A.req("GET", `/api/bilans/${b.id}/plan`)).corps.suivi[0].statut, "termine");
});

test("fiche publique Pro : pré-remplie dans P04 sans écraser une réponse déjà saisie", async () => {
  const b = (await A.req("GET", "/api/bilan")).corps.bilan;
  await A.req("PUT", `/api/bilans/${b.id}/reponses/P04`, { valeur: ["site"], texte_libre: { site_url: "https://alice.fr" } });
  let p04 = (await A.req("GET", "/api/bilan")).corps.reponses.find((r) => r.question_id === "P04");
  assert.equal(p04.texte_libre.fiche_url, "https://www.monphotographebebe.fr/photographe/alice");
  assert.equal(p04.texte_libre.site_url, "https://alice.fr");
  await A.req("PUT", `/api/bilans/${b.id}/reponses/P04`, { valeur: ["site"], texte_libre: { fiche_url: "https://ma-fiche-saisie.fr" } });
  p04 = (await A.req("GET", "/api/bilan")).corps.reponses.find((r) => r.question_id === "P04");
  assert.equal(p04.texte_libre.fiche_url, "https://ma-fiche-saisie.fr");
});

test("formule gratuite : outil d'analyse ouvert, identité, studios et ressources payantes refusés côté serveur", async () => {
  const G = await membre("G");
  assert.equal(G.moi.formule, "gratuite");
  assert.equal((await G.req("POST", "/api/bilans")).statut, 200);
  assert.equal((await G.req("GET", "/api/identite")).statut, 403);
  assert.equal((await G.req("PUT", "/api/identite", { reponses: {} })).statut, 403);
  assert.equal((await G.req("GET", "/api/contenus?mission_id=MG01")).statut, 403);
  assert.equal((await G.req("POST", "/api/fonctions/agent-identite", {})).statut, 403);
  assert.equal((await G.req("POST", "/api/fonctions/studio-instagram", { formule: "complete" })).statut, 403, "la formule envoyée dans le corps ne compte pas");
  assert.equal((await G.req("POST", "/api/fonctions/analyse-site", {})).statut, 200);
  const cat = (await G.req("GET", "/api/catalogue")).corps;
  assert.ok(cat.missions.length > 0 && cat.missions.every((m) => !("methode" in m) && !("etapes" in m) && !("comprendre" in m) && !("ressources" in m)), "contenu des missions réservé au programme payant");
  assert.ok("etapes" in (await A.req("GET", "/api/catalogue")).corps.missions[0], "contenu complet avec le droit training");
  const bg = (await G.req("GET", "/api/bilan")).corps.bilan;
  assert.equal((await G.req("GET", `/api/bilans/${bg.id}/plan`)).statut, 200, "la synthèse de l'analyse reste lisible");
  assert.equal((await G.req("PUT", `/api/bilans/${bg.id}/suivi/MG01`, { statut: "termine" })).statut, 403, "le suivi du programme demande une offre payante");
  const res = (await G.req("GET", "/api/ressources")).corps;
  assert.deepEqual(res.ressources.map((r) => [r.id, r.accessible]), [["res-libre", true], ["res-audit", false], ["res-complete", false]]);
  assert.ok(res.ressources.every((r) => r.url.startsWith("/api/ressources/")));
  assert.equal((await G.req("GET", "/api/ressources/res-libre/fichier")).statut, 302);
  assert.equal((await G.req("GET", "/api/ressources/res-audit/fichier")).statut, 403);
  const ev = res.evenements.find((e) => e.id === "20000000-0000-0000-0000-000000000002");
  assert.equal(ev.zoom_url, null);
  assert.equal((await G.req("POST", "/api/inscriptions/20000000-0000-0000-0000-000000000002")).statut, 403);
});

test("formule visibilité : ressources « audit » ouvertes, « complète » et studios fermés", async () => {
  const V = await membre("V");
  assert.equal(V.moi.formule, "intermediaire");
  const f = await V.req("GET", "/api/ressources/res-audit/fichier");
  assert.equal(f.statut, 302); assert.match(f.r.headers.get("location"), /^https:\/\/htyvaqxdfptgswvwqplq\.supabase\.co\//);
  assert.equal((await V.req("GET", "/api/ressources/res-complete/fichier")).statut, 403);
  assert.equal((await V.req("POST", "/api/fonctions/redacteur-pages", {})).statut, 403);
});

test("relais des fonctions : jeton MPB transmis côté serveur, liste fermée, aucun cookie", async () => {
  fonctions.recu.length = 0;
  const r = await A.req("POST", "/api/fonctions/studio-contenu", { action: "etat" });
  assert.equal(r.statut, 200);
  const appel = fonctions.recu.at(-1);
  assert.equal(appel.chemin, "/functions/v1/studio-contenu");
  assert.ok([...pro.etat.jetons.keys()].some((j) => appel.auth === `Bearer ${j}`), "bearer = jeton MPB opaque");
  assert.equal(appel.cookie, undefined);
  assert.deepEqual(appel.corps, { action: "etat" });
  assert.equal((await A.req("POST", "/api/fonctions/ranger-ressources", {})).statut, 404);
  assert.equal((await A.req("POST", "/api/fonctions/..%2Fautre", {})).statut, 404);
  assert.equal((await A.req("GET", "/api/fonctions/studio-contenu")).statut, 405);
});

test("compte historique : rattachement nécessaire, jamais automatique, puis accès aux anciennes données après rattachement", async () => {
  const H = await membre("H");
  assert.equal(H.moi.etat_compte, "rattachement_necessaire");
  assert.equal((await H.req("GET", "/api/bilan")).corps.erreur, "rattachement_necessaire");
  assert.equal((await H.req("POST", "/api/bilans")).statut, 403);
  const { rows } = await outil.pool.query(`select candidats from mpb_prive.rattachements_attente where mpb_subject = 'H'`);
  assert.deepEqual(rows[0].candidats, ["00000000-0000-0000-0000-0000000000aa"]);
  // Procédure d'équipe, journalisée
  await outil.pool.query(`select mpb_prive.rattacher($1, 'H', '00000000-0000-0000-0000-0000000000aa', 'amelie', 'appel de vérification')`, [pro.etat.iss]);
  const H2 = await membre("H");
  assert.equal(H2.moi.etat_compte, "actif");
  const lu = (await H2.req("GET", "/api/bilan")).corps;
  assert.equal(lu.bilan.id, "10000000-0000-0000-0000-0000000000aa", "le bilan historique est retrouvé avec son UUID");
});

test("stockage du navigateur : clé propre à chaque membre, jamais l'identifiant du membre", async () => {
  assert.match(A.moi.cle_stockage, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(A.moi.cle_stockage, B.moi.cle_stockage);
  const { rows } = await outil.pool.query(`select member_id::text from mpb_prive.correspondances`);
  assert.ok(rows.every((r) => r.member_id !== A.moi.cle_stockage));
});

test("limite de bilans : au plus 10 nouveaux bilans par mois", async () => {
  const L = await membre("V");
  let dernier;
  for (let i = 0; i < 11; i++) dernier = await L.req("POST", "/api/bilans");
  assert.equal(dernier.statut, 429);
});

test("fonction qui refuse le jeton : session locale détruite", async () => {
  const S = await membre("A");
  const id = S.nav.entete(outil.origin).split("; ").map((x) => x.split("=")).find(([k]) => k === outil.config.nomCookie)[1];
  const { empreinte } = await import("../src/outils.js");
  fonctions.statut = 401;
  const r = await S.req("POST", "/api/fonctions/studio-contenu", {});
  fonctions.statut = 200;
  assert.equal(r.statut, 401);
  const { rowCount } = await outil.pool.query(`select 1 from mpb_prive.sessions where id_hash = $1`, [empreinte(id)]);
  assert.equal(rowCount, 0);
});
