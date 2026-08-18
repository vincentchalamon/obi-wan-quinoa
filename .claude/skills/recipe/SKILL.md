---
name: recipe
description: Rédiger une recette végétarienne équilibrée (de saison, sourcée nutrition) et la publier dans mon catalogue local (fichier recipes/<slug>.json), puis commit direct sur main après validation.
argument-hint: "<idée de plat, contrainte ou ingrédients ; ex. 'plat courge riche en protéines'>"
allowed-tools: Read, Write, Edit, WebSearch, WebFetch, Bash
---

Aide l'auteur à **créer une nouvelle recette** pour enrichir le catalogue **local** de l'application Obi-Wan Quinoa (les recettes vivent dans le dépôt, sous `recipes/`). Rédige une recette équilibrée et sourcée, présente-la pour **validation**, puis **publie** en écrivant le fichier et en **committant directement sur `main`** (pas de PR — l'auteur relit avant le commit).

Demande cible : `$ARGUMENTS` (idée de plat, contrainte, ou ingrédients à valoriser). **Commence toujours par demander à l'auteur ce dont il dispose** (panier AMAP, placard, contraintes, saison, envie) si ce n'est pas déjà précisé : la recette doit d'abord valoriser ces ingrédients (anti-gaspi).

## Principe
- **Ne rien inventer côté nutrition.** Tout chiffre/principe vient de `.claude/skills/recipe/references/nutrition.md` (ou d'une source primaire vérifiée via WebSearch/WebFetch), cité dans la justification. Pas un avis médical.
- Recette **lacto-ovo végétarienne**, **de saison**, portions **pour 1 personne** par défaut (`portions: 1`) — sauf gâteau/plat multi-parts (indiquer le nombre réel de portions).
- Vise la cohérence avec les cibles de `nutrition.md` (densité protéique, fer + vitamine C, variété, sel modéré). Lis d'abord l'en-tête « Cibles & règles ».
- **Qualité (essentielle pour la liste de courses et la lisibilité)** : ingrédients à **nom canonique unique** (mêmes libellés dans tout le catalogue, singulier générique) et **étapes simples** (une action claire par étape). Vérifie la cohérence ingrédients↔étapes.

## Étapes
1. **Recueillir** : si `$ARGUMENTS` ne le précise pas, **demander ce dont l'auteur dispose** — la recette doit d'abord valoriser ces ingrédients.
2. **Éviter les doublons** : lis les titres de `recipes/index.json` et vérifie que la recette envisagée n'y figure pas (titre ou concept proche). Si trop proche, propose une variante distincte ou demande confirmation.
3. **Cadrer** : proposer un titre et un concept (saison, panier, objectif protéines) en 2-3 lignes. Itérer si besoin.
4. **Composer** : ingrédients calibrés sur les grammages par portion de `references/nutrition.md` §11 (GEM-RCN) et le budget/repas (~800-950 kcal, ~55 g protéines, sel < 2,5 g) ; étapes claires.
5. **Chiffrer** : estimer `kcal` et `prot` **par portion** (méthode/source ; possibilité de recouper avec `scripts/nutrition_table.json` via une somme des ingrédients / portions).
6. **Étiqueter** : un label de **type** — `repas` (seule catégorie générée en menu), `base`, `accompagnement` ou `dessert` — plus le(s) label(s) de **régime** en forme accentuée (`végétarien` ; + `vegan` si aucun produit animal ; `sans-gluten`/`sans-lactose` si applicable). **Renseigner `allergenes`** : sous-ensemble du set fermé `gluten, crustaces, oeuf, poisson, arachide, soja, lait, fruits-a-coque, celeri, moutarde, sesame, sulfites, lupin, mollusques` (allergènes **présents**). Pas de label par ingrédient ni `midi`/`soir`.
7. **Publier** (après accord explicite de l'auteur) :
   - Écrire `recipes/<slug>.json` (`slug` = titre normalisé sans accents ni ponctuation ; un renommage **conserve** l'ancien slug/fichier). Schéma ci-dessous.
   - Ajouter l'image éventuelle dans `recipes/images/<slug>.<ext>` et référencer le chemin relatif.
   - Régénérer l'index : `node scripts/build_index.mjs`.
   - Valider : `node scripts/validate_recipes.mjs` (doit passer) et vérifier `node scripts/lint_recipes.mjs` (0 alerte bloquante).
   - Montrer le diff, puis **committer directement sur `main`** (sans PR, **sans** footer « Generated with Claude Code »).

Depuis l'app mobile Claude, la session cloud dispose de git et du proxy GitHub : le commit sur `main` fonctionne, **à condition que la GitHub App Claude soit installée sur le dépôt** (ou un token `gh` synchronisé via `/web-setup`).

## Schéma d'un fichier recette (`recipes/<slug>.json`)
```json
{
  "id": "<slug>",
  "titre": "…",
  "portions": 1,
  "ingredients": ["80 g quinoa", "1 gousse ail", "…"],
  "etapes": ["…", "…"],
  "labels": ["repas", "végétarien"],
  "allergenes": ["gluten"],
  "kcal": 720,
  "prot": 39,
  "image": "recipes/images/<slug>.jpg"
}
```
`shop` n'est **pas** stocké (dérivé à l'exécution). `image` optionnelle.

## Grammaire des ingrédients (compatible app + liste de courses)
**Quantité + unité en tête de ligne**, **une ligne par ingrédient** (jamais deux) ; fractions en **ASCII** (`1/2`, pas `½`), décimales `1,5` ; cuillères en toutes lettres (`cuillère à soupe`/`café`) ; unités métriques. **Jamais** `Nom — quantité`.

**Un seul ingrédient atomique par ligne** — jamais d'énumération (`sel, poivre` → deux lignes) ni de sous-recette (`vinaigrette : moutarde, huile, citron` → chaque composant sur sa ligne, la préparation passant dans les étapes). **Noms canoniques** au singulier générique (`oignon`, `carotte`, `farine` — pas `oignon jaune`/`farine T55`, sauf variété essentielle type `citron vert`). **Unités autorisées** : `g`, `kg`, `ml`, `cl`, `l`, `cuillère à soupe`/`café`, `gousse`, `botte`, `tranche`, `pincée`, `sachet`, `boîte`, `pot` — **proscrire** `cm`, `verre`, `branche`, `bouquet`, `goutte`. Option en note entre parenthèses (`(optionnel)`), pas de préfixe `Optionnel :`. Aucune entité HTML.

## Desserts (recettes figées)
Les recettes de **dessert** existantes sont optimisées : **ne pas modifier** leurs quantités ni leurs instructions ; seule l'harmonisation des libellés d'ingrédients est permise. Pour une **nouvelle** recette, applique pleinement les règles ci-dessus.

## Condition de complétion
Recette complète et cohérente (labels type + régime, `allergenes` renseignés, nutrition chiffrée et sourcée par portion, régime lacto-ovo respecté, ingrédients atomiques/canoniques, étapes claires), **validée par l'auteur**, fichier écrit, index régénéré, `validate_recipes.mjs` vert, puis **commit sur `main`**.
