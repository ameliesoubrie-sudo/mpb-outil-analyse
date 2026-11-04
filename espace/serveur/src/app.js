// Serveur HTTP de l'outil (BFF) : connexion par le compte Pro, sessions, routes métier, relais des Edge Functions.
import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import {
  aleatoire, challengeS256, egalConstant, hmac, lireCookies, cookie, cookieEfface, destinationInterne, journal,
} from "./outils.js";
import { ProIndisponible, ProRefus } from "./pro.js";
import { routesMetier, ErreurMetier, FONCTIONS, fichierRessource } from "./metier.js";
import { pageAmorce, pageErreurConnexion, pageIndisponible, pageDeconnexion, pageSortie, pageOutil } from "./pages.js";

const ICI = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(ICI, "..", "..", "public");
const LIMITE_JSON = 512 * 1024;
const LIMITE_FONCTION = 15 * 1024 * 1024;
const ID_COOKIE = /^[A-Za-z0-9_-]{43}$/;

class ErreurHttp extends Error { constructor(statut, code, message) { super(message); this.statut = statut; this.code = code; } }

function chargerStatiques() {
  const fichiers = {};
  for (const [chemin, type] of [["app.js", "text/javascript; charset=utf-8"], ["app.css", "text/css; charset=utf-8"], ["page.css", "text/css; charset=utf-8"]]) {
    const p = join(PUBLIC, chemin);
    if (!existsSync(p)) continue;
    const contenu = readFileSync(p);
    fichiers["/static/" + chemin] = { contenu, type, etag: `"${createHash("sha256").update(contenu).digest("base64url").slice(0, 16)}"` };
  }
  const modele = existsSync(join(PUBLIC, "app-modele.html")) ? readFileSync(join(PUBLIC, "app-modele.html"), "utf8") : "<div>Outil absent</div>";
  const version = createHash("sha256").update(Object.values(fichiers).map((f) => f.etag).join("")).digest("base64url").slice(0, 10);
  return { fichiers, modele, version };
}

