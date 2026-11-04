// Edge Function : analyse-site
// Lit les pages publiques du site d'un photographe et demande à Claude de proposer
// une réponse (A/B/C/U) avec preuve pour chaque question vérifiable du bilan.
// Entrée : POST { bilan_id: string, url: string }  (Authorization: Bearer <jwt du membre>)
// Secrets requis : ANTHROPIC_API_KEY. Optionnel : ANTHROPIC_MODEL.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { parse } from "npm:node-html-parser@6.1.13";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_PAGES = 8;
const MAX_TEXT_PER_PAGE = 5000;
const KEYWORDS = [
  "contact", "tarif", "prix", "nouveau", "naissance", "newborn", "grossesse", "maternite", "bebe", "enfant", "famille",
  "seance", "prestation", "studio", "propos", "qui-suis", "faq", "question", "avis", "temoignage", "deroulement", "portfolio",
];

type Page = {
  url: string; ok: boolean; title?: string; description?: string; h1?: string[]; h2?: string[];
  viewport?: boolean; forms?: number; contactLinks?: string[]; internalLinks?: string[]; text?: string;
  ms?: number; poidsKo?: number; images?: number; imagesSansAlt?: number; mots?: number; prix?: boolean; telephone?: boolean;
};

function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  const url = new URL(u);
  url.hash = "";
  return url.toString();
}

const strip = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

async function fetchPage(url: string, origin: string): Promise<Page> {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MonPhotographeBebe-Bilan/1.0; +https://monphotographebebe.fr)",
        "Accept-Language": "fr-FR,fr;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("html")) return { url, ok: false };
    const html = await res.text();
    const ms = Date.now() - t0;
    const root = parse(html);
    root.querySelectorAll("script,style,noscript,svg,iframe").forEach((n) => n.remove());
    const links = root.querySelectorAll("a[href]").map((a) => ({ href: a.getAttribute("href") || "", text: a.text.trim() }));
    const abs = (h: string) => { try { return new URL(h, url).toString().split("#")[0]; } catch { return ""; } };
    const internal = [...new Set(links.map((l) => abs(l.href)).filter((h) => h.startsWith(origin)))];
    const contactLinks = [...new Set(links
      .filter((l) => /contact|devis|reserv|rendez|disponib|mailto:|tel:|wa\.me|whatsapp/i.test(l.href + " " + l.text))
      .map((l) => `${l.text.slice(0, 40)} -> ${l.href.slice(0, 80)}`))].slice(0, 10);
    const fullText = (root.querySelector("body")?.text || "").replace(/\s+/g, " ").trim();
    const text = fullText.slice(0, MAX_TEXT_PER_PAGE);
    const imgs = root.querySelectorAll("img");
    return {
      url, ok: true,
      title: root.querySelector("title")?.text.trim(),
      description: root.querySelector('meta[name="description"]')?.getAttribute("content")?.trim(),
      h1: root.querySelectorAll("h1").map((h) => h.text.trim()).filter(Boolean).slice(0, 3),
      h2: root.querySelectorAll("h2").map((h) => h.text.trim()).filter(Boolean).slice(0, 12),
      viewport: !!root.querySelector('meta[name="viewport"]'),
      forms: root.querySelectorAll("form").length,
      contactLinks, internalLinks: internal, text,
      ms, poidsKo: Math.round(html.length / 1024), images: imgs.length,
      imagesSansAlt: imgs.filter((i) => !(i.getAttribute("alt") || "").trim()).length,
      mots: fullText ? fullText.split(" ").length : 0,
      prix: /\d[\d\s.,]*\s?€|€\s?\d/.test(fullText),
      telephone: /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/.test(fullText) || links.some((l) => l.href.startsWith("tel:")),
    };
  } catch (_e) {
    return { url, ok: false };
  }
}

