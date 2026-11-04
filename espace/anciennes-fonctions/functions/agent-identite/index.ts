// Edge Function : agent-identite
// Lit le questionnaire « Mon identité » du membre (et le contexte de son bilan),
// rédige sa carte d'identité (promesse, piliers, personas, voix, style, limites) et l'enregistre.
// Entrée : POST {} pour une première carte, ou { mise_a_jour: true, carte, precisions } pour mettre à jour en gardant les corrections

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const LIMITE_MENSUELLE = 10;

type Q = { id: string; bloc: string; ordre: number; texte: string; type: string; options: string[]; condition?: string | null };

// Mêmes règles que l'application : une question « lieu » ne compte que si la photographe a un lieu à elle, « exterieur » que si elle fait de l'extérieur
const LIEUX_PROPRES = ["Dans mon studio dédié", "Dans un espace aménagé chez moi", "Dans un studio loué"];
function visible(q: Q, rep: Record<string, R>): boolean {
  const v = rep.PR01?.v || [];
  if (q.condition === "lieu") return v.some((x) => LIEUX_PROPRES.includes(x));
  if (q.condition === "exterieur") return v.includes("En extérieur");
  return true;
}
type R = { v?: string[]; autre?: string; t?: string; c?: string[] };

function lireReponse(q: Q, r: R | undefined): string | null {
  if (!r) return null;
  const morceaux: string[] = [];
  if (r.v?.length) morceaux.push(r.v.map((x) => (x === "Autre" && r.autre ? `Autre : ${r.autre}` : x)).join(" ; "));
  if (r.c?.some((x) => x?.trim())) morceaux.push(q.options.map((o, i) => (r.c?.[i]?.trim() ? `${o} : ${r.c[i].trim()}` : null)).filter(Boolean).join(" ; "));
  if (r.t?.trim()) morceaux.push(r.t.trim());
  return morceaux.length ? morceaux.join(" | ") : null;
}

