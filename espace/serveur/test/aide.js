// Outils de test : base Postgres jetable (schéma de production + migrations 0037/0038), faux Pro, faux serveur de fonctions.
import http from "node:http";
import { execFileSync } from "node:child_process";
import { randomBytes, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { lireConfig } from "../src/config.js";
import { creerPool, creerStockage } from "../src/stockage.js";
import { creerClientPro } from "../src/pro.js";
import { creerServeur } from "../src/app.js";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PGURL = process.env.PGURL || "postgres://postgres@localhost:54329";

export function creerBase() {
  const nom = "mpb_test_" + randomBytes(5).toString("hex");
  execFileSync("psql", [`${PGURL}/postgres`, "-qc", `create database ${nom}`]);
  const f = (p) => ["-f", join(RACINE, p)];
  execFileSync("psql", [`${PGURL}/${nom}`, "-q", "-v", "ON_ERROR_STOP=1",
    ...f("tests/db/00_supabase_simule.sql"), ...f("tests/db/01_schema_production_2026-10-28.sql"), ...f("tests/db/02_rls_droits_production.sql"),
    ...f("tests/db/donnees_historiques.sql"), ...f("serveur/test/catalogue_test.sql"),
    ...f("supabase/migrations/0037_registre_membres_sso.sql"), ...f("supabase/migrations/0038_bascule_connexion_pro.sql")], { stdio: ["ignore", "ignore", "pipe"] });
  return { url: `${PGURL}/${nom}`, supprimer: () => execFileSync("psql", [`${PGURL}/postgres`, "-qc", `drop database if exists ${nom} with (force)`]) };
}

const ecouter = (srv) => new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv.address().port)));

