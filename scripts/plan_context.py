#!/usr/bin/env python3
"""Contexte compact pour la skill /plan (Step 3).

Projette recipes.json (id, moment, titre, kcal, prot, priorite + noms
d'ingredients sans quantites ; sans etapes ni shop), liste les cles de
menus.json, et resume les 2 semaines utiles aux gardes (cible + precedente).
Read-only : n'ecrit rien. Usage : python3 scripts/plan_context.py [<jeudi AAAA-MM-JJ> | prochaine]
"""
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
recipes = json.loads((ROOT / "recipes.json").read_text(encoding="utf-8"))
menus = json.loads((ROOT / "menus.json").read_text(encoding="utf-8"))
keys = sorted(menus)


def next_thursday():
    d = datetime.date.today()
    d += datetime.timedelta(days=(3 - d.weekday()) % 7)  # prochain jeudi (aujourd'hui si jeudi)
    while d.isoformat() in menus:
        d += datetime.timedelta(days=7)
    return d.isoformat()


arg = sys.argv[1] if len(sys.argv) > 1 else "prochaine"
cible = next_thursday() if arg == "prochaine" else arg


def noms(ingr):
    return " · ".join(i.split("—")[0].strip() for i in ingr)


def resume(wid):
    wk = menus.get(wid)
    if not wk:
        return "absente"
    return " ".join(
        f"j{i + 1}:[{', '.join(ref.get('recipe', '?') for ref in day.get('repas', [])) or '-'}]"
        for i, day in enumerate(wk.get("jours", []))
    )


print(f"CIBLE: {cible}")
print(f"CATALOGUE ({len(recipes)}) — id | moment | titre | kcal | prot | [frais] | ingrédients")
for rid, r in recipes.items():
    frais = " | frais" if r.get("priorite") else ""
    print(f"{rid} | {r['moment']} | {r['titre']} | {r['kcal']} kcal | {r['prot']} g{frais} | {noms(r['ingredients'])}")

print(f"\nMENUS_KEYS ({len(keys)}): {', '.join(keys) or '(vide)'}")
prev = (datetime.date.fromisoformat(cible) - datetime.timedelta(days=7)).isoformat()
print(f"SEMAINE CIBLE {cible}: {resume(cible)}")
print(f"SEMAINE PRÉCÉDENTE {prev}: {resume(prev)}")
