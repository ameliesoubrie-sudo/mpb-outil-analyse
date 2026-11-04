// Étape « questions » commune aux agents de contenu (studio Instagram, rédacteur de pages).
// Avant d'écrire, l'agent vérifie qu'il a de quoi produire un texte que seule cette photographe
// pourrait signer. Sinon il pose 1 à 4 questions précises. Les réponses sont gardées et resservent
// aux contenus suivants, pour ne jamais reposer la même question.

export type QR = { question: string; reponse: string };

export const SCHEMA_QUESTIONS = {
  type: "object",
  properties: {
    suffisant: { type: "boolean", description: "true si vous avez déjà tout pour écrire un texte vraiment personnel." },
    questions: {
      type: "array", description: "0 à 4 questions, de la plus utile à la moins utile.",
      items: {
        type: "object",
        properties: {
          question: { type: "string", description: "Une seule information demandée, en vouvoiement, chaleureuse et courte." },
          pourquoi: { type: "string", description: "En une phrase : ce que la réponse va changer dans le texte." },
          exemple: { type: "string", description: "Un court exemple de réponse pour l'aider à démarrer, jamais une réponse à sa place." },
        },
        required: ["question", "pourquoi"],
      },
    },
  },
  required: ["suffisant", "questions"],
};

// Bloc ajouté au prompt : réponses données pour ce contenu, et ce qu'elle a déjà raconté ailleurs
export function blocReponses(reponses: QR[], anciennes: QR[]): string {
  const r = (reponses || []).filter((x) => x?.reponse?.trim());
  const a = (anciennes || []).filter((x) => x?.reponse?.trim()).slice(0, 15);
  if (!r.length && !a.length) return "";
  return [
    r.length ? `=== SES RÉPONSES AUX QUESTIONS POUR CE CONTENU (à utiliser en priorité, avec ses mots) ===\n${r.map((x) => `- ${x.question}\n  -> ${x.reponse.trim()}`).join("\n")}` : "",
    a.length ? `=== CE QU'ELLE A DÉJÀ RACONTÉ POUR D'AUTRES CONTENUS (faits réels, réutilisables si pertinents) ===\n${a.map((x) => `- ${x.question}\n  -> ${x.reponse.trim()}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n") + "\n\n";
}

// Écriture neutre : les membres sont des photographes, femmes et hommes, et les clients sont des parents
export const REGLE_NEUTRE = `=== ÉCRITURE NEUTRE ===
On ne sait pas si cette personne photographe est une femme ou un homme. Dans tout ce qui s'adresse à elle (« angle », « a_completer », « questions », « note », conseils), écrivez au vouvoiement sans aucun accord au féminin ni au masculin qui la concerne : reformulez plutôt (« vous êtes prête » devient « tout est prêt », « installée depuis 10 ans » devient « 10 ans d'activité »). Dans les textes qu'elle signe, faites de même, sauf si sa carte indique clairement son genre. Parlez des « parents », des « futurs parents » ou des « familles », pas seulement des mères. Pas d'écriture inclusive avec point médian.

`;

// Insère la règle d'écriture neutre et le bloc de réponses avant les règles impératives du prompt de rédaction
export function avecReponses(prompt: string, bloc: string): string {
  const ajout = (prompt.includes("=== ÉCRITURE NEUTRE ===") || prompt.includes("Écriture neutre") ? "" : REGLE_NEUTRE) + (bloc || "");
  if (!ajout) return prompt;
  const i = prompt.indexOf("=== RÈGLES IMPÉRATIVES ===");
  return i < 0 ? prompt + "\n\n" + ajout : prompt.slice(0, i) + ajout + prompt.slice(i);
}

// Transforme le prompt de rédaction en prompt de questions
export function promptQuestions(promptRedaction: string, besoins?: string): string {
  const base = promptRedaction.replace(/Enregistrez le résultat avec l'outil enregistrer_contenu\.\s*$/, "").trimEnd();
  return `${base}

=== VOTRE TÂCHE MAINTENANT : PRÉPARER, PAS ENCORE ÉCRIRE ===
N'écrivez pas encore le contenu. Vérifiez d'abord si vous avez de quoi écrire un texte vraiment personnel, que seule cette photographe pourrait signer, et pas un texte générique qui irait à n'importe quelle photographe.
Il vous faut au minimum :
- les informations pratiques indispensables à ce contenu${besoins ? ` : ${besoins}` : ""} ;
- au moins un détail vécu, propre à elle et lié au sujet (une anecdote, un geste qu'elle fait, une phrase qu'elle dit ou qu'une famille lui a dite, un lieu précis, une habitude de ses séances).
Si tout cela figure déjà dans la carte, le brief, ses réponses ou ce qu'elle a déjà raconté, répondez suffisant = true sans aucune question.
Sinon, posez 1 à 4 questions :
- une seule information par question, courte, concrète, en vouvoiement, sur un ton chaleureux ;
- jamais une question dont la réponse est déjà ci-dessus, jamais une question vague (« parlez-moi de vous », « quelles sont vos valeurs ») ;
- d'abord celles dont la réponse changera le plus le texte ;
- pour chacune, dites en une phrase ce que la réponse va changer, et proposez un court exemple de réponse pour l'aider à démarrer (pas une réponse à sa place).

Enregistrez votre analyse avec l'outil preparer_questions.`;
}

// Appel commun à l'API : renvoie l'entrée de l'outil, ou le JSON trouvé dans le texte
export type ImageJointe = { media_type: string; data: string };
export async function appelerOutil(apiKey: string, model: string, prompt: string, outil: { name: string; description: string; input_schema: unknown }, maxTokens: number, images: ImageJointe[] = []) {
  const content = images.length
    ? [...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.media_type, data: i.data } })), { type: "text", text: prompt }]
    : prompt;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, tools: [outil], tool_choice: { type: "auto" }, messages: [{ role: "user", content }] }),
  });
  const out = await res.json();
  if (!res.ok) throw new Error(`API Anthropic : ${out?.error?.message || res.status}`);
  let brut: any = (out.content || []).find((c: any) => c.type === "tool_use")?.input ?? null;
  if (!brut) {
    const raw = (out.content || []).map((c: any) => c.text || "").join("");
    const m = raw.match(/\{[\s\S]*\}/);
    try { brut = m ? JSON.parse(m[0]) : null; } catch { brut = null; }
  }
  return { brut, usage: out.usage, stop: out.stop_reason };
}

