// Tests du helper d'authentification des Edge Functions et de son usage dans les 10 fonctions membre.
// deno test -A tests/mpb_auth_test.ts
import { strict as A } from "node:assert";
const assertEquals = (a: unknown, b: unknown, m = "") => A.deepStrictEqual(a, b, m);
const assert: (v: unknown, m?: string) => asserts v = (v, m = "") => A.ok(v, m);
import { authentifierMembre, lireCorps, type Dependances } from "../supabase/functions/_shared/mpb_auth.ts";

const JETON = "Op4quE_MPB_jeton_0123456789abcdef";
const SESSION = (x: Record<string, unknown> = {}) => ({
  active: true, iss: "https://pro.monphotographebebe.fr", sub: "123", email: "a@b.fr", email_verified: true, name: "A",
  entitlements: { analysis: true, training: true, studios: true }, links: {}, ...x,
});
function dep({ statut = 200, corps = SESSION() as unknown, membre = "11111111-1111-1111-1111-111111111111" as string | null, panne = false } = {}) {
  const appels: string[] = [];
  const d: Dependances = {
    env: (k) => ({ MPB_PRO_ORIGIN: "https://pro.monphotographebebe.fr" } as Record<string, string>)[k],
    fetch: (async (u: string, init: RequestInit) => {
      appels.push(`${u} ${(init.headers as Record<string, string>).Authorization}`);
      if (panne) throw new TypeError("réseau");
      return new Response(JSON.stringify(corps), { status: statut });
    }) as typeof fetch,
    membrePour: async () => membre,
  };
  return { d, appels };
}
const req = (auth?: string, methode = "POST") => new Request("http://f/x", { method: methode, headers: auth ? { authorization: auth } : {} });

Deno.test("session Pro valide : membre résolu par la correspondance privée", async () => {
  const { d, appels } = dep();
  const r = await authentifierMembre(req(`Bearer ${JETON}`), "studios", d);
  assert(!(r instanceof Response));
  assertEquals(r.memberId, "11111111-1111-1111-1111-111111111111");
  assertEquals(appels, [`https://pro.monphotographebebe.fr/api/pro-integration/session Bearer ${JETON}`]);
});

Deno.test("absence, ambiguïté ou format anormal du bearer : 401 sans appel au Pro", async () => {
  for (const a of [undefined, "Basic abc", `Bearer ${JETON}, Bearer ${JETON}`, "Bearer court", `Bearer ${"x".repeat(3000)}`, `bearer ${JETON}`]) {
    const { d, appels } = dep();
    const r = await authentifierMembre(req(a), "analysis", d);
    assert(r instanceof Response); assertEquals(r.status, 401, String(a)); assertEquals(appels.length, 0);
  }
});

Deno.test("ancien JWT Supabase, clé anon, service_role ou clé sb_ : refusés sans appel au Pro", async () => {
  const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJlX2ZhdXNzZQ";
  for (const a of [jwt, "sb_secret_abcdefghijklmnopqrstu", "sb_publishable_abcdefghijklmnop"]) {
    const { d, appels } = dep();
    const r = await authentifierMembre(req(`Bearer ${a}`), "analysis", d);
    assert(r instanceof Response); assertEquals(r.status, 401); assertEquals(appels.length, 0);
  }
});

Deno.test("méthode autre que POST : 405 avant tout", async () => {
  const { d, appels } = dep();
  const r = await authentifierMembre(req(`Bearer ${JETON}`, "GET"), "analysis", d);
  assert(r instanceof Response); assertEquals(r.status, 405); assertEquals(appels.length, 0);
});

Deno.test("refus, inactivité, panne ou réponse incohérente du Pro : jamais d'accès", async () => {
  const cas: [Parameters<typeof dep>[0], number][] = [
    [{ statut: 401 }, 401], [{ corps: SESSION({ active: false }) }, 401], [{ statut: 500 }, 503], [{ panne: true }, 503],
    [{ corps: SESSION({ iss: "https://pirate.example" }) }, 503], [{ corps: SESSION({ sub: "" }) }, 503],
    [{ corps: SESSION({ entitlements: { analysis: true } }) }, 503], [{ corps: "pas du json" }, 503],
  ];
  for (const [o, attendu] of cas) {
    const { d } = dep(o);
    const r = await authentifierMembre(req(`Bearer ${JETON}`), "analysis", d);
    assert(r instanceof Response); assertEquals(r.status, attendu, JSON.stringify(o));
  }
});

