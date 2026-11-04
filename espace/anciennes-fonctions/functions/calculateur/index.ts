// Edge Function : calculateur
// Recalcule les chiffres saisis par la photographe avec le même code que l'application (calculs.js),
// puis demande à notre studio de création de les commenter : ce qu'ils veulent dire et quoi faire en premier.
// Notre studio de création ne calcule rien et ne cite que des chiffres fournis ; un contrôle signale tout chiffre inconnu.
// Entrée : POST { mission_id, calcul?, donnees: {...}, contexte?: string }
// Sortie : { id, created_at, resultat, chiffres, alertes, restant }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
// @ts-ignore module JS partagé avec l'application
import { calculer, resumer, CALCULS, CALCUL_DE_MISSION } from "./calculs.js";
import { appelerOutil } from "./questions.ts";
import { construirePrompt, nettoyer, SCHEMA } from "./prompt.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const LIMITE_MENSUELLE = 30;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non connecté" }, 401);
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Clé absente côté serveur." }, 500);

    const body = await req.json().catch(() => ({}));
    const missionId: string | null = body?.mission_id || null;
    const calcul: string = body?.calcul || (missionId ? CALCUL_DE_MISSION[missionId] : "") || "";
    if (!CALCULS[calcul]) return json({ error: `Calcul inconnu : ${calcul}` }, 400);
    const donnees: Record<string, unknown> = typeof body?.donnees === "object" && body.donnees ? body.donnees : {};
    // Taille raisonnable : 40 lignes de tableau, textes limités
    if (Array.isArray(donnees.lignes)) donnees.lignes = (donnees.lignes as unknown[]).slice(0, 40);
    for (const k of Object.keys(donnees)) if (typeof donnees[k] === "string") donnees[k] = String(donnees[k]).slice(0, 3000);
    const contexte = String(body?.contexte || "").slice(0, 3000);

    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const { count } = await admin.from("bilan_agent_appels").select("id", { count: "exact", head: true })
      .eq("member_id", user.id).eq("agent", "calcul").gte("created_at", depuis);
    if ((count || 0) >= LIMITE_MENSUELLE) return json({ error: `Vous avez atteint la limite de ${LIMITE_MENSUELLE} commentaires ce mois-ci.` }, 429);

    // Le calcul fait foi : on le refait ici, avec le même code que l'application
    const sortie = calculer(calcul, donnees);
    const chiffres = resumer(calcul, sortie);

    const [{ data: ident }, { data: mission }, { data: missions }] = await Promise.all([
      admin.from("bilan_identite").select("reponses, carte").eq("member_id", user.id).maybeSingle(),
      missionId ? admin.from("bilan_missions").select("id, titre, methode").eq("id", missionId).maybeSingle() : Promise.resolve({ data: null }),
      calcul === "bilan_annuel" ? admin.from("bilan_missions").select("id, titre").order("id") : Promise.resolve({ data: null }),
    ]);
    const r = (ident?.reponses || {}) as Record<string, any>;
    const specialites = (r.ID01?.v || []).slice(0, 3).map((s: string) => (s === "Autre" && r.ID01?.autre ? r.ID01.autre : s));

    const prompt = construirePrompt({
      calcul, chiffres, donnees, contexte, carte: ident?.carte || null, specialites,
      mission: mission ? { id: mission.id, titre: mission.titre, methode: mission.methode } : null,
      missions: (missions || []).map((m: any) => `${m.id} : ${m.titre}`),
    });
    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
    const appel = await appelerOutil(apiKey, model, prompt, { name: "enregistrer_commentaire", description: "Enregistre le commentaire des chiffres.", input_schema: SCHEMA }, 3000);
    if (!appel.brut?.elements?.length) throw new Error(`Réponse du studio de création illisible (arrêt : ${appel.stop}). Réessayez.`);
    const { resultat, alertes } = nettoyer(appel.brut, [chiffres, JSON.stringify(donnees), contexte].join("\n"));

    const { data: ligne, error } = await admin.from("bilan_contenus").insert({
      member_id: user.id, agent: "calculateur", mission_id: missionId, format: calcul,
      persona_index: null, persona_prenom: null, brief: { donnees, contexte }, resultat: { ...resultat, chiffres: sortie },
    }).select("id, created_at").single();
    if (error) throw new Error("Enregistrement impossible : " + error.message);
    await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "calcul", tokens_in: appel.usage?.input_tokens, tokens_out: appel.usage?.output_tokens });

    return json({ id: ligne.id, created_at: ligne.created_at, resultat, chiffres: sortie, alertes, restant: LIMITE_MENSUELLE - (count || 0) - 1 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
