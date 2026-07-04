#!/usr/bin/env python3
"""Validation des donnees et de l'integrite statique d'Obi-Wan Quinoa.

Sans dependance (stdlib uniquement). Usage : python3 scripts/validate.py
Verifie les invariants de la skill /plan (voir .claude/skills/plan/SKILL.md) :
- recipes.json : schema de chaque recette (titre, moment, kcal/prot, ingredients, etapes, shop)
- menus.json  : cle = un jeudi, 7 jours, <=2 repas/jour, chaque recette existe
- statique    : manifest valide + assets references presents
"""
import datetime
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors = []


def err(msg):
    errors.append(msg)


def load_json(name):
    try:
        return json.loads((ROOT / name).read_text(encoding="utf-8"))
    except FileNotFoundError:
        err(f"{name}: fichier absent")
    except json.JSONDecodeError as e:
        err(f"{name}: JSON invalide ({e})")
    return None


U_OK = {"g", "ml", "gousse", "botte", "tranche", ""}
R_OK = {"prot", "leg", "epi", "con", "fru"}
MOMENT_OK = {"Midi", "Soir"}


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def validate_recipes(recipes):
    if not isinstance(recipes, dict):
        err("recipes.json: racine attendue = objet {id: recette}")
        return
    for rid, r in recipes.items():
        c = f"recipe '{rid}'"
        if not re.fullmatch(r"[a-z0-9_]+", rid):
            err(f"{c}: identifiant invalide (slug attendu : [a-z0-9_], sert de nom de page r/<id>.html)")
        if not isinstance(r, dict):
            err(f"{c}: doit etre un objet")
            continue
        if not isinstance(r.get("titre"), str) or not r["titre"].strip():
            err(f"{c}: titre manquant (chaine non vide requise, cf. build_recipe_pages.py)")
        if r.get("moment") not in MOMENT_OK:
            err(f"{c}: moment invalide ({r.get('moment')!r})")
        for k in ("kcal", "prot"):
            if not is_num(r.get(k)):
                err(f"{c}: {k} doit etre numerique")
        for k in ("ingredients", "etapes"):
            v = r.get(k)
            if not isinstance(v, list) or not v or not all(isinstance(x, str) and x.strip() for x in v):
                err(f"{c}: {k} doit etre une liste non vide de chaines")
        if "priorite" in r and not isinstance(r["priorite"], bool):
            err(f"{c}: priorite doit etre booleen")
        shop = r.get("shop")
        if not isinstance(shop, list):
            err(f"{c}: shop doit etre une liste")
            continue
        for i, s in enumerate(shop):
            sc = f"{c} shop[{i}]"
            if not isinstance(s, dict):
                err(f"{sc}: doit etre un objet")
                continue
            if not isinstance(s.get("n"), str) or not s["n"].strip():
                err(f"{sc}: n (nom) manquant")
            q = s.get("q", "__MISSING__")
            if q == "__MISSING__":
                err(f"{sc}: q requis (nombre ou null)")
            elif q is not None and not is_num(q):
                err(f"{sc}: q doit etre un nombre ou null")
            if s.get("u", "__MISSING__") not in U_OK:
                err(f"{sc}: u invalide ({s.get('u')!r})")
            if s.get("r") not in R_OK:
                err(f"{sc}: r invalide ({s.get('r')!r})")
            if "note" in s and not isinstance(s["note"], str):
                err(f"{sc}: note doit etre une chaine")


def validate_menus(menus, recipes):
    if not isinstance(menus, dict):
        err("menus.json: racine attendue = objet {jeudi: semaine}")
        return
    ids = set(recipes) if isinstance(recipes, dict) else set()
    for wid, week in menus.items():
        c = f"semaine '{wid}'"
        try:
            if datetime.date.fromisoformat(wid).weekday() != 3:
                err(f"{c}: la cle doit etre un jeudi (AAAA-MM-JJ)")
        except ValueError:
            err(f"{c}: cle de date invalide (AAAA-MM-JJ attendu)")
        if not isinstance(week, dict) or not isinstance(week.get("jours"), list):
            err(f"{c}: doit etre un objet avec 'jours' (liste)")
            continue
        jours = week["jours"]
        if len(jours) != 7:
            err(f"{c}: 'jours' doit contenir exactement 7 entrees (trouve {len(jours)})")
            continue
        for di, day in enumerate(jours):
            dc = f"{c} jour {di}"
            if not isinstance(day, dict) or not isinstance(day.get("repas"), list):
                err(f"{dc}: doit etre un objet avec 'repas' (liste)")
                continue
            if len(day["repas"]) > 2:
                err(f"{dc}: max 2 repas (midi/soir), trouve {len(day['repas'])}")
            for ri, ref in enumerate(day["repas"]):
                if not isinstance(ref, dict) or "recipe" not in ref:
                    err(f"{dc} repas[{ri}]: doit etre {{\"recipe\": <id>}}")
                    continue
                if ref["recipe"] not in ids:
                    err(f"{dc} repas[{ri}]: recette inconnue '{ref['recipe']}'")


def validate_static():
    man = load_json("manifest.webmanifest")
    if isinstance(man, dict):
        for k in ("name", "start_url", "display", "icons"):
            if k not in man:
                err(f"manifest: champ requis manquant '{k}'")
        for ic in man.get("icons", []):
            src = ic.get("src")
            if src and not (ROOT / src).exists():
                err(f"manifest: icone absente '{src}'")

    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    m = re.search(r"const ASSETS\s*=\s*\[(.*?)\]", sw, re.S)
    if m:
        for a, b in re.findall(r"'([^']+)'|\"([^\"]+)\"", m.group(1)):
            ref = a or b
            rel = ref[2:] if ref.startswith("./") else ref
            if rel in ("", "/"):
                continue
            if not (ROOT / rel).exists():
                err(f"sw.js ASSETS: fichier absent '{ref}'")

    html = (ROOT / "index.html").read_text(encoding="utf-8")
    for ref in re.findall(r'(?:href|src)="([^"]+)"', html):
        if ref.startswith(("http", "data:", "#", "mailto:")):
            continue
        rel = ref[2:] if ref.startswith("./") else ref
        if not (ROOT / rel).exists():
            err(f"index.html: reference locale absente '{ref}'")


def main():
    recipes = load_json("recipes.json")
    menus = load_json("menus.json")
    if recipes is not None:
        validate_recipes(recipes)
    if menus is not None:
        validate_menus(menus, recipes or {})
    validate_static()

    if errors:
        print(f"FAIL: {len(errors)} erreur(s) de validation :")
        for e in errors:
            print("  -", e)
        return 1
    n_rec = len(recipes) if isinstance(recipes, dict) else 0
    n_wk = len(menus) if isinstance(menus, dict) else 0
    print(f"OK: validation reussie ({n_rec} recettes, {n_wk} semaines, assets et manifest verifies)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
