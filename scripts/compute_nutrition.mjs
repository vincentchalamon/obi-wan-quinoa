#!/usr/bin/env node
/* Calcule la nutrition (kcal + protéines PAR PART) des recettes qui n'en ont pas, par somme des macros
   des ingrédients (table Ciqual/USDA versionnée, scripts/nutrition_table.json) / nombre de portions.
   Méthode sourcée et reproductible (pas d'invention). N'ajoute que kcal/prot -> ne modifie NI quantités NI
   instructions (compatible desserts figés). Régénère ensuite recipes/index.json.
   Usage :
     node scripts/compute_nutrition.mjs            # remplit les recettes sans kcal/prot
     node scripts/compute_nutrition.mjs --report   # aperçu + ingrédients non reconnus, sans écrire
     node scripts/compute_nutrition.mjs --all      # recalcule TOUTES les recettes (écrase) */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { readRecipes, serializeRecipe } from './catalogue_lib.mjs';
const require = createRequire(import.meta.url);
const L = require('../logic.js');
const T = require('./nutrition_table.json');

const RECIPES_DIR = new URL('../recipes/', import.meta.url).pathname;
const MATCH = T.match.map(([pat, key]) => [new RegExp('\\b(?:' + pat + ')'), key]);
const mode = process.argv.includes('--report') ? 'report' : process.argv.includes('--all') ? 'all' : 'fill';

function keyOf(name) { const n = L.norm(name); for (const [re, key] of MATCH) if (re.test(n)) return key; return null; }
/* grammes d'une ligne selon la table ; null = inconnu (unité ou pièce non convertible). */
function gramsOf(p, key) {
  if (p.qty == null) return 0;                                   // ingrédient non quantifié (zeste, "au goût") -> ignoré
  if (p.unit) {
    if (p.unit === 'sachet') return p.qty * (T.sachet[key] != null ? T.sachet[key] : T.sachet.default);
    const g = T.unitGrams[p.unit]; return g == null ? null : p.qty * g;
  }
  const cg = T.countGrams[key]; return cg == null ? null : p.qty * cg;
}
const isDessert = (o) => (o.labels || []).some((l) => L.norm(l) === 'dessert');
/* Totaux de la recette ENTIÈRE (avant division par les portions). */
function computeTotals(o) {
  let kcal = 0, prot = 0, grams = 0; const unknown = [];
  for (const line of o.ingredients || []) {
    const p = L.parseQty(line), key = keyOf(p.name);
    if (!key) { unknown.push(line + '  [nom ?]'); continue; }
    const g = gramsOf(p, key);
    if (g == null) { unknown.push(line + '  [' + (p.unit || 'pièce') + ' ?]'); continue; }
    const t = T.table[key]; grams += g; kcal += g / 100 * t.kcal; prot += g / 100 * t.prot;
  }
  return { kcal, prot, grams, unknown };
}
/* Portions retenues : yield si > 1 ; sinon, pour un dessert « gâteau » (poids > 350 g), inférence par le
   poids (~100 g/part, borné 1..16). Métadonnée seulement (n'altère ni quantités ni instructions). */
function partsOf(o, grams) {
  if ((o.portions || 1) > 1) return o.portions;
  if (isDessert(o) && grams > 350) return Math.min(16, Math.max(1, Math.round(grams / 100)));
  return o.portions || 1;
}
function compute(o) {
  const tot = computeTotals(o); const parts = partsOf(o, tot.grams);
  return { parts: parts, kcal: Math.round(tot.kcal / parts / 5) * 5, prot: Math.round(tot.prot / parts), unknown: tot.unknown };
}

const recipes = readRecipes(RECIPES_DIR);
let filled = 0;
for (const { file, obj } of recipes) {
  const missing = typeof obj.kcal !== 'number' || typeof obj.prot !== 'number';
  if (mode === 'fill' && !missing) continue;
  const c = compute(obj);
  const inferred = c.parts !== (obj.portions || 1);
  if (mode === 'report') {
    console.log(`\n[${obj.id}] parts=${c.parts}${inferred ? ' (inféré)' : ''} -> ${c.kcal} kcal / ${c.prot} g prot` + (missing ? ' (MANQUANT)' : ''));
    if (c.unknown.length) c.unknown.forEach((u) => console.log('   ? ' + u));
    continue;
  }
  if (inferred) obj.portions = c.parts;                          // portions inférées (métadonnée) pour un dessert multi-parts
  if (mode === 'all' || typeof obj.kcal !== 'number') obj.kcal = c.kcal;
  if (mode === 'all' || typeof obj.prot !== 'number') obj.prot = c.prot;
  fs.writeFileSync(file, serializeRecipe(obj));
  filled++;
  if (c.unknown.length) console.error(`[${obj.id}] ${c.kcal} kcal / ${c.prot} g — ${c.unknown.length} ingrédient(s) non pris en compte`);
}
if (mode !== 'report') {
  console.error(`\n${filled} recette(s) mises à jour.`);
  execFileSync(process.execPath, [new URL('./build_index.mjs', import.meta.url).pathname], { stdio: 'inherit' });
}
