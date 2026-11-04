// Contrôles statiques du contenu de l'outil généré (public/) : plus de client Supabase, calculateur identique au serveur.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const R = new URL("../../", import.meta.url);
const app = readFileSync(new URL("public/app.js", R), "utf8");
const css = readFileSync(new URL("public/app.css", R), "utf8");

test("aucun client, clé ni appel Supabase dans le navigateur", () => {
  assert.doesNotMatch(app, /supabase\.createClient|SUPABASE_KEY|SUPABASE_URL|\bsb\.(from|auth|rpc|storage|functions)\b/);
  assert.doesNotMatch(app, /eyJhbGciOi/);
  assert.doesNotMatch(app, /signInWithPassword|signUp\(|getSession|signOut|screenLogin/);
});

test("formule : jamais « complete » par défaut", () => {
  assert.match(app, /let FORMULE = "gratuite";/);
  assert.doesNotMatch(app, /NIVEAU_FORMULE\[FORMULE\] \?\? 2/);
});

test("calculateur : même code que la fonction calculateur (outils/sync_calculs.py)", () => {
  const calc = readFileSync(new URL("supabase/functions/calculateur/calculs.js", R), "utf8").replace(/^export /gm, "");
  assert.ok(app.includes(calc), "public/app.js n'est pas à jour : relancer outils/convertir_front.py après tools/sync_calculs.py");
});

test("stockage local du calculateur séparé par membre", () => {
  assert.doesNotMatch(app, /"mpb-calc-" \+ id/);
  assert.match(app, /const cleCalc = \(id\) => "mpb-calc:" \+ \(MOI\?\.cle_stockage/);
});

test("CSS isolé : aucune règle sur body/html, racine réinitialisée", () => {
  assert.doesNotMatch(css, /(^|[}\s,])(body|html)[\s{.,:]/);
  assert.match(css, /^\.mpb-racine\{all:initial;display:block\}/);
});
