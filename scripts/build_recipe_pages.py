#!/usr/bin/env python3
"""Genere une page HTML statique par recette dans r/<id>.html.

Chaque page embarque un JSON-LD schema.org/Recipe (lu cote serveur par le
clipper de RecipeSage, qui n'execute pas le JS) + un rendu lisible partageable.
Sans dependance (stdlib). Usage : python3 scripts/build_recipe_pages.py
Lance en CI avant le deploiement Pages ; les pages ne sont pas commitees.
"""
import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "r"

PAGE = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — Obi-Wan Quinoa</title>
<meta name="description" content="{desc}">
<script type="application/ld+json">
{jsonld}
</script>
<style>
  body{{font-family:"Helvetica Neue",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    color:#25342A;background:#F4F6EF;line-height:1.55;margin:0;padding:24px 16px 48px;}}
  main{{max-width:680px;margin:0 auto;background:#fff;border:1px solid #E2E7DA;border-radius:12px;padding:24px 20px 28px;}}
  h1{{font-family:Georgia,serif;color:#2F4A36;font-size:24px;line-height:1.2;margin:0 0 14px;}}
  .tag{{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
    color:#6E9E5E;border:1px solid #6E9E5E;border-radius:20px;padding:3px 11px;margin-bottom:12px;}}
  .macros{{margin:0 0 22px;}}
  .chip{{display:inline-block;font-size:12px;font-weight:700;padding:5px 11px;border-radius:7px;margin-right:8px;}}
  .chip.kcal{{background:#E7EEE0;color:#2F4A36;}}
  .chip.prot{{background:#F4E3E7;color:#A8455E;}}
  h2{{font-family:"Helvetica Neue",sans-serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;
    color:#6B7468;font-weight:700;margin:22px 0 10px;}}
  ul,ol{{margin:0;padding-left:20px;}}
  li{{padding:4px 0;font-size:15px;}}
  footer{{max-width:680px;margin:16px auto 0;color:#6B7468;font-size:12px;text-align:center;}}
  footer a{{color:#2F4A36;}}
</style>
</head>
<body>
<main>
  <span class="tag">Recette végétarienne · 1 personne</span>
  <h1>{title}</h1>
  <div class="macros"><span class="chip kcal">~{kcal} kcal</span><span class="chip prot">~{prot} g protéines</span></div>
  <h2>Ingrédients</h2>
  <ul>{ingredients}</ul>
  <h2>Préparation</h2>
  <ol>{etapes}</ol>
</main>
<footer>Obi-Wan Quinoa — <a href="../">menus de la semaine</a></footer>
</body>
</html>
"""


def jsonld_recipe(r):
    obj = {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": r["titre"],
        "author": {"@type": "Organization", "name": "Obi-Wan Quinoa"},
        "recipeYield": "1 personne",
        "suitableForDiet": "https://schema.org/VegetarianDiet",
        "recipeCategory": r.get("moment", ""),
        "recipeIngredient": r["ingredients"],
        "recipeInstructions": [{"@type": "HowToStep", "text": s} for s in r["etapes"]],
        "nutrition": {
            "@type": "NutritionInformation",
            "calories": "{} kcal".format(r["kcal"]),
            "proteinContent": "{} g".format(r["prot"]),
        },
    }
    # ensure_ascii=False garde les accents ; on echappe < pour ne pas rompre le <script>.
    return json.dumps(obj, ensure_ascii=False, indent=2).replace("<", "\\u003c")


def build():
    recipes = json.loads((ROOT / "recipes.json").read_text(encoding="utf-8"))
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for rid, r in recipes.items():
        page = PAGE.format(
            title=html.escape(r["titre"]),
            desc=html.escape("{} — ~{} kcal, {} g de proteines.".format(r["titre"], r["kcal"], r["prot"])),
            jsonld=jsonld_recipe(r),
            kcal=r["kcal"],
            prot=r["prot"],
            ingredients="".join("<li>{}</li>".format(html.escape(i)) for i in r["ingredients"]),
            etapes="".join("<li>{}</li>".format(html.escape(s)) for s in r["etapes"]),
        )
        (OUT / "{}.html".format(rid)).write_text(page, encoding="utf-8")
    print("OK: {} pages recettes generees dans r/".format(len(recipes)))


if __name__ == "__main__":
    build()