// Nettoie les réponses reçues de l'application
export function lireReponses(x: unknown): QR[] {
  if (!Array.isArray(x)) return [];
  return x.slice(0, 8).map((q: any) => ({ question: String(q?.question || "").slice(0, 400), reponse: String(q?.reponse || "").slice(0, 3000) }))
    .filter((q) => q.question && q.reponse.trim());
}

// Images jointes par l'application : 6 au plus, JPEG, PNG ou WebP, 1,5 Mo chacune une fois encodées
export function lireImages(x: unknown): ImageJointe[] {
  if (!Array.isArray(x)) return [];
  return x.filter((i: any) => ["image/jpeg", "image/png", "image/webp"].includes(i?.media_type) && typeof i?.data === "string" && i.data.length > 100 && i.data.length < 1_500_000 && /^[A-Za-z0-9+/=]+$/.test(i.data.slice(0, 200)))
    .slice(0, 6).map((i: any) => ({ media_type: i.media_type, data: i.data }));
}

// Bloc « son histoire et sa personnalité » à insérer dans le prompt des agents, à partir de la carte d'identité
export function blocHistoire(c: any): string {
  const h = c?.histoire;
  if (!h) return "";
  const l = (t?: string[]) => (t || []).filter(Boolean).join(", ");
  return [
    "Son histoire et sa personnalité (faits déclarés, à utiliser pour que le texte ne puisse venir que d'elle) :",
    h.recit ? `  - Son parcours : ${h.recit}` : "",
    h.traits?.length ? `  - Ses traits : ${l(h.traits)}` : "",
    h.valeurs?.length ? `  - Ses valeurs : ${l(h.valeurs)}` : "",
    h.mots_clients?.length ? `  - Les mots de ses clients : ${l(h.mots_clients)}` : "",
    h.rituel ? `  - Sa signature en séance : ${h.rituel}` : "",
    h.convictions ? `  - Ses convictions : ${h.convictions}` : "",
    ...(h.passions || []).map((p: any) => `  - Passion : ${p.passion}${p.ce_que_ca_dit ? ` (${p.ce_que_ca_dit})` : ""}`),
    h.voix ? `  - Sa voix : ${h.voix}` : "",
    ...(h.fils_rouges || []).map((x: any) => `  - Fil rouge « ${x.titre} » : ${x.ce_que_ca_dit}`),
    ...(h.signes_distinctifs || []).map((x: any) => `  - Signe distinctif « ${x.titre} » : ${x.pourquoi}${x.bio ? ` Pour sa bio : ${x.bio}` : ""}${x.comment_le_montrer ? ` Idée : ${x.comment_le_montrer}` : ""}`),
    ...(h.pieges || []).map((x: any) => `  - À éviter dans ses textes : ${x.piege}${x.pourquoi ? ` (${x.pourquoi})` : ""}`),
  ].filter(Boolean).join("\n") + "\n";
}

// Informations pratiques de la carte (lieu, zone, séances), pour ne jamais les inventer
export function blocPratique(c: any): string {
  const p = c?.pratique;
  if (!p) return "";
  const n: Record<string, string> = { lieux: "Lieux de séance", studio: "Lieu de séance", confort: "Confort sur place", zone: "Zone", exterieur: "Extérieur", disponibilites: "Disponibilités", seance: "Séances", livrables: "Ce que reçoivent les familles", langues: "Langues" };
  const l = Object.entries(n).filter(([k]) => typeof p[k] === "string" && p[k].trim()).map(([k, t]) => `  - ${t} : ${p[k].trim()}`);
  return l.length ? `Son activité en pratique (faits déclarés, à reprendre tels quels) :\n${l.join("\n")}\n` : "";
}
