// Outil administratif retiré de l'exposition publique (28 octobre 2026).
// L'ancien code (jeton fixe) est conservé hors des fonctions déployées : le dossier de travail de l’équipe,
// à n'exécuter qu'en local par l'équipe, avec la clé service_role, jamais comme fonction publique.
Deno.serve(() => new Response(JSON.stringify({ error: "Outil retiré" }), { status: 410, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }));
