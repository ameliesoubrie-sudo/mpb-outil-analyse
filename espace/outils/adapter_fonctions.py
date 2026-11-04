# Adapte les 10 Edge Functions membre à la connexion Pro (exécuté une fois, conservé pour traçabilité et relecture).
# Remplace userClient.auth.getUser() par authentifierMembre(), retire le CORS navigateur, borne la taille du corps.
import re, sys, pathlib
R = pathlib.Path(__file__).resolve().parent.parent / "supabase" / "functions"
DROITS = {"analyse-site": "analysis", "generer-plan": "analysis", "agent-identite": "studios", "studio-instagram": "studios",
          "redacteur-pages": "studios", "messages-clients": "studios", "stratege-marque": "studios",
          "assistant-partenaires": "studios", "studio-contenu": "studios", "calculateur": "studios"}
for nom, droit in DROITS.items():
    p = R / nom / "index.ts"; s = p.read_text()
    if "authentifierMembre" in s: print("déjà adaptée", nom); continue
    limite = "15_000_000" if "images" in s else "1_000_000"
    def rem(old, new, n=1):
        global s
        c = s.count(old)
        if c != n: sys.exit(f"{nom} : motif trouvé {c} fois au lieu de {n} : {old[:60]!r}")
        s = s.replace(old, new)
    s = re.sub(r'const CORS = \{\n  "Access-Control-Allow-Origin": "\*",\n  "Access-Control-Allow-Headers": "[^"]*",\n  "Access-Control-Allow-Methods": "POST, OPTIONS",\n\};',
               '// Pas de CORS : les navigateurs n\'appellent plus les fonctions, seul le serveur de l\'outil le fait.\nconst CORS = { "Cache-Control": "no-store" };', s)
    if "Access-Control-Allow-Origin" in s: sys.exit(nom + " : CORS non remplacé")
    rem('  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });\n',
        f'  // Session Pro vérifiée AVANT tout traitement ; le membre vient de la correspondance privée, jamais du corps\n  const mpb = await authentifierMembre(req, "{droit}");\n  if (mpb instanceof Response) return mpb;\n  const user = {{ id: mpb.memberId }};\n')
    s = re.sub(r'\n\s*const userClient = createClient\([^\n]*\n', '\n', s)
    s = re.sub(r'\n\s*const \{ data: \{ user \} \} = await userClient\.auth\.getUser\(\);\n\s*if \(!user\) return json\(\{ error: "Non connecté" \}, 401\);\n', '\n', s)
    if "userClient" in s or "getUser" in s: sys.exit(nom + " : userClient restant")
    s = s.replace('  const auth = req.headers.get("Authorization") || "";\n', '')
    s = s.replace('const body = await req.json().catch(() => ({}));', f'const body: any = await lireCorps(req, {limite});\n    if (body instanceof Response) return body;')
    s = s.replace('const { bilan_id } = await req.json().catch(() => ({}));', f'const corps = await lireCorps(req, {limite});\n  if (corps instanceof Response) return corps;\n  const bilan_id = typeof corps.bilan_id === "string" ? corps.bilan_id : "";')
    s = s.replace('try { body = await req.json(); } catch { return json({ error: "Corps JSON invalide" }, 400); }', f'const lu = await lireCorps(req, {limite});\n  if (lu instanceof Response) return lu;\n  body = lu as typeof body;')
    if "req.json()" in s: sys.exit(nom + " : req.json() restant")
    s = re.sub(r'(import \{ createClient \} from "npm:@supabase/supabase-js@2\.45\.4";\n)', r'\1import { authentifierMembre, lireCorps } from "./mpb_auth.ts";\n', s, count=1)
    if "./mpb_auth.ts" not in s: sys.exit(nom + " : import non ajouté")
    s = s.replace("(Authorization: Bearer <jwt du membre>)", "(Authorization: Bearer <jeton opaque MPB, transmis par le serveur de l'outil>)")
    p.write_text(s); print("adaptée", nom, droit, limite)