// Faux Pro conforme au contrat (codes 60 s à usage unique, PKCE S256, Basic, jetons opaques, révocation)
export async function demarrerFauxPro() {
  const etat = {
    comptes: new Map(),           // sub -> { email, name, droits, actif, fiche }
    connecte: null,               // sub connecté dans le navigateur Pro (null = écran de connexion)
    codes: new Map(), jetons: new Map(), revoques: [], panne: false, chromeInvalide: false,
    appels: [], secret: "s".repeat(40), clientId: "espace-visibilite", iss: "https://pro.test",
  };
  let base;
  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, base);
    etat.appels.push({ chemin: url.pathname, auth: req.headers.authorization || "", cookie: req.headers.cookie || "" });
    const json = (s, o) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(o === undefined ? "" : JSON.stringify(o)); };
    if (etat.panne && url.pathname.startsWith("/api/")) { res.writeHead(503); return res.end(); }
    if (url.pathname === "/connexion/outils/autoriser") {
      const p = url.searchParams;
      if (p.get("client_id") !== etat.clientId || p.get("redirect_uri") !== etat.redirectUri || p.get("code_challenge_method") !== "S256"
        || !/^[A-Za-z0-9_-]{43}$/.test(p.get("code_challenge") || "") || (p.get("state") || "").length < 32) { res.writeHead(400); return res.end("paramètres invalides"); }
      if (!etat.connecte) { res.writeHead(200); return res.end("ecran de connexion pro"); }
      const code = randomBytes(32).toString("base64url");
      etat.codes.set(code, { sub: etat.connecte, challenge: p.get("code_challenge"), expire: Date.now() + 60_000, utilise: false });
      const cb = new URL(etat.redirectUri); cb.search = new URLSearchParams({ code, state: p.get("state"), iss: etat.iss }).toString(); cb.hash = "_";
      res.writeHead(302, { Location: cb.toString() }); return res.end();
    }
    if (url.pathname === "/api/pro-integration/token" && req.method === "POST") {
      let corps = ""; for await (const m of req) corps += m;
      const attendu = "Basic " + Buffer.from(`${etat.clientId}:${etat.secret}`).toString("base64");
      if (req.headers.authorization !== attendu) return json(401, { error: "invalid_client" });
      const p = new URLSearchParams(corps); const c = etat.codes.get(p.get("code"));
      if (!c || c.utilise || c.expire < Date.now() || p.get("redirect_uri") !== etat.redirectUri
        || createHash("sha256").update(p.get("code_verifier") || "").digest("base64url") !== c.challenge) return json(400, { error: "invalid_grant" });
      c.utilise = true;
      const jeton = randomBytes(32).toString("base64url");
      etat.jetons.set(jeton, { sub: c.sub, actif: true });
      return json(200, { access_token: jeton, token_type: "Bearer", expires_in: etat.dureeJeton || 28800, scope: "profile" });
    }
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || "")?.[1];
    const j = bearer && etat.jetons.get(bearer);
    const compte = j && etat.comptes.get(j.sub);
    if (url.pathname === "/api/pro-integration/session") {
      if (!j || !j.actif || !compte?.actif) return json(401, { error: "invalid_token" });
      return json(200, {
        active: true, iss: etat.iss, sub: j.sub, email: compte.email, email_verified: true, name: compte.name,
        account_plan: "pro", subscription_plan: compte.droits.studios ? "studios" : compte.droits.training ? "visibilite" : null,
        photographer_id: 42, entitlements: compte.droits,
        links: { dashboard: base + "/espace", profile_edit: base + "/espace/profil", public_profile: compte.fiche ?? null, logout: base + "/deconnexion" },
      });
    }
    if (url.pathname === "/api/pro-integration/chrome") {
      if (!j || !j.actif) return json(401, { error: "invalid_token" });
      if (etat.chromeInvalide) return json(200, { version: 1, integration_mode: "document", header_html: "", footer_html: "", stylesheets: ["https://pirate.example/x.css"], scripts: [], body_classes: [], logout_url: "/auth/logout", cookie_settings_event: "mpb:cookie-settings" });
      return json(200, {
        version: 1, integration_mode: "document",
        header_html: `<header class="pro-header"><a href="${base}/espace">Espace</a><a href="/auth/logout">Se déconnecter</a></header>`,
        footer_html: `<footer class="pro-footer"><button type="button" data-cookies>Cookies</button></footer>`,
        stylesheets: [base + "/assets/pro.css"], scripts: [base + "/assets/remote-chrome.js"], body_classes: ["brand-site", "member-area"],
        logout_url: "/auth/logout", cookie_settings_event: "mpb:cookie-settings",
      });
    }
    if (url.pathname === "/api/pro-integration/revoke" && req.method === "POST") {
      if (!j || !j.actif) return json(401, { error: "invalid_token" });
      j.actif = false; etat.revoques.push(bearer); res.writeHead(204); return res.end();
    }
    if (url.pathname === "/assets/pro.css") { res.writeHead(200, { "Content-Type": "text/css" }); return res.end(etat.cssPro || ".pro-header{display:flex;gap:16px;padding:16px;border-bottom:1px solid #ebdcda;font-family:Mulish}.pro-footer{padding:24px;border-top:1px solid #ebdcda;margin-top:40px}"); }
    if (url.pathname === "/assets/remote-chrome.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end("window.MPBProChrome={init(){document.querySelectorAll('[data-cookies]').forEach(function(b){b.onclick=function(){document.dispatchEvent(new CustomEvent('mpb:cookie-settings'))}})}};window.MPBProChrome.init();"); }
    if (url.pathname === "/deconnexion") { res.writeHead(200); return res.end("deconnecte du pro"); }
    res.writeHead(404); res.end();
  });
  const port = await ecouter(srv);
  base = `http://127.0.0.1:${port}`;
  etat.base = base;
  return { etat, base, fermer: () => new Promise((ok) => { srv.closeAllConnections?.(); srv.close(ok); }) };
}

// Faux serveur des Edge Functions : vérifie qu'il reçoit le jeton MPB (jamais un JWT Supabase) et renvoie un écho
export async function demarrerFaussesFonctions() {
  const recu = []; let etat;
  const srv = http.createServer(async (req, res) => {
    let corps = ""; for await (const m of req) corps += m;
    recu.push({ chemin: req.url, auth: req.headers.authorization, corps: corps ? JSON.parse(corps) : null, cookie: req.headers.cookie });
    res.writeHead(etat.statut, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok: true, chemin: req.url }));
  });
  const port = await ecouter(srv);
  return etat = { statut: 200, recu, url: `http://127.0.0.1:${port}`, fermer: () => new Promise((ok) => { srv.closeAllConnections?.(); srv.close(ok); }) };
}

