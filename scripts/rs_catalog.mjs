#!/usr/bin/env node
/* Liste le catalogue RecipeSage public de l'auteur (lecture seule, AUCUNE auth) — sert à la skill /recipe
   pour éviter de créer une recette en doublon. L'userId est lu depuis recipesage.js (source unique).
   Usage : node scripts/rs_catalog.mjs [--json] */
import fs from 'fs';

const src = fs.readFileSync(new URL('../recipesage.js', import.meta.url), 'utf8');
const OWNER = (src.match(/OWNER_USER_ID\s*=\s*'([^']+)'/) || [])[1];
if (!OWNER) { console.error('OWNER_USER_ID introuvable dans recipesage.js'); process.exit(1); }
const API = 'https://api.recipesage.com/trpc/';

async function getAll() {
  const PAGE = 200, all = []; let off = 0;
  for (;;) {
    const input = { userIds: [OWNER], folder: 'main', orderBy: 'title', orderDirection: 'asc', offset: off, limit: PAGE };
    const r = await fetch(API + 'recipes.getRecipes?input=' + encodeURIComponent(JSON.stringify(input)));
    if (!r.ok) throw new Error('getRecipes HTTP ' + r.status);
    const d = (await r.json()).result.data; const batch = d.recipes || [];
    all.push(...batch);
    if (batch.length < PAGE) break; off += PAGE;
  }
  return all;
}
const labelsOf = (r) => (r.recipeLabels || []).map((l) => l.label && l.label.title).filter(Boolean);
const recs = await getAll();
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(recs.map((r) => ({ id: r.id, title: r.title, labels: labelsOf(r) })), null, 1));
} else {
  recs.forEach((r) => console.log('- ' + r.title + '  [' + labelsOf(r).join(', ') + ']'));
  console.error('\n' + recs.length + ' recettes dans le catalogue.');
}
