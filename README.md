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

## Comment je l'utilise

**Depuis le mobile** (mardi soir, au retour de l'AMAP) :

1. Dans l'app, sur la carte du **mardi**, je touche **« Préparer »** et je saisis le **panier AMAP**.
2. **« Générer avec Claude »** ouvre **Claude Code** sur le repo (deep link `claude://code/new`), le contexte pré-rempli. Choisir le modèle **Sonnet** : la skill est fortement scriptée (référentiel nutrition + validations), Sonnet suffit et coûte moins qu'Opus ; garder la session légère (pas de serveurs MCP hors-sujet).
3. La skill `/plan` propose **toute la semaine** (de saison, équilibrée, sourcée) ; je **demande des changements** autant que besoin, puis je **valide en bloc**.
4. La skill écrit la semaine dans `menus.json` (+ éventuelles nouvelles recettes dans `recipes.json`) et **pousse directement sur `main`** (pas de PR) ; GitHub Pages publie. De retour dans l'app, la semaine apparaît (rafraîchissement automatique).

> **Prérequis (une fois)** : ouvrir **claude.ai/code** et connecter le repo à **Claude Code** (autoriser la *Claude GitHub App* sur ce repo, ou `/web-setup` depuis le terminal). La skill pousse **directement sur `main`** (le repo perso n'a pas de protection de branche) — pas de PR, aucun secret ni réglage spécial.

**Depuis l'ordinateur** : la skill reste utilisable en CLI (`/plan prochaine`), avec relecture du diff puis commit/push manuel.

### Retoucher un menu

- **Glisser-déposer** (poignée à droite d'un repas) pour **échanger midi/soir** ou **déplacer un repas** d'un jour à l'autre. Les retouches sont locales (hors-ligne) et **fondues dans `menus.json`** à la prochaine génération via Claude.
- **Ajuster une quantité de courses** : sur l'écran Courses, toucher le nombre d'un article pour saisir la quantité **à acheter** (si j'en ai déjà) ; la quantité nécessaire pour la semaine reste affichée (« sur N »). Local, réinitialisé à la régénération de la semaine.
- **Reporter un repas sauté** : les repas retirés (« je mange à l'extérieur ») de la semaine en cours sont signalés dans le prompt « Préparer » ; à la génération, la skill propose de les **reporter au jeudi** de la semaine suivante (ingrédients déjà achetés, fraîcheur d'abord).
- **Mode cuisine** : sur une recette, garder l'écran allumé pendant la préparation.
- **Partager une recette** : chaque recette a une **page publique** (`r/<id>.html`) avec un JSON-LD `schema.org/Recipe`. Le bouton *Partager* utilise `navigator.share` (ou copie l'URL). Pour l'importer dans **RecipeSage**, partager la page vers l'app depuis la feuille de partage (RecipeSage clippe l'URL côté serveur).

## Fonctionnement technique

- `index.html` — la PWA (HTML/CSS/JS, sans dépendance). Charge les données au démarrage et calcule la liste de courses à partir des repas conservés.
- `logic.js` — logique pure sans DOM (dates, matérialisation des menus, calcul de la liste de courses), extraite d'`index.html` pour être testée en Node. Chargée comme script classique (fonctions exposées en global) et couverte par `test/logic.test.js` (`node --test`).
- `recipes.json` — catalogue de recettes (source de vérité, portions pour 1 personne). Champs : `moment`, `titre`, `kcal`, `prot`, `priorite?`, `ingredients[]`, `etapes[]`, `shop[]` (`{n, q, u, r, note?}`, rayon `r ∈ prot|leg|epi|con|fru`).
- `menus.json` — planning par semaine. Clé = date du **jeudi** ; 7 jours (jeudi→mercredi) ; chaque repas référence une recette par son identifiant (`{"recipe":"buddha"}`), résolu en midi/soir selon sa position.
- `sw.js` — service worker : *network-first* sur le HTML et les JSON (pour voir les nouveaux menus en ligne), *cache-first* sur les icônes ; précache pour l'usage hors-ligne.
- `manifest.webmanifest` — métadonnées PWA (installable, hors-ligne).
- `scripts/build_recipe_pages.py` — génère une page publique `r/<id>.html` par recette (JSON-LD `schema.org/Recipe` + rendu lisible), pour le partage et l'import RecipeSage. **Générées en CI** au déploiement (non commitées, cf. `.gitignore`).
- `scripts/plan_context.py` — projette un **catalogue compact** de `recipes.json` (sans `etapes`/`shop`, noms d'ingrédients sans quantités) + clés/semaines de `menus.json`, consommé par la skill `/plan` pour réduire les tokens. Non utilisé par l'app ni la CI.
- `.claude/skills/plan/` — la skill de génération (`SKILL.md`) et son référentiel nutrition **sourcé** (`references/nutrition.md`).

Aucune clé d'API ni serveur : la génération passe par **Claude Code** (abonnement, en local ou via l'app mobile) qui écrit puis pousse les données ; le site reste 100 % statique. Chaque utilisateur agit avec **son propre** compte Claude/GitHub, et **aucun secret n'est stocké dans le dépôt** (le deep link ne transporte aucun identifiant).

### Tester en local

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

(Le service worker et le chargement des JSON nécessitent `http://`, pas `file://`.)

### Validation & CI

- `python3 scripts/validate.py` — valide `recipes.json`/`menus.json` (schéma, ids en slug, références de recettes, clé = jeudi, 7 jours) et l'intégrité statique (manifest, assets présents). À lancer avant de publier une semaine.
- `node --test 'test/*.test.js'` — tests unitaires de la logique pure (`logic.js`).
- CI GitHub Actions (`.github/workflows/ci.yml`) sur chaque push/PR : validation des données, syntaxe JS (`sw.js`, `logic.js`, JS inline de `index.html`), tests unitaires, scan de secrets. Sans dépendance (Python/Node du runner), aucun secret.
- Déploiement Pages via `.github/workflows/pages.yml` (source *GitHub Actions*) : génère les pages recettes puis publie, avec anti-collision (`concurrency`) et retry automatique.

## Sources nutritionnelles

Les principes nutritionnels et leurs références sont rassemblés dans [`.claude/skills/plan/references/nutrition.md`](.claude/skills/plan/references/nutrition.md) : ANSES (repères végétariens 2025), Santé publique France / Manger Bouger (PNNS), Academy of Nutrition and Dietetics (2025), NHS, NIH (fer), ADEME (saisonnalité), formule de Mifflin-St Jeor.

## Avertissement

Projet **personnel**. Les repères nutritionnels présentés sont des informations générales issues de sources publiques, **pas un avis médical individualisé**. Pour un objectif de perte de poids combiné à une activité physique, consulter un diététicien / médecin (un bilan de la ferritine est recommandé).
