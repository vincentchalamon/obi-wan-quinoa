#!/usr/bin/env node
/* EXPORT UNIQUE (a lancer AVANT de fermer le compte RecipeSage) : rapatrie TOUT le catalogue public de
   l'auteur (toutes categories : repas, base, accompagnement, dessert) vers le catalogue LOCAL du depot.
   Autonome : n'importe PAS recipesage.js (supprime dans la meme PR). Aucune auth (GET public, sans en-tete
   Origin -> le durcissement CORS de RecipeSage, cote navigateur seulement, ne s'applique pas ici).

   Ecrit recipes/<slug>.json (champs rediges, sans shop), telecharge les images dans recipes/images/,
   puis regenere recipes/index.json (via catalogue_lib.buildIndex).

   Usage : node scripts/export_catalogue.mjs
   Rejouable. Apres export + commit + reste de la migration, l'auteur peut fermer son compte RecipeSage. */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { firstNum, suggestAllergenes, serializeRecipe, serializeIndex, buildIndex } from './catalogue_lib.mjs';
const require = createRequire(import.meta.url);
const L = require('../logic.js');

const OWNER_USER_ID = '4f329051-c9e5-45fb-9a61-069e3853ba61'; // id public de l'auteur (embarque : script autonome)
const API = 'https://api.recipesage.com/trpc/';
const ROOT = new URL('../', import.meta.url).pathname;
const RECIPES_DIR = path.join(ROOT, 'recipes');
const IMAGES_DIR = path.join(RECIPES_DIR, 'images');

const rsGet = async (proc, input) => {
  const r = await fetch(API + proc + '?input=' + encodeURIComponent(JSON.stringify(input)));
  if (!r.ok) throw new Error(proc + ' HTTP ' + r.status);
  return (await r.json()).result.data;
};
async function getAllLite() {
  const PAGE = 200, all = []; let off = 0;
  for (;;) {
    const d = await rsGet('recipes.getRecipes', { userIds: [OWNER_USER_ID], folder: 'main', orderBy: 'title', orderDirection: 'asc', offset: off, limit: PAGE });
    const b = d.recipes || []; all.push(...b);
    if (b.length < PAGE) break; off += PAGE;
  }
  return all;
}
const splitLines = (s) => ('' + (s || '')).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const labelsOf = (raw) => (raw.recipeLabels || []).map((l) => l.label && l.label.title).filter(Boolean);
const EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/* Recette RecipeSage brute -> schema interne du depot (copie autonome de rsMapRecipe, SANS shop ni url). */
function mapRecipe(raw, id) {
  const ingredients = splitLines(raw.ingredients);
  const o = { id, titre: raw.title || '(sans titre)', ingredients, etapes: splitLines(raw.instructions), labels: labelsOf(raw), allergenes: suggestAllergenes(ingredients) };
  const kc = firstNum(raw.nutritionCalories); if (kc != null) o.kcal = kc;
  const pr = firstNum(raw.nutritionProtein); if (pr != null) o.prot = pr;
  return o;
}
async function downloadImage(url, slug) {
  const r = await fetch(url); if (!r.ok) throw new Error('image HTTP ' + r.status);
  const ext = EXT[(r.headers.get('content-type') || '').split(';')[0].trim()] || (url.split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i) || [, 'jpg'])[1].toLowerCase();
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  fs.writeFileSync(path.join(IMAGES_DIR, slug + '.' + ext), Buffer.from(await r.arrayBuffer()));
  return 'recipes/images/' + slug + '.' + ext;
}

fs.mkdirSync(RECIPES_DIR, { recursive: true });
const lite = await getAllLite();
console.error(`${lite.length} recettes a exporter...`);

const usedSlugs = new Set();
const written = [];
const byType = {};
let images = 0, collisions = 0;

for (let i = 0; i < lite.length; i += 8) {
  const batch = await Promise.all(lite.slice(i, i + 8).map((r) => rsGet('recipes.getRecipe', { id: r.id }).catch(() => null)));
  for (const raw of batch.filter(Boolean)) {
    let slug = L.slugify(raw.title || '') || 'recette';
    if (usedSlugs.has(slug)) { let n = 2; while (usedSlugs.has(slug + '-' + n)) n++; slug = slug + '-' + n; collisions++; }
    usedSlugs.add(slug);
    const obj = mapRecipe(raw, slug);
    const imgUrl = raw.recipeImages && raw.recipeImages[0] && raw.recipeImages[0].image && raw.recipeImages[0].image.location;
    if (imgUrl) { try { obj.image = await downloadImage(imgUrl, slug); images++; } catch (e) { console.error(`  image KO (${slug}): ${e.message}`); } }
    const str = serializeRecipe(obj);
    fs.writeFileSync(path.join(RECIPES_DIR, slug + '.json'), str);
    written.push({ obj, rawBytes: Buffer.from(str) });
    obj.labels.map((l) => L.norm(l)).filter((l) => ['repas', 'base', 'accompagnement', 'dessert'].includes(l)).forEach((t) => { byType[t] = (byType[t] || 0) + 1; });
  }
  console.error(`  ${Math.min(i + 8, lite.length)}/${lite.length}`);
}

fs.writeFileSync(path.join(RECIPES_DIR, 'index.json'), serializeIndex(buildIndex(written)));
console.error(`\nOK : ${written.length} recettes ecrites, ${images} images, ${collisions} collisions de slug resolues.`);
console.error(`Par type: ${JSON.stringify(byType)}`);
