// Edge Function : studio-contenu (« Mon studio de contenu »)
// Aide permanente à la création de contenu pour les réseaux sociaux, nourrie par la carte d'identité
// et le portrait personal branding. Persona, réseau, format, pilier, sujet, puis rédaction.
// Entrée : POST { action, ... }
//   etat                                  -> { personas, persona_pro, piliers, sujets_utilises, historique }
//   persona_pro { cibles[], precision? }  -> { persona_pro }
//   piliers { cle, regenerer? }           -> { piliers }        (cle : "p0", "p1"… ou "pro")
//   piliers_maj { cle, piliers[] }        -> { piliers }
//   sujets { cle, pilier, reseau?, encore? } -> { sujets }
//   rediger { cle, pilier, sujet{titre,angle}, reseau, format, detail? } -> { id, resultat, alertes }
//   retoucher { id, consigne }            -> { id, resultat, alertes }
//   sujet_utilise { titre, retirer? }     -> { sujets_utilises }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { RESEAUX, RETOUCHES, CIBLES_PRO, trouverFormat } from "./catalogue.ts";
import {
  promptPersonaPro, promptPiliers, promptSujets, promptRedaction, promptRetouche, nettoyer, propre,
  SCHEMA, SCHEMA_PERSONA, SCHEMA_PILIERS, SCHEMA_SUJETS, FORMULES_CREUSES, type Carte, type Persona, type Pilier,
} from "./prompt.ts";
import { appelerOutil, avecReponses } from "./questions.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const LIMITE_CONTENUS = 60, LIMITE_IDEES = 150;
const txt = (x: unknown, n = 400) => String(x ?? "").replace(/—|–/g, "-").trim().slice(0, n);
const rep = (r: any) => !r ? "" : [r.v?.length ? r.v.map((x: string) => (x === "Autre" && r.autre ? r.autre : x)).join(", ") : "", r.t?.trim() || ""].filter(Boolean).join(" · ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non connecté" }, 401);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "etat");

    const [{ data: ident }, { data: ligne }] = await Promise.all([
      admin.from("bilan_identite").select("reponses, carte, portrait").eq("member_id", user.id).maybeSingle(),
      admin.from("bilan_studio_contenu").select("*").eq("member_id", user.id).maybeSingle(),
    ]);
    const etat = ligne || { member_id: user.id, persona_pro: null, piliers: {}, idees: {}, sujets_utilises: [] };
    const carte = (ident?.carte ? { ...ident.carte, histoire: ident.carte.histoire || ident.portrait || undefined } : ident?.portrait ? { histoire: ident.portrait } : null) as Carte | null;
    const personas = (carte?.personas || []) as Persona[];
    const r = (ident?.reponses || {}) as Record<string, any>;
    const specialites = (r.ID01?.v || []).slice(0, 3).map((s: string) => (s === "Autre" && r.ID01?.autre ? r.ID01.autre : s));
    const ctx = { carte, specialites, emojis: rep(r.VO04) || undefined };
    const sauver = async (patch: Record<string, unknown>) => {
      Object.assign(etat, patch);
      const { error } = await admin.from("bilan_studio_contenu").upsert({ ...etat, member_id: user.id, updated_at: new Date().toISOString() });
      if (error) throw new Error("Enregistrement impossible : " + error.message);
    };
    const personaDe = (cle: string): { persona: Persona; pro: boolean } | null => {
      if (cle === "pro") return etat.persona_pro ? { persona: etat.persona_pro, pro: true } : null;
      const i = /^p(\d+)$/.exec(cle)?.[1];
      return i !== undefined && personas[+i] ? { persona: personas[+i], pro: false } : null;
    };

    if (action === "etat") {
      const { data: hist } = await admin.from("bilan_contenus").select("id, created_at, format, persona_prenom, resultat, brief")
        .eq("member_id", user.id).like("format", "sc:%").order("created_at", { ascending: false }).limit(30);
      return json({
        personas: personas.map((p, i) => ({ cle: `p${i}`, prenom: p.prenom, specialite: p.specialite, portrait: p.portrait })),
        persona_pro: etat.persona_pro, piliers: etat.piliers, sujets_utilises: etat.sujets_utilises,
        historique: hist || [], sansCarte: !carte, cibles_pro: CIBLES_PRO,
        reseaux: Object.values(RESEAUX).map((x) => ({ id: x.id, nom: x.nom, formats: x.formats.map((f) => ({ id: f.id, nom: f.nom })) })),
      });
    }

    if (action === "sujet_utilise") {
      const t = txt(body?.titre, 200); if (!t) return json({ error: "Sujet manquant." }, 400);
      const l = (etat.sujets_utilises as string[]).filter((x) => x !== t);
      await sauver({ sujets_utilises: body?.retirer ? l : [t, ...l].slice(0, 300) });
      return json({ sujets_utilises: etat.sujets_utilises });
    }

    if (action === "piliers_maj") {
      const cle = String(body?.cle || ""); if (!personaDe(cle)) return json({ error: "Persona introuvable : rechargez la page." }, 400);
      const piliers: Pilier[] = (Array.isArray(body?.piliers) ? body.piliers : []).map((p: any) => ({ titre: txt(p?.titre, 80), description: txt(p?.description, 300) }))
        .filter((p: Pilier) => p.titre).slice(0, 8);
      if (!piliers.length) return json({ error: "Gardez au moins un pilier." }, 400);
      await sauver({ piliers: { ...etat.piliers, [cle]: piliers } });
      return json({ piliers: etat.piliers });
    }

    // Actions qui appellent le modèle : limites mensuelles
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Clé absente côté serveur." }, 500);
    const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
    const redaction = action === "rediger" || action === "retoucher";
    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const { count } = await admin.from("bilan_agent_appels").select("id", { count: "exact", head: true })
      .eq("member_id", user.id).eq("agent", redaction ? "contenu" : "contenu-idees").gte("created_at", depuis);
    const limite = redaction ? LIMITE_CONTENUS : LIMITE_IDEES;
    if ((count || 0) >= limite) return json({ error: `Vous avez atteint la limite de ${limite} ${redaction ? "contenus" : "propositions"} ce mois-ci.` }, 429);
    const compter = (u: any) => admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: redaction ? "contenu" : "contenu-idees", tokens_in: u?.input_tokens, tokens_out: u?.output_tokens });

    if (action === "persona_pro") {
      const cibles = (Array.isArray(body?.cibles) ? body.cibles : []).map(String).filter((c: string) => CIBLES_PRO.some((x) => x[0] === c));
      const a = await appelerOutil(apiKey, model, avecReponses(promptPersonaPro({ ...ctx, cibles, precision: txt(body?.precision, 600) }), ""),
        { name: "enregistrer_persona", description: "Enregistre le persona professionnel.", input_schema: SCHEMA_PERSONA }, 3000);
      await compter(a.usage);
      if (!a.brut?.prenom) throw new Error("Réponse illisible, réessayez.");
      const p = propre({ ...a.brut, cibles });
      const piliers = { ...etat.piliers }; delete (piliers as any).pro;
      await sauver({ persona_pro: p, piliers });
      return json({ persona_pro: p });
    }

    if (action === "piliers") {
      const cle = String(body?.cle || ""); const pe = personaDe(cle);
      if (!pe) return json({ error: "Persona introuvable : rechargez la page." }, 400);
      if (!body?.regenerer && (etat.piliers as any)[cle]?.length) return json({ piliers: etat.piliers });
      const a = await appelerOutil(apiKey, model, avecReponses(promptPiliers({ ...ctx, ...pe }), ""),
        { name: "enregistrer_piliers", description: "Enregistre les 5 piliers de contenu.", input_schema: SCHEMA_PILIERS }, 2000);
      await compter(a.usage);
      const piliers = (a.brut?.piliers || []).map((p: any) => ({ titre: txt(p.titre, 80), description: txt(p.description, 300) })).filter((p: Pilier) => p.titre).slice(0, 5);
      if (!piliers.length) throw new Error("Réponse illisible, réessayez.");
      await sauver({ piliers: { ...etat.piliers, [cle]: piliers } });
      return json({ piliers: etat.piliers });
    }

    if (action === "sujets") {
      const cle = String(body?.cle || ""); const pe = personaDe(cle);
      if (!pe) return json({ error: "Persona introuvable : rechargez la page." }, 400);
      const pilier: Pilier = { titre: txt(body?.pilier?.titre, 80), description: txt(body?.pilier?.description, 300) };
      if (!pilier.titre) return json({ error: "Choisissez un pilier." }, 400);
      const k = `${cle}|${pilier.titre}`;
      const idees = { ...(etat.idees as Record<string, any[]>) };
      if (!body?.encore && idees[k]?.length) return json({ sujets: idees[k] });
      const deja = [...(idees[k] || []).map((s: any) => s.titre), ...(etat.sujets_utilises as string[])];
      const a = await appelerOutil(apiKey, model, avecReponses(promptSujets({ ...ctx, ...pe, pilier, deja, reseau: RESEAUX[body?.reseau] ? body.reseau : undefined }), ""),
        { name: "enregistrer_sujets", description: "Enregistre les idées de sujets.", input_schema: SCHEMA_SUJETS }, 3000);
      await compter(a.usage);
      const nouveaux = (a.brut?.sujets || []).map((s: any) => ({ titre: txt(s.titre, 160), angle: txt(s.angle, 400) })).filter((s: any) => s.titre);
      if (!nouveaux.length) throw new Error("Réponse illisible, réessayez.");
      idees[k] = [...nouveaux, ...(body?.encore ? idees[k] || [] : [])].slice(0, 48);
      await sauver({ idees });
      return json({ sujets: idees[k] });
    }

    if (action === "rediger" || action === "retoucher") {
      let p: { cle: string; pilier: Pilier; sujet: { titre: string; angle?: string }; reseau: string; format: string; detail?: string };
      let precedent: any = null;
      if (action === "retoucher") {
        if (!RETOUCHES[body?.consigne] && !txt(body?.consigne, 500)) return json({ error: "Consigne manquante." }, 400);
        const { data: c } = await admin.from("bilan_contenus").select("resultat, brief").eq("id", body?.id).eq("member_id", user.id).maybeSingle();
        if (!c?.brief?.studio) return json({ error: "Contenu introuvable." }, 404);
        p = c.brief.studio; precedent = c.resultat;
      } else {
        p = {
          cle: String(body?.cle || ""), pilier: { titre: txt(body?.pilier?.titre, 80), description: txt(body?.pilier?.description, 300) },
          sujet: { titre: txt(body?.sujet?.titre, 200), angle: txt(body?.sujet?.angle, 400) },
          reseau: String(body?.reseau || ""), format: String(body?.format || ""), detail: txt(body?.detail, 1500),
        };
        if (!p.sujet.titre) return json({ error: "Choisissez ou écrivez un sujet." }, 400);
      }
      const pe = personaDe(p.cle);
      if (!pe) return json({ error: "Persona introuvable : rechargez la page." }, 400);
      const rf = trouverFormat(p.reseau, p.format);
      if (!rf) return json({ error: "Réseau ou format inconnu." }, 400);
      const { data: recents } = await admin.from("bilan_contenus").select("resultat").eq("member_id", user.id).like("format", "sc:%").order("created_at", { ascending: false }).limit(8);
      let prompt = avecReponses(promptRedaction({ ...ctx, ...pe, ...p, dejaFaits: (recents || []).map((x: any) => x.resultat?.titre).filter(Boolean) }), "");
      if (precedent) prompt = promptRetouche(prompt, precedent, RETOUCHES[body.consigne] ? body.consigne : txt(body.consigne, 500));
      const a = await appelerOutil(apiKey, model, prompt, { name: "enregistrer_contenu", description: "Enregistre le contenu créé.", input_schema: SCHEMA }, 6000);
      await compter(a.usage);
      if (!a.brut?.elements?.length) throw new Error(`Réponse illisible (arrêt : ${a.stop}). Réessayez.`);
      const { resultat, alertes } = nettoyer(a.brut, [...(carte?.voix?.mots_bannis || []), ...FORMULES_CREUSES]);
      const { data: l, error } = await admin.from("bilan_contenus").insert({
        member_id: user.id, mission_id: null, format: `sc:${p.reseau}:${p.format}`,
        persona_index: p.cle === "pro" ? null : +p.cle.slice(1), persona_prenom: pe.persona.prenom || null,
        brief: { studio: p, retouche: action === "retoucher" ? body.consigne : undefined, base: action === "retoucher" ? body.id : undefined }, resultat,
      }).select("id, created_at, format, persona_prenom, brief").single();
      if (error) throw new Error("Enregistrement impossible : " + error.message);
      if (action === "rediger") {
        const l2 = (etat.sujets_utilises as string[]).filter((x) => x !== p.sujet.titre);
        await sauver({ sujets_utilises: [p.sujet.titre, ...l2].slice(0, 300) });
      }
      return json({ ...l, resultat, alertes, sujets_utilises: etat.sujets_utilises, restant: LIMITE_CONTENUS - (count || 0) - 1 });
    }

    return json({ error: `Action inconnue : ${action}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
