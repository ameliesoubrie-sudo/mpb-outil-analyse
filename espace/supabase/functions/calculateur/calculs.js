// Calculs des missions « chiffres ». Ce fichier est partagé tel quel entre l'application (copié dans bilan.html
// entre les repères CALCULS) et la fonction « calculateur » : le calcul est toujours fait par ce code, jamais par l'IA.
// Chaque calcul décrit ses champs, puis calc(d) renvoie { resultats, lignes, alertes }.

export const n = (x) => {
  if (x === null || x === undefined) return null;
  let s = String(x).trim().replace(/^(\d+)\s*h\s*(\d{1,2})$/i, (_, h, m) => String(+h + +m / 60));
  s = s.replace(/[\s\u00a0\u202f€%h]/gi, "").replace(",", ".");
  if (s === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
};
const div = (a, b) => (a === null || b === null || b === 0 ? null : a / b);
const r = (v, k = 0) => (v === null || !Number.isFinite(v) ? null : Math.round(v * 10 ** k) / 10 ** k);
const somme = (l) => l.reduce((s, x) => s + (x || 0), 0);
const pct = (a, b, k = 0) => { const v = div(a, b); return v === null ? null : r(v * 100, k); };
const evol = (a, b) => (a === null || b === null || b === 0 ? null : r(((a - b) / Math.abs(b)) * 100));

export function fmt(v, u) {
  if (v === null || v === undefined || (typeof v === "number" && !Number.isFinite(v))) return "?";
  if (typeof v !== "number") return String(v);
  const t = (k) => v.toLocaleString("fr-FR", { maximumFractionDigits: k, minimumFractionDigits: 0 });
  if (u === "€") return t(Math.abs(v) < 100 ? 2 : 0) + " €";
  if (u === "%") return t(0) + " %";
  if (u === "pts") return (v > 0 ? "+" : "") + t(0) + " pts";
  if (u === "evol") return (v > 0 ? "+" : "") + t(0) + " %";
  if (u === "h") return t(1) + " h";
  if (u === "€/h") return t(0) + " € / h";
  return t(1) + (u ? " " + u : "");
}

const LIGNE = (cle, libelle, valeur, unite, extra = {}) => ({ cle, libelle, valeur, unite, ...extra });

export const CALCULS = {
  cout_seance: {
    titre: "Le coût réel de votre séance",
    intro: "Notez le temps passé sur une séance type (idéalement la moyenne de 3 séances) et vos charges de l'année.",
    champs: [
      { k: "seance_type", l: "La séance étudiée", t: "texte", aide: "Ex. : séance nouveau-né au studio" },
      { groupe: "Le temps passé sur une séance, en heures" },
      { k: "t_echanges", l: "Échanges avant (messages, appels)", t: "nombre", u: "h" },
      { k: "t_prepa", l: "Préparation", t: "nombre", u: "h" },
      { k: "t_seance", l: "Séance", t: "nombre", u: "h" },
      { k: "t_post", l: "Tri et retouche", t: "nombre", u: "h" },
      { k: "t_choix", l: "Galerie ou visionnage", t: "nombre", u: "h" },
      { k: "t_livraison", l: "Livraison et suivi", t: "nombre", u: "h" },
      { groupe: "Vos charges et vos prix" },
      { k: "charges", l: "Charges fixes de l'année", t: "nombre", u: "€", aide: "Studio, matériel amorti, logiciels, assurances, formation, comptable, site…" },
      { k: "seances_an", l: "Nombre de séances dans l'année", t: "nombre" },
      { k: "variables", l: "Coûts variables par séance", t: "nombre", u: "€", aide: "Laboratoire, coffret, accessoires, déplacement, retouche externalisée" },
      { k: "prix", l: "Prix moyen encaissé pour cette séance, hors TVA", t: "nombre", u: "€", aide: "Ce que la famille paie vraiment, produits compris" },
      { k: "cotis_taux", l: "Vos cotisations sociales", t: "nombre", u: "%", aide: "Le taux vous est donné par votre comptable" },
      { k: "cotis_base", l: "Elles se calculent sur", t: "choix", options: [["ca", "le chiffre d'affaires (micro-entreprise)"], ["benefice", "le bénéfice"]] },
      { k: "horaire_vise", l: "Le revenu par heure que vous visez (facultatif)", t: "nombre", u: "€/h" },
    ],
    calc(d) {
      const T = ["t_echanges", "t_prepa", "t_seance", "t_post", "t_choix", "t_livraison"].map((k) => n(d[k]));
      const temps = somme(T); const tSeance = n(d.t_seance) || 0;
      const charges = n(d.charges); const nb = n(d.seances_an); const variables = n(d.variables) || 0; const prix = n(d.prix);
      const t = (n(d.cotis_taux) || 0) / 100; const surCA = d.cotis_base !== "benefice"; const vise = n(d.horaire_vise);
      const partFixe = div(charges, nb); const cout = partFixe === null ? null : partFixe + variables;
      const marge = prix === null || cout === null ? null : prix - cout;
      const cotis = marge === null ? null : surCA ? prix * t : Math.max(marge, 0) * t;
      const net = marge === null ? null : marge - cotis;
      const horaire = div(net, temps || null);
      const plancher = cout === null ? null : surCA ? cout / (1 - t) : cout;
      const besoin = vise === null || !temps ? null : vise * temps;
      const prixVise = besoin === null || cout === null ? null : surCA ? (cout + besoin) / (1 - t) : cout + besoin / (1 - t);
      const resultats = [
        LIGNE("temps", "Temps total pour une séance", r(temps, 1), "h"),
        LIGNE("temps_cache", "Part du temps passée hors séance", temps ? r(((temps - tSeance) / temps) * 100) : null, "%"),
        LIGNE("part_fixe", "Part des charges fixes par séance", r(partFixe), "€"),
        LIGNE("cout", "Coût d'une séance (charges + variables)", r(cout), "€", { fort: true }),
        LIGNE("cotis", "Cotisations sur cette séance", r(cotis), "€"),
        LIGNE("net", "Ce qu'il vous reste par séance", r(net), "€", { fort: true }),
        LIGNE("horaire", "Votre revenu par heure", r(horaire), "€/h", { fort: true }),
        LIGNE("plancher", "Prix plancher (vous ne gagnez rien en dessous)", r(plancher), "€"),
      ];
      if (prixVise !== null) {
        resultats.push(LIGNE("prix_vise", `Prix pour atteindre ${fmt(vise, "€/h")}`, r(prixVise), "€", { fort: true }));
        if (prix !== null) resultats.push(LIGNE("ecart", "Écart avec votre prix actuel", r(prix - prixVise), "€"));
      }
      const alertes = [];
      if (!nb) alertes.push("Indiquez votre nombre de séances dans l'année pour répartir vos charges.");
      if (!temps) alertes.push("Indiquez le temps passé pour calculer votre revenu par heure.");
      if (net !== null && net < 0) alertes.push("À ce prix, chaque séance vous coûte de l'argent.");
      if (t >= 1) alertes.push("Le taux de cotisations semble trop élevé : vérifiez-le.");
      return { resultats, lignes: [], alertes };
    },
  },

  panier_moyen: {
    titre: "Votre panier moyen par type de séance",
    intro: "Sur les 12 derniers mois, depuis votre logiciel de gestion. Montants hors TVA.",
    champs: [
      { k: "modele", l: "Comment les familles choisissent leurs images", t: "choix", options: [["galerie", "Seules, en galerie en ligne"], ["visionnage", "Avec moi, en visionnage"], ["les_deux", "Les deux selon les séances"]] },
      { k: "lignes", t: "tableau", l: "Vos séances", colonnes: [["type", "Type de séance", "texte"], ["familles", "Familles", "nombre"], ["ca", "Chiffre d'affaires total (€)", "nombre"], ["add", "Dont achats après la séance (€, facultatif)", "nombre"]], exemple: ["Nouveau-né", "32", "14 400", "4 800"] },
    ],
    calc(d) {
      const L = (d.lignes || []).filter((x) => x && (x.type || n(x.familles))).map((x) => {
        const f = n(x.familles); const ca = n(x.ca); const add = n(x.add);
        return { type: x.type || "Séance", familles: f, ca, panier: r(div(ca, f)), part_add: pct(add, ca) };
      });
      const F = somme(L.map((x) => x.familles)); const CA = somme(L.map((x) => x.ca));
      const addTot = somme((d.lignes || []).map((x) => n(x?.add)));
      const ok = L.filter((x) => x.panier !== null).sort((a, b) => b.panier - a.panier);
      const resultats = [
        LIGNE("familles", "Familles sur 12 mois", F, ""),
        LIGNE("ca", "Chiffre d'affaires des séances", r(CA), "€"),
        LIGNE("panier", "Panier moyen, toutes séances", r(div(CA, F)), "€", { fort: true }),
      ];
      if (addTot) resultats.push(LIGNE("part_add", "Part des achats faits après la séance", pct(addTot, CA), "%", { fort: true }));
      if (ok.length > 1) {
        resultats.push(LIGNE("plus_haut", `Panier le plus haut : ${ok[0].type}`, ok[0].panier, "€"));
        resultats.push(LIGNE("plus_bas", `Panier le plus bas : ${ok[ok.length - 1].type}`, ok[ok.length - 1].panier, "€"));
      }
      return { resultats, lignes: L.map((x) => ({ titre: x.type, valeurs: [[x.familles, ""], [x.panier, "€"], [x.part_add, "%"]] })), colonnes: ["Familles", "Panier moyen", "Achats après séance"], alertes: F ? [] : ["Ajoutez au moins une ligne avec un nombre de familles."] };
    },
  },

  transformation: {
    titre: "Votre taux de transformation par source",
    intro: "Sur 6 à 12 mois : pour chaque source, combien de demandes, combien sont devenues des réservations, et ce qu'elles ont rapporté.",
    champs: [
      { k: "lignes", t: "tableau", l: "Vos sources", colonnes: [["source", "Source", "texte"], ["demandes", "Demandes", "nombre"], ["reservations", "Réservations", "nombre"], ["ca", "Chiffre d'affaires (€, facultatif)", "nombre"]], exemple: ["Recommandation", "12", "10", "5 200"] },
    ],
    calc(d) {
      const L = (d.lignes || []).filter((x) => x && (x.source || n(x.demandes))).map((x) => {
        const dem = n(x.demandes); const res = n(x.reservations); const ca = n(x.ca);
        return { source: x.source || "Source", demandes: dem, reservations: res, taux: pct(res, dem), panier: r(div(ca, res)), peu: dem !== null && dem < 20 };
      });
      const D = somme(L.map((x) => x.demandes)); const R = somme(L.map((x) => x.reservations));
      const classes = L.filter((x) => x.taux !== null).sort((a, b) => b.taux - a.taux);
      const ind = (x) => (x.peu ? " (encore indicatif)" : "");
      const resultats = [
        LIGNE("demandes", "Demandes au total", D, ""),
        LIGNE("reservations", "Réservations au total", R, ""),
        LIGNE("taux", "Taux de transformation global", pct(R, D), "%", { fort: true }),
      ];
      if (classes.length > 1) {
        const [h, b] = [classes[0], classes[classes.length - 1]];
        resultats.push(LIGNE("meilleure", `Source qui transforme le mieux : ${h.source}${ind(h)}`, h.taux, "%", { fort: true }));
        resultats.push(LIGNE("moins", `Source qui transforme le moins : ${b.source}${ind(b)}`, b.taux, "%"));
      }
      const plusDem = [...L].sort((a, b) => (b.demandes || 0) - (a.demandes || 0))[0];
      if (plusDem) resultats.push(LIGNE("volume", `Source qui apporte le plus de demandes : ${plusDem.source}`, plusDem.demandes, ""));
      const alertes = L.filter((x) => x.peu).map((x) => `${x.source} : moins de 20 demandes, son taux est encore indicatif.`);
      if (L.some((x) => x.reservations !== null && x.demandes !== null && x.reservations > x.demandes)) alertes.push("Une source a plus de réservations que de demandes : vérifiez la saisie.");
      return { resultats, lignes: L.map((x) => ({ titre: x.source, valeurs: [[x.demandes, ""], [x.reservations, ""], [x.taux, "%"], [x.panier, "€"]] })), colonnes: ["Demandes", "Réservations", "Taux", "Panier moyen"], alertes };
    },
  },

  fideles: {
    titre: "Votre taux de clients fidèles",
    intro: "Sur l'année écoulée, depuis la liste de vos clients exportée de votre logiciel de gestion.",
    champs: [
      { k: "clients", l: "Familles photographiées dans l'année", t: "nombre" },
      { k: "deja", l: "Dont familles déjà venues avant", t: "nombre" },
      { k: "reco", l: "Dont familles venues par recommandation (facultatif)", t: "nombre" },
      { k: "avant", l: "Votre taux de clients fidèles l'an dernier (facultatif)", t: "nombre", u: "%" },
    ],
    calc(d) {
      const c = n(d.clients); const f = n(d.deja); const rc = n(d.reco); const av = n(d.avant);
      const taux = pct(f, c);
      const resultats = [LIGNE("fideles", "Clients fidèles", taux, "%", { fort: true }), LIGNE("nouveaux", "Nouvelles familles", c === null || f === null ? null : c - f, "")];
      if (rc !== null) resultats.push(LIGNE("reco", "Familles venues par recommandation", pct(rc, c), "%", { fort: true }));
      if (av !== null && taux !== null) resultats.push(LIGNE("evolution", "Évolution sur un an", r(taux - av), "pts"));
      const alertes = [];
      if (c !== null && f !== null && f > c) alertes.push("Les familles déjà venues ne peuvent pas dépasser le total : vérifiez la saisie.");
      return { resultats, lignes: [], alertes };
    },
  },

  instagram: {
    titre: "Votre point mensuel Instagram",
    intro: "Les chiffres des 30 derniers jours, dans le tableau de bord professionnel. Le mois précédent est facultatif mais permet de voir la tendance.",
    champs: [
      { groupe: "Ce mois-ci" },
      { k: "touches", l: "Comptes touchés", t: "nombre" },
      { k: "enreg", l: "Enregistrements", t: "nombre" },
      { k: "partages", l: "Partages", t: "nombre" },
      { k: "profil", l: "Visites du profil", t: "nombre" },
      { k: "clics", l: "Clics sur le lien (facultatif)", t: "nombre" },
      { groupe: "Le mois précédent (facultatif)" },
      { k: "p_touches", l: "Comptes touchés", t: "nombre" },
      { k: "p_enreg", l: "Enregistrements", t: "nombre" },
      { k: "p_partages", l: "Partages", t: "nombre" },
      { k: "p_profil", l: "Visites du profil", t: "nombre" },
      { groupe: "Vos 3 meilleures publications" },
      { k: "top", l: "Pour chacune : le sujet, le format, ses enregistrements et partages", t: "long", aide: "Ex. : carrousel « que mettre dans le sac de maternité », 48 enregistrements, 12 partages" },
    ],
    calc(d) {
      const T = n(d.touches), E = n(d.enreg), P = n(d.partages), V = n(d.profil), C = n(d.clics);
      const pT = n(d.p_touches), pE = n(d.p_enreg), pP = n(d.p_partages), pV = n(d.p_profil);
      const pour1000 = (x, t) => r(div(x, t) === null ? null : div(x, t) * 1000, 1);
      const resultats = [
        LIGNE("enreg_1000", "Enregistrements pour 1 000 comptes touchés", pour1000(E, T), "", { fort: true }),
        LIGNE("partages_1000", "Partages pour 1 000 comptes touchés", pour1000(P, T), "", { fort: true }),
        LIGNE("profil_pct", "Comptes touchés qui visitent votre profil", pct(V, T, 1), "%"),
      ];
      if (C !== null) resultats.push(LIGNE("clics_pct", "Visites du profil qui cliquent sur votre lien", pct(C, V), "%"));
      [["touches", "Comptes touchés", T, pT], ["enreg", "Enregistrements", E, pE], ["partages", "Partages", P, pP], ["profil", "Visites du profil", V, pV]]
        .forEach(([k, l, a, b]) => { if (b !== null && a !== null) resultats.push(LIGNE("ev_" + k, `${l} par rapport au mois précédent`, evol(a, b), "evol")); });
      return { resultats, lignes: [], alertes: T ? [] : ["Indiquez au moins les comptes touchés."] };
    },
  },

  charges: {
    titre: "Vos charges passées au crible",
    intro: "Une ligne par dépense récurrente, relevée sur 12 mois. Classez chacune : indispensable, utile, doublon ou oubliée.",
    champs: [
      { k: "lignes", t: "tableau", l: "Vos dépenses récurrentes", colonnes: [["poste", "Dépense", "texte"], ["montant", "Montant (€)", "nombre"], ["freq", "Fréquence", "choix", [["mois", "par mois"], ["trimestre", "par trimestre"], ["an", "par an"]]], ["classe", "Classement", "choix", [["indispensable", "indispensable"], ["utile", "utile"], ["doublon", "doublon"], ["oubliee", "oubliée"]]]], exemple: ["Galerie en ligne", "19", "mois", "doublon"] },
    ],
    calc(d) {
      const mult = { mois: 12, trimestre: 4, an: 1 };
      const L = (d.lignes || []).filter((x) => x && (x.poste || n(x.montant))).map((x) => ({ poste: x.poste || "Dépense", classe: x.classe || "utile", an: r((n(x.montant) || 0) * (mult[x.freq] || 12)) }));
      const tot = somme(L.map((x) => x.an)); const par = (c) => somme(L.filter((x) => x.classe === c).map((x) => x.an));
      const petits = L.filter((x) => x.an > 0 && x.an <= 180);
      const lourds = [...L].sort((a, b) => b.an - a.an).slice(0, 3);
      const resultats = [
        LIGNE("total", "Total annuel de vos charges récurrentes", r(tot), "€", { fort: true }),
        LIGNE("indispensable", "Indispensables", r(par("indispensable")), "€"),
        LIGNE("utile", "Utiles", r(par("utile")), "€"),
        LIGNE("economie", "Économie possible en résiliant doublons et oubliées", r(par("doublon") + par("oubliee")), "€", { fort: true }),
        LIGNE("petits", `Petits abonnements (15 € par mois ou moins), ${petits.length} au total`, r(somme(petits.map((x) => x.an))), "€"),
      ];
      lourds.forEach((x, i) => resultats.push(LIGNE("lourd" + i, `Charge n° ${i + 1} : ${x.poste}`, x.an, "€")));
      return { resultats, lignes: L.map((x) => ({ titre: x.poste, valeurs: [[x.an, "€"], [x.classe === "oubliee" ? "oubliée" : x.classe, ""]] })), colonnes: ["Par an", "Classement"], alertes: L.length ? [] : ["Ajoutez au moins une dépense."] };
    },
  },

  bilan_annuel: {
    titre: "Votre bilan annuel",
    intro: "Vos chiffres clés de l'année et de l'année précédente, depuis votre logiciel de gestion. Laissez vide ce que vous n'avez pas.",
    champs: [
      { groupe: "Cette année" },
      { k: "seances", l: "Séances réalisées", t: "nombre" },
      { k: "ca", l: "Chiffre d'affaires hors TVA", t: "nombre", u: "€" },
      { k: "demandes", l: "Demandes reçues", t: "nombre" },
      { k: "fideles", l: "Clients fidèles", t: "nombre", u: "%" },
      { k: "reco", l: "Demandes venues par recommandation", t: "nombre", u: "%" },
      { groupe: "L'an dernier" },
      { k: "p_seances", l: "Séances réalisées", t: "nombre" },
      { k: "p_ca", l: "Chiffre d'affaires hors TVA", t: "nombre", u: "€" },
      { k: "p_demandes", l: "Demandes reçues", t: "nombre" },
      { k: "p_fideles", l: "Clients fidèles", t: "nombre", u: "%" },
      { k: "p_reco", l: "Demandes venues par recommandation", t: "nombre", u: "%" },
      { groupe: "Votre regard sur l'année" },
      { k: "marche", l: "Ce qui a marché", t: "long", aide: "La séance la plus rentable, le mois le plus fort, la source la plus fiable" },
      { k: "coute", l: "Ce qui vous a coûté", t: "long", aide: "La séance qui prend trop de temps, l'outil qui vous fatigue, le client qui ne vous correspond pas" },
    ],
    calc(d) {
      const S = n(d.seances), CA = n(d.ca), D = n(d.demandes), pS = n(d.p_seances), pCA = n(d.p_ca), pD = n(d.p_demandes);
      const pan = r(div(CA, S)), pPan = r(div(pCA, pS));
      const tx = pct(S, D), pTx = pct(pS, pD);
      const resultats = [
        LIGNE("seances", "Séances", S, "", { avant: pS, evol: evol(S, pS) }),
        LIGNE("ca", "Chiffre d'affaires", r(CA), "€", { avant: pCA, evol: evol(CA, pCA), fort: true }),
        LIGNE("panier", "Panier moyen", pan, "€", { avant: pPan, evol: evol(pan, pPan), fort: true }),
        LIGNE("transfo", "Demandes devenues séances", tx, "%", { avant: pTx, evol: tx === null || pTx === null ? null : r(tx - pTx), evolU: "pts" }),
        LIGNE("fideles", "Clients fidèles", n(d.fideles), "%", { avant: n(d.p_fideles), evol: n(d.fideles) === null || n(d.p_fideles) === null ? null : r(n(d.fideles) - n(d.p_fideles)), evolU: "pts" }),
        LIGNE("reco", "Demandes par recommandation", n(d.reco), "%", { avant: n(d.p_reco), evol: n(d.reco) === null || n(d.p_reco) === null ? null : r(n(d.reco) - n(d.p_reco)), evolU: "pts" }),
      ].filter((x) => x.valeur !== null || x.avant !== null);
      return { resultats, lignes: [], alertes: S || CA ? [] : ["Indiquez au moins vos séances ou votre chiffre d'affaires de l'année."] };
    },
  },

  modele_vente: {
    titre: "Votre modèle de vente en chiffres",
    intro: "Décrivez votre façon de vendre aujourd'hui, avec vos chiffres moyens. Montants hors TVA.",
    champs: [
      { k: "modele", l: "Votre modèle", t: "choix", options: [["tout_compris", "Tout compris"], ["carte", "Séance puis choix à la carte"], ["forfait", "Forfait avec options"]] },
      { k: "choix", l: "Le choix des images", t: "choix", options: [["galerie", "Seule, en galerie en ligne"], ["visionnage", "Avec moi, en visionnage"], ["visio", "Avec moi, en visio"]] },
      { k: "entree", l: "Ce que la famille paie à la réservation", t: "nombre", u: "€" },
      { k: "panier", l: "Ce qu'elle dépense en moyenne au total", t: "nombre", u: "€" },
      { k: "acheteurs", l: "Part des familles qui achètent en plus", t: "nombre", u: "%" },
      { k: "temps", l: "Temps total passé par séance", t: "nombre", u: "h" },
      { k: "seances_an", l: "Séances par an", t: "nombre" },
      { k: "contraintes", l: "Vos contraintes et vos envies (facultatif)", t: "long", aide: "Ex. : pas de studio pour recevoir, envie de moins de temps de vente, clients qui trouvent le prix d'entrée élevé" },
    ],
    calc(d) {
      const E = n(d.entree), P = n(d.panier), A = n(d.acheteurs), T = n(d.temps), N = n(d.seances_an);
      const add = P === null || E === null ? null : P - E;
      const resultats = [
        LIGNE("add_famille", "Achats en plus, en moyenne par famille", r(add), "€"),
        LIGNE("part_add", "Part du panier faite après la réservation", pct(add, P), "%", { fort: true }),
        LIGNE("add_acheteur", "Montant moyen dépensé en plus par une famille qui achète", r(div(add, A ? A / 100 : null)), "€"),
        LIGNE("par_heure", "Chiffre d'affaires par heure passée", r(div(P, T)), "€/h", { fort: true }),
        LIGNE("ca_an", "Chiffre d'affaires annuel des séances", r(P !== null && N !== null ? P * N : null), "€"),
      ];
      const alertes = [];
      if (add !== null && add < 0) alertes.push("Le panier moyen est inférieur au prix d'entrée : vérifiez la saisie.");
      return { resultats, lignes: [], alertes };
    },
  },
};

export const CALCUL_DE_MISSION = { MEB2: "cout_seance", MEB1: "panier_moyen", MES1: "transformation", MN12: "fideles", MR11: "instagram", MEB4: "charges", MEB3: "bilan_annuel", MEB6: "modele_vente" };

export function calculer(id, donnees) {
  const c = CALCULS[id];
  if (!c) throw new Error("Calcul inconnu : " + id);
  return c.calc(donnees || {});
}

// Les chiffres en texte, tels que notre studio de création les reçoit et tels qu'ils s'affichent
export function resumer(id, sortie) {
  const lignes = sortie.resultats.map((x) => `- ${x.libelle} : ${fmt(x.valeur, x.unite)}${x.avant !== undefined && x.avant !== null ? ` (l'an dernier : ${fmt(x.avant, x.unite)}${x.evol !== null && x.evol !== undefined ? `, ${fmt(x.evol, x.evolU || "evol")}` : ""})` : ""}`);
  const tab = (sortie.lignes || []).map((l) => `- ${l.titre} : ${l.valeurs.map(([v, u], i) => `${sortie.colonnes?.[i] || ""} ${fmt(v, u)}`).join(" · ")}`);
  return [CALCULS[id].titre, ...lignes, ...(tab.length ? ["Détail :", ...tab] : []), ...(sortie.alertes.length ? ["Points d'attention :", ...sortie.alertes.map((a) => "- " + a)] : [])].join("\n");
}
