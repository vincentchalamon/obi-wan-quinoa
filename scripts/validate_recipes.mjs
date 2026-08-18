#!/usr/bin/env node
/* Valide le catalogue local (schema + coherence) — SANS reseau. Verrouille les regles mecaniques :
   champs requis, kcal/prot numeriques, exactement un label de type, allergenes dans le set ferme,
   lignes d'ingredients atomiques/parseables, id === nom de fichier + unicite, image referencee existante.
   Enchaine build_index --check (fraicheur de l'index). Usage : node scripts/validate_recipes.mjs */
import { execFileSync } from 'child_process';
import { readRecipes, validateRecipe } from './catalogue_lib.mjs';

const RECIPES_DIR = new URL('../recipes/', import.meta.url).pathname;
const ROOT = new URL('../', import.meta.url).pathname;

const recipes = readRecipes(RECIPES_DIR);
if (!recipes.length) { console.error('Aucune recette dans recipes/.'); process.exit(1); }

const allIds = new Map();
recipes.forEach((r) => allIds.set(r.obj.id, (allIds.get(r.obj.id) || 0) + 1));

let nErr = 0;
for (const { basename, obj } of recipes) {
  const errs = validateRecipe(obj, { basename, allIds, root: ROOT });
  if (errs.length) { nErr += errs.length; console.error(`\n[${basename}]`); errs.forEach((e) => console.error('  - ' + e)); }
}

if (nErr) { console.error(`\n${nErr} erreur(s) de validation.`); process.exit(1); }
console.error(`${recipes.length} recettes valides.`);
execFileSync(process.execPath, [new URL('./build_index.mjs', import.meta.url).pathname, '--check'], { stdio: 'inherit' });