function pickPages(home: Page): string[] {
  const scored = (home.internalLinks || [])
    .filter((u) => !/\.(jpg|jpeg|png|webp|pdf|zip)$/i.test(u) && !/wp-content|\/tag\/|\/category\/|\/feed|\?/i.test(u))
    .map((u) => ({ u, s: KEYWORDS.filter((k) => strip(u).includes(k)).length }))
    .filter((x) => x.s > 0 && x.u !== home.url)
    .sort((a, b) => b.s - a.s);
  return [...new Set(scored.map((x) => x.u))].slice(0, MAX_PAGES - 1);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST attendu" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: "Non connecté" }, 401);

  let body: { bilan_id?: string; url?: string; cible?: string };
  try { body = await req.json(); } catch { return json({ error: "Corps JSON invalide" }, 400); }
  if (!body.bilan_id || !body.url) return json({ error: "bilan_id et url requis" }, 400);

  // Le bilan doit appartenir au membre connecté
  const { data: bilan } = await admin.from("bilan_bilans").select("id, member_id").eq("id", body.bilan_id).single();
  if (!bilan || bilan.member_id !== user.id) return json({ error: "Bilan introuvable" }, 404);

  let start: string;
  try { start = normalizeUrl(body.url); } catch { return json({ error: "Adresse de site invalide" }, 400); }
  const origin = new URL(start).origin;
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return json({ error: "Clé ANTHROPIC_API_KEY absente des secrets" }, 500);
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
  const cible = body.cible === "fiche" ? "fiche" : "site";

  if (cible === "site") await admin.from("bilan_bilans").update({ site_url: start, updated_at: new Date().toISOString() }).eq("id", bilan.id);
  const { data: analyse } = await admin.from("bilan_analyses")
    .insert({ bilan_id: bilan.id, url: start, modele: model }).select("id").single();

  try {
    // 1. Lecture des pages
    const home = await fetchPage(start, origin);
    if (!home.ok) throw new Error(cible === "fiche" ? "La fiche n'a pas pu être lue." : "La page d'accueil n'a pas pu être lue.");
    const others = cible === "site" ? await Promise.all(pickPages(home).map((u) => fetchPage(u, origin))) : [];
    const pages = [home, ...others].filter((p) => p.ok);
    const thin = pages.reduce((n, p) => n + (p.text?.length || 0), 0) < 600;

    // Contrôles techniques simples, calculés sans IA
    const titres = pages.map((p) => (p.title || "").trim());
    const pagesTech = pages.map((p) => ({
      url: p.url, titre: p.title || null, titre_long: (p.title || "").length, description: !!p.description, description_long: (p.description || "").length,
      h1: (p.h1 || []).length, viewport: !!p.viewport, mots: p.mots || 0, images: p.images || 0, images_sans_alt: p.imagesSansAlt || 0,
      contact: (p.contactLinks || []).length > 0 || (p.forms || 0) > 0, prix: !!p.prix, telephone: !!p.telephone, ms: p.ms || 0, poids_ko: p.poidsKo || 0,
      titre_double: !!p.title && titres.filter((t) => t === (p.title || "").trim()).length > 1,
    }));
    const n = pagesTech.length || 1;
    const totalImg = pagesTech.reduce((s, p) => s + p.images, 0), sansAlt = pagesTech.reduce((s, p) => s + p.images_sans_alt, 0);
    const controles = {
      https: start.startsWith("https://"),
      mobile: pagesTech.every((p) => p.viewport),
      titres_ok: pagesTech.filter((p) => p.titre_long >= 25 && p.titre_long <= 65 && !p.titre_double).length,
      descriptions_ok: pagesTech.filter((p) => p.description_long >= 70 && p.description_long <= 170).length,
      h1_ok: pagesTech.filter((p) => p.h1 === 1).length,
      contact_pages: pagesTech.filter((p) => p.contact).length,
      prix_visible: pagesTech.some((p) => p.prix),
      telephone_visible: pagesTech.some((p) => p.telephone),
      images: totalImg, images_sans_alt: sansAlt,
      temps_moyen_ms: Math.round(pagesTech.reduce((s, p) => s + p.ms, 0) / n),
      pages: pagesTech.length,
    };

    // 2. Questions vérifiables
    const { data: questions } = await admin.from("bilan_questions")
      .select("id, texte, dimension, bilan_question_options(code, libelle)")
      .eq("verifiable", cible).eq("active", true).order("id");

    const grille = (questions || []).map((q: any) => {
      const opts = (q.bilan_question_options || []).sort((a: any, b: any) => a.code.localeCompare(b.code))
        .map((o: any) => `   ${o.code} : ${o.libelle}`).join("\n");
      return `${q.id} - ${q.texte}\n${opts}`;
    }).join("\n\n");

    const corpus = pages.map((p) => [
      `### PAGE ${p.url}`,
      `Titre (balise title) : ${p.title || "(absent)"}`,
      `Meta description : ${p.description || "(absente)"}`,
      `H1 : ${(p.h1 || []).join(" | ") || "(aucun)"}`,
      `H2 : ${(p.h2 || []).join(" | ") || "(aucun)"}`,
      `Formulaires : ${p.forms} · Balise viewport mobile : ${p.viewport ? "oui" : "non"} · Mots : ${p.mots} · Images : ${p.images} (dont ${p.imagesSansAlt} sans texte alternatif) · Prix visible : ${p.prix ? "oui" : "non"} · Téléphone visible : ${p.telephone ? "oui" : "non"}`,
      `Liens de contact : ${(p.contactLinks || []).join(" ; ") || "(aucun)"}`,
      `Texte visible : ${p.text}`,
    ].join("\n")).join("\n\n");

    const objet = cible === "fiche"
      ? "la fiche publique d'un photographe professionnel qui accompagne les familles de la grossesse aux 3 ans de l'enfant, sur l'annuaire Mon Photographe Bébé, celle que voient les familles"
      : "le site public d'un photographe professionnel qui accompagne les familles de la grossesse aux 3 ans de l'enfant (grossesse, naissance, bébé, enfant, famille)";
    const prompt = `Vous analysez ${objet} pour le bilan visibilité de Mon Photographe Bébé.

Pour CHAQUE question de la grille, proposez la réponse qui décrit le mieux ce qui est RÉELLEMENT visible dans les pages fournies.

Règles strictes :
- Basez-vous uniquement sur le contenu fourni ci-dessous. N'inventez rien.
- Si l'information ne peut pas être établie avec ces pages (page absente, contenu chargé dynamiquement, doute), répondez "U".
- "constat" : une ou deux phrases en français, en vouvoyant le photographe, factuelles et bienveillantes, sans jugement sur la qualité des photos. N'utilisez pas de tiret cadratin.
- Écriture neutre : on ne sait pas si la personne photographe est une femme ou un homme. Vouvoiement sans aucun accord au féminin ni au masculin qui la concerne ; parlez des parents ou des familles, pas seulement des mères ; pas de point médian.
- "preuve" : un extrait EXACT copié depuis les pages (200 caractères maximum), ou la description précise de l'absence constatée (ex. « aucun lien de contact sur la page /nouveau-ne »).
- "source_url" : l'adresse de la page concernée.
- Les titres de page à juger pour G09 sont les balises "Titre (balise title)".
${thin ? "- ATTENTION : très peu de texte a pu être lu. Le site est probablement construit avec un outil qui charge le contenu en JavaScript. Répondez U partout où vous n'avez pas de preuve directe.\n" : ""}
${cible === "site" ? `En plus des constats, rédigez dans "site" une lecture de son site, comme le ferait un futur ou jeune parent puis une consultante en visibilité :
- "synthese" : 3 ou 4 phrases sur l'impression d'ensemble (ce qui donne envie, ce qui freine), en citant des éléments précis.
- "priorites" : les 3 améliorations les plus rentables, chacune avec un titre court, le comment (action concrète) et la page concernée.
- "pages" : pour chaque page lue, son rôle (accueil, prestation, tarifs, à propos, contact, autre), une phrase de résumé, 1 à 3 points forts et 1 à 3 améliorations précises (titre de page, texte, appel à l'action, information manquante).
Contrôles techniques déjà mesurés (à utiliser, ne pas recalculer) : ${JSON.stringify(controles)}
` : ""}
Vous DEVEZ enregistrer vos réponses en appelant l'outil "enregistrer_constats", une seule fois, avec une entrée par question de la grille${cible === "site" ? " et l'objet \"site\"" : ""}. Constats concis. N'écrivez rien d'autre.

=== GRILLE ===
${grille}

=== PAGES LUES (${pages.length}) ===
${corpus}`;

    // 3. Appel à Claude
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 24000,
        tools: [{
          name: "enregistrer_constats",
          description: "Enregistre un constat par question vérifiable du bilan.",
          input_schema: {
            type: "object",
            properties: {
              constats: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    question_id: { type: "string" },
                    proposition: { type: "string", enum: ["A", "B", "C", "U"] },
                    constat: { type: "string", description: "Une ou deux phrases, vouvoiement." },
                    preuve: { type: "string", description: "Extrait exact (200 caractères max) ou absence constatée." },
                    source_url: { type: "string" },
                  },
                  required: ["question_id", "proposition", "constat"],
                },
              },
              site: {
                type: "object",
                properties: {
                  synthese: { type: "string" },
                  priorites: { type: "array", items: { type: "object", properties: { titre: { type: "string" }, comment: { type: "string" }, page: { type: "string" } }, required: ["titre", "comment"] } },
                  pages: { type: "array", items: { type: "object", properties: {
                    url: { type: "string" }, role: { type: "string" }, resume: { type: "string" },
                    forces: { type: "array", items: { type: "string" } }, ameliorations: { type: "array", items: { type: "string" } },
                  }, required: ["url", "resume"] } },
                },
              },
            },
            required: ["constats"],
          },
        }],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const out = await res.json();
    if (!res.ok) throw new Error(`API Anthropic : ${out?.error?.message || res.status}`);
    const entree: any = (out.content || []).find((c: any) => c.type === "tool_use")?.input ?? null;
    let items: any = entree?.constats ?? null;
    let lectureSite: any = entree?.site ?? null;
    if (typeof lectureSite === "string") { try { lectureSite = JSON.parse(lectureSite); } catch { lectureSite = null; } }
    if (typeof items === "string") { try { items = JSON.parse(items); } catch { items = null; } }
    if (!Array.isArray(items)) {
      const raw = (out.content || []).map((c: any) => c.text || "").join("");
      const match = raw.match(/\[[\s\S]*\]/);
      try { items = match ? JSON.parse(match[0]) : null; } catch { items = null; }
      if (!Array.isArray(items)) throw new Error(`Réponse de l'IA illisible (arrêt : ${out.stop_reason}). Début : ${raw.slice(0, 200)}`);
    }
    const valid = new Set((questions || []).map((q: any) => q.id));
    const constats = (items as any[])
      .filter((c) => c && valid.has(c.question_id) && ["A", "B", "C", "U"].includes(c.proposition))
      .map((c) => ({
        analyse_id: analyse!.id, bilan_id: bilan.id, question_id: c.question_id, proposition: c.proposition,
        constat: String(c.constat || "").replace(/—/g, "-").slice(0, 600),
        preuve: c.preuve ? String(c.preuve).replace(/—/g, "-").slice(0, 400) : null,
        source_url: c.source_url || null,
      }));

    // 4. Enregistrement
    await admin.from("bilan_constats").delete().eq("analyse_id", analyse!.id);
    if (constats.length) await admin.from("bilan_constats").insert(constats);
    await admin.from("bilan_analyses").update({
      statut: "termine", finished_at: new Date().toISOString(),
      pages: pages.map((p) => ({ url: p.url, titre: p.title || null })),
      audit: cible === "site" ? JSON.parse(JSON.stringify({ controles, pages_tech: pagesTech, lecture: lectureSite }).replace(/\u2014/g, "-")) : null,
      tokens_in: out.usage?.input_tokens, tokens_out: out.usage?.output_tokens,
    }).eq("id", analyse!.id);

    return json({ analyse_id: analyse!.id, cible, pages: pages.map((p) => p.url), contenu_limite: thin, constats, audit: cible === "site" ? { controles, lecture: lectureSite } : null });
  } catch (e) {
    await admin.from("bilan_analyses").update({ statut: "erreur", erreur: String((e as Error).message), finished_at: new Date().toISOString() }).eq("id", analyse!.id);
    return json({ error: (e as Error).message, analyse_id: analyse!.id }, 502);
  }
});
