// Configuration lue dans l'environnement. Toute valeur invalide arrête le démarrage (jamais de valeur par défaut pour un secret).
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";

function origine(nom, valeur, { httpLocalAutorise = false } = {}) {
  let u;
  try { u = new URL(valeur); } catch { throw new Error(`${nom} : URL invalide`); }
  const local = httpLocalAutorise && u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname);
  if (u.protocol !== "https:" && !local) throw new Error(`${nom} doit utiliser HTTPS`);
  if (u.username || u.password || u.search || u.hash || (u.pathname !== "/" && u.pathname !== "")) throw new Error(`${nom} doit être une origine seule (sans chemin, paramètres ni identifiants)`);
  return u.origin;
}

function cle(nom, valeur) {
  if (!valeur) throw new Error(`${nom} manquante`);
  let b;
  if (/^[0-9a-f]{64}$/i.test(valeur)) b = Buffer.from(valeur, "hex");
  else b = Buffer.from(valeur, "base64");
  if (b.length !== 32) throw new Error(`${nom} : 32 octets attendus (64 caractères hexadécimaux ou base64)`);
  return b;
}

export function lireConfig(env = process.env) {
  // Les tests locaux peuvent utiliser http://localhost ; la production exige HTTPS partout.
  const modeTest = env.NODE_ENV === "test";
  const appOrigin = origine("APP_ORIGIN", env.APP_ORIGIN, { httpLocalAutorise: modeTest });
  const proOrigin = origine("MPB_PRO_ORIGIN", env.MPB_PRO_ORIGIN, { httpLocalAutorise: modeTest });
  const clientId = env.MPB_CLIENT_ID || "";
  if (!/^[a-z0-9-]{3,64}$/.test(clientId)) throw new Error("MPB_CLIENT_ID invalide");
  const clientSecret = env.MPB_CLIENT_SECRET || "";
  if (clientSecret.length < 32) throw new Error("MPB_CLIENT_SECRET : au moins 32 caractères");
  const redirectUri = env.MPB_REDIRECT_URI || "";
  if (redirectUri !== `${appOrigin}/auth/callback`) throw new Error("MPB_REDIRECT_URI doit valoir exactement APP_ORIGIN + /auth/callback");
  const dbUrl = env.SESSION_STORE_URL || env.DATABASE_URL || "";
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) throw new Error("SESSION_STORE_URL : URL Postgres attendue");
  const supabaseUrl = origine("SUPABASE_URL", env.SUPABASE_URL, { httpLocalAutorise: modeTest });
  const cookieSecure = new URL(appOrigin).protocol === "https:";
  // Origines d'images autorisées en plus du Pro (logo, fiches Parents) : liste explicite, séparée par des espaces
  const imagesExtra = (env.CSP_IMG_ORIGINS || "").split(/\s+/).filter(Boolean).map((o) => origine("CSP_IMG_ORIGINS", o));
  const proxiesDeConfiance = (env.TRUST_PROXY || "").split(/[\s,]+/).filter(Boolean);
  return Object.freeze({
    modeTest,
    port: Number(env.PORT || 8080),
    hote: env.HOST || "0.0.0.0",
    appOrigin, proOrigin, clientId, clientSecret, redirectUri,
    issuer: env.MPB_ISSUER ? origine("MPB_ISSUER", env.MPB_ISSUER, { httpLocalAutorise: modeTest }) : proOrigin,
    dbUrl,
    dbSsl: env.SESSION_STORE_SSL === "disable" ? false : !modeTest,
    // Certificat racine Supabase (Project Settings > Database > SSL certificate) pour vérifier le serveur Postgres
    dbCa: env.SESSION_STORE_CA ? readFileSync(env.SESSION_STORE_CA, "utf8") : undefined,
    cleChiffrement: cle("SESSION_ENCRYPTION_KEY", env.SESSION_ENCRYPTION_KEY),
    supabaseUrl,
    fonctionsUrl: `${supabaseUrl}/functions/v1`,
    storagePublicUrl: `${supabaseUrl}/storage/v1/object/public`,
    // Cookie de session : __Host- impose Secure, Path=/ et l'absence de Domain
    nomCookie: cookieSecure ? "__Host-mpb_visibility" : "mpb_visibility_dev",
    nomCookieTx: cookieSecure ? "__Host-mpb_visibility_tx" : "mpb_visibility_tx_dev",
    // Marque une fin de session subie (révocation, refus) : la page suivante propose « Me reconnecter » sans relance automatique
    nomCookieFin: cookieSecure ? "__Host-mpb_visibility_fin" : "mpb_visibility_fin_dev",
    cookieSecure,
    imagesExtra,
    proxiesDeConfiance,
    delaiProMs: Number(env.MPB_TIMEOUT_MS || 6000),
    delaiFonctionsMs: Number(env.FUNCTIONS_TIMEOUT_MS || 180000),
    dureeTransactionS: 600,
    limiteConnexionsParMinute: Number(env.MPB_LIMITE_CONNEXIONS || 30),
  });
}
