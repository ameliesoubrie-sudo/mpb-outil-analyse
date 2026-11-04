// Outils communs : aléatoire, empreintes, chiffrement, PKCE, cookies, validations, journal expurgé.
import { randomBytes, createHash, createCipheriv, createDecipheriv, createHmac, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

export const aleatoire = (octets = 32) => randomBytes(octets).toString("base64url");
export const empreinte = (texte) => createHash("sha256").update(String(texte)).digest("base64url");
export const challengeS256 = (verifier) => createHash("sha256").update(verifier, "ascii").digest("base64url");

export function egalConstant(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

// AES-256-GCM : iv(12) | tag(16) | texte chiffré, en base64url. Contexte lié (AAD) pour éviter les échanges de champs.
export function chiffrer(cle, texte, contexte) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", cle, iv);
  c.setAAD(Buffer.from(contexte));
  const corps = Buffer.concat([c.update(String(texte), "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), corps]).toString("base64url");
}
export function dechiffrer(cle, b64, contexte) {
  const b = Buffer.from(String(b64), "base64url");
  if (b.length < 29) throw new Error("chiffré invalide");
  const d = createDecipheriv("aes-256-gcm", cle, b.subarray(0, 12));
  d.setAAD(Buffer.from(contexte));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
export const hmac = (cle, texte) => createHmac("sha256", cle).update(String(texte)).digest("base64url");

// ---------- Cookies ----------
export function lireCookies(entete) {
  const out = new Map();
  for (const morceau of String(entete || "").split(";")) {
    const i = morceau.indexOf("=");
    if (i < 1) continue;
    const nom = morceau.slice(0, i).trim(), valeur = morceau.slice(i + 1).trim();
    if (out.has(nom)) out.set(nom, null);     // cookie en double : ambigu, ignoré
    else out.set(nom, valeur);
  }
  return out;
}
export function cookie(config, nom, valeur, { maxAge } = {}) {
  const attrs = [`${nom}=${valeur}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (config.cookieSecure) attrs.push("Secure");
  if (maxAge !== undefined) attrs.push(`Max-Age=${maxAge}`);
  return attrs.join("; ");
}
export const cookieEfface = (config, nom) => cookie(config, nom, "", { maxAge: 0 });

// ---------- Destination interne après connexion ----------
// Seule la page de l'outil est acceptée, avec un fragment simple (#mission-MG09). Jamais d'URL externe.
export function destinationInterne(brute) {
  if (typeof brute !== "string" || brute.length === 0) return "/";
  if (brute.length > 200 || /[\u0000-\u001f\u007f\\]/.test(brute)) return "/";
  const m = /^\/(#[A-Za-z0-9][A-Za-z0-9_\/-]{0,80})?$/.exec(brute);
  return m ? brute : "/";
}

// ---------- Validations ----------
export const estUuid = (v) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const estIdCatalogue = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);

// ---------- Journal sans secrets ----------
const SENSIBLE = /(authorization|cookie|token|code|state|verifier|secret|password|jeton)/i;
export function journal(niveau, message, details = {}) {
  const propre = {};
  for (const [k, v] of Object.entries(details)) propre[k] = SENSIBLE.test(k) ? "[masqué]" : typeof v === "string" ? v.slice(0, 300) : v;
  const ligne = JSON.stringify({ t: new Date().toISOString(), niveau, message, ...propre });
  (niveau === "erreur" ? console.error : console.log)(ligne);
}
