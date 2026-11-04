// Edge Function : assistant-partenaires
// Développe le réseau local : partenaires de la périnatalité (recherche web autour de la zone), support,
// premier contact, proposition, suivi, publication commune, atelier, liens vers le site, presse locale.
// Entrée : POST { format?, mission_id?, persona: number | "toutes", brief: { partenaire, details, offre, consignes }, etape?, reponses? }
// Sortie : { id, resultat, alertes, restant } ou, à l'étape « questions » : { etape, suffisant, questions }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { authentifierMembre, lireCorps } from "./mpb_auth.ts";
import { FORMATS, FORMAT_DE_MISSION } from "./formats.ts";
import { construirePrompt, nettoyer, SCHEMA, FORMULES_CREUSES, type Carte, type Persona } from "./prompt.ts";
import { SCHEMA_QUESTIONS, blocReponses, avecReponses, promptQuestions, appelerOutil, lireReponses, type QR } from "./questions.ts";

// Pas de CORS : les navigateurs n'appellent plus les fonctions, seul le serveur de l'outil le fait.
const CORS = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const LIMITE_MENSUELLE = 30;

// Appel avec l'outil de recherche web côté serveur, puis l'outil d'enregistrement.
// Gère la pause éventuelle de l'API pendant les recherches (stop_reason « pause_turn »).
async function appelerAvecRecherche(apiKey: string, model: string, prompt: string, ville: string, maxTokens: number) {
  const outils: unknown[] = [
    { type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", city: ville || undefined, country: "FR", timezone: "Europe/Paris" } },
    { name: "enregistrer_contenu", description: "Enregistre le contenu rédigé.", input_schema: SCHEMA },
  ];
  const messages: any[] = [{ role: "user", content: prompt }];
  let usage = { input_tokens: 0, output_tokens: 0 }; let stop = ""; let sources: string[] = [];
  for (let tour = 0; tour < 4; tour++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, tools: outils, messages }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(`API Anthropic : ${out?.error?.message || res.status}`);
    usage = { input_tokens: usage.input_tokens + (out.usage?.input_tokens || 0), output_tokens: usage.output_tokens + (out.usage?.output_tokens || 0) };
    stop = out.stop_reason;
    for (const c of out.content || []) if (c.type === "web_search_tool_result" && Array.isArray(c.content)) sources.push(...c.content.map((r: any) => r.url).filter(Boolean));
    const brut = (out.content || []).find((c: any) => c.type === "tool_use" && c.name === "enregistrer_contenu")?.input;
    if (brut) return { brut, usage, stop, sources };
    if (stop === "pause_turn") { messages.push({ role: "assistant", content: out.content }); continue; }
    // Recherches faites mais pas encore d'enregistrement : on demande l'enregistrement
    messages.push({ role: "assistant", content: out.content });
    messages.push({ role: "user", content: "Enregistrez maintenant le résultat avec l'outil enregistrer_contenu, à partir de vos recherches." });
  }
  return { brut: null, usage, stop, sources };
}