Deno.test("droits : formule insuffisante 403 ; studios jamais sans training", async () => {
  let { d } = dep({ corps: SESSION({ entitlements: { analysis: true, training: false, studios: false } }) });
  let r = await authentifierMembre(req(`Bearer ${JETON}`), "studios", d);
  assert(r instanceof Response); assertEquals(r.status, 403);
  ({ d } = dep({ corps: SESSION({ entitlements: { analysis: true, training: false, studios: true } }) }));
  r = await authentifierMembre(req(`Bearer ${JETON}`), "studios", d);
  assert(r instanceof Response); assertEquals(r.status, 403);
  ({ d } = dep({ corps: SESSION({ entitlements: { analysis: true, training: false, studios: false } }) }));
  r = await authentifierMembre(req(`Bearer ${JETON}`), "analysis", d);
  assert(!(r instanceof Response));
});

Deno.test("compte sans correspondance : 403, aucune création depuis une fonction", async () => {
  const { d } = dep({ membre: null });
  const r = await authentifierMembre(req(`Bearer ${JETON}`), "analysis", d);
  assert(r instanceof Response); assertEquals(r.status, 403);
});

Deno.test("corps : type, taille et forme bornés", async () => {
  const mk = (corps: string, type = "application/json") => new Request("http://f", { method: "POST", headers: { "content-type": type }, body: corps });
  assert((await lireCorps(mk("{}", "text/plain"))) instanceof Response);
  assertEquals(((await lireCorps(mk("x".repeat(2000)), 1000)) as Response).status, 413);
  assertEquals(((await lireCorps(mk("[1]"))) as Response).status, 400);
  assertEquals(await lireCorps(mk('{"a":1}')), { a: 1 });
});

const FONCTIONS: Record<string, string> = {
  "analyse-site": "analysis", "generer-plan": "analysis", "agent-identite": "studios", "studio-instagram": "studios",
  "redacteur-pages": "studios", "messages-clients": "studios", "stratege-marque": "studios",
  "assistant-partenaires": "studios", "studio-contenu": "studios", "calculateur": "studios",
};
const racine = new URL("../supabase/functions/", import.meta.url);

Deno.test("les 10 fonctions : copie identique du helper, vérification en première instruction, plus aucun getUser ni CORS ouvert", async () => {
  const ref = await Deno.readTextFile(new URL("_shared/mpb_auth.ts", racine));
  for (const [nom, droit] of Object.entries(FONCTIONS)) {
    assertEquals(await Deno.readTextFile(new URL(`${nom}/mpb_auth.ts`, racine)), ref, `${nom}/mpb_auth.ts doit être identique`);
    const s = await Deno.readTextFile(new URL(`${nom}/index.ts`, racine));
    const corps = s.slice(s.indexOf("Deno.serve(async (req) => {") + 27);
    const premiere = corps.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("//"))[0];
    assertEquals(premiere, `const mpb = await authentifierMembre(req, "${droit}");`, nom);
    assert(!/getUser|userClient|SUPABASE_ANON_KEY|Access-Control-Allow-Origin|req\.json\(\)/.test(s), nom);
  }
});

Deno.test("config.toml : verify_jwt = false uniquement pour les 10 fonctions protégées", async () => {
  const t = await Deno.readTextFile(new URL("../config.toml", racine));
  const blocs = [...t.matchAll(/\[functions\.([a-z-]+)\]\s*\nverify_jwt = (true|false)/g)].map((m) => [m[1], m[2]]);
  for (const [nom, v] of blocs) assertEquals(v === "false", nom in FONCTIONS, nom);
  assertEquals(blocs.filter(([, v]) => v === "false").length, 10);
});
