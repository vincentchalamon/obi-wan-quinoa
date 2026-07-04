---
name: plan
description: Proposer un menu végétarien hebdomadaire de saison à partir du panier AMAP, le valider repas par repas en conversation, puis l'écrire dans menus.json
argument-hint: "<jeudi AAAA-MM-JJ | prochaine>"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(python3 *), Bash(git status *), Bash(git diff *), Bash(git add *), Bash(git commit *), Bash(git push *), WebSearch, WebFetch
---

Génère une proposition de menu pour la **semaine à venir** (jeudi → mercredi, rythme AMAP), la fait **valider en bloc**, puis l'écrit dans `menus.json` après accord explicite. La semaine cible est `$ARGUMENTS` (un jeudi `AAAA-MM-JJ`, ou `prochaine`). Si absent, demande-le.

Principe absolu : **ne rien inventer côté nutrition**. Chaque principe ou chiffre invoqué doit venir de `.claude/skills/plan/references/nutrition.md` (ou d'une source primaire vérifiée via WebSearch/WebFetch). Toujours citer la source dans la justification. Tu n'es pas un avis médical : rappelle-le quand tu touches au déficit calorique.

Économie de contexte : charge le catalogue via `scripts/plan_context.py` (Step 3), pas le `recipes.json` complet ; ne lis le `recipes.json` d'une recette entière que pour la modifier. Ne relance pas de lectures inutiles en cours de conversation.

## Step 1 — Cibler la semaine
- `prochaine` = le prochain jeudi sans entrée dans `menus.json` ; sinon le jeudi fourni. `python3 scripts/plan_context.py <cible>` résout `prochaine` et affiche `CIBLE:` (jeudi retenu). Vérifie que la cible est bien un jeudi (`python3 -c "import datetime,sys; print(datetime.date.fromisoformat(sys.argv[1]).weekday())" <date>` doit donner `3`).
- Lancée un mardi soir, la cible par défaut est le jeudi du surlendemain.
- Déduis la **saison** depuis la date (pour la cohérence des produits).

## Step 2 — Saisir le panier AMAP
- **Si le panier AMAP est déjà fourni dans le message initial** (l'app Obi-Wan Quinoa pré-remplit le prompt via un deep link `claude://code/new`), l'utiliser directement sans le redemander.
- Sinon, demande à l'utilisateur ce qu'il a récupéré (légumes/fruits + quantités approximatives).
- Ces produits frais sont la **base de la semaine**, placés **en début de semaine** (jeudi/vendredi/...), **jamais le mercredi** (jour de courses).

## Step 2 bis — Repas sautés à reporter
- Le prompt de l'app peut lister des **« Repas sautés cette semaine (ingrédients déjà achetés) »**. Ces plats ont été retirés du planning en cours alors que les courses étaient déjà faites : leurs ingrédients sont **en stock**.
- **Propose de les reporter** dans la semaine cible, **placés le jeudi (jour 1)** pour consommer les produits frais en priorité (fraîcheur). Cela fait autant de recettes en moins à inventer.
- Ces repas reportés **ne rajoutent pas de courses fraîches** (déjà achetés) : l'utilisateur ajuste au besoin les quantités dans l'app. N'ajoute pas de nouvel achat pour eux, hormis un éventuel complément.
- Si aucun repas sauté n'est signalé, ignore cette étape.

## Step 3 — Charger le contexte
- Exécute `python3 scripts/plan_context.py <cible>` : catalogue compact des recettes (`id | moment | titre | kcal | prot | [frais] | ingrédients`), `MENUS_KEYS`, et les 2 semaines utiles aux gardes (cible + précédente). C'est le contexte de **choix** — pas besoin du `recipes.json` complet.
- Lis **uniquement l'en-tête compact** de `nutrition.md` : `sed -n '/^## Cibles/,/^## 1\./p' .claude/skills/plan/references/nutrition.md` (ou Read avec `limit`). Ne lis le fichier complet (sections numérotées) **que si une valeur est contestée** ou pour vérifier une source.
- **Garde-fous qualité** : (a) à la **création** d'une recette, lis d'abord 1-2 recettes complètes du `recipes.json` comme gabarit (style des `etapes`, format du `shop`) ; (b) si la sortie de `plan_context.py` paraît incomplète/étrange, rabats-toi sur le Read de `recipes.json`.

## Step 4 — Gardes (avant de composer)
- **Semaine déjà acceptée** : si la clé du jeudi cible existe déjà dans `menus.json` (voir `SEMAINE CIBLE` ≠ `absente`), **n'écrase rien**. Avertis et demande une confirmation explicite ; par défaut, propose un autre jeudi. Ne modifie jamais une semaine passée.
- **Mercredi de courses couvert** : vérifie que la **semaine précédente** (`SEMAINE PRÉCÉDENTE` de `plan_context.py`) a bien un plat à son dernier jour (j7 = le mercredi précédant le jeudi cible). Sinon, signale-le (risque de se retrouver sans plat le jour des courses).

## Step 5 — Composer 7 jours (jeudi → mercredi, 2 repas/jour)
Applique le bloc « Cibles & règles » de `nutrition.md` (cite les sources) :
- **Autour du panier** + produits de saison ; frais en début de semaine ; **mercredi (jour 7) = placard/conserves/restes** (jour de courses, pas de frais à acheter ce jour-là).
- **Repas reportés** (Step 2 bis) : place-les le **jeudi** (jour 1), en priorité sur les nouveaux plats.
- **~1900 kcal/j** (déficit léger) et **~115 g de protéines/j** (cible pratique ; repère théorique haut ~1,6 g/kg ≈ 130 g) : relève la densité protéique (œufs, laitages, légumineuses, tofu/tempeh, soja).
- **Fer + vitamine C** le même jour ; ne concentre pas les laitages (calcium) sur le repas le plus riche en fer ; **oméga-3** (noix/graines/colza) réguliers.
- **Complémentarité** légumineuses + céréales ; **variété** (pas la même protéine dominante deux jours de suite ; varie les féculents).
- Chaque jour : **fruit** de saison + **entrée optionnelle**. Sel modéré.
- **Collation** de récupération autour du yoga (**mercredi soir**, **samedi matin**).
- Pioche d'abord dans le catalogue. Si une recette manque (saison, panier, protéines), **crée-la** au schéma de `recipes.json` (voir Step 9 pour la validation, et le garde-fou gabarit du Step 3) — elle sera validée comme les autres et ajoutée au catalogue.

## Step 6 — Proposer (format compact, PAS de JSON)
- Présente la semaine **jour par jour**, **1 ligne par repas** : `Jour — Midi : titre (~kcal, ~prot)` / `Soir : ...`, avec tag « frais », entrée et fruit éventuels, collation le cas échéant.
- Ajoute une **justification nutritionnelle sourcée en 3-5 puces** max (équilibre, fer/vit C, saison, protéines), pas de paragraphes. **N'écris rien dans les fichiers à ce stade.**

## Step 7 — Réviser puis valider en bloc
- Après la **proposition initiale** (semaine complète, Step 6), laisse l'utilisateur **demander des changements** en langage naturel. À chaque itération, ne re-présente **que le(s) jour(s) modifié(s)** + une ligne de contexte ; ne réémets pas la semaine entière.
- Quand l'utilisateur n'a plus de modifications, **re-présente la semaine complète** une dernière fois (confirmation finale) avant d'écrire.
- La validation est **globale** (toute la semaine d'un coup), **pas** repas par repas.
- Ne propose que des recettes existantes ou de **nouvelles recettes complètes** (au schéma) — validées avec l'ensemble.

## Step 8 — Acceptation globale
- Une fois **tous les repas validés** (confirmation finale, Step 7), propose d'écrire l'ensemble. N'écris **que** sur un accord explicite. Flux : proposition → révision → confirmation → écriture.

## Step 9 — Valider le schéma puis écrire
- Construis l'entrée : `{ "<jeudi>": { "jours": [ 7 × { "repas": [ {"recipe":"<id>"}, {"recipe":"<id>"} ] } ] } }`.
- Vérifie **avant d'écrire** : exactement 7 jours ; chaque `recipe` existe dans `recipes.json` (après ajout des nouvelles) ; la clé est un jeudi ; la clé est absente (sauf override confirmé au Step 4) ; pour toute nouvelle recette : `titre` non vide, `moment ∈ {Midi,Soir}`, `kcal`/`prot` numériques, `ingredients`/`etapes` non vides, `shop[]` = `{n,q:number|null,u,r,note?}` avec `u ∈ {g,ml,gousse,botte,tranche,""}` et `r ∈ {prot,leg,epi,con,fru}`.
- **Merge sans toucher aux autres semaines** dans `menus.json` ; **ajoute les nouvelles recettes** à `recipes.json`. Indentation 2 espaces, UTF-8, accents non échappés.
- Contrôle : `python3 scripts/validate.py` (schéma + invariants + intégrité statique).

## Step 10 — Publier (push direct sur `main`, sans PR)
- Après l'acceptation globale (Step 8) uniquement : reste sur `main` (**ne crée pas** de branche `claude/...`), **committe et pousse directement sur `main`** (message Conventional Commits, ex. `feat(menus): semaine <jeudi>`). GitHub Pages publie. **Pas de PR.**
- Le proxy git des sessions cloud autorise le push sur la **branche de travail courante** : en restant sur `main`, le push direct fonctionne (le repo perso n'a pas de protection de branche). **Fallback** : si le push sur `main` est refusé, bascule sur une branche `claude/...`, ouvre une PR et **préviens l'utilisateur** (à merger, ou relancer la skill depuis Claude Code en local).
- Montre un **récap concis** (semaine ajoutée, recettes créées) — pas de `git diff` complet déversé en contexte.
- Ne publie **jamais** un menu non validé : commit/push seulement **après** l'acceptation explicite. Aucune autre semaine ne doit être modifiée.

## Conditions de complétion
- Semaine écrite pour le bon jeudi, **7 jours**, **mercredi en placard/conserves**, ids tous valides, `menus.json` et `recipes.json` valides (`scripts/validate.py` OK), **aucune autre semaine modifiée**, sources citées dans la justification. Sinon, la skill n'est pas terminée.

## Rappel
Projet personnel, pas un avis médical. Le profil (déficit + sport) sort du cadre des repères ANSES (adultes en bonne santé) : recommander un suivi diététicien + bilan (ferritine) quand c'est pertinent.