const SCHEMA = {
  type: "object",
  properties: {
    promesse: { type: "string", description: "Une phrase : ce que la photographe apporte et à qui, avec les mots de ses clients." },
    piliers: {
      type: "array", description: "3 piliers qui la distinguent, chacun appuyé sur une preuve déclarée.",
      items: { type: "object", properties: { titre: { type: "string" }, preuve: { type: "string" } }, required: ["titre", "preuve"] },
    },
    personas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          specialite: { type: "string" },
          prenom: { type: "string" },
          portrait: { type: "string", description: "2 ou 3 phrases : qui est cette personne (maman, papa ou couple), sa situation, son quotidien." },
          cherche: { type: "array", items: { type: "string" } },
          freins: { type: "array", items: { type: "string" } },
          ce_qui_la_decide: { type: "array", items: { type: "string" } },
          ou_la_trouver: { type: "array", items: { type: "string" } },
          ses_mots: { type: "string", description: "Les objections ou freins entendus avant la réservation, avec les mots des parents, tels que déclarés (réponse « objections ou freins »), sinon chaîne vide. Ils nourrissent aussi « freins »." },
          themes: { type: "array", description: "4 ou 5 thèmes de communication qui lui parlent.", items: { type: "string" } },
          a_eviter: { type: "string", description: "Le client qui ne correspond pas, en une phrase." },
          rapport_photo: { type: "string", description: "Son rapport à la photo et à l'objectif, en une phrase (première séance, déception passée, peu de photos de famille…). Vide si non renseigné." },
          declencheurs: { type: "array", description: "Ce qui déclenche sa recherche : le moment où il faut lui parler.", items: { type: "string" } },
          ce_quil_regarde: { type: "array", description: "Ce que cette personne regarde avant d'écrire : les contenus à soigner en priorité.", items: { type: "string" } },
          valeur: { type: "array", description: "Ce pour quoi elle accepte de payer plus : ce qui justifie le prix à ses yeux.", items: { type: "string" } },
          occasions: { type: "array", description: "Les occasions pour lesquelles elle pourrait revenir.", items: { type: "string" } },
        },
        required: ["specialite", "prenom", "portrait", "cherche", "freins", "themes"],
      },
    },
    voix: {
      type: "object",
      properties: {
        adresse: { type: "string", description: "Vous ou tu, selon le support." },
        registre: { type: "string" },
        regles: { type: "array", description: "4 à 6 règles d'écriture concrètes, déduites des réponses et du texte collé.", items: { type: "string" } },
        mots_a_employer: { type: "array", items: { type: "string" } },
        mots_bannis: { type: "array", items: { type: "string" } },
        exemple: { type: "string", description: "2 ou 3 phrases d'exemple écrites avec sa voix, à la première personne, adressées aux parents." },
      },
      required: ["adresse", "registre", "regles", "mots_a_employer", "mots_bannis", "exemple"],
    },
    style_images: {
      type: "object",
      properties: { mots: { type: "array", items: { type: "string" } }, images_phares: { type: "array", items: { type: "string" } } },
      required: ["mots"],
    },
    limites: { type: "array", items: { type: "string" } },
    pratique: {
      type: "object", description: "Les informations pratiques déclarées, recopiées fidèlement en phrases courtes. Champ vide si non renseigné.",
      properties: {
        lieux: { type: "string", description: "Où se passent les séances (studio, chez elle, domicile des familles, extérieur, maternité)." },
        studio: { type: "string", description: "Son lieu de séance à elle (studio ou espace aménagé) : ville, quartier, surface, accès. Vide si elle n'a pas de lieu à elle." },
        confort: { type: "string", description: "Le confort offert dans son lieu. Vide si elle n'a pas de lieu à elle." },
        zone: { type: "string", description: "Ville principale, villes desservies, frais de déplacement." },
        exterieur: { type: "string" },
        disponibilites: { type: "string" },
        seance: { type: "string", description: "Durée, tarif d'entrée, délai de livraison, nombre d'images." },
        livrables: { type: "string", description: "Ce que reçoivent les familles." },
        langues: { type: "string" },
      },
    },
    questions_ouvertes: { type: "array", description: "Informations pratiques vraiment manquantes à faire préciser, 3 au maximum. Peut être vide.", items: { type: "string" } },
  },
  required: ["promesse", "piliers", "personas", "voix", "style_images", "limites"],
};

