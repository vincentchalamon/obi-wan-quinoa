# Obi-Wan Quinoa

> Que la graine soit avec toi, padawan.

Application web personnelle (PWA) pour planifier mes **menus végétariens de la semaine** et générer la **liste de courses** correspondante, utilisable **hors-ligne** et hébergée sur GitHub Pages. Les recettes et les plannings sont des fichiers de données ; un assistant (Claude Code, en local ou depuis mobile) m'aide à composer les semaines, validées repas par repas puis publiées via Git.

## Équilibre alimentaire visé (par jour)

- **~1900 kcal/j** (déficit léger d'environ 500 kcal pour ~0,5 kg/semaine ; estimation Mifflin-St Jeor).
- **~115 g de protéines/j** (cible pratique) pour préserver la masse musculaire pendant la perte de poids ; le repère théorique haut est ~1,6 g/kg (≈ 130 g), atteint via les variantes protéinées et les desserts laitiers maigres (skyr, fromage blanc).
- **2 repas** (midi/soir) + **fruit** quotidien + **entrée optionnelle** + **collation** autour du yoga.
- Points d'attention d'un régime lacto-ovo (ANSES 2025) : **oméga-3 (EPA/DHA) et vitamine D**, **vitamine B12** (malgré les œufs), **calcium + vitamine D + protéines** pour la santé osseuse.
- **Fer** : surtout une question d'absorption — associer **fer + vitamine C** (agrumes, poivron, kiwi, tomate) et éloigner les inhibiteurs (laitages/calcium, **tanins du thé/café**). Boissons : **rooibos, tisanes, infusions** (pauvres en tanins).
- **Produits de saison** privilégiés (et le contenu réel du panier AMAP).
- Sel limité (< 8 g/j, PNNS).

### Avant un don de plasma/plaquettes

Repas **équilibré et pauvre en graisses** dans les ~12-20 h précédant le don : un repas trop gras rend le plasma laiteux (lipémique), bouche les filtres et fausse les analyses, ce qui fait écarter le don. Garder fer + vitamine C, **ne pas venir à jeun**, bien s'hydrater. (Sources EFS / Croix-Rouge.)

## Comment je l'utilise

**Depuis le mobile** (mardi soir, au retour de l'AMAP) :

1. Dans l'app, sur la carte du **mardi**, je touche **« Préparer »** et je saisis le **panier AMAP** (et un éventuel **jour de don**).
2. **« Générer avec Claude »** ouvre **Claude Code** sur le repo (deep link `claude://code/new`), le contexte pré-rempli.
3. La skill `/plan` propose **toute la semaine** (de saison, équilibrée, sourcée) ; je **demande des changements** autant que besoin, puis je **valide en bloc**.
4. La skill écrit la semaine dans `menus.json` (+ éventuelles nouvelles recettes dans `recipes.json`) et **pousse directement sur `main`** (pas de PR) ; GitHub Pages publie. De retour dans l'app, la semaine apparaît (rafraîchissement automatique).

> **Prérequis (une fois)** : ouvrir **claude.ai/code** et connecter le repo à **Claude Code** (autoriser la *Claude GitHub App* sur ce repo, ou `/web-setup` depuis le terminal). La skill pousse **directement sur `main`** (le repo perso n'a pas de protection de branche) — pas de PR, aucun secret ni réglage spécial.

**Depuis l'ordinateur** : la skill reste utilisable en CLI (`/plan prochaine`), avec relecture du diff puis commit/push manuel.

### Retoucher un menu

- **Glisser-déposer** (poignée à droite d'un repas) pour **échanger midi/soir** ou **déplacer un repas** d'un jour à l'autre. Les retouches sont locales (hors-ligne) et **fondues dans `menus.json`** à la prochaine génération via Claude.
- **Exporter une semaine** (le menu, ou la liste de courses) en **PDF** ou **Markdown** daté, depuis l'écran Courses.

## Fonctionnement technique

- `index.html` — la PWA (HTML/CSS/JS, sans dépendance). Charge les données au démarrage et calcule la liste de courses à partir des repas conservés.
- `recipes.json` — catalogue de recettes (source de vérité, portions pour 1 personne). Champs : `moment`, `heure`, `titre`, `kcal`, `prot`, `priorite?`, `ingredients[]`, `etapes[]`, `shop[]` (`{n, q, u, r, note?}`, rayon `r ∈ prot|leg|epi|con|fru`).
- `menus.json` — planning par semaine. Clé = date du **jeudi** ; 7 jours (jeudi→mercredi) ; chaque repas référence une recette par son identifiant (`{"recipe":"buddha"}`), résolu en midi/soir selon sa position.
- `sw.js` — service worker : *network-first* sur le HTML et les JSON (pour voir les nouveaux menus en ligne), *cache-first* sur les icônes ; précache pour l'usage hors-ligne.
- `manifest.webmanifest` — métadonnées PWA (installable, hors-ligne).
- `.claude/skills/plan/` — la skill de génération (`SKILL.md`) et son référentiel nutrition **sourcé** (`references/nutrition.md`).

Aucune clé d'API ni serveur : la génération passe par **Claude Code** (abonnement, en local ou via l'app mobile) qui écrit puis pousse les données ; le site reste 100 % statique. Chaque utilisateur agit avec **son propre** compte Claude/GitHub, et **aucun secret n'est stocké dans le dépôt** (le deep link ne transporte aucun identifiant).

### Tester en local

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

(Le service worker et le chargement des JSON nécessitent `http://`, pas `file://`.)

### Validation & CI

- `python3 scripts/validate.py` — valide `recipes.json`/`menus.json` (schéma, références de recettes, clé = jeudi, 7 jours) et l'intégrité statique (manifest, assets présents). À lancer avant de publier une semaine.
- CI GitHub Actions (`.github/workflows/ci.yml`) sur chaque push/PR : validation des données, syntaxe JS (`sw.js` + JS inline de `index.html`), scan de secrets. Sans dépendance (Python/Node du runner), aucun secret.
- Déploiement Pages via `.github/workflows/pages.yml` (source *GitHub Actions*), avec anti-collision (`concurrency`) et retry automatique.

## Sources nutritionnelles

Les principes nutritionnels et leurs références sont rassemblés dans [`.claude/skills/plan/references/nutrition.md`](.claude/skills/plan/references/nutrition.md) : ANSES (repères végétariens 2025), Santé publique France / Manger Bouger (PNNS), EFS (alimentation du donneur, don de plasma), Academy of Nutrition and Dietetics (2025), NHS, NIH (fer), ADEME (saisonnalité), formule de Mifflin-St Jeor.

## Avertissement

Projet **personnel**. Les repères nutritionnels présentés sont des informations générales issues de sources publiques, **pas un avis médical individualisé**. Pour un objectif de perte de poids combiné à des dons du sang réguliers et à une activité physique, consulter un diététicien / médecin et suivre les consignes de l'EFS (un bilan de la ferritine est recommandé).
