// Pages HTML rendues par le serveur : amorce de connexion, erreurs, déconnexion, page de l'outil avec le header/footer du Pro.
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const POLICES = "https://fonts.googleapis.com/css2?family=Mulish:wght@200;300;400;600;700&family=Nothing+You+Could+Do&family=Great+Vibes&display=swap";

const STYLE_PAGE = `
:root{--acc:#9b2f45;--encre:#474746;--texte:#5f5f5d;--gris:#737371;--trait:#ebdcda;--poudre:#fbf5f3}
*{box-sizing:border-box}body{margin:0;font-family:Mulish,system-ui,sans-serif;color:var(--texte);background:#fff;font-weight:300}
.simple{min-height:100vh;display:grid;place-items:center;padding:24px}
.carte{max-width:520px;width:100%;background:var(--poudre);border-radius:24px;padding:40px 32px;text-align:center}
.logo{font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:var(--acc);font-weight:600;margin:0 0 20px}
h1{font-weight:200;font-size:30px;line-height:1.2;color:var(--encre);margin:0 0 12px}
h1 .main{font-family:"Nothing You Could Do",cursive;color:var(--acc);font-weight:400}
p{line-height:1.6;margin:0 0 20px}
.bouton{display:inline-block;font:inherit;font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;border:0;border-radius:999px;padding:14px 26px;background:var(--acc);color:#fff;text-decoration:none;cursor:pointer}
.bouton.secondaire{background:transparent;color:var(--acc);border:1px solid var(--acc)}
.actions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
:focus-visible{outline:2px solid var(--acc);outline-offset:3px}
`;

export function pageSimple({ titre, mot, texte, actions = "", nonce, script = "", statut = 200, polices = true }) {
  const corps = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(titre)} · Mon Photographe Bébé</title>
${polices ? `<link rel="stylesheet" href="${POLICES}">` : ""}
<style>${STYLE_PAGE}</style></head>
<body><main class="simple"><div class="carte">
<p class="logo">Mon Photographe Bébé</p>
<h1>${esc(titre)}${mot ? ` <span class="main">${esc(mot)}</span>` : ""}</h1>
${texte ? `<p>${texte}</p>` : ""}
<div class="actions">${actions}</div>
</div></main>${script ? `<script nonce="${nonce}">${script}</script>` : ""}</body></html>`;
  return { statut, html: corps };
}

// Première ouverture sans session : on capture le fragment (#mission-MG09), absent côté serveur, puis on démarre la connexion.
// Garde-fou anti-boucle : une seule tentative automatique toutes les 2 minutes, ensuite un lien « Me reconnecter ».
export function pageAmorce({ nonce, automatique }) {
  const script = `(function(){
  var f = location.hash && /^#[A-Za-z0-9][A-Za-z0-9_\\/-]{0,80}$/.test(location.hash) && location.hash !== "#_" ? location.hash : "";
  var dest = "/auth/login?retour=" + encodeURIComponent("/" + f);
  var lien = document.getElementById("reco"); if (lien) lien.href = dest;
  var cle = "mpb-sso-tentative", t = 0;
  try { t = Number(sessionStorage.getItem(cle) || 0); } catch (e) {}
  if (${automatique ? "true" : "false"} && Date.now() - t > 120000) {
    try { sessionStorage.setItem(cle, String(Date.now())); } catch (e) {}
    location.replace(dest);
  } else { document.getElementById("attente").hidden = true; document.getElementById("manuel").hidden = false; }
})();`;
  return pageSimple({
    titre: "Notre outil", mot: "d'analyse", nonce, script,
    texte: `<span id="attente">Connexion avec votre compte Mon Photographe Bébé…</span><span id="manuel" hidden>${automatique ? "La connexion n'a pas abouti." : "Votre session a pris fin."} Reconnectez-vous pour retrouver vos bilans.</span>`,
    actions: `<a class="bouton" id="reco" href="/auth/login">Me reconnecter</a>`,
  });
}

// Aussi affichée au retour de connexion (URL avec code et state) : aucune ressource tierce chargée
export const pageErreurConnexion = ({ nonce }) => pageSimple({
  titre: "Connexion", mot: "interrompue", nonce, statut: 400, polices: false,
  texte: "La connexion avec votre compte Mon Photographe Bébé n'a pas pu être confirmée. Aucune donnée n'a été modifiée.",
  actions: `<a class="bouton" href="/auth/login">Me reconnecter</a>`,
});

export const pageIndisponible = ({ nonce, retour = "/", polices = true }) => pageSimple({
  titre: "Service momentanément", mot: "indisponible", nonce, statut: 503, polices,
  texte: "Nous n'arrivons pas à joindre votre espace Mon Photographe Bébé pour vérifier votre connexion. Vos données sont intactes : réessayez dans un instant.",
  actions: `<a class="bouton" href="${esc(retour)}">Réessayer</a>`,
});

export const pageDeconnexion = ({ nonce, csrf }) => pageSimple({
  titre: "Se", mot: "déconnecter", nonce,
  texte: "Vous allez être déconnecté de notre outil d'analyse et de votre espace Mon Photographe Bébé.",
  actions: `<form method="post" action="/auth/logout"><input type="hidden" name="csrf" value="${esc(csrf)}"><button class="bouton" type="submit">Me déconnecter</button></form>
  <a class="bouton secondaire" href="/">Annuler</a>`,
});

// Après déconnexion : efface le stockage du navigateur puis rejoint la déconnexion du Pro.
export const pageSortie = ({ nonce, urlPro }) => {
  const p = pageSimple({
    titre: "À bientôt", nonce,
    texte: "Vous êtes déconnecté de notre outil d'analyse.",
    actions: `<a class="bouton" href="${esc(urlPro)}">Continuer</a>`,
    script: `try{localStorage.clear()}catch(e){}try{sessionStorage.clear()}catch(e){}location.replace(${JSON.stringify(urlPro)});`,
  });
  p.html = p.html.replace("<head>", `<head><meta http-equiv="refresh" content="1;url=${esc(urlPro)}">`);
  return p;
};

// Page de l'outil : header/footer du Pro dans le document principal, contenu métier isolé dans un Shadow DOM.
export function pageOutil({ chrome, modele, nonce, donnees, versionStatique }) {
  const styles = chrome.styles.map((u) => `<link rel="stylesheet" href="${esc(u)}">`).join("\n");
  const scripts = chrome.scripts.map((u) => `<script src="${esc(u)}"></script>`).join("\n");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notre outil d'analyse · Mon Photographe Bébé</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="${POLICES}">
${styles}
<link rel="stylesheet" href="/static/page.css?v=${versionStatique}">
</head>
<body class="${chrome.classes.map(esc).join(" ")}">
${chrome.header}
<div id="mpb-outil" class="mpb-outil"></div>
${chrome.footer}
<template id="mpb-outil-modele">${modele.replaceAll("{{VERSION}}", versionStatique)}</template>
<script type="application/json" id="mpb-donnees">${JSON.stringify(donnees).replace(/</g, "\\u003c")}</script>
${scripts}
<script src="/static/app.js?v=${versionStatique}"></script>
</body></html>`;
  return { statut: 200, html };
}