const SCHEMA_PORTRAIT = {
      type: "object",
      properties: {
        lecture: { type: "string", description: "Notre lecture, 3 à 5 phrases : ce qui ressort immédiatement quand on croise toutes ses réponses, ce qui est fort, ce qui reste flou. Une conclusion, jamais un résumé." },
        fils_rouges: {
          type: "array", description: "2 ou 3 fils rouges : des motifs qui reviennent dans plusieurs réponses différentes, qu'elle n'a pas forcément vus elle-même.",
          items: { type: "object", properties: {
            titre: { type: "string", description: "Le motif, en quelques mots précis." },
            constat: { type: "string", description: "Les réponses où il apparaît, citées brièvement (au moins trois, dans des blocs différents), en une ou deux phrases." },
            ce_que_ca_dit: { type: "string", description: "1 ou 2 phrases : ce que ce motif dit concrètement de sa façon de travailler et de la place qu'elle prend auprès des familles." },
          }, required: ["titre", "constat", "ce_que_ca_dit"] },
        },
        signes_distinctifs: {
          type: "array", description: "Exactement 4 axes différenciants.",
          items: { type: "object", properties: {
            titre: { type: "string", description: "Nom de l'axe : 3 à 6 mots, précis et mémorisable, que personne d'autre ne pourrait porter." },
            pourquoi: { type: "string", description: "2 ou 3 phrases d'analyse : les réponses croisées qui le prouvent, et en quoi c'est rare chez les photographes de famille (pas une qualité que tout le monde revendique)." },
            note_psy: { type: "string", description: "Ce que cet axe révèle, en une phrase factuelle : de sa relation au métier, aux familles ou à son image. Sans interprétation psychologique." },
            question: { type: "string", description: "Une question d'introspection, précise, pour creuser cet axe (pas un conseil de communication)." },
          }, required: ["titre", "pourquoi", "note_psy", "question"] },
        },
        tensions: {
          type: "array", description: "1 ou 2 tensions ou écarts relevés dans les réponses : entre ce qu'elle dit d'elle et ce que disent ses familles, entre ses valeurs et sa pratique, entre ce qu'elle aime et ce qu'elle vend. Vide s'il n'y en a pas de réelle.",
          items: { type: "object", properties: { constat: { type: "string", description: "L'écart, avec les réponses qui le montrent." }, question: { type: "string", description: "La question qu'il ouvre pour elle." } }, required: ["constat", "question"] },
        },
        voix: { type: "string", description: "Votre voix : 3 ou 4 phrases qui décrivent sa façon singulière de parler et d'être avec les familles, telle qu'elle ressort de ses réponses et de ses mots, pour l'aider à la reconnaître et à la garder." },
        direction: { type: "string", description: "Où vous allez : 2 ou 3 phrases sur la direction qui se dessine (les familles qu'elle veut vraiment accompagner, ce qu'elle a envie de développer), tirées de ce qu'elle aime, refuse et vise." },
        pieges: {
          type: "array", description: "2 ou 3 pièges propres à ce profil : ce qui pourrait la faire ressembler aux autres photographes et effacer sa différence.",
          items: { type: "object", properties: { piege: { type: "string", description: "Le piège, nommé en quelques mots." }, pourquoi: { type: "string", description: "1 ou 2 phrases : pourquoi c'est un risque pour elle précisément, d'après ses réponses." } }, required: ["piege", "pourquoi"] },
        },
        recit: { type: "string", description: "Votre trajectoire, 3 ou 4 phrases : pas un résumé du parcours, mais le lien entre ce qu'elle a vécu avant et sa façon de photographier aujourd'hui." },
        traits: { type: "array", description: "Les mots qui la décrivent, tels que choisis.", items: { type: "string" } },
        valeurs: { type: "array", description: "Ses valeurs, telles que choisies.", items: { type: "string" } },
        mots_clients: { type: "array", description: "Les mots que ses clients emploient pour parler d'elle, tels qu'elle les a donnés. Vide si elle ne les a pas donnés.", items: { type: "string" } },
        rituel: { type: "string", description: "Sa signature : ce qui la caractérise le plus dans son activité, en une phrase à partir de sa réponse. Vide si elle n'a rien écrit." },
        convictions: { type: "string", description: "2 ou 3 phrases à la première personne, comme un petit manifeste : ce en quoi elle croit et ce qu'elle refuse. Vide si elle n'a rien répondu sur ce point." },
        passions: { type: "array", items: { type: "object", properties: { passion: { type: "string" }, ce_que_ca_dit: { type: "string", description: "Ce que cette passion dit de sa façon de travailler." } }, required: ["passion", "ce_que_ca_dit"] } },
      },
      required: ["lecture", "fils_rouges", "signes_distinctifs", "voix", "direction", "pieges", "recit", "traits", "valeurs"],
    };
const BLOCS_BRANDING = ["b_parcours", "b_methode", "b_familles", "b_perso", "b_nourrit"];

