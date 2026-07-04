#!/usr/bin/env python3
"""Validation de l'integrite statique d'Obi-Wan Quinoa.

Sans dependance (stdlib uniquement). Usage : python3 scripts/validate.py
Verifie : manifest valide + icones referencees presentes, assets precaches par le
service worker presents, et references locales (href/src) de index.html existantes.

Les recettes et les menus proviennent desormais de RecipeSage (cote client,
localStorage) : il n'y a plus de donnees embarquees dans le depot a valider.
"""
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
        if "'" in ref or "+" in ref:  # refs construites en JS (concatenation) : hors du scan statique
            continue
        rel = ref[2:] if ref.startswith("./") else ref
        if not (ROOT / rel).exists():
            err(f"index.html: reference locale absente '{ref}'")


def main():
    validate_static()

    if errors:
        print(f"FAIL: {len(errors)} erreur(s) de validation :")
        for e in errors:
            print("  -", e)
        return 1
    print("OK: validation reussie (integrite statique : manifest et assets verifies)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
