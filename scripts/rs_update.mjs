#!/usr/bin/env node
/* Met à jour une recette EXISTANTE du catalogue RecipeSage via l'API tRPC (mutation recipes.updateRecipe).
   Sert à HARMONISER les recettes (format des ingrédients, portions) sans passer par l'UI.

   ATTENTION : updateRecipe est un REMPLACEMENT COMPLET. Ce script récupère d'abord la recette courante
   et PRÉSERVE tous ses champs (labels, images, nutrition, temps, source, note, rating, dossier) ; il ne
   remplace que les champs fournis sur stdin. Une sauvegarde de la version courante est écrite dans
   ./.rs_backups/<id>.json (gitignoré) avant toute écriture.

   Entrée : un objet JSON sur stdin décrivant les CHAMPS À MODIFIER, dont l'id :
     { "id": "<uuid>", "ingredients": [".."]|"txt", "yield"?, "title"?, "nutritionCalories"?, ... }
   Seul `id` est requis ; tout champ absent est conservé tel quel.

   Token (jamais committé) résolu comme rs_publish.mjs : $RS_TOKEN, $RS_TOKEN_FILE, ./.rs_token,
     ~/.config/obi-wan-quinoa/rs_token.

   Sécurité : SANS --confirm, montre le diff (dry-run), aucune écriture. AVEC --confirm, met à jour. */
import fs from 'fs';
import os from 'os';
import path from 'path';

const API = 'https://api.recipesage.com/trpc/';
const CONFIRM = process.argv.includes('--confirm');
const BACKUP_DIR = path.resolve('.rs_backups');

function readToken() {
  if (process.env.RS_TOKEN) return process.env.RS_TOKEN.trim();
  const candidates = [process.env.RS_TOKEN_FILE, path.resolve('.rs_token'),
    path.join(os.homedir(), '.config/obi-wan-quinoa/rs_token')].filter(Boolean);
  for (const p of candidates) { try { const t = fs.readFileSync(p, 'utf8').trim(); if (t) return t; } catch (e) {} }
  throw new Error('Token introuvable. Renseigne $RS_TOKEN ou un fichier .rs_token (voir en-tête).');
}
const TOKEN = readToken();
const H = () => ({ Authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' });
async function get(proc, input) {
  const r = await fetch(API + proc + '?input=' + encodeURIComponent(JSON.stringify(input)), { headers: H() });
  if (!r.ok) throw new Error(proc + ' HTTP ' + r.status);
  return (await r.json()).result.data;
}
async function post(proc, body) {
  const r = await fetch(API + proc, { method: 'POST', headers: H(), body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(proc + ' HTTP ' + r.status + ' ' + JSON.stringify(j.error || j));
  return j.result.data;
}
const asText = (v) => Array.isArray(v) ? v.join('\n') : (v == null ? '' : String(v));

const NUTR = ['nutritionServingSize', 'nutritionCalories', 'nutritionTotalFat', 'nutritionSaturatedFat',
  'nutritionTransFat', 'nutritionPolyunsaturatedFat', 'nutritionMonounsaturatedFat', 'nutritionCholesterol',
  'nutritionSodium', 'nutritionTotalCarbs', 'nutritionDietaryFiber', 'nutritionTotalSugars',
  'nutritionAddedSugars', 'nutritionProtein', 'nutritionVitaminD', 'nutritionCalcium', 'nutritionIron',
  'nutritionPotassium', 'nutritionOtherDetails'];

const ov = (() => { try { return JSON.parse(fs.readFileSync(0, 'utf8')); } catch (e) { console.error('stdin : JSON invalide.', e.message); process.exit(1); } })();
if (!ov.id) { console.error('`id` requis dans le JSON stdin.'); process.exit(1); }

const cur = await get('recipes.getRecipe', { id: ov.id });

// payload complet = recette courante préservée
const payload = {
  id: cur.id,
  title: cur.title,
  description: cur.description || '',
  yield: cur.yield || '',
  activeTime: cur.activeTime || '',
  totalTime: cur.totalTime || '',
  source: cur.source || '',
  url: cur.url || '',
  notes: cur.notes || '',
  rating: cur.rating ?? null,
  folder: cur.folder || 'main',
  ingredients: cur.ingredients || '',
  instructions: cur.instructions || '',
  labelIds: (cur.recipeLabels || []).map((l) => l.labelId || (l.label && l.label.id)).filter(Boolean),
  imageIds: (cur.recipeImages || []).map((i) => i.imageId || (i.image && i.image.id)).filter(Boolean),
};
for (const k of NUTR) if (cur[k] != null) payload[k] = cur[k];
if (cur.lastMadeAt != null) payload.lastMadeAt = cur.lastMadeAt;

// surcharge par les champs fournis (ingredients/instructions acceptent un tableau de lignes)
for (const [k, v] of Object.entries(ov)) {
  if (k === 'id') continue;
  payload[k] = (k === 'ingredients' || k === 'instructions') ? asText(v) : v;
}

// sauvegarde de la version courante
fs.mkdirSync(BACKUP_DIR, { recursive: true });
fs.writeFileSync(path.join(BACKUP_DIR, cur.id + '.json'), JSON.stringify(cur, null, 1));

const sep = '\n  ';
console.log('Recette   : ' + payload.title + '  (' + cur.id + ')');
if (payload.yield !== (cur.yield || '')) console.log('Rendement : "' + (cur.yield || '') + '" -> "' + payload.yield + '"');
console.log('Labels    : ' + payload.labelIds.length + ' préservés · Images : ' + payload.imageIds.length + ' préservées');
if (payload.ingredients !== (cur.ingredients || '')) {
  console.log('\n--- Ingrédients (avant) ---' + sep + (cur.ingredients || '').split(/\r?\n/).join(sep));
  console.log('\n+++ Ingrédients (après) +++' + sep + payload.ingredients.split(/\r?\n/).join(sep));
}
for (const k of ['nutritionCalories', 'nutritionProtein']) if (k in ov) console.log(k + ' : ' + (cur[k] ?? '?') + ' -> ' + payload[k]);
console.log('\nSauvegarde: .rs_backups/' + cur.id + '.json');

if (!CONFIRM) { console.log('\n[dry-run] relance avec --confirm pour appliquer la mise à jour.'); process.exit(0); }

const out = await post('recipes.updateRecipe', payload);
console.log('\nMise à jour ✓  id=' + out.id);
console.log('https://recipesage.com/app/recipe/' + out.id);