async function appeler(apiKey: string, prompt: string, nom: string, schema: unknown, maxTokens: number) {
  const model = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, tools: [{ name: nom, description: "Enregistre le résultat.", input_schema: schema }], tool_choice: { type: "auto" }, messages: [{ role: "user", content: prompt }] }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(`API Anthropic : ${out?.error?.message || res.status}`);
  if (out.stop_reason === "max_tokens") throw new Error("La réponse a été coupée avant la fin. Réessayez dans un instant.");
  let r: any = (out.content || []).find((c: any) => c.type === "tool_use")?.input ?? null;
  if (!r) {
    const raw = (out.content || []).map((c: any) => c.text || "").join("");
    const m = raw.match(/\{[\s\S]*\}/);
    try { r = m ? JSON.parse(m[0]) : null; } catch { r = null; }
    if (!r) throw new Error(`Réponse du studio de création illisible (arrêt : ${out.stop_reason}).`);
  }
  return { r: JSON.parse(JSON.stringify(r).replace(/\u2014/g, "-")), usage: out.usage };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } });
    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Non connecté" }, 401);
    const body = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "Clé absente côté serveur." }, 500);

    const depuis = new Date(Date.now() - 30 * 864e5).toISOString();
    const { count } = await admin.from("bilan_agent_appels").select("id", { count: "exact", head: true })
      .eq("member_id", user.id).eq("agent", "identite").gte("created_at", depuis);
    if ((count || 0) >= LIMITE_MENSUELLE) return json({ error: `Vous avez atteint la limite de ${LIMITE_MENSUELLE} cartes ce mois-ci. Vous pouvez toujours modifier votre carte à la main.` }, 429);

    const [{ data: ident }, { data: qs }, { data: bilans }] = await Promise.all([
      admin.from("bilan_identite").select("*").eq("member_id", user.id).maybeSingle(),
      admin.from("bilan_identite_questions").select("id, bloc, ordre, texte, type, options, condition").eq("active", true).order("bloc").order("ordre"),
      admin.from("bilan_bilans").select("id, site_url").eq("member_id", user.id).order("created_at", { ascending: false }).limit(1),
    ]);
    if (!ident) return json({ error: "Questionnaire vide." }, 400);
    const rep = (ident.reponses || {}) as Record<string, R>;
    const questions = ((qs || []) as Q[]).filter((q) => visible(q, rep));
    const ordreBlocs = ["vous", "pratique", "persona", "style", "voix", "limites"];
    questions.sort((a, b) => ordreBlocs.indexOf(a.bloc) - ordreBlocs.indexOf(b.bloc) || a.ordre - b.ordre);

    // ---- Mode « portrait » : le personal branding, indépendant de la carte ----
    if (body?.portrait) {
      const lb: string[] = [];
      for (const bloc of BLOCS_BRANDING) {
        for (const q of questions.filter((x) => x.bloc === bloc).sort((a, b) => a.ordre - b.ordre)) { const v = lireReponse(q, rep[q.id]); if (v) lb.push(`- ${q.texte} -> ${v}`); }
      }
      if (lb.length < 5) return json({ error: "Répondez à quelques questions de plus pour que notre studio de création puisse dresser votre portrait." }, 400);
      const spes = (rep.ID01?.v || []).map((x) => (x === "Autre" && rep.ID01?.autre ? rep.ID01.autre : x)).slice(0, 3);
      const promptP = `Vous êtes le studio de personal branding de Mon Photographe Bébé. Une photographe qui accompagne les familles de la grossesse aux 3 ans de l'enfant vient de répondre à un questionnaire sur son parcours, sa façon de travailler, ce que disent ses familles, sa personnalité, ce qui la nourrit et ses convictions. Elle a surtout coché, et écrit quelques mots par endroits : ses phrases écrites sont les plus précieuses.

Votre rôle n'est pas de lui résumer ce qu'elle a dit, ni de lui donner des conseils de communication. C'est un travail d'introspection : l'aider à comprendre qui elle est comme photographe, où elle va, et ce qui la différencie vraiment des autres, pour qu'elle trouve sa voix. Elle doit lire une analyse travaillée, qui lui apprend quelque chose sur elle.

Méthode :
- Croisez les réponses entre elles. Chaque phrase de votre analyse relie au moins deux réponses, ou tire une conclusion qui n'est écrite nulle part telle quelle. Ne reformulez jamais une réponse seule.
- Cherchez les motifs qui reviennent (un mot, une idée, une façon de faire présente dans plusieurs blocs), les écarts (entre ce qu'elle dit d'elle et ce que disent ses familles, entre ses valeurs et sa pratique, entre ce qu'elle aime et ce qu'elle vend), et ce qui est rare chez les photographes de famille.
- Restez factuel : aucune psychologie de comptoir, aucune interprétation de son enfance, de blessures ou d'émotions cachées. Des constats tirés de ses réponses, et ce qu'ils impliquent pour son métier.
- Si son parcours avant la photographie touche à sa spécialité (soignant, sage-femme ou puériculture avec le nouveau-né, petite enfance avec les enfants, coaching ou psychologie avec la confiance en soi en séance grossesse...), c'est un différenciateur majeur : faites-en le premier axe.
- Si elle n'est pas à l'aise devant l'objectif, nommez-le comme une force : elle comprend de l'intérieur les parents qui ne se trouvent pas photogéniques.
- Les questions d'introspection sont précises et personnelles, jamais génériques (pas « qu'est-ce qui vous rend unique ? »).
- Ne donnez aucun conseil de communication (bio, publication, contenu, argument commercial) : ce n'est pas l'objet de cette partie.
- Mots et formules interdits : passionné, passion du métier, authenticité, authentique, bienveillance, bienveillant, sensibilité artistique, moments magiques, souvenirs inoubliables, à l'écoute, capturer l'instant.
- « traits », « valeurs » : ceux qu'elle a choisis, tels quels. « mots_clients », « rituel », « convictions » : seulement si elle a répondu, avec ses mots.
- Ton direct, précis, chaleureux sans flatterie ni condescendance.
- Écriture neutre : on ne sait pas si la personne photographe est une femme ou un homme. Vouvoiement sans aucun accord au féminin ni au masculin qui la concerne (reformulez : « tout est prêt » plutôt que « vous êtes prête ») ; parlez des parents ou des familles ; pas de point médian.
- Français soigné, jamais de tiret long ni demi-cadratin, « clients » et jamais « clientes ».
${spes.length ? `\nSes spécialités photo, par ordre d'importance : ${spes.join(", ")}\n` : ""}
=== SES RÉPONSES ===
${lb.join("\n")}

Enregistrez le portrait avec l'outil enregistrer_portrait.`;
      const { r: portrait, usage } = await appeler(apiKey, promptP, "enregistrer_portrait", SCHEMA_PORTRAIT, 16000);
      const maj: Record<string, unknown> = { portrait, updated_at: new Date().toISOString() };
      if (ident.carte) maj.carte = { ...ident.carte, histoire: portrait };
      await admin.from("bilan_identite").update(maj).eq("member_id", user.id);
      await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "portrait", tokens_in: usage?.input_tokens, tokens_out: usage?.output_tokens });
      return json({ portrait });
    }

    const brutes = (rep.ID01?.v || []).slice(0, 3);
    const nomSpe = (s: string) => (s === "Autre" && rep.ID01?.autre ? rep.ID01.autre : s);
    const specialites = brutes.map(nomSpe);
    if (!specialites.length) return json({ error: "Indiquez au moins une spécialité (question ID01)." }, 400);

    const lignes: string[] = [];
    for (const bloc of ordreBlocs) {
      const qb = questions.filter((q) => q.bloc === bloc);
      if (bloc === "persona") {
        for (const s of brutes) {
          const l = qb.map((q) => { const v = lireReponse(q, rep[`${q.id}|${s}`]); return v ? `- ${q.texte.replace(/\{seance\}/g, nomSpe(s).toLowerCase())} -> ${v}` : null; }).filter(Boolean);
          lignes.push(`\n## Persona pour la spécialité « ${nomSpe(s)} »`, ...(l.length ? l as string[] : ["- (non renseignée)"]));
        }
      } else {
        lignes.push(`\n## Bloc ${bloc}`);
        for (const q of qb) { const v = lireReponse(q, rep[q.id]); if (v) lignes.push(`- ${q.texte} -> ${v}`); }
      }
    }

    // Contexte du bilan : activité déclarée et quelques constats de l'analyse
    let contexte = "";
    const bilan = bilans?.[0];
    if (bilan) {
      const [{ data: br }, { data: bo }, { data: bc }] = await Promise.all([
        admin.from("bilan_reponses").select("question_id, valeur, texte_libre").eq("bilan_id", bilan.id).in("question_id", ["P01", "P02", "P03", "P04"]),
        admin.from("bilan_question_options").select("question_id, code, libelle").in("question_id", ["P01", "P02", "P03", "P04"]),
        admin.from("bilan_constats").select("constat").eq("bilan_id", bilan.id).order("created_at", { ascending: false }).limit(12),
      ]);
      const lib = (qid: string, code: string) => bo?.find((o: any) => o.question_id === qid && o.code === code)?.libelle || code;
      contexte = [
        ...(br || []).map((r: any) => `- ${r.question_id} : ${(r.valeur || []).map((c: string) => lib(r.question_id, c)).join(", ")}${r.texte_libre ? " " + JSON.stringify(r.texte_libre) : ""}`),
        bilan.site_url ? `- Site : ${bilan.site_url}` : "",
        ...(bc || []).map((c: any) => `- Constat de l'analyse : ${c.constat}`),
      ].filter(Boolean).join("\n");
    }

    // Mise à jour : on part de la carte actuelle (avec les corrections de la photographe) et de ses précisions
    const carteActuelle = body?.mise_a_jour ? (body.carte || ident.carte) : null;
    const precisions = (body?.precisions || (rep as any)._precisions || {}) as Record<string, string>;
    const precTxt = Object.entries(precisions).filter(([, v]) => v && String(v).trim()).map(([q, v]) => `- ${q} -> ${v}`).join("\n");
    const blocMaj = carteActuelle ? `

=== MISE À JOUR DE LA CARTE ===
La photographe a déjà une carte, qu'elle a relue et corrigée. Elle demande une mise à jour.
- Conservez tout ce qu'elle a corrigé ou écrit elle-même dans la carte actuelle, mot pour mot quand c'est possible.
- Intégrez ses précisions ci-dessous et ses réponses au questionnaire, qui ont pu changer.
- Ne reposez pas dans questions_ouvertes une question à laquelle elle a répondu. Gardez seulement les points encore flous.

Carte actuelle :
${JSON.stringify(carteActuelle)}

Précisions apportées par la photographe :
${precTxt || "(aucune)"}` : "";

    const prompt = `Vous êtes le studio d'identité de Mon Photographe Bébé, un annuaire de photographes qui accompagnent les familles de la grossesse jusqu'aux 3 ans de l'enfant (grossesse, naissance, bébé, enfant, famille).
À partir du questionnaire « Mon identité » d'une photographe membre, rédigez sa carte d'identité. Cette carte servira de base à tous les autres agents (présentation, sujets de communication, messages aux clients) : elle doit être précise, personnelle et utilisable.

Règles impératives :
- N'utilisez QUE les faits déclarés ci-dessous. N'inventez ni chiffre, ni formation, ni distinction, ni année. Si une information utile manque ou se contredit, ajoutez-la dans questions_ouvertes.
- Un persona par spécialité listée, dans le même ordre. Si un persona n'est pas renseigné, déduisez prudemment des réponses générales et signalez-le dans questions_ouvertes.
- Plusieurs cases cochées dans une même question d'un persona ne sont JAMAIS une contradiction : elles disent que ces clients se ressemblent mais varient (par exemple « premier enfant » et « deuxième enfant ou plus », ou « première séance » et « déçu par une séance précédente »). Écrivez le portrait en conséquence (« souvent un premier enfant, parfois un deuxième ») et ne posez aucune question là-dessus. Des personas différents d'une spécialité à l'autre sont normaux, et ne sont pas une contradiction non plus.
- questions_ouvertes : seulement une information pratique vraiment manquante et utile à la communication (un lieu, une zone, un tarif), jamais une question de détail sur le persona ni une question qui ne sert à rien pour écrire.
- Évitez les formules creuses que toutes les photographes emploient (lumineux et intemporel, moments magiques, souvenirs inoubliables, immortaliser) et respectez strictement les mots bannis déclarés.
- Écriture neutre : on ne sait pas si la personne photographe est une femme ou un homme. Vouvoiement sans aucun accord au féminin ni au masculin qui la concerne (reformulez : « tout est prêt » plutôt que « vous êtes prête ») ; parlez des parents ou des familles, pas seulement des mères ; pas de point médian.
- Les textes de la carte s'adressent à la photographe : vouvoiement. Seul le champ voix.exemple est écrit avec sa voix à elle, à la première personne, adressé aux parents, en respectant son choix vous ou tu.
- Français soigné, phrases courtes, jamais de tiret long (utilisez une virgule ou deux-points).
- Pour parler de la clientèle en général, écrivez « clients » et non « clientes ».
- Un persona peut être une maman, un papa ou un couple : déduisez-le des réponses et accordez le texte en conséquence. Sans indication, écrivez de façon neutre (« cette personne », « ces parents »).
- Les personas sont de futurs ou de jeunes parents, de la grossesse aux 3 ans de l'enfant : adaptez chaque persona à sa spécialité (une femme enceinte ou un couple qui attend un enfant pour la grossesse, des parents d'un enfant de 2 ans pour une séance enfant), sans tout ramener au nouveau-né.
- Les piliers : 3, chacun avec une preuve concrète tirée des réponses (une date, un chiffre, un engagement, un lieu).
- Les thèmes de communication de chaque persona partent de ses freins, de ce qu'il cherche et de ce qui l'a décidé.
- Les réponses du persona sont rangées par rubriques (son portrait, ses envies, sa façon de choisir, ses hésitations, son budget, après la séance) : reportez-les dans les champs correspondants (rapport_photo, declencheurs, ce_quil_regarde, valeur, occasions), sans rien inventer, et croisez-les pour une analyse utile : par exemple un déclencheur et une hésitation donnent un thème de communication et le bon moment pour le publier.
- « pratique » : recopiez fidèlement ce qu'elle a déclaré dans le bloc pratique (lieux, studio, zone, confort, séances, livrables), sans rien ajouter. Tous les photographes n'ont pas de studio : si ses lieux ne comprennent ni studio ni espace aménagé chez elle, laissez « studio » et « confort » vides et ne parlez jamais de studio dans la carte.
- Si son personal branding est fourni ci-dessous, appuyez-vous sur ses signes distinctifs pour les piliers, la promesse et la voix, sans le recopier.

Spécialités, dans l'ordre d'importance : ${specialites.join(", ")}

=== RÉPONSES AU QUESTIONNAIRE ===
${lignes.join("\n")}

=== SON PERSONAL BRANDING ===
${ident.portrait ? JSON.stringify(ident.portrait) : "(pas encore fait)"}

=== CONTEXTE DU BILAN ===
${contexte || "(aucun)"}${blocMaj}

Enregistrez la carte avec l'outil enregistrer_carte.`;

    const { r: carteBrute, usage } = await appeler(apiKey, prompt, "enregistrer_carte", SCHEMA, 16000);
    const carte: any = carteBrute;
    if (ident.portrait) carte.histoire = ident.portrait;

    const now = new Date().toISOString();
    await admin.from("bilan_identite").update({ carte, statut: "carte_proposee", carte_generee_at: now, updated_at: now }).eq("member_id", user.id);
    await admin.from("bilan_agent_appels").insert({ member_id: user.id, agent: "identite", tokens_in: usage?.input_tokens, tokens_out: usage?.output_tokens });
    return json({ carte, restant: LIMITE_MENSUELLE - (count || 0) - 1 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
