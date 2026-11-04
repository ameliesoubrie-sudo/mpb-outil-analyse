// Recette navigateur (Chromium) de l'outil complet : faux Pro, serveur de l'outil, base locale avec le catalogue réel.
// Usage : node test/recette/recette.mjs <dossier de captures>
// Ne remplace pas la recette sur les deux domaines réels.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { creerBase, demarrerFauxPro, demarrerFaussesFonctions, demarrerOutil, DROITS } from "../aide.js";
import { semerCatalogue, semerBilanComplet } from "./semer.js";

const require = createRequire(import.meta.url);
const { chromium } = require(execSync("npm root -g").toString().trim() + "/playwright");
const SORTIE = process.argv[2] || "/tmp/recette-outil";
mkdirSync(SORTIE, { recursive: true });
const resultats = [];
const ok = (cond, nom, detail = "") => { resultats.push({ ok: !!cond, nom, detail }); console.log(`${cond ? "  ok " : "  ÉCHEC"} ${nom}${detail ? " : " + detail : ""}`); };

const base = creerBase();
const pro = await demarrerFauxPro();
const fonctions = await demarrerFaussesFonctions();
// CSS du Pro volontairement agressif : il ne doit pas déborder sur l'outil
pro.etat.cssPro = `
  .pro-header{display:flex;gap:16px;align-items:center;padding:18px 24px;border-bottom:1px solid #ebdcda;font-family:Mulish,sans-serif}
  .pro-footer{padding:32px 24px;border-top:1px solid #ebdcda;margin-top:48px;font-family:Mulish,sans-serif}
  *{letter-spacing:3px} a{color:rgb(0,128,0)} h1{color:rgb(0,0,255)} .bouton{background:rgb(255,0,0)!important} .conteneur{max-width:200px}
  main{border:5px solid rgb(255,0,0)} nav{background:rgb(255,255,0)}`;
const outil = await demarrerOutil({ pro, fonctions, dbUrl: base.url, env: { CSP_IMG_ORIGINS: "" } });
await semerCatalogue(outil.pool);
pro.etat.comptes.set("A", { email: "a@pro.test", name: "Alice", droits: { ...DROITS.studios }, actif: true, fiche: "https://www.monphotographebebe.fr/photographe/alice" });
pro.etat.comptes.set("G", { email: "g@pro.test", name: "Gaëlle", droits: { ...DROITS.gratuit }, actif: true });

const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const erreursConsole = [];
async function page(largeur = 1280) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|ERR_NAME|ERR_CONNECTION|Failed to load resource/.test(m.text())) erreursConsole.push(m.text()); });
  p.on("pageerror", (e) => erreursConsole.push("pageerror " + e.message));
  return { ctx, p };
}
const ombre = (p, sel) => p.evaluate((s) => !!document.getElementById("mpb-outil").shadowRoot.querySelector(s), sel);
const style = (p, sel, prop) => p.evaluate(([s, pr]) => { const el = document.getElementById("mpb-outil").shadowRoot.querySelector(s); return el ? getComputedStyle(el)[pr] : null; }, [sel, prop]);
const attendreOmbre = (p, sel) => p.waitForFunction((s) => document.getElementById("mpb-outil")?.shadowRoot?.querySelector(s), sel, { timeout: 15000 });

