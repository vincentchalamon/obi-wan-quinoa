#!/usr/bin/env node
/* Regenere recipes/index.json depuis recipes/*.json (manifeste allege + versionnage deterministe).
   Serialisation canonique (catalogue_lib) -> hash/version stables pour le --check et le delta cote app.
   Usage :
     node scripts/build_index.mjs           # (re)ecrit recipes/index.json
     node scripts/build_index.mjs --check   # echoue si index.json est perime ou en collision d'id */
import fs from 'fs';
import path from 'path';
import { readRecipes, buildIndex, serializeIndex } from './catalogue_lib.mjs';

const RECIPES_DIR = new URL('../recipes/', import.meta.url).pathname;
const INDEX = path.join(RECIPES_DIR, 'index.json');
const check = process.argv.includes('--check');

const recipes = readRecipes(RECIPES_DIR);

const ids = new Map();
recipes.forEach((r) => ids.set(r.obj.id, (ids.get(r.obj.id) || 0) + 1));
const dupes = [...ids].filter(([, n]) => n > 1).map(([id]) => id);
if (dupes.length) { console.error('Collision d\'id: ' + dupes.join(', ')); process.exit(1); }

const wanted = serializeIndex(buildIndex(recipes.map(({ obj, rawBytes }) => ({ obj, rawBytes }))));

if (check) {
  const current = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : '';
  if (current !== wanted) { console.error('recipes/index.json est perime. Lance: node scripts/build_index.mjs'); process.exit(1); }
  console.error('index.json a jour (' + recipes.length + ' recettes).');
} else {
  fs.writeFileSync(INDEX, wanted);
  console.error('index.json ecrit (' + recipes.length + ' recettes).');
}
