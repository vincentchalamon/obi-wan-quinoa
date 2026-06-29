# Obi-Wan Quinoa

> Que la graine soit avec toi, padawan.

Application web personnelle (PWA) pour planifier mes **menus végétariens de la semaine** et générer la **liste de courses** correspondante, utilisable **hors-ligne** et hébergée sur GitHub Pages. Les recettes et les plannings sont des fichiers de données ; un assistant (Claude Code, en local) m'aide à composer les semaines, que je relis puis publie via Git.

## Équilibre alimentaire visé (par jour)

- **~1900 kcal/j** (déficit léger d'environ 500 kcal pour ~0,5 kg/semaine ; estimation Mifflin-St Jeor).
- **~130 g de protéines/j** (~1,6 g/kg) pour préserver la masse musculaire pendant la perte de poids.
- **2 repas** (midi/soir) + **fruit** quotidien + **entrée optionnelle** + **collation** autour du yoga.
- Points d'attention d'un régime lacto-ovo (ANSES 2025) : **oméga-3 (EPA/DHA) et vitamine D**, **vitamine B12** (malgré les œufs), **calcium + vitamine D + protéines** pour la santé osseuse.
- **Fer** : surtout une question d'absorption — associer **fer + vitamine C** (agrumes, poivron, kiwi, tomate) et éloigner les inhibiteurs (laitages/calcium, **tanins du thé/café**). Boissons : **rooibos, tisanes, infusions** (pauvres en tanins).
- **Produits de saison** privilégiés (et le contenu réel du panier AMAP).
- Sel limité (< 8 g/j, PNNS).

### Avant un don de plasma/plaquettes

Repas **équilibré et pauvre en graisses** dans les ~12-20 h précédant le don : un repas trop gras rend le plasma laiteux (lipémique), bouche les filtres et fausse les analyses, ce qui fait écarter le don. Garder fer + vitamine C, **ne pas venir à jeun**, bien s'hydrater. (Sources EFS / Croix-Rouge.)

## Comment je l'utilise

1. **Mardi soir**, au retour de l'AMAP, je lance l'assistant : `/plan prochaine`.
2. Je renseigne le **contenu du panier** et un éventuel **jour de don** dans la semaine.
3. L'assistant propose un menu de saison, équilibré et sourcé ; je **valide ou commente chaque repas**.
4. Une fois tout validé, il écrit la semaine dans `menus.json` (et ajoute d'éventuelles nouvelles recettes dans `recipes.json`).
5. Je relis le diff, puis je **commite et pousse** : GitHub Pages publie la nouvelle semaine.

## Fonctionnement technique

- `index.html` — la PWA (HTML/CSS/JS, sans dépendance). Charge les données au démarrage et calcule la liste de courses à partir des repas conservés.
- `recipes.json` — catalogue de recettes (source de vérité, portions pour 1 personne). Champs : `moment`, `heure`, `titre`, `kcal`, `prot`, `priorite?`, `ingredients[]`, `etapes[]`, `shop[]` (`{n, q, u, r, note?}`, rayon `r ∈ prot|leg|epi|con|fru`).
- `menus.json` — planning par semaine. Clé = date du **jeudi** ; 7 jours (jeudi→mercredi) ; chaque repas référence une recette par son identifiant (`{"recipe":"buddha"}`), résolu en midi/soir selon sa position.
- `sw.js` — service worker : *network-first* sur le HTML et les JSON (pour voir les nouveaux menus en ligne), *cache-first* sur les icônes ; précache pour l'usage hors-ligne.
- `manifest.webmanifest` — métadonnées PWA (installable, hors-ligne).
- `.claude/skills/plan/` — la skill de génération (`SKILL.md`) et son référentiel nutrition **sourcé** (`references/nutrition.md`).

Aucune clé d'API ni serveur : la génération se fait en local avec Claude Code, le reste est 100 % statique.

### Tester en local

```sh
python3 -m http.server 8000   # puis ouvrir http://localhost:8000
```

(Le service worker et le chargement des JSON nécessitent `http://`, pas `file://`.)

## Sources nutritionnelles

Les principes nutritionnels et leurs références sont rassemblés dans [`.claude/skills/plan/references/nutrition.md`](.claude/skills/plan/references/nutrition.md) : ANSES (repères végétariens 2025), Santé publique France / Manger Bouger (PNNS), EFS (alimentation du donneur, don de plasma), Academy of Nutrition and Dietetics (2025), NHS, NIH (fer), ADEME (saisonnalité), formule de Mifflin-St Jeor.

## Avertissement

Projet **personnel**. Les repères nutritionnels présentés sont des informations générales issues de sources publiques, **pas un avis médical individualisé**. Pour un objectif de perte de poids combiné à des dons du sang réguliers et à une activité physique, consulter un diététicien / médecin et suivre les consignes de l'EFS (un bilan de la ferritine est recommandé).
