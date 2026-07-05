---
name: recipe
description: Rédiger une recette végétarienne équilibrée (de saison, sourcée nutrition) et la publier directement dans mon catalogue RecipeSage via l'API (après validation).
argument-hint: "<idée de plat, contrainte ou ingrédients ; ex. 'plat courge riche en protéines'>"
allowed-tools: Read, WebSearch, WebFetch, Bash
---

Aide l'auteur à **créer une nouvelle recette** pour enrichir son catalogue RecipeSage public (la base de données que l'application Obi-Wan Quinoa interroge pour générer les menus). Elle rédige une recette équilibrée et sourcée, la présente pour **validation**, puis la **publie directement** dans RecipeSage via l'API (`scripts/rs_publish.mjs`). Ne touche pas au dépôt.

Demande cible : `$ARGUMENTS` (idée de plat, contrainte, ou ingrédients à valoriser). **Commence toujours par demander à l'auteur ce dont il dispose** (panier AMAP, placard, contraintes, saison, envie) si ce n'est pas déjà précisé : la recette doit d'abord valoriser ces ingrédients (anti-gaspi).

## Principe
- **Ne rien inventer côté nutrition.** Tout chiffre/principe vient de `.claude/skills/recipe/references/nutrition.md` (ou d'une source primaire vérifiée via WebSearch/WebFetch), cité dans la justification. Pas un avis médical.
- Recette **lacto-ovo végétarienne**, **de saison**, portions **pour 1 personne** par défaut (ou précise le rendement).
- Vise la cohérence avec les cibles de `nutrition.md` (densité protéique, fer + vitamine C, variété, sel modéré). Lis d'abord l'en-tête « Cibles & règles » ; ne lis les sections détaillées que si une valeur est contestée.
- **Sécurité de la publication** : la skill ne manipule **jamais** les identifiants RecipeSage. L'auteur génère lui-même un token de session (via `users.login`) et le place dans un fichier **gitignoré** (`.rs_token` ou `~/.config/obi-wan-quinoa/rs_token`) ; le script le lit à l'exécution sans l'afficher. **Aucun identifiant ni token n'est écrit dans le dépôt, committé ou publié.**

## Étapes
1. **Recueillir** : si `$ARGUMENTS` ne le précise pas, **demander ce dont l'auteur dispose** (panier AMAP, placard, contraintes, saison, objectif) — la recette doit d'abord valoriser ces ingrédients.
2. **Éviter les doublons** : lister le catalogue existant avec `node scripts/rs_catalog.mjs` et vérifier que la recette envisagée n'y figure pas déjà (titre ou concept proche). Si c'est trop proche d'une recette existante, proposer une variante distincte ou demander confirmation avant de continuer.
3. **Cadrer** : proposer un titre et un concept (saison, panier, objectif protéines) en 2-3 lignes. Itérer avec l'auteur si besoin.
4. **Composer** : ingrédients (quantités réalistes pour 1 personne) et étapes claires.
5. **Chiffrer** : estimer `kcal` et `protéines` (méthode/source).
6. **Étiqueter** : un label de **type** — `repas` (seule catégorie générée en menu), `base`, `accompagnement` ou `dessert` — et le(s) label(s) de **régime** (additifs) : `vegetarien` (+ `vegan` si aucun produit animal ; un vegan porte aussi `vegetarien`), plus `sans-gluten`/`sans-lactose` si applicable. **Pas de label par ingrédient** ni `midi`/`soir` (inutiles au générateur).
7. **Publier** : présenter le bloc de validation ci-dessous, puis publier **après accord explicite** de l'auteur (action externe) :
   ```sh
   echo '<recette JSON>' | node scripts/rs_publish.mjs --confirm
   ```
   JSON attendu : `{ "title", "yield", "ingredients": [...], "instructions": [...], "labels": [...], "nutritionCalories", "nutritionProtein", "activeTime"?, "totalTime"?, "source"?, "url"? }`. Sans `--confirm` = aperçu (dry-run). Token : cf. « Sécurité de la publication » ci-dessus.

## Sortie — bloc de validation (avant publication)
Format **exact** — grammaire compatible avec l'app : **quantité + unité en tête de ligne**, **une ligne par ingrédient** (jamais deux sur la même ligne), fractions en **ASCII** (`1/2`, pas `½`) et sans nombre mixte (`1,5` plutôt que `1 1/2`), cuillères en toutes lettres (`cuillère à soupe`/`cuillère à café`), unités métriques ; **jamais** le format `Nom — quantité`. Une ligne par étape.

```
Titre : <titre>
Rendement : 1 personne
Labels : <type: repas|base|accompagnement|dessert>, vegetarien[, vegan][, sans-gluten][, sans-lactose]

Ingrédients :
<quantité> <unité> <nom>        (ex. "80 g quinoa", "1 gousse ail", "1/2 citron")
                                (à éviter : "Quinoa — 80 g", "½ citron", "2 c. à s. sauce soja")
...

Instructions :
<étape 1>
<étape 2>
...

Nutrition (à saisir dans RecipeSage) : Calories <n> kcal · Protéines <n> g
```

Puis une **justification nutritionnelle sourcée** (3-5 puces max), en citant `nutrition.md` (ou la source primaire).

## Condition de complétion
Recette complète et cohérente (labels type + régime, nutrition chiffrée et sourcée, régime lacto-ovo respecté, format d'ingrédients compatible app), **validée par l'auteur puis publiée** via `scripts/rs_publish.mjs --confirm` (l'auteur peut aussi préférer l'aperçu sans `--confirm` et coller manuellement).
