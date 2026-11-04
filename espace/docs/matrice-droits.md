# Matrice des droits

Droits fournis par le Pro à chaque requête (`/api/pro-integration/session`). `studios` n'est jamais retenu sans `training`. Aucun droit, membre ou formule envoyé par le navigateur n'est lu.

| Route ou fonction | Droit exigé | Vérifié par |
|---|---|---|
| `GET /api/moi`, `GET /api/ressources` (liste) | session active | serveur |
| `GET /api/catalogue`, `GET /api/bilan`, `POST /api/bilans`, `PATCH /api/bilans/:id`, `PUT .../reponses/:q`, `POST .../constats/:q/corriger`, `GET .../plan` | `analysis` | serveur |
| `PUT /api/bilans/:id/suivi/:mission` (suivi du programme) | `training` | serveur |
| `GET /api/ressources/:id/fichier` | selon `acces` : `tous` → session ; `audit` → `training` ; `complete` → `studios` | serveur |
| `POST/DELETE /api/inscriptions/:evenement` | selon `acces` de l'événement (même règle) | serveur |
| `GET /api/identite`, `PUT /api/identite`, `GET /api/contenus` | `studios` | serveur |
| Fonctions `analyse-site`, `generer-plan` | `analysis` | serveur **et** fonction |
| Fonctions `agent-identite`, `studio-instagram`, `redacteur-pages`, `messages-clients`, `stratege-marque`, `assistant-partenaires`, `studio-contenu`, `calculateur` | `studios` | serveur **et** fonction |
| `ranger-ressources` | retirée (410) | - |

Formule affichée (texte seulement) : `complete` si `studios`, `intermediaire` si `training`, sinon `gratuite`.

Quotas mensuels comptés côté serveur, par membre, avant tout appel coûteux (`bilan_agent_appels`) : analyse de site 20, analyse rédigée (generer-plan) 30, nouveaux bilans 10 ; quotas existants des studios de création inchangés (identité 10, Instagram 40, pages 30, messages 30, marque 20, partenaires 30, contenus 60 et propositions 150, calculateur 30).

Sans le droit `training`, `/api/catalogue` n'envoie des missions que l'identifiant, le titre et les données utiles à l'analyse (pas la méthode, les étapes, les fiches ni le « pourquoi »).

**Choix à confirmer par Amélie :** le contrat du Pro ouvre notre outil d'analyse (bilan, analyse du site, synthèse) à tout photographe actif. Le programme personnalisé (suivi des missions, fiches, vidéos) est réservé aux offres payantes, comme l'indiquait déjà le parcours de l'application.
