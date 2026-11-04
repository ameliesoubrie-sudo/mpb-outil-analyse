// Edge Function : redacteur-pages
// Rédige les textes des pages du site et des fiches (descriptions de prestations, déroulé de séance,
// titres et méta-descriptions, page ville, guide…) avec la voix de la photographe, pour le persona choisi,
// en s'appuyant sur sa carte d'identité et sur les pages de son site lues par notre outil d'analyse.
// Entrée : POST { format?, mission_id?, persona: number | "toutes", brief: { sujet, details, offre, periode, ville, consignes } }
// Sortie : { id, resultat, alertes, restant }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { FORMATS, FORMAT_DE_MISSION } from "./formats.ts";
import { construirePrompt, nettoyer, SCHEMA, FORMULES_CREUSES, type Carte, type Persona, type PageLue } from "./prompt.ts";
import { SCHEMA_QUESTIONS, blocReponses, avecReponses, promptQuestions, appelerOutil, lireReponses, type QR } from "./questions.ts";

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
    const formatId: string = body?.format || (missionId ? FORMAT_DE_MISSION[missionId] : "") || "deroule";
    if (!FORMATS[formatId]) return json({ error: `Format inconnu : ${formatId}` }, 400);
    const etape: "questions" | "rediger" = body?.etape === "questions" ? "questions" : "rediger";
    const reponses: QR[] = lireReponses(body?.reponses);
    const brief = typeof body?.brief === "object" && body.brief ? { ...body.brief } : {};
    delete (brief as any).reponses;
    for (const k of Object.keys(brief)) brief[k] = String(brief[k] ?? "").slice(0, 6000);

    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const { count } = await admin.from("bilan_agent_appels").select("id", { count: "exact", head: true })
      .eq("member_id", user.id).eq("agent", etape === "questions" ? "pages-q" : "pages").gte("created_at", depuis);
    if ((count || 0) >= (etape === "questions" ? LIMITE_MENSUELLE * 3 : LIMITE_MENSUELLE)) return json({ error: `Vous avez atteint la limite de ${LIMITE_MENSUELLE} textes ce mois-ci.` }, 429);

    const [{ data: ident }, { data: mission }, { data: bilans }] = await Promise.all([
      admin.from("bilan_identite").select("reponses, carte, portrait").eq("member_id", user.id).maybeSingle(),
      missionId ? admin.from("bilan_missions").select("id, titre, methode").eq("id", missionId).maybeSingle() : Promise.resolve({ data: null }),
      admin.from("bilan_bilans").select("id, site_url").eq("member_id", user.id).order("created_at", { ascending: false }).limit(1),
    ]);

    const { data: passes } = await admin.from("bilan_contenus").select("brief").eq("member_id", user.id).order("created_at", { ascending: false }).limit(20);
    const anciennes: QR[] = (passes || []).flatMap((x: any) => Array.isArray(x.brief?.reponses) ? x.brief.reponses : []);
    const carte = (ident?.carte ? { ...ident.carte, histoire: ident.carte.histoire || ident.portrait || undefined } : ident?.portrait ? { histoire: ident.portrait } : null) as Carte | null;
    const toutesPersonas = (carte?.personas || []) as Persona[];
    const toutes = body?.persona === "toutes" || body?.persona === undefined || body?.persona === null;
    const idx = Number.isInteger(body?.persona) ? body.persona : -1;
    if (!toutes && (idx < 0 || idx >= toutesPersonas.length)) return json({ error: "Persona introuvable : rechargez la page." }, 400);
    const personas = toutes ? toutesPersonas : [toutesPersonas[idx]];
    const r = (ident?.reponses || {}) as Record<string, any>;
    const specialites = (r.ID01?.v || []).slice(0, 3).map((s: string) => (s === "Autre" && r.ID01?.autre ? r.ID01.autre : s));

    // Contexte : séances visées, lieux, et pages lues sur son site lors de l'analyse
    let contexte = ""; let pages: PageLue[] = [];
    const bilan = bilans?.[0];
    if (bilan) {
      const [{ data: br }, { data: bo }, { data: an }] = await Promise.all([
        admin.from("bilan_reponses").select("question_id, valeur").eq("bilan_id", bilan.id).in("question_id", ["P01", "P02"]),
        admin.from("bilan_question_options").select("question_id, code, libelle").in("question_id", ["P01", "P02"]),
        admin.from("bilan_analyses").select("url, audit, created_at").eq("bilan_id", bilan.id).eq("statut", "termine").order("created_at", { ascending: false }).limit(3),
      ]);
      const lib = (q: string, c: string) => bo?.find((o: any) => o.question_id === q && o.code === c)?.libelle || c;
      const nom: Record<string, string> = { P01: "Séances qu'elle veut mettre en avant", P02: "Où elle réalise ses séances" };
      contexte = (br || []).map((x: any) => `- ${nom[x.question_id]} : ${(x.valeur || []).map((c: string) => lib(x.question_id, c)).join(", ")}`).join("\n");
      const site = (an || []).find((a: any) => a.url && bilan.site_url && a.url.startsWith(bilan.site_url.replace(/\/$/, ""))) || (an || [])[0];
      pages = ((site?.audit?.pages_tech || []) as any[]).map((p) => ({ url: p.url, titre: p.titre, description: p.description, mots: p.mots }));
    }

    const prompt = avecReponses(construirePrompt({
      formatId, carte, personas, toutes, brief, specialites, contexte, pages, siteUrl: bilan?.site_url || null,
      mission: mission ? { id: mission.id, titre: mission.titre, methode: mission.methode } : null,
    }), blocReponses(reponses, anciennes));

    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
    if (etape === "questions") {
      const q = await appelerOutil(apiKey, model, promptQuestions(prompt, FORMATS[formatId].besoins),
        { name: "preparer_questions", description: "Indique s'il manque des détails personnels et pose les questions utiles.", input_schema: SCHEMA_QUESTIONS }, 1500);
      await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "pages-q", tokens_in: q.usage?.input_tokens, tokens_out: q.usage?.output_tokens });
      const questions = (q.brut?.questions || []).slice(0, 4).map((x: any) => ({ question: String(x.question || ""), pourquoi: String(x.pourquoi || ""), exemple: String(x.exemple || "") }))
        .filter((x: any) => x.question).map((x: any) => JSON.parse(JSON.stringify(x).replace(/\u2014|\u2013/g, "-")));
      return json({ etape: "questions", suffisant: !!q.brut?.suffisant || !questions.length, questions });
    }
    const appel = await appelerOutil(apiKey, model, prompt, { name: "enregistrer_contenu", description: "Enregistre les textes rédigés.", input_schema: SCHEMA }, 8000);
    const brut = appel.brut; const out = { usage: appel.usage, stop_reason: appel.stop };
    if (!brut?.elements?.length) throw new Error(`Réponse du studio de création illisible (arrêt : ${out.stop_reason}). Réessayez.`);
    const { resultat, alertes } = nettoyer(brut, [...(carte?.voix?.mots_bannis || []), ...FORMULES_CREUSES]);

    const persona = toutes ? null : toutesPersonas[idx];
    const { data: ligne, error } = await admin.from("bilan_contenus").insert({
      member_id: user.id, agent: "redacteur-pages", mission_id: missionId, format: formatId,
      persona_index: toutes ? null : idx, persona_prenom: persona?.prenom || (toutes ? "Tous mes personas" : null),
      brief: { ...brief, reponses }, resultat,
    }).select("id, created_at").single();
    if (error) throw new Error("Enregistrement impossible : " + error.message);
    await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "pages", tokens_in: out.usage?.input_tokens, tokens_out: out.usage?.output_tokens });

    return json({ id: ligne.id, created_at: ligne.created_at, format: formatId, resultat, alertes, sansCarte: !carte, restant: LIMITE_MENSUELLE - (count || 0) - 1 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
