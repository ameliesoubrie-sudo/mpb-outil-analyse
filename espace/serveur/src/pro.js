// Client du Pro (pro.monphotographebebe.fr) : échange de code, session, header/footer, révocation.
// Appels serveur à serveur uniquement : jamais de cookie Pro, délais bornés, aucune redirection suivie.
import { Buffer } from "node:buffer";
import { journal } from "./outils.js";

export class ProIndisponible extends Error { constructor(m) { super(m); this.name = "ProIndisponible"; } }
export class ProRefus extends Error { constructor(m, code) { super(m); this.name = "ProRefus"; this.code = code; } }

const URL_HTTPS = (v) => { try { const u = new URL(v); return u.protocol === "https:" ? u : null; } catch { return null; } };

export function creerClientPro(config, fetchImpl = fetch) {
  const base = config.proOrigin;
  const urlOk = (v, { origineImposee = true } = {}) => {
    const u = URL_HTTPS(v) || (config.modeTest ? (() => { try { const x = new URL(v); return x.protocol === "http:" && ["localhost", "127.0.0.1"].includes(x.hostname) ? x : null; } catch { return null; } })() : null);
    if (!u) return false;
    return origineImposee ? u.origin === base : true;
  };

  async function appel(chemin, init) {
    let r;
    try {
      r = await fetchImpl(base + chemin, { ...init, redirect: "manual", signal: AbortSignal.timeout(config.delaiProMs) });
    } catch (e) {
      journal("erreur", "pro injoignable", { chemin, type: e?.name });
      throw new ProIndisponible("Pro injoignable");
    }
    if (r.status >= 300 && r.status < 400) throw new ProIndisponible("redirection inattendue du Pro");
    return r;
  }
  const lireJson = async (r) => { try { return await r.json(); } catch { throw new ProIndisponible("réponse illisible"); } };

  return {
    async echangerCode({ code, codeVerifier }) {
      const corps = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: config.redirectUri, code_verifier: codeVerifier });
      const basic = Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString("base64");
      const r = await appel("/api/pro-integration/token", {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: corps.toString(),
      });
      if (r.status === 400 || r.status === 401) { await r.body?.cancel?.(); throw new ProRefus("échange refusé", r.status === 401 ? "client" : "code"); }
      if (r.status !== 200) { await r.body?.cancel?.(); throw new ProIndisponible(`échange : HTTP ${r.status}`); }
      const j = await lireJson(r);
      const ok = j && typeof j.access_token === "string" && /^[\x21-\x7e]{20,2048}$/.test(j.access_token)
        && typeof j.token_type === "string" && j.token_type.toLowerCase() === "bearer"
        && Number.isInteger(j.expires_in) && j.expires_in > 0 && j.expires_in <= 28800;
      if (!ok) throw new ProIndisponible("réponse d'échange invalide");
      return { jeton: j.access_token, expireDansS: j.expires_in };
    },

    // Renvoie le profil validé, ou lève ProRefus (session invalide) / ProIndisponible (panne, à ne jamais transformer en accès).
    async session(jeton) {
      const r = await appel("/api/pro-integration/session", { headers: { Authorization: `Bearer ${jeton}`, Accept: "application/json" } });
      if (r.status === 401 || r.status === 403) { await r.body?.cancel?.(); throw new ProRefus("session refusée", "jeton"); }
      if (r.status !== 200) { await r.body?.cancel?.(); throw new ProIndisponible(`session : HTTP ${r.status}`); }
      const j = await lireJson(r);
      if (j?.active === false) throw new ProRefus("session inactive", "inactive");
      return validerSession(j);
    },

    async chrome(jeton) {
      const r = await appel("/api/pro-integration/chrome", { headers: { Authorization: `Bearer ${jeton}`, Accept: "application/json" } });
      if (r.status === 401 || r.status === 403) { await r.body?.cancel?.(); throw new ProRefus("chrome refusé", "jeton"); }
      if (r.status !== 200) { await r.body?.cancel?.(); throw new ProIndisponible(`chrome : HTTP ${r.status}`); }
      const j = await lireJson(r);
      const liste = (v, n) => Array.isArray(v) && v.length <= n;
      const ok = j && j.version === 1 && j.integration_mode === "document"
        && typeof j.header_html === "string" && j.header_html.length < 500_000
        && typeof j.footer_html === "string" && j.footer_html.length < 500_000
        && liste(j.stylesheets, 20) && j.stylesheets.every((u) => typeof u === "string" && (urlOk(u) || /^https:\/\/fonts\.googleapis\.com\/css2?\?/.test(u)))
        && liste(j.scripts, 20) && j.scripts.every((u) => typeof u === "string" && urlOk(u))
        && liste(j.body_classes, 20) && j.body_classes.every((c) => typeof c === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(c))
        && j.logout_url === "/auth/logout"
        && typeof j.cookie_settings_event === "string" && /^[A-Za-z0-9:_.-]{1,64}$/.test(j.cookie_settings_event);
      if (!ok) throw new ProIndisponible("header/footer invalides");
      return { header: j.header_html, footer: j.footer_html, styles: j.stylesheets, scripts: j.scripts, classes: j.body_classes, evenementCookies: j.cookie_settings_event };
    },

    async revoquer(jeton) {
      const r = await appel("/api/pro-integration/revoke", { method: "POST", headers: { Authorization: `Bearer ${jeton}` } });
      await r.body?.cancel?.();
      // 204 : révoqué ; 401 : déjà révoqué ou expiré. Les deux valent nettoyage réussi.
      if (r.status !== 204 && r.status !== 401) throw new ProIndisponible(`révocation : HTTP ${r.status}`);
    },
  };

  function validerSession(j) {
    const L = j?.links || {}, E = j?.entitlements || {};
    const chaine = (v, max = 320) => typeof v === "string" && v.length <= max;
    const ok = j && j.active === true
      && j.iss === config.issuer
      && typeof j.sub === "string" && j.sub.length >= 1 && j.sub.length <= 255 && !/[\u0000-\u001f\u007f]/.test(j.sub)
      && (j.email === null || j.email === undefined || chaine(j.email))
      && typeof j.email_verified === "boolean"
      && (j.name === null || j.name === undefined || chaine(j.name, 200))
      && typeof E.analysis === "boolean" && typeof E.training === "boolean" && typeof E.studios === "boolean"
      && urlOk(L.dashboard) && urlOk(L.profile_edit) && urlOk(L.logout)
      && (L.public_profile === null || L.public_profile === undefined || urlOk(L.public_profile, { origineImposee: false }));
    if (!ok) throw new ProIndisponible("session au format inattendu");
    return {
      iss: j.iss, sub: j.sub,
      email: j.email ?? null, emailVerifie: j.email_verified, nom: j.name || "",
      offre: j.subscription_plan ?? null, compte: j.account_plan ?? null,
      ficheId: j.photographer_id ?? null,
      // studios n'est jamais accordé sans training, quelle que soit la réponse
      droits: { analysis: E.analysis, training: E.training, studios: E.training && E.studios },
      liens: { tableauDeBord: L.dashboard, modifierFiche: L.profile_edit, fichePublique: L.public_profile || null, deconnexion: L.logout },
    };
  }
}
