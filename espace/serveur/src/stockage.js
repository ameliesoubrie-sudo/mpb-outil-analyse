// Stockage partagé (Postgres, schéma mpb_prive) : sessions, transactions SSO, résolution des membres.
// Partagé entre toutes les instances du serveur. Les jetons sont chiffrés ; seules des empreintes servent de clés.
import pg from "pg";
import { chiffrer, dechiffrer, empreinte } from "./outils.js";

export function creerPool(config) {
  const pool = new pg.Pool({
    connectionString: config.dbUrl,
    ssl: config.dbSsl ? { rejectUnauthorized: true, ca: config.dbCa } : false,
    max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000, statement_timeout: 15_000,
  });
  pool.on("error", () => { /* connexion inactive coupée : le pool en rouvre une */ });
  return pool;
}

export function creerStockage(config, pool) {
  const K = config.cleChiffrement;
  return {
    pool,
    // ---------- Transactions SSO ----------
    async creerTransaction({ state, navigateur, verifier, destination }) {
      await pool.query(
        `insert into mpb_prive.transactions_sso (state_hash, navigateur_hash, verifier_chiffre, destination, expire_le)
         values ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
        [empreinte(state), empreinte(navigateur), chiffrer(K, verifier, "pkce:" + empreinte(state)), destination, config.dureeTransactionS]);
    },
    // Consommation atomique et unique, liée au navigateur. Renvoie null si inconnue, expirée, déjà utilisée ou d'un autre navigateur.
    async consommerTransaction({ state, navigateur }) {
      const { rows } = await pool.query(
        `update mpb_prive.transactions_sso set consomme_le = now()
         where state_hash = $1 and navigateur_hash = $2 and consomme_le is null and expire_le > now()
         returning verifier_chiffre, destination`,
        [empreinte(state), empreinte(navigateur)]);
      if (!rows[0]) return null;
      return { verifier: dechiffrer(K, rows[0].verifier_chiffre, "pkce:" + empreinte(state)), destination: rows[0].destination };
    },

    // ---------- Sessions ----------
    async creerSession({ id, iss, sub, memberId, jeton, expireDansS }) {
      await pool.query(
        `insert into mpb_prive.sessions (id_hash, mpb_issuer, mpb_subject, member_id, jeton_chiffre, jeton_expire_le)
         values ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))`,
        [empreinte(id), iss, sub, memberId, chiffrer(K, jeton, "jeton:" + empreinte(id)), expireDansS]);
    },
    async lireSession(id) {
      const { rows } = await pool.query(
        `select mpb_issuer, mpb_subject, member_id, jeton_chiffre, jeton_expire_le, (jeton_expire_le <= now()) as expiree
         from mpb_prive.sessions where id_hash = $1`, [empreinte(id)]);
      const s = rows[0];
      if (!s) return null;
      let jeton;
      try { jeton = dechiffrer(K, s.jeton_chiffre, "jeton:" + empreinte(id)); } catch { return null; }
      return { iss: s.mpb_issuer, sub: s.mpb_subject, memberId: s.member_id, jeton, expireLe: s.jeton_expire_le, expiree: s.expiree };
    },
    async majMembreSession(id, memberId) {
      await pool.query(`update mpb_prive.sessions set member_id = $2, vu_le = now() where id_hash = $1`, [empreinte(id), memberId]);
    },
    async supprimerSession(id) {
      await pool.query(`delete from mpb_prive.sessions where id_hash = $1`, [empreinte(id)]);
    },
    async purger() {
      await pool.query(`delete from mpb_prive.sessions where jeton_expire_le < now() - interval '1 hour'`);
      await pool.query(`delete from mpb_prive.transactions_sso where expire_le < now() - interval '1 hour'`);
    },

    // ---------- Membres ----------
    async resoudreMembre({ iss, sub, email, nom }) {
      const { rows } = await pool.query(`select member_id, etat from mpb_prive.resoudre_membre($1, $2, $3, $4)`, [iss, sub, email, nom]);
      return { memberId: rows[0]?.member_id || null, etat: rows[0]?.etat || "rattachement_necessaire" };
    },
    // Lecture seule de la correspondance (à chaque requête : un détachement prend effet immédiatement)
    async membrePour(iss, sub) {
      const { rows } = await pool.query(`select member_id from mpb_prive.correspondances where mpb_issuer = $1 and mpb_subject = $2`, [iss, sub]);
      return rows[0]?.member_id || null;
    },
  };
}
