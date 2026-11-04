"""Copie supabase/functions/calculateur/calculs.js dans app/bilan.html, entre les repères CALCULS.
Le même code calcule dans l'application et dans la fonction : à relancer après toute modification de calculs.js."""
import re, pathlib
racine = pathlib.Path(__file__).resolve().parent.parent
js = (racine / "supabase/functions/calculateur/calculs.js").read_text(encoding="utf-8")
corps = re.sub(r"^export ", "", js, flags=re.M)
bloc = ("// <CALCULS> copie automatique de calculs.js (tools/sync_calculs.py), ne pas modifier ici\n"
        "const CALC = (() => {\n" + corps + "\nreturn { n, fmt, CALCULS, CALCUL_DE_MISSION, calculer, resumer };\n})();\n// </CALCULS>")
html = (racine / "app/bilan.html").read_text(encoding="utf-8")
if "// <CALCULS>" in html:
    html = re.sub(r"// <CALCULS>.*?// </CALCULS>", lambda m: bloc, html, flags=re.S)
else:
    html = html.replace("function etatStudio(id)", bloc + "\nfunction etatStudio(id)", 1)
(racine / "app/bilan.html").write_text(html, encoding="utf-8")
print("calculs synchronisés")
