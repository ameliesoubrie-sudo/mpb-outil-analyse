// Démarrage du serveur de l'outil.
import { lireConfig } from "./config.js";
import { creerPool, creerStockage } from "./stockage.js";
import { creerClientPro } from "./pro.js";
import { creerServeur } from "./app.js";
import { journal } from "./outils.js";

const config = lireConfig();
const pool = creerPool(config);
const stockage = creerStockage(config, pool);
const pro = creerClientPro(config);
const serveur = creerServeur({ config, stockage, pro });

serveur.listen(config.port, config.hote, () => journal("info", "serveur démarré", { port: config.port, origine: config.appOrigin }));
const purge = setInterval(() => stockage.purger().catch(() => journal("erreur", "purge des sessions impossible")), 3600_000);
purge.unref();

function arreter() {
  journal("info", "arrêt demandé");
  serveur.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", arreter);
process.on("SIGINT", arreter);
