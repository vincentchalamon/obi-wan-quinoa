---
name: plan
description: Proposer un menu végétarien hebdomadaire de saison à partir du panier AMAP, le valider repas par repas en conversation, puis l'écrire dans menus.json
argument-hint: "<jeudi AAAA-MM-JJ | prochaine>"
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(python3 *), Bash(git status *), Bash(git diff *), Bash(git add *), Bash(git commit *), Bash(git push *), WebSearch, WebFetch
---

Génère une proposition de menu pour la **semaine à venir** (jeudi → mercredi, rythme AMAP), la fait **valider repas par repas**, puis l'écrit dans `menus.json` après accord explicite. La semaine cible est `$ARGUMENTS` (un jeudi `AAAA-MM-JJ`, ou `prochaine`). Si absent, demande-le.

Principe absolu : **ne rien inventer côté nutrition**. Chaque principe ou chiffre invoqué doit venir de `.claude/skills/plan/references/nutrition.md` (ou d'une source primaire vérifiée via WebSearch/WebFetch). Toujours citer la source dans la justification. Tu n'es pas un avis médical : rappelle-le quand tu touches au déficit calorique ou aux dons.

## Step 1 — Cibler la semaine
- `prochaine` = le prochain jeudi sans entrée dans `menus.json` ; sinon le jeudi fourni. Vérifie que c'est bien un jeudi (`python3 -c "import datetime,sys; print(datetime.date.fromisoformat(sys.argv[1]).weekday())" <date>` doit donner `3`).
- Lancée un mardi soir, la cible par défaut est le jeudi du surlendemain.
- Déduis la **saison** depuis la date (pour la cohérence des produits).

## Step 2 — Saisir le panier AMAP
- **Si le panier AMAP (et l'éventuel jour de don) sont déjà fournis dans le message initial** (l'app Obi-Wan Quinoa pré-remplit le prompt via un deep link `claude://code/new`), les utiliser directement sans les redemander.
- Sinon, demande à l'utilisateur ce qu'il a récupéré (légumes/fruits + quantités approximatives).
- Ces produits frais sont la **base de la semaine**, placés **en début de semaine** (jeudi/vendredi/...), **jamais le mercredi** (jour de courses).

## Step 3 — Don de sang cette semaine ?
- Si l'info figure déjà dans le message initial, utilise-la ; sinon, demande si un **don de plasma/plaquettes** est prévu et **quel jour**.
- Si oui : repère les repas dans la fenêtre **~12-20 h avant le don** (le repas du soir de la veille si don le matin, et/ou le midi du jour) ; ils devront être **équilibrés et pauvres en graisses**, tout en restant riches en fer + vitamine C (cf. nutrition.md §7).

## Step 4 — Charger le contexte
- Lis `recipes.json`, `menus.json`, et `.claude/skills/plan/references/nutrition.md`.

## Step 5 — Gardes (avant de composer)
- **Semaine déjà acceptée** : si la clé du jeudi cible existe déjà dans `menus.json`, **n'écrase rien**. Avertis et demande une confirmation explicite ; par défaut, propose un autre jeudi. Ne modifie jamais une semaine passée.
- **Mercredi de courses couvert** : vérifie que le mercredi de la **semaine en cours** (le lendemain d'une planification du mardi, dernier jour de la semaine précédant le jeudi cible) a déjà un plat dans `menus.json`. Sinon, signale-le (risque de se retrouver sans plat le jour des courses).

## Step 6 — Composer 7 jours (jeudi → mercredi, 2 repas/jour)
Applique `nutrition.md` (cite les sources) :
- **Autour du panier** + produits de saison ; frais en début de semaine ; **mercredi (jour 7) = placard/conserves/restes** (jour de courses, pas de frais à acheter ce jour-là).
- **~1900 kcal/j** (déficit léger) et **~115 g de protéines/j** (cible pratique ; repère théorique haut ~1,6 g/kg ≈ 130 g) : relève la densité protéique (œufs, laitages, légumineuses, tofu/tempeh, soja).
- **Fer + vitamine C** le même jour ; ne concentre pas les laitages (calcium) sur le repas le plus riche en fer ; **oméga-3** (noix/graines/colza) réguliers.
- **Complémentarité** légumineuses + céréales ; **variété** (pas la même protéine dominante deux jours de suite ; varie les féculents).
- Chaque jour : **fruit** de saison + **entrée optionnelle**. Sel modéré.
- **Collation** de récupération autour du yoga (**mercredi soir**, **samedi matin**).
- **Repas pré-don** pauvres en graisses si un don est prévu (Step 3).
- Pioche d'abord dans `recipes.json`. Si une recette manque (saison, panier, protéines), **crée-la** au schéma de `recipes.json` (voir Step 8 pour la validation) — elle sera validée comme les autres et ajoutée au catalogue.

## Step 7 — Proposer (format lisible, PAS de JSON)
- Présente un **tableau jour par jour** : Midi / Soir (titre, ~kcal, ~prot), tag « frais », entrée et fruit éventuels, collation, et **jour de don** signalé le cas échéant.
- Ajoute une **courte justification nutritionnelle sourcée** (équilibre, fer/vit C, saison, dons...). **N'écris rien dans les fichiers à ce stade.**

## Step 8 — Réviser puis valider en bloc
- Présente la **semaine complète** (Step 7), puis laisse l'utilisateur **demander des changements** en langage naturel ; ajuste et **re-présente la semaine entière** à chaque itération, jusqu'à ce qu'il n'ait plus de modifications.
- La validation est **globale** (toute la semaine d'un coup), **pas** repas par repas.
- Ne propose que des recettes existantes ou de **nouvelles recettes complètes** (au schéma) — validées avec l'ensemble.

## Step 9 — Acceptation globale
- Une fois **tous les repas validés**, propose d'écrire l'ensemble. N'écris **que** sur un accord explicite. Flux : proposition → revue → acceptation → écriture.

## Step 10 — Valider le schéma puis écrire
- Construis l'entrée : `{ "<jeudi>": { "jours": [ 7 × { "repas": [ {"recipe":"<id>"}, {"recipe":"<id>"} ] } ] } }`.
- Vérifie **avant d'écrire** : exactement 7 jours ; chaque `recipe` existe dans `recipes.json` (après ajout des nouvelles) ; la clé est un jeudi ; la clé est absente (sauf override confirmé au Step 5) ; pour toute nouvelle recette : `moment ∈ {Midi,Soir}`, `kcal`/`prot` numériques, `ingredients`/`etapes` non vides, `shop[]` = `{n,q:number|null,u,r,note?}` avec `u ∈ {g,ml,gousse,botte,tranche,""}` et `r ∈ {prot,leg,epi,con,fru}`.
- **Merge sans toucher aux autres semaines** dans `menus.json` ; **ajoute les nouvelles recettes** à `recipes.json`. Indentation 2 espaces, UTF-8, accents non échappés.
- Contrôle : `python3 -c "import json; json.load(open('menus.json')); json.load(open('recipes.json'))"`.

## Step 11 — Publier (push direct sur `main`, sans PR)
- Après l'acceptation globale (Step 9) uniquement : reste sur `main` (**ne crée pas** de branche `claude/...`), **committe et pousse directement sur `main`** (message Conventional Commits, ex. `feat(menus): semaine <jeudi>`). GitHub Pages publie. **Pas de PR.**
- Le proxy git des sessions cloud autorise le push sur la **branche de travail courante** : en restant sur `main`, le push direct fonctionne (le repo perso n'a pas de protection de branche). **Fallback** : si le push sur `main` est refusé, bascule sur une branche `claude/...`, ouvre une PR et **préviens l'utilisateur** (à merger, ou relancer la skill depuis Claude Code en local).
- Montre un récap (semaine ajoutée, recettes créées).
- Ne publie **jamais** un menu non validé : commit/push seulement **après** l'acceptation explicite. Aucune autre semaine ne doit être modifiée.

## Conditions de complétion
- Semaine écrite pour le bon jeudi, **7 jours**, **mercredi en placard/conserves**, repas pré-don conformes si un don est prévu, ids tous valides, `menus.json` et `recipes.json` valides (JSON + invariants), **aucune autre semaine modifiée**, sources citées dans la justification. Sinon, la skill n'est pas terminée.

## Rappel
Projet personnel, pas un avis médical. Le profil (déficit + sport + dons) sort du cadre des repères ANSES (adultes en bonne santé) : recommander un suivi diététicien + bilan (ferritine) quand c'est pertinent.