try {
  // ---------- 1. Arrivée directe sur un lien de mission, connexion SSO puis ouverture de la mission ----------
  pro.etat.connecte = "A";
  const { ctx, p } = await page(1280);
  await p.goto(outil.origin + "/");          // première ouverture : crée le membre
  await p.waitForSelector("#mpb-outil");
  const { rows: [{ member_id: idA }] } = await outil.pool.query(`select member_id from mpb_prive.correspondances where mpb_subject = 'A'`);
  await semerBilanComplet(outil.pool, idA);
  const { rows: [pm] } = await outil.pool.query(`select mission_id from public.bilan_plan_missions order by ordre limit 1`);
  await ctx.clearCookies();
  await p.goto("about:blank");
  await p.goto(`${outil.origin}/#mission-${pm.mission_id}`);
  await p.waitForURL((u) => u.pathname === "/" && u.origin === outil.origin, { timeout: 15000 });
  await attendreOmbre(p, ".mission-tete, .m-tete, #contenu");
  await p.waitForTimeout(600);
  ok(new URL(p.url()).hash === "", "lien #mission conservé à travers la connexion puis nettoyé", p.url());
  ok(await p.evaluate(() => !!document.querySelector(".pro-header") && !!document.querySelector(".pro-footer")), "header et footer du Pro dans le document principal");
  ok(await p.evaluate(() => document.body.classList.contains("member-area")), "classes du body appliquées");
  ok(await ombre(p, ".m-tete"), `mission ${pm.mission_id} ouverte directement`);
  await p.screenshot({ path: `${SORTIE}/01-mission-depuis-lien-1280.png`, fullPage: false });

  // ---------- 2. Isolation des styles ----------
  ok((await style(p, ".mpb-racine", "letterSpacing")) === "normal", "letter-spacing du Pro sans effet sur l'outil");
  const bp = await p.evaluate(() => { const b = document.getElementById("mpb-outil").shadowRoot.querySelector(".bouton.principal"); return b ? getComputedStyle(b).backgroundColor : "aucun"; });
  ok(bp !== "rgb(255, 0, 0)", "règle .bouton du Pro sans effet sur les boutons de l'outil", bp);
  ok((await style(p, "main", "borderTopWidth")) !== "5px", "règle main du Pro sans effet");
  ok((await style(p, ".conteneur", "maxWidth")) === "1240px", "largeur de l'outil : 1240 px");
  const h1Pro = await p.evaluate(() => { const h = document.createElement("h1"); h.textContent = "x"; document.querySelector(".pro-footer").append(h); const c = getComputedStyle(h).color; h.remove(); return c; });
  ok(h1Pro === "rgb(0, 0, 255)", "les styles du Pro s'appliquent toujours au chrome");
  const lienPro = await p.evaluate(() => getComputedStyle(document.querySelector(".pro-header a")).color);
  ok(lienPro === "rgb(0, 128, 0)", "les styles de l'outil ne touchent pas le header du Pro", lienPro);

  // ---------- 3. Programme, ressources, préférences cookies ----------
  await p.evaluate(() => document.getElementById("mpb-outil").shadowRoot.getElementById("nav-programme").click());
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${SORTIE}/02-programme-1280.png` });
  ok(await ombre(p, ".pg3, .programme, #contenu"), "programme affiché (formule studios)");
  await p.evaluate(() => document.getElementById("mpb-outil").shadowRoot.getElementById("nav-ressources").click());
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${SORTIE}/03-ressources-1280.png` });
  const liens = await p.evaluate(() => [...document.getElementById("mpb-outil").shadowRoot.querySelectorAll("a[href*='/api/ressources/']")].length);
  ok(liens > 0, "ressources servies par le serveur de l'outil (contrôle du droit)", `${liens} liens`);
  await p.click(".pro-footer [data-cookies]");
  await p.waitForTimeout(200);
  ok(await ombre(p, "#cookies-outil"), "bouton Cookies du footer : préférences de l'outil ouvertes");
  await p.screenshot({ path: `${SORTIE}/04-preferences-cookies-1280.png` });
  await p.keyboard.press("Escape");
  ok(!(await ombre(p, "#cookies-outil")), "préférences fermées au clavier (Échap)");
  // Aucun secret dans le navigateur
  const html = await p.content();
  const stockage = await p.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
  ok([...pro.etat.jetons.keys()].every((j) => !html.includes(j) && !stockage.includes(j)), "aucun jeton MPB dans la page, le stockage ou document.cookie");
  ok(!html.includes(pro.etat.secret) && !/eyJhbGciOi/.test(html) && !/supabase\.createClient/.test(html), "ni secret client, ni clé Supabase, ni client Supabase");
  await ctx.close();

  // ---------- 4. Téléphone ----------
  for (const largeur of [390, 768]) {
    const t = await page(largeur);
    await t.p.goto(outil.origin + "/");
    await t.p.waitForURL((u) => u.origin === outil.origin && u.pathname === "/", { timeout: 15000 });
    await attendreOmbre(t.p, "#app section, #app .carte");
    await t.p.waitForTimeout(600);
    const deborde = await t.p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(deborde <= 0, `aucun débordement horizontal à ${largeur} px`, `${deborde}px`);
    await t.p.screenshot({ path: `${SORTIE}/05-accueil-${largeur}.png`, fullPage: false });
    await t.ctx.close();
  }

  // ---------- 5. Formule gratuite : programme verrouillé ----------
  pro.etat.connecte = "G";
  const g = await page(1280);
  await g.p.goto(outil.origin + "/");
  await g.p.waitForURL((u) => u.origin === outil.origin && u.pathname === "/", { timeout: 15000 });
  await attendreOmbre(g.p, "#app .carte, #app .pile, #app section");
  await g.p.waitForTimeout(500);
  await g.p.screenshot({ path: `${SORTIE}/06-accueil-gratuit-1280.png` });
  await g.p.evaluate(() => { const r = document.getElementById("mpb-outil").shadowRoot; return r; });
  const verrou = await g.p.evaluate(async () => { const r = document.getElementById("mpb-outil").shadowRoot; const t = r.querySelector("#app").innerText; return /offres payantes/i.test(t); });
  ok(verrou, "formule gratuite : le parcours indique ce qui est réservé aux offres payantes");
  ok(await g.p.evaluate(() => document.getElementById("mpb-outil").shadowRoot.getElementById("nav-studio").hidden), "studio de création masqué en formule gratuite");

  // ---------- 6. Déconnexion commune ----------
  await g.p.click(".pro-header a[href='/auth/logout']");
  await g.p.waitForURL((u) => u.pathname === "/auth/logout");
  await g.p.screenshot({ path: `${SORTIE}/07-deconnexion-confirmation.png` });
  await g.p.click("button[type=submit]");
  await g.p.waitForURL((u) => u.pathname === "/deconnexion", { timeout: 10000 });
  ok(new URL(g.p.url()).origin === pro.base, "retour à la déconnexion du Pro");
  const rest = await g.ctx.cookies(outil.origin);
  ok(!rest.some((c) => c.name === outil.config.nomCookie), "cookie de session supprimé");
  await g.ctx.close();

  // ---------- 7. Panne du Pro ----------
  pro.etat.connecte = "A";
  const r = await page(1280);
  await r.p.goto(outil.origin + "/");
  await r.p.waitForURL((u) => u.origin === outil.origin && u.pathname === "/", { timeout: 15000 });
  await attendreOmbre(r.p, "#app");
  pro.etat.panne = true;
  await r.p.reload();
  ok((await r.p.textContent("h1")).includes("indisponible"), "panne du Pro : page d'indisponibilité avec « Réessayer »");
  await r.p.screenshot({ path: `${SORTIE}/08-pro-indisponible.png` });
  pro.etat.panne = false;
  await r.p.click("text=Réessayer");
  await attendreOmbre(r.p, "#app");
  ok(true, "retour à la normale après la panne, sans reconnexion");
  await r.ctx.close();

  ok(erreursConsole.length === 0, "aucune erreur JavaScript ni violation CSP dans la console", erreursConsole.slice(0, 5).join(" | "));
} catch (e) {
  ok(false, "déroulé de la recette", e.message.split("\n")[0]);
  for (const ctx of navigateur.contexts()) for (const pg of ctx.pages()) {
    console.log("  page ouverte :", pg.url());
    console.log("  ", (await pg.evaluate(() => (document.getElementById("mpb-outil")?.shadowRoot?.textContent || document.body.innerText).replace(/\s+/g, " ").slice(0, 400)).catch(() => "")));
    await pg.screenshot({ path: `${SORTIE}/echec.png` }).catch(() => {});
    console.log("  api bilan :", await pg.evaluate(() => fetch("/api/bilan").then((r) => r.text()).then((t) => t.slice(0, 300))).catch((e) => e.message));
  }
  console.log("  console :", erreursConsole.slice(0, 5));
} finally {
  writeFileSync(`${SORTIE}/resultats.json`, JSON.stringify(resultats, null, 2));
  await navigateur.close(); await outil.fermer(); await pro.fermer(); await fonctions.fermer(); base.supprimer();
  const echecs = resultats.filter((x) => !x.ok).length;
  console.log(`\n${resultats.length - echecs}/${resultats.length} contrôles réussis`);
  process.exit(echecs ? 1 : 0);
}