Deno.serve(async (req) => {
  // Session Pro vérifiée AVANT tout traitement ; le membre vient de la correspondance privée, jamais du corps
  const mpb = await authentifierMembre(req, "studios");
  if (mpb instanceof Response) return mpb;
  const user = { id: mpb.memberId };
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Clé absente côté serveur." }, 500);

    const body: any = await lireCorps(req, 1_000_000);
    if (body instanceof Response) return body;
    const missionId: string | null = body?.mission_id || null;
    const formatId: string = body?.format || (missionId ? FORMAT_DE_MISSION[missionId] : "") || "part_recherche";
    const f = FORMATS[formatId];
    if (!f) return json({ error: `Format inconnu : ${formatId}` }, 400);
    const etape: "questions" | "rediger" = body?.etape === "questions" ? "questions" : "rediger";
    const reponses: QR[] = lireReponses(body?.reponses);
    const brief = typeof body?.brief === "object" && body.brief ? { ...body.brief } : {};
    delete (brief as any).reponses;
    for (const k of Object.keys(brief)) brief[k] = String(brief[k] ?? "").slice(0, 6000);

    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const { count } = await admin.from("bilan_agent_appels").select("id", { count: "exact", head: true })
      .eq("member_id", user.id).eq("agent", etape === "questions" ? "partenaires-q" : "partenaires").gte("created_at", depuis);
    if ((count || 0) >= (etape === "questions" ? LIMITE_MENSUELLE * 3 : LIMITE_MENSUELLE)) return json({ error: `Vous avez atteint la limite de ${LIMITE_MENSUELLE} contenus ce mois-ci.` }, 429);

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

    // Zone : commune et zone du bilan, puis « Votre zone » et « Votre lieu de séance » de Mon identité
    let commune = "", zoneBilan = "", contexte = "";
    const bilan = bilans?.[0];
    if (bilan) {
      const [{ data: br }, { data: bo }] = await Promise.all([
        admin.from("bilan_reponses").select("question_id, valeur, texte_libre").eq("bilan_id", bilan.id).in("question_id", ["P01", "P02"]),
        admin.from("bilan_question_options").select("question_id, code, libelle").in("question_id", ["P01", "P02"]),
      ]);
      const lib = (q: string, c: string) => bo?.find((o: any) => o.question_id === q && o.code === c)?.libelle || c;
      const p02 = (br || []).find((x: any) => x.question_id === "P02");
      commune = String(p02?.texte_libre?.commune || ""); zoneBilan = String(p02?.texte_libre?.zone || "");
      const nom: Record<string, string> = { P01: "Séances à mettre en avant", P02: "Lieux des séances" };
      contexte = (br || []).map((x: any) => `- ${nom[x.question_id]} : ${(x.valeur || []).map((c: string) => lib(x.question_id, c)).join(", ")}`).join("\n");
      if (bilan.site_url) contexte += `\n- Son site : ${bilan.site_url}`;
    }
    const pr04 = r.PR04?.c || [], pr02 = r.PR02?.c || [];
    const ville = String(pr04[0] || commune || "").trim();
    const zone = [
      ville && `Ville principale : ${ville}`,
      (pr04[1] || zoneBilan) && `Zone desservie : ${pr04[1] || zoneBilan}`,
      pr02[0] && `Lieu de séance : ${pr02[0]}`,
    ].filter(Boolean).join("\n");

    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
    const construire = (recherchePossible: boolean) => avecReponses(construirePrompt({
      formatId, carte, personas, brief, specialites, zone, contexte, recherchePossible,
      mission: mission ? { id: mission.id, titre: mission.titre, methode: mission.methode } : null,
    }), blocReponses(reponses, anciennes));

    if (etape === "questions") {
      // Les recherches n'ont besoin que de la zone : pas de questions si elle est connue
      if (f.recherche && zone) return json({ etape: "questions", suffisant: true, questions: [] });
      const q = await appelerOutil(apiKey, model, promptQuestions(construire(false), f.besoins || "sa ville et sa zone"),
        { name: "preparer_questions", description: "Indique s'il manque des détails et pose les questions utiles.", input_schema: SCHEMA_QUESTIONS }, 1500);
      await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "partenaires-q", tokens_in: q.usage?.input_tokens, tokens_out: q.usage?.output_tokens });
      const questions = (q.brut?.questions || []).slice(0, 4).map((x: any) => ({ question: String(x.question || ""), pourquoi: String(x.pourquoi || ""), exemple: String(x.exemple || "") }))
        .filter((x: any) => x.question).map((x: any) => JSON.parse(JSON.stringify(x).replace(/—|–/g, "-")));
      return json({ etape: "questions", suffisant: !!q.brut?.suffisant || !questions.length, questions });
    }

    const alertesEnPlus: string[] = [];
    let appel: { brut: any; usage: any; stop: string; sources?: string[] };
    if (f.recherche) {
      try { appel = await appelerAvecRecherche(apiKey, model, construire(true), ville, 10000); }
      catch (e) {
        // Recherche web indisponible sur ce compte : on bascule sur la méthode, sans citer de noms
        alertesEnPlus.push("La recherche web n'a pas pu être faite : notre studio de création vous donne la méthode pour trouver vous-même vos partenaires.");
        console.error(e);
        appel = await appelerOutil(apiKey, model, construire(false), { name: "enregistrer_contenu", description: "Enregistre le contenu rédigé.", input_schema: SCHEMA }, 8000);
      }
    } else {
      appel = await appelerOutil(apiKey, model, construire(false), { name: "enregistrer_contenu", description: "Enregistre le contenu rédigé.", input_schema: SCHEMA }, 8000);
    }
    if (!appel.brut?.elements?.length) throw new Error(`Réponse du studio de création illisible (arrêt : ${appel.stop}). Réessayez.`);
    const { resultat, alertes } = nettoyer(appel.brut, [...(carte?.voix?.mots_bannis || []), ...FORMULES_CREUSES]);
    // Un lien cité qui n'apparaît dans aucun résultat de recherche est signalé
    if (appel.sources?.length) {
      const vus = new Set(appel.sources.map((u) => u.replace(/\/$/, "")));
      const inconnus = (resultat.elements || []).flatMap((e: any) => String(e.note || "").match(/https?:\/\/[^\s)]+/g) || []).filter((u: string) => !vus.has(u.replace(/[.,;]$/, "").replace(/\/$/, "")));
      if (inconnus.length) alertesEnPlus.push(`${inconnus.length} lien${inconnus.length > 1 ? "s" : ""} à vérifier avant de prendre contact.`);
    }

    const persona = toutes ? null : toutesPersonas[idx];
    const { data: ligne, error } = await admin.from("bilan_contenus").insert({
      member_id: user.id, agent: "assistant-partenaires", mission_id: missionId, format: formatId,
      persona_index: toutes ? null : idx, persona_prenom: persona?.prenom || (toutes ? "Tous mes personas" : null),
      brief: { ...brief, reponses }, resultat,
    }).select("id, created_at").single();
    if (error) throw new Error("Enregistrement impossible : " + error.message);
    await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "partenaires", tokens_in: appel.usage?.input_tokens, tokens_out: appel.usage?.output_tokens });

    return json({ id: ligne.id, created_at: ligne.created_at, format: formatId, resultat, alertes: [...alertes, ...alertesEnPlus], sansCarte: !carte, restant: LIMITE_MENSUELLE - (count || 0) - 1 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
