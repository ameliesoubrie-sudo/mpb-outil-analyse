// Authentification des Edge Functions par la session du compte Pro (pro.monphotographebebe.fr).
// OBLIGATOIRE en tête de chaque fonction membre : aucun chemin métier ne s'exécute avant cette vérification.
//  1. extrait un bearer opaque MPB (refuse absence, ambiguïté, format anormal, et tout JWT : anon, service_role, ancien jeton Supabase) ;
//  2. appelle uniquement l'origine Pro configurée, sur /api/pro-integration/session ;
//  3. exige une session active, le bon émetteur, un sub valide et le droit demandé ;
//  4. résout la correspondance privée (iss, sub) -> UUID membre (fonction mpb_membre_pour, service_role) ;
//  5. renvoie cet UUID et les droits validés. Le corps de la requête et les en-têtes du navigateur ne font jamais autorité.
// Copie identique dans chaque dossier de fonction (déploiement autonome) : outils/sync_mpb_auth.py et tests/mpb_auth_test.ts.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

export type Droit = "analysis" | "training" | "studios";
export type Droits = { analysis: boolean; training: boolean; studios: boolean };
export type ContexteMembre = { memberId: string; iss: string; sub: string; droits: Droits };

const ENTETES = { "Content-Type": "application/json", "Cache-Control": "no-store" };
export const reponseJson = (corps: unknown, statut = 200) => new Response(JSON.stringify(corps), { status: statut, headers: ENTETES });

function origineHttps(v: string | undefined): string | null {
  if (!v) return null;
  try { const u = new URL(v); return u.protocol === "https:" && u.pathname === "/" && !u.search && !u.username ? u.origin : null; } catch { return null; }
}

// Injection pour les tests
export type Dependances = {
  fetch: typeof fetch;
  env: (k: string) => string | undefined;
  membrePour: (iss: string, sub: string) => Promise<string | null>;
};
const parDefaut = (): Dependances => ({
  fetch: (...a) => fetch(...a),
  env: (k) => Deno.env.get(k),
  membrePour: async (iss, sub) => {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data, error } = await admin.rpc("mpb_membre_pour", { p_iss: iss, p_sub: sub });
    if (error) throw new Error("correspondance indisponible");
    return typeof data === "string" ? data : null;
  },
});

export async function authentifierMembre(req: Request, droit: Droit, dep: Dependances = parDefaut()): Promise<ContexteMembre | Response> {
  if (req.method !== "POST") return reponseJson({ error: "Méthode non autorisée" }, 405);
  const entete = req.headers.get("authorization");
  if (!entete) return reponseJson({ error: "Non connecté" }, 401);
  const m = /^Bearer ([\x21-\x7e]{20,2048})$/.exec(entete);
  if (!m) return reponseJson({ error: "Non connecté" }, 401);
  const jeton = m[1];
  // Un JWT (en-tête eyJ…, trois segments) n'est jamais une session MPB : ancien jeton Supabase, clé anon ou service_role
  if (/^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*$/.test(jeton) || jeton.startsWith("sb_")) return reponseJson({ error: "Non connecté" }, 401);

  const pro = origineHttps(dep.env("MPB_PRO_ORIGIN"));
  const issuer = origineHttps(dep.env("MPB_ISSUER")) || pro;
  if (!pro || !issuer) return reponseJson({ error: "Service mal configuré" }, 500);

  let r: Response;
  try {
    r = await dep.fetch(`${pro}/api/pro-integration/session`, {
      headers: { Authorization: `Bearer ${jeton}`, Accept: "application/json" },
      redirect: "manual", signal: AbortSignal.timeout(6000),
    });
  } catch { return reponseJson({ error: "Service momentanément indisponible. Réessayez." }, 503); }
  if (r.status === 401 || r.status === 403) { await r.body?.cancel(); return reponseJson({ error: "Session expirée" }, 401); }
  if (r.status !== 200) { await r.body?.cancel(); return reponseJson({ error: "Service momentanément indisponible. Réessayez." }, 503); }
  let s: any;
  try { s = await r.json(); } catch { return reponseJson({ error: "Service momentanément indisponible. Réessayez." }, 503); }
  if (typeof s !== "object" || s === null || Array.isArray(s)) return reponseJson({ error: "Service momentanément indisponible. Réessayez." }, 503);
  if (s.active !== true) return reponseJson({ error: "Session expirée" }, 401);
  const E = s.entitlements || {};
  if (s.iss !== issuer || typeof s.sub !== "string" || s.sub.length < 1 || s.sub.length > 255 || /[\u0000-\u001f\u007f]/.test(s.sub)
    || typeof E.analysis !== "boolean" || typeof E.training !== "boolean" || typeof E.studios !== "boolean") {
    return reponseJson({ error: "Service momentanément indisponible. Réessayez." }, 503);
  }
  const droits: Droits = { analysis: E.analysis, training: E.training, studios: E.training && E.studios };
  if (!droits[droit]) return reponseJson({ error: "Cette fonctionnalité n'est pas incluse dans votre formule." }, 403);

  let memberId: string | null;
  try { memberId = await dep.membrePour(s.iss, s.sub); } catch { return reponseJson({ error: "Service momentanément indisponible. Réessayez." }, 503); }
  if (!memberId) return reponseJson({ error: "Votre compte doit d'abord être rattaché." }, 403);
  return { memberId, iss: s.iss, sub: s.sub, droits };
}

// Lecture du corps JSON avec une taille maximale (refus avant tout traitement)
export async function lireCorps(req: Request, limiteOctets = 1_000_000): Promise<Record<string, unknown> | Response> {
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return reponseJson({ error: "Contenu JSON attendu" }, 415);
  const annonce = Number(req.headers.get("content-length") || 0);
  if (annonce > limiteOctets) return reponseJson({ error: "Contenu trop volumineux" }, 413);
  const brut = new Uint8Array(await req.arrayBuffer());
  if (brut.byteLength > limiteOctets) return reponseJson({ error: "Contenu trop volumineux" }, 413);
  if (brut.byteLength === 0) return {};
  try {
    const v = JSON.parse(new TextDecoder().decode(brut));
    if (typeof v !== "object" || v === null || Array.isArray(v)) return reponseJson({ error: "Objet JSON attendu" }, 400);
    return v as Record<string, unknown>;
  } catch { return reponseJson({ error: "JSON invalide" }, 400); }
}
