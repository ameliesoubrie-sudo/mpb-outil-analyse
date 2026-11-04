# Copie _shared/mpb_auth.ts dans chaque fonction membre (déploiement autonome de chaque fonction).
import pathlib, shutil
R = pathlib.Path(__file__).resolve().parent.parent / "supabase" / "functions"
for d in ["analyse-site", "generer-plan", "agent-identite", "studio-instagram", "redacteur-pages", "messages-clients",
          "stratege-marque", "assistant-partenaires", "studio-contenu", "calculateur"]:
    shutil.copyfile(R / "_shared" / "mpb_auth.ts", R / d / "mpb_auth.ts")
print("mpb_auth.ts copié dans 10 fonctions")