export function creerServeur({ config, stockage, pro, fetchImpl = fetch }) {
  const statiques = chargerStatiques();
  const routes = routesMetier({ pool: stockage.pool });
  const csrfDe = (idSession) => hmac(config.cleChiffrement, "csrf:" + idSession);
  const cleStockageDe = (memberId) => hmac(config.cleChiffrement, "stockage:" + memberId).slice(0, 22);
  const hoteAttendu = new URL(config.appOrigin).host;

  function csp(nonce) {
    const pro = config.proOrigin;
    const img = ["'self'", "data:", "blob:", pro, config.supabaseUrl, ...config.imagesExtra].join(" ");
    return [
      "default-src 'none'",
      `script-src 'self' ${pro} 'nonce-${nonce}'`,
      `style-src 'self' ${pro} https://fonts.googleapis.com 'unsafe-inline'`,
      `font-src ${pro} https://fonts.gstatic.com data:`,
      `img-src ${img}`,
      "connect-src 'self'",
      "media-src 'self' blob:",
      "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
      `form-action 'self' ${pro}`,
      "base-uri 'none'", "object-src 'none'", "frame-ancestors 'none'",
    ].join("; ");
  }

  function envoyer(res, statut, corps, entetes = {}) {
    if (res.headersSent) return;
    const base = {
      "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin", "Cross-Origin-Opener-Policy": "same-origin",
      "Permissions-Policy": "camera=(), geolocation=(), payment=(), microphone=(self)",
    };
    if (config.cookieSecure) base["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    res.writeHead(statut, { ...base, ...entetes });
    res.end(corps);
  }
  const json = (res, statut, obj, entetes = {}) => envoyer(res, statut, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", ...entetes });
  const html = (res, page, nonce, entetes = {}) => envoyer(res, page.statut, page.html, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": csp(nonce), ...entetes });

  async function lireCorps(req, limite) {
    const morceaux = []; let taille = 0;
    for await (const m of req) {
      taille += m.length;
      if (taille > limite) throw new ErreurHttp(413, "trop_volumineux", "Contenu trop volumineux.");
      morceaux.push(m);
    }
    return Buffer.concat(morceaux).toString("utf8");
  }
  async function lireJson(req, limite = LIMITE_JSON) {
    const type = String(req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (type !== "application/json") throw new ErreurHttp(415, "type_invalide", "Contenu JSON attendu.");
    const brut = await lireCorps(req, limite);
    if (!brut) return {};
    try { return JSON.parse(brut); } catch { throw new ErreurHttp(400, "json_invalide", "JSON invalide."); }
  }

  // Mutations : origine identique + jeton CSRF lié à la session (SameSite seul ne suffit pas entre sous-domaines)
  function verifierOrigine(req) {
    return req.headers.origin === config.appOrigin;
  }
  // Déconnexion : si le navigateur n'envoie pas Origin (réglage de confidentialité), le jeton CSRF lié à la session suffit ;
  // une origine présente et différente est toujours refusée
  const origineAcceptablePourFormulaire = (req) => req.headers.origin === undefined ? req.headers["sec-fetch-site"] !== "cross-site" : verifierOrigine(req);

  // Limite des démarrages de connexion (écriture en base sans authentification) : 30 par minute et par adresse par défaut
  const tentatives = new Map();
  function tropDeTentatives(req) {
    const ip = (config.proxiesDeConfiance.includes(req.socket.remoteAddress) && String(req.headers["x-forwarded-for"] || "").split(",").pop().trim()) || req.socket.remoteAddress || "?";
    const maintenant = Date.now(), t = tentatives.get(ip) || { n: 0, debut: maintenant };
    if (maintenant - t.debut > 60_000) { t.n = 0; t.debut = maintenant; }
    t.n++; tentatives.set(ip, t);
    if (tentatives.size > 10_000) for (const [k, v] of tentatives) if (maintenant - v.debut > 60_000) tentatives.delete(k);
    return t.n > config.limiteConnexionsParMinute;
  }

  // ---------- Session : vérifiée auprès du Pro à CHAQUE requête privée, sans cache d'autorisation ----------
  async function verifierSession(req, res) {
    const id = lireCookies(req.headers.cookie).get(config.nomCookie);
    if (!id || !ID_COOKIE.test(id)) return { etat: "absente" };
    const s = await stockage.lireSession(id);
    if (!s) { effacerCookieSession(res); return { etat: "absente" }; }
    if (s.expiree) { await detruire(id, res, false); return { etat: "expiree" }; }
    let profil;
    try { profil = await pro.session(s.jeton); }
    catch (e) {
      if (e instanceof ProRefus) { await detruire(id, res); return { etat: "revoquee" }; }
      return { etat: "indisponible" };
    }
    if (profil.iss !== s.iss || profil.sub !== s.sub) { await detruire(id, res); return { etat: "revoquee" }; }
    const memberId = await stockage.membrePour(profil.iss, profil.sub);
    if (memberId !== s.memberId) await stockage.majMembreSession(id, memberId);
    return { etat: "ok", id, session: s, profil, memberId };
  }
  const sessionsAEffacer = new WeakMap();
  function effacerCookieSession(res, subie = false) { sessionsAEffacer.set(res, subie || sessionsAEffacer.get(res) === "subie" ? "subie" : "simple"); }
  async function detruire(id, res, subie = true) { await stockage.supprimerSession(id); effacerCookieSession(res, subie); }
  function cookiesSortants(res, extra = []) {
    const c = [...extra];
    const fin = sessionsAEffacer.get(res);
    if (fin) c.push(cookieEfface(config, config.nomCookie));
    if (fin === "subie") c.push(cookie(config, config.nomCookieFin, "1", { maxAge: 600 }));
    return c.length ? { "Set-Cookie": c } : {};
  }
  const finSubie = (req) => lireCookies(req.headers.cookie).get(config.nomCookieFin) === "1";

  // ---------- /auth/login ----------
  async function login(req, res, url, nonce) {
    const params = [...url.searchParams.keys()];
    const destination = destinationInterne(params.length === 1 && params[0] === "retour" && url.searchParams.getAll("retour").length === 1 ? url.searchParams.get("retour") : "/");
    const v = await verifierSession(req, res);
    if (v.etat === "ok") return envoyer(res, 303, "", { Location: destination, ...cookiesSortants(res) });
    if (v.etat === "indisponible") return html(res, pageIndisponible({ nonce, retour: "/auth/login" }), nonce, cookiesSortants(res));
    if (tropDeTentatives(req)) return envoyer(res, 429, "Trop de tentatives de connexion. Réessayez dans une minute.", { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "60" });
    const state = aleatoire(32), verifier = aleatoire(48);
    let navigateur = lireCookies(req.headers.cookie).get(config.nomCookieTx);
    if (!navigateur || !ID_COOKIE.test(navigateur)) navigateur = aleatoire(32);
    await stockage.creerTransaction({ state, navigateur, verifier, destination });
    const autoriser = new URL("/connexion/outils/autoriser", config.proOrigin);
    autoriser.search = new URLSearchParams({
      response_type: "code", client_id: config.clientId, redirect_uri: config.redirectUri,
      state, code_challenge: challengeS256(verifier), code_challenge_method: "S256",
    }).toString();
    envoyer(res, 303, "", { Location: autoriser.toString(), ...cookiesSortants(res, [cookie(config, config.nomCookieTx, navigateur, { maxAge: config.dureeTransactionS }), cookieEfface(config, config.nomCookieFin)]) });
  }

  // ---------- /auth/callback ----------
  async function callback(req, res, url, nonce) {
    const entetes = { "Referrer-Policy": "no-referrer" };
    const echec = (raison) => { journal("info", "callback refusé", { raison }); return html(res, pageErreurConnexion({ nonce }), nonce, entetes); };
    const cles = [...url.searchParams.keys()];
    const attendues = ["code", "iss", "state"];
    if (cles.length !== 3 || [...cles].sort().join() !== attendues.join()) return echec("paramètres inattendus");
    const code = url.searchParams.get("code"), state = url.searchParams.get("state"), iss = url.searchParams.get("iss");
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(state) || !/^[A-Za-z0-9._~-]{16,512}$/.test(code)) return echec("format");
    if (iss !== config.issuer) return echec("émetteur");
    const navigateur = lireCookies(req.headers.cookie).get(config.nomCookieTx);
    if (!navigateur || !ID_COOKIE.test(navigateur)) return echec("navigateur");
    const tx = await stockage.consommerTransaction({ state, navigateur });
    if (!tx) return echec("transaction");
    let echange, profil;
    try {
      echange = await pro.echangerCode({ code, codeVerifier: tx.verifier });
      profil = await pro.session(echange.jeton);
    } catch (e) {
      if (e instanceof ProIndisponible) return html(res, pageIndisponible({ nonce, retour: "/auth/login", polices: false }), nonce, entetes);
      return echec("échange ou session");
    }
    const { memberId } = await stockage.resoudreMembre({ iss: profil.iss, sub: profil.sub, email: profil.email, nom: profil.nom });
    // Remplacement de session : révoque l'ancienne autorisation et renouvelle l'identifiant du cookie
    const ancien = lireCookies(req.headers.cookie).get(config.nomCookie);
    if (ancien && ID_COOKIE.test(ancien)) {
      const s = await stockage.lireSession(ancien);
      if (s) { try { await pro.revoquer(s.jeton); } catch { journal("erreur", "révocation de l'ancienne session impossible"); } await stockage.supprimerSession(ancien); }
    }
    const id = aleatoire(32);
    await stockage.creerSession({ id, iss: profil.iss, sub: profil.sub, memberId, jeton: echange.jeton, expireDansS: echange.expireDansS });
    envoyer(res, 303, "", { ...entetes, Location: tx.destination, "Set-Cookie": [cookie(config, config.nomCookie, id, { maxAge: echange.expireDansS })] });
  }

  // ---------- /auth/logout ----------
  async function logoutGet(req, res, nonce) {
    const id = lireCookies(req.headers.cookie).get(config.nomCookie);
    const s = id && ID_COOKIE.test(id) ? await stockage.lireSession(id) : null;
    html(res, pageDeconnexion({ nonce, csrf: s ? csrfDe(id) : "" }), nonce);
  }
  async function logoutPost(req, res, nonce) {
    const urlPro = new URL("/deconnexion", config.proOrigin).toString();
    if (!origineAcceptablePourFormulaire(req)) return html(res, pageErreurConnexion({ nonce }), nonce);
    const type = String(req.headers["content-type"] || "").split(";")[0].trim();
    if (type !== "application/x-www-form-urlencoded") return html(res, pageErreurConnexion({ nonce }), nonce);
    const corps = new URLSearchParams(await lireCorps(req, 4096));
    const id = lireCookies(req.headers.cookie).get(config.nomCookie);
    const s = id && ID_COOKIE.test(id) ? await stockage.lireSession(id) : null;
    if (s) {
      if (corps.getAll("csrf").length !== 1 || !egalConstant(corps.get("csrf"), csrfDe(id))) return html(res, pageErreurConnexion({ nonce }), nonce);
      try { await pro.revoquer(s.jeton); } catch { journal("erreur", "révocation distante impossible lors de la déconnexion"); }
      await stockage.supprimerSession(id);
    }
    html(res, pageSortie({ nonce, urlPro }), nonce, {
      "Set-Cookie": [cookieEfface(config, config.nomCookie), cookieEfface(config, config.nomCookieTx), cookieEfface(config, config.nomCookieFin)],
      "Clear-Site-Data": '"cache", "storage"',
    });
  }

  // ---------- Page de l'outil ----------
  async function accueil(req, res, nonce) {
    const v = await verifierSession(req, res);
    if (v.etat === "indisponible") return html(res, pageIndisponible({ nonce }), nonce, cookiesSortants(res));
    if (v.etat !== "ok") {
      const automatique = (v.etat === "absente" && !finSubie(req)) || v.etat === "expiree";
      return html(res, pageAmorce({ nonce, automatique }), nonce, cookiesSortants(res));
    }
    let chrome;
    try { chrome = await pro.chrome(v.session.jeton); }
    catch (e) {
      if (e instanceof ProRefus) { await detruire(v.id, res); return html(res, pageAmorce({ nonce, automatique: false }), nonce, cookiesSortants(res)); }
      return html(res, pageIndisponible({ nonce }), nonce, cookiesSortants(res));
    }
    const donnees = { evenementCookies: chrome.evenementCookies };
    html(res, pageOutil({ chrome, modele: statiques.modele, nonce, donnees, versionStatique: statiques.version }), nonce, cookiesSortants(res));
  }

  // ---------- API ----------
  function moi(v) {
    const d = v.profil.droits;
    return {
      nom: v.profil.nom,
      droits: d,
      // Nom d'affichage seulement : chaque route contrôle le droit précis
      formule: d.studios ? "complete" : d.training ? "intermediaire" : "gratuite",
      etat_compte: v.memberId ? "actif" : "rattachement_necessaire",
      liens: { tableau_de_bord: v.profil.liens.tableauDeBord, modifier_fiche: v.profil.liens.modifierFiche, fiche_publique: v.profil.liens.fichePublique },
      csrf: csrfDe(v.id),
      cle_stockage: v.memberId ? cleStockageDe(v.memberId) : null,
      expire_le: v.session.expireLe,
    };
  }

  async function api(req, res, url) {
    const v = await verifierSession(req, res);
    const sortie = (statut, obj) => json(res, statut, obj, cookiesSortants(res));
    if (v.etat === "indisponible") return sortie(503, { erreur: "pro_indisponible", message: "Service momentanément indisponible. Réessayez dans un instant." });
    if (v.etat !== "ok") return sortie(401, { erreur: v.etat === "expiree" ? "session_expiree" : v.etat === "revoquee" ? "session_revoquee" : "non_connecte", reconnexion: "/auth/login" });

    const mutation = !["GET", "HEAD"].includes(req.method);
    if (mutation) {
      const jeton = req.headers["x-csrf-token"];
      if (!verifierOrigine(req) || typeof jeton !== "string" || !egalConstant(jeton, csrfDe(v.id))) return sortie(403, { erreur: "csrf", message: "Requête refusée. Rechargez la page." });
    }
    const ctx = { memberId: v.memberId, profil: v.profil };

    if (url.pathname === "/api/moi" && req.method === "GET") return sortie(200, moi(v));

    const fichier = /^\/api\/ressources\/([^/]+)\/fichier$/.exec(url.pathname);
    if (fichier && req.method === "GET") {
      const cible = await fichierRessource({ pool: stockage.pool }, ctx, decodeURIComponent(fichier[1]));
      return envoyer(res, 302, "", { Location: cible, ...cookiesSortants(res) });
    }

    const fn = /^\/api\/fonctions\/([a-z-]+)$/.exec(url.pathname);
    if (fn) {
      if (req.method !== "POST") throw new ErreurHttp(405, "methode", "Méthode non autorisée.");
      const droit = FONCTIONS[fn[1]];
      if (!droit) throw new ErreurHttp(404, "introuvable", "Élément introuvable.");
      if (!v.profil.droits[droit]) return sortie(403, { erreur: "droit_insuffisant", message: "Cette fonctionnalité n'est pas incluse dans votre formule." });
      if (!v.memberId) return sortie(403, { erreur: "rattachement_necessaire", message: "Votre compte doit d'abord être rattaché." });
      const corps = await lireJson(req, LIMITE_FONCTION);
      if (typeof corps !== "object" || corps === null || Array.isArray(corps)) throw new ErreurHttp(400, "json_invalide", "Objet JSON attendu.");
      let r;
      try {
        r = await fetchImpl(`${config.fonctionsUrl}/${fn[1]}`, {
          method: "POST", redirect: "manual", signal: AbortSignal.timeout(config.delaiFonctionsMs),
          headers: { Authorization: `Bearer ${v.session.jeton}`, "Content-Type": "application/json" },
          body: JSON.stringify(corps),
        });
      } catch { return sortie(504, { erreur: "fonction_indisponible", message: "Notre outil met trop de temps à répondre. Réessayez." }); }
      const texte = (await r.text()).slice(0, 5_000_000);
      let out; try { out = JSON.parse(texte); } catch { out = { error: "Réponse illisible." }; }
      if (r.status === 401) { await detruire(v.id, res); return sortie(401, { erreur: "session_revoquee", reconnexion: "/auth/login" }); }
      if (r.status >= 200 && r.status < 300) return sortie(200, out);
      if (r.status >= 500) return sortie(502, { erreur: "fonction_erreur", message: typeof out.error === "string" ? out.error.slice(0, 500) : "Une erreur est survenue. Réessayez." });
      return sortie(r.status, { erreur: "fonction_refus", message: typeof out.error === "string" ? out.error.slice(0, 500) : "Requête refusée." });
    }

    for (const [methode, motif, droit, gestion] of routes) {
      const m = motif.exec(url.pathname);
      if (!m || methode !== req.method) continue;
      if (droit && !v.profil.droits[droit]) return sortie(403, { erreur: "droit_insuffisant", message: "Cette fonctionnalité n'est pas incluse dans votre formule." });
      if (droit && !v.memberId) return sortie(403, { erreur: "rattachement_necessaire", message: "Votre compte doit d'abord être rattaché." });
      const corps = mutation ? await lireJson(req) : undefined;
      return sortie(200, await gestion(ctx, m.slice(1).map(decodeURIComponent), corps, url));
    }
    throw new ErreurHttp(404, "introuvable", "Élément introuvable.");
  }

  async function traiter(req, res) {
    const nonce = aleatoire(18);
    const url = new URL(req.url, config.appOrigin);
    if (url.pathname === "/sante") return envoyer(res, 200, "ok", { "Content-Type": "text/plain" });
    if (req.headers.host !== hoteAttendu) return envoyer(res, 421, "Hôte inattendu", { "Content-Type": "text/plain" });
    try {
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (req.method === "GET" && url.pathname === "/auth/login") return await login(req, res, url, nonce);
      if (req.method === "GET" && url.pathname === "/auth/callback") return await callback(req, res, url, nonce);
      if (req.method === "GET" && url.pathname === "/auth/logout") return await logoutGet(req, res, nonce);
      if (req.method === "POST" && url.pathname === "/auth/logout") return await logoutPost(req, res, nonce);
      if (req.method === "GET" && url.pathname === "/") return await accueil(req, res, nonce);
      const st = statiques.fichiers[url.pathname];
      if (st && req.method === "GET") {
        if (req.headers["if-none-match"] === st.etag) return envoyer(res, 304, "", { ETag: st.etag, "Cache-Control": "no-cache" });
        return envoyer(res, 200, st.contenu, { "Content-Type": st.type, ETag: st.etag, "Cache-Control": "no-cache" });
      }
      envoyer(res, 404, "Page introuvable", { "Content-Type": "text/plain; charset=utf-8" });
    } catch (e) {
      if (e instanceof ErreurHttp || e instanceof ErreurMetier) return json(res, e.statut, { erreur: e.code, message: e.message }, cookiesSortants(res));
      journal("erreur", "erreur serveur", { chemin: url.pathname, type: e?.name, detail: e?.code || "" });
      if (url.pathname.startsWith("/api/")) return json(res, 500, { erreur: "serveur", message: "Une erreur est survenue. Réessayez." });
      envoyer(res, 500, "Erreur", { "Content-Type": "text/plain" });
    }
  }

  const serveur = http.createServer({ headersTimeout: 20_000, requestTimeout: 200_000 }, (req, res) => { traiter(req, res); });
  return serveur;
}