export async function demarrerOutil({ pro, fonctions, dbUrl, env = {} }) {
  const port = await new Promise((ok) => { const s = http.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => ok(p)); }); });
  const appOrigin = `http://localhost:${port}`;
  pro.etat.redirectUri = `${appOrigin}/auth/callback`;
  const config = lireConfig({
    NODE_ENV: "test", APP_ORIGIN: appOrigin, MPB_PRO_ORIGIN: pro.base, MPB_CLIENT_ID: "espace-visibilite", MPB_CLIENT_SECRET: pro.etat.secret,
    MPB_REDIRECT_URI: `${appOrigin}/auth/callback`, SESSION_STORE_URL: dbUrl, SESSION_ENCRYPTION_KEY: randomBytes(32).toString("hex"),
    SUPABASE_URL: fonctions?.url || "http://127.0.0.1:9", MPB_TIMEOUT_MS: "1500", MPB_ISSUER: pro.etat.iss, MPB_LIMITE_CONNEXIONS: "1000", ...env,
  });
  // En test, les fonctions sont jointes sur l'URL du faux serveur
  const cfg = Object.freeze({ ...config, fonctionsUrl: (fonctions?.url || "http://127.0.0.1:9") + "/functions/v1" });
  const pool = creerPool(cfg);
  const stockage = creerStockage(cfg, pool);
  const serveur = creerServeur({ config: cfg, stockage, pro: creerClientPro(cfg) });
  await new Promise((ok) => serveur.listen(port, "localhost", ok));
  return { config: cfg, pool, stockage, origin: appOrigin, fermer: async () => { serveur.closeAllConnections?.(); await new Promise((ok) => serveur.close(ok)); await pool.end(); } };
}

// Navigateur minimal : jarre de cookies par origine, redirections manuelles
export class Navigateur {
  constructor() { this.cookies = new Map(); this.stockage = new Map(); }
  entete(url) {
    const h = new URL(url).host; const jar = this.cookies.get(h); if (!jar) return undefined;
    return [...jar].map(([k, v]) => `${k}=${v}`).join("; ") || undefined;
  }
  enregistrer(url, res) {
    const h = new URL(url).host; const jar = this.cookies.get(h) || new Map(); this.cookies.set(h, jar);
    for (const c of res.headers.getSetCookie?.() || []) {
      const [paire, ...attrs] = c.split(";"); const i = paire.indexOf("="); const k = paire.slice(0, i).trim(), v = paire.slice(i + 1).trim();
      if (attrs.some((a) => /max-age=0/i.test(a.trim())) || v === "") jar.delete(k); else jar.set(k, v);
    }
  }
  async aller(url, init = {}) {
    const headers = { ...(init.headers || {}) }; const c = this.entete(url); if (c) headers.cookie = c;
    const res = await fetch(url, { ...init, headers, redirect: "manual" });
    this.enregistrer(url, res);
    return res;
  }
  // Suit les redirections (avec le fragment, comme un navigateur) jusqu'à une page finale
  async suivre(url, max = 8) {
    let courant = url, res, fragment = "";
    for (let i = 0; i < max; i++) {
      res = await this.aller(courant);
      const loc = res.headers.get("location");
      if (!loc || res.status < 300 || res.status >= 400) break;
      const suivant = new URL(loc, courant);
      fragment = suivant.hash || fragment; suivant.hash = "";
      courant = suivant.toString();
    }
    return { res, url: courant, fragment, texte: await res.text() };
  }
}

export const DROITS = {
  gratuit: { analysis: true, training: false, studios: false },
  visibilite: { analysis: true, training: true, studios: false },
  studios: { analysis: true, training: true, studios: true },
};
