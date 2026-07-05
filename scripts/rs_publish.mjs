#!/usr/bin/env node
/* Publie une recette dans le catalogue RecipeSage de l'auteur via l'API tRPC (mutation recipes.createRecipe).
   Utilisé par la skill /recipe pour publier directement (au lieu d'un copier-coller manuel).

   Entrée : un objet recette JSON sur stdin :
     { "title", "yield"?, "ingredients": [..]|"txt", "instructions": [..]|"txt", "labels": [..]?,
       "nutritionCalories"?, "nutritionProtein"?, "activeTime"?, "totalTime"?, "source"?, "url"?, "description"? }
   Token (jamais committé) résolu dans l'ordre : $RS_TOKEN, fichier $RS_TOKEN_FILE, ./.rs_token,
     ~/.config/obi-wan-quinoa/rs_token. Générer via :
     curl -s https://api.recipesage.com/trpc/users.login -H 'content-type: application/json' \
       -d '{"email":"<email>","password":"<mdp>"}'   # -> result.data.token, à écrire dans le fichier token

   Sécurité : SANS --confirm, affiche seulement ce qui serait publié (dry-run). AVEC --confirm, publie. */
import fs from 'fs';
import os from 'os';
import path from 'path';

const API = 'https://api.recipesage.com/trpc/';
const CONFIRM = process.argv.includes('--confirm');

function readToken() {
  if (process.env.RS_TOKEN) return process.env.RS_TOKEN.trim();
  const candidates = [process.env.RS_TOKEN_FILE, path.resolve('.rs_token'),
    path.join(os.homedir(), '.config/obi-wan-quinoa/rs_token')].filter(Boolean);
  for (const p of candidates) { try { const t = fs.readFileSync(p, 'utf8').trim(); if (t) return t; } catch (e) {} }
  throw new Error('Token introuvable. Renseigne $RS_TOKEN ou un fichier .rs_token (voir en-tête du script).');
}
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
const norm = (s) => (s || '').toLowerCase().replace(/œ/g, 'oe').normalize('NFD').replace(/[̀-ͯ]/g, '');
const asText = (v) => Array.isArray(v) ? v.join('\n') : (v || '');

const TOKEN = readToken();

const raw = fs.readFileSync(0, 'utf8');
let rec;
try { rec = JSON.parse(raw); } catch (e) { console.error('stdin : JSON invalide.', e.message); process.exit(1); }
if (!rec.title || !asText(rec.ingredients).trim() || !asText(rec.instructions).trim()) {
  console.error('Recette incomplète : title, ingredients et instructions sont requis.'); process.exit(1);
}

// Résout les labels (crée les manquants). La taxonomie est censée déjà exister.
const labs = await get('labels.getAllVisibleLabels', {});
const byNorm = {}; labs.forEach((l) => { byNorm[norm(l.title)] = l.id; });
const labelIds = [];
for (const title of (rec.labels || [])) {
  let id = byNorm[norm(title)];
  if (!id) { const created = await post('labels.createLabel', { title, labelGroupId: null }); id = created.id; byNorm[norm(title)] = id; }
  labelIds.push(id);
}

const payload = {
  title: rec.title, description: rec.description || '',
  yield: rec.yield || '1 personne', activeTime: rec.activeTime || '', totalTime: rec.totalTime || '',
  source: rec.source || '', url: rec.url || '', notes: rec.notes || '',
  ingredients: asText(rec.ingredients), instructions: asText(rec.instructions),
  rating: null, folder: 'main', labelIds, imageIds: [],
};
if (rec.nutritionCalories != null) payload.nutritionCalories = Number(rec.nutritionCalories);
if (rec.nutritionProtein != null) payload.nutritionProtein = Number(rec.nutritionProtein);

console.log('Recette   : ' + payload.title);
console.log('Rendement : ' + payload.yield + '   labels : ' + (rec.labels || []).join(', '));
console.log('Nutrition : ' + (payload.nutritionCalories ?? '?') + ' kcal / ' + (payload.nutritionProtein ?? '?') + ' g');
if (!CONFIRM) { console.log('\n[dry-run] relance avec --confirm pour publier dans RecipeSage.'); process.exit(0); }

const out = await post('recipes.createRecipe', payload);
console.log('\nPubliée ✓  id=' + out.id);
console.log('https://recipesage.com/#/recipe/' + out.id);
