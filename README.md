# Obi-Wan Quinoa

> Que la graine soit avec toi, padawan.

Application web (PWA) pour composer ses **menus végétariens de la semaine** et la **liste de courses** correspondante, utilisable **hors-ligne** et hébergée sur GitHub Pages. Les menus sont **générés par l'application** (sans IA) à partir d'un **catalogue de recettes public RecipeSage**, en privilégiant les ingrédients que l'on a déjà (panier AMAP, placard). Aucun backend, aucune authentification, aucune dépendance.

Le catalogue-source est le RecipeSage **de l'auteur** (son `userId` est codé en dur). Pour utiliser votre propre catalogue, **forkez** le projet et remplacez cet identifiant dans `recipesage.js`.

## Comment ça marche

1. **Profil** (icône ⚙ dans l'en-tête) : régime alimentaire, nombre de **couverts** par défaut, **début de la semaine** alimentaire (les données de démonstration sont calées sur le jeudi, rythme AMAP).
2. Sur le **marqueur de semaine**, toucher **« Générer »**, saisir les **ingrédients disponibles** au format `1 courgette; 3 tomates; 200 g de lentilles`.
3. L'app interroge le catalogue RecipeSage, **propose** une semaine (7 jours × midi/soir) en privilégiant les recettes qui consomment les ingrédients saisis (anti-gaspi), desserts exclus. Pour chaque repas : **lien** vers la recette RecipeSage et bouton **« proposer une autre »** (re-tirage). **« Valider la semaine »** enregistre le menu.
4. Une fois généré, tout est stocké localement : **menu, recettes et courses sont consultables hors-ligne**. (La *génération* nécessite une connexion — le bouton est grisé hors-ligne.)

### Retoucher / utiliser

- **Couverts par repas** : sur une recette, ajuster les couverts ; les quantités de courses se mettent à l'échelle (n'affecte pas le repas des autres jours).
- **Liste de courses** : calculée à partir des repas conservés. Toucher un nombre pour saisir la quantité **à acheter** (si on en a déjà) ; le besoin reste affiché (« sur N »). Les ingrédients saisis au moment de la génération sont **pré-déduits** automatiquement.
- **Glisser-déposer** un repas (poignée à droite) pour échanger midi/soir ou changer de jour ; **« je mange à l'extérieur »** retire un repas. Retouches locales (hors-ligne).
- **Mode cuisine** : garder l'écran allumé pendant la préparation.

## Enrichir le catalogue (auteur)

Les recettes vivent dans **RecipeSage** (source de vérité unique) ; l'app n'en héberge aucune. Pour ajouter une recette, l'auteur utilise la skill **Claude Code `/recipe`** (en CLI/desktop, hors application) : elle rédige une recette équilibrée et sourcée (ingrédients au format `quantité unité nom`, une ligne par ingrédient, pour 1 personne ; étapes ; **labels** de type et de régime ; valeurs nutritionnelles), puis la **publie directement** dans RecipeSage via l'API après validation (cf. `scripts/rs_publish.mjs`). Plus le catalogue est étiqueté et fourni, meilleures sont les propositions.

**Convention de labels** : un label de **type** — `repas` (seules ces recettes entrent dans la génération de menus), `base`, `accompagnement`, `dessert` — et un ou plusieurs labels de **régime** — `vegetarien`, `vegan` (additif : un plat vegan porte aussi `vegetarien`), `viande`, `poisson` — plus les allergènes `sans-gluten` / `sans-lactose` le cas échéant. Pas de label par ingrédient : le matching anti-gaspi lit déjà le texte des ingrédients.

### Équilibre alimentaire visé (référence d'écriture des recettes)

Cibles de l'auteur, appliquées par la skill `/recipe` (détail et sources : [`.claude/skills/recipe/references/nutrition.md`](.claude/skills/recipe/references/nutrition.md)) :

- **~1900 kcal/j** (déficit léger ~500 kcal ; Mifflin-St Jeor) et **~115 g de protéines/j** (repère théorique haut ~1,6 g/kg ≈ 130 g).
- Régime **lacto-ovo** : veiller oméga-3 (EPA/DHA), vitamine D, **B12**, calcium ; **fer + vitamine C** le même jour, éloigner les inhibiteurs (calcium, tanins thé/café).
- **Produits de saison**, sel limité (< 8 g/j, PNNS).

## Fonctionnement technique

- `index.html` — la PWA (HTML/CSS/JS, sans dépendance, sans build) : profil, rendu du planning, écran de génération, liste de courses.
- `logic.js` — logique pure sans DOM (dates, matérialisation des menus, calcul des courses, **parser d'ingrédients FR**, **moteur de génération**), testée en Node (`test/logic.test.js`).
- `recipesage.js` — client de l'API **tRPC publique** de RecipeSage : `getRecipes` (liste filtrable par labels) et `getRecipe` (détail), mappés vers la forme interne. GET direct (`?input=<json>`), CORS ouvert, aucun secret. Testé (`test/recipesage.test.js`).
- Les recettes sélectionnées et les menus générés sont stockés **côté client** (`localStorage`, clés `owq.*`) et matérialisés au démarrage. Aucune donnée de recettes/menus n'est embarquée dans le dépôt — tout provient de RecipeSage.
- `sw.js` — service worker : *network-first* sur HTML/JSON, *cache-first* sur les statiques ; précache pour le hors-ligne.
- `manifest.webmanifest` — métadonnées PWA (installable, hors-ligne).
- `.claude/skills/recipe/` — la skill d'écriture de recettes (`SKILL.md`) et son référentiel nutrition **sourcé** (`references/nutrition.md`).

Aucune clé d'API ni serveur : l'app appelle directement l'API publique de RecipeSage sur des données publiques ; le site reste 100 % statique.

### Tester en local

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

(Le service worker, le chargement des JSON et les appels RecipeSage nécessitent `http(s)://`, pas `file://`.)

### Validation & CI

- `python3 scripts/validate.py` — valide l'intégrité statique (manifest, assets référencés, liens locaux de `index.html`).
- `node --test 'test/*.test.js'` — tests unitaires de la logique pure (`logic.js`, `recipesage.js`).
- CI (`.github/workflows/ci.yml`) sur chaque push/PR : validation des données, syntaxe JS (`sw.js`, `logic.js`, `recipesage.js`, JS inline), tests, scan de secrets. Sans dépendance, aucun secret.
- Déploiement Pages via `.github/workflows/pages.yml` (source *GitHub Actions*), avec anti-collision (`concurrency`) et retry.

## Avertissement

Les repères nutritionnels sont des informations générales issues de sources publiques, **pas un avis médical individualisé**. Pour un objectif de perte de poids combiné à une activité physique, consulter un diététicien / médecin (bilan de la ferritine recommandé).
