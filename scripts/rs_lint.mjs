#!/usr/bin/env node
/* Lint READ-ONLY du catalogue RecipeSage vs pipeline liste de courses (logic.js) — AUCUNE auth, GET only.
   Detecte ce qui pollue la liste de courses (doublons singulier/pluriel, unites parasites dans le nom,
   lignes composees, "eau", ingredients non classes) sur les recettes `repas` (les seules generees en menu),
   et signale les portions suspectes (> budget/repas ou grammages GEM-RCN de references/nutrition.md).
   Sert de mesure AVANT/APRES l'harmonisation des recettes et d'hygiene continue.

   Usage :
     node scripts/rs_lint.mjs           # rapport lisible
     node scripts/rs_lint.mjs --vocab   # liste le vocabulaire d'ingredients (pour derive SINGULARS)
     node scripts/rs_lint.mjs --json    # rapport machine */
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const L = require('../logic.js');

const src = fs.readFileSync(new URL('../recipesage.js', import.meta.url), 'utf8');
const OWNER = (src.match(/OWNER_USER_ID\s*=\s*'([^']+)'/) || [])[1];
if (!OWNER) { console.error('OWNER_USER_ID introuvable dans recipesage.js'); process.exit(1); }
const API = 'https://api.recipesage.com/trpc/';
const MODE = process.argv.includes('--json') ? 'json' : process.argv.includes('--vocab') ? 'vocab' : 'report';

const rsGet = async (proc, input) => {
  const r = await fetch(API + proc + '?input=' + encodeURIComponent(JSON.stringify(input)));
  if (!r.ok) throw new Error(proc + ' HTTP ' + r.status);
  return (await r.json()).result.data;
};
async function getAll() {
  const PAGE = 200, all = []; let off = 0;
  for (;;) {
    const d = await rsGet('recipes.getRecipes', { userIds: [OWNER], folder: 'main', orderBy: 'title', orderDirection: 'asc', offset: off, limit: PAGE });
    const b = d.recipes || []; all.push(...b);
    if (b.length < PAGE) break; off += PAGE;
  }
  return all;
}
const labelsOf = (r) => (r.recipeLabels || []).map((l) => l.label && l.label.title).filter(Boolean);
const hasLabel = (r, t) => labelsOf(r).map((x) => L.norm(x)).includes(t);
const splitLines = (s) => (s || '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const firstNum = (s) => { const m = ('' + (s || '')).match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };

/* Canon LOCAL de detection de doublons (naif : minuscule + ligature oe + espaces, accents preserves,
   pluriel regulier -s/-x). Sert uniquement au reporting du lint (la dedup reelle vit dans logic.js). */
const sing = (w) => (w.length >= 4 && /(s|x)$/.test(w) ? w.slice(0, -1) : w);
const canon = (name) => (name || '').toLowerCase().replace(/œ/g, 'oe').replace(/\s+/g, ' ').trim().split(' ').map(sing).join(' ');

/* unites vagues / non reconnues qui polluent le nom d'ingredient */
const VAGUE_RE = /^(cm|mm|verre|verres|branche|branches|bouquet|bouquets|goutte|gouttes|filet|filets|trait|traits|morceau|morceaux|tige|tiges|louche|louches|bol|bols|tasse|tasses|zeste|zestes|dose|doses)\b/i;
const STARCH_RE = /\b(riz|pate|pates|nouille|nouilles|spaghetti|penne|tagliatelle|vermicelle|coquillette|coquillettes|couscous|boulgour|semoule|polenta|quinoa|orge|epeautre|sarrasin|ble)\b/;
/* garde-fous portions (sources : references/nutrition.md — budget/repas ~800-950 kcal, ~55 g prot ; GEM-RCN feculents secs ~80-100 g) */
const KCAL_MAX = 1200, PROT_MAX = 90, STARCH_DRY_MAX = 120, EGGS_MAX = 4;

const recs = await getAll();
const details = [];
for (let i = 0; i < recs.length; i += 8) {
  const got = await Promise.all(recs.slice(i, i + 8).map((r) => rsGet('recipes.getRecipe', { id: r.id }).catch(() => null)));
  details.push(...got.filter(Boolean));
}
/* perimetre liste de courses : recettes `repas` (le pool de generation) */
const repas = details.filter((r) => hasLabel(r, 'repas'));
const vege = repas.filter((r) => hasLabel(r, 'vegetarien') || hasLabel(r, 'vegan'));

const issues = { aut: [], vague: [], compound: [], eau: [], portion: [] };
const vocab = new Map();          // nom normalise -> occurrences
const canonMap = new Map();       // canon -> Set de formes normalisees

for (const raw of repas) {
  const title = raw.title || '(sans titre)';
  const y = firstNum(raw.yield);                 // null = non precise
  const onePerson = y === 1 || y === null;
  const kcal = firstNum(raw.nutritionCalories), prot = firstNum(raw.nutritionProtein);
  const flags = [];
  if (onePerson && kcal != null && kcal > KCAL_MAX) flags.push(`kcal=${kcal}`);
  if (onePerson && prot != null && prot > PROT_MAX) flags.push(`prot=${prot}`);
  for (const line of splitLines(raw.ingredients)) {
    const p = L.parseQty(line), r = L.rayonFor(p.name), n = L.norm(p.name);
    const rec = { title, line, name: p.name, r };
    if (r === 'aut') issues.aut.push(rec);
    if (VAGUE_RE.test(p.name) || /\d/.test(p.name)) issues.vague.push(rec);
    if (/[,&:]| et /.test(p.name)) issues.compound.push(rec);
    if (n === 'eau') issues.eau.push(rec);
    if (onePerson && p.unit === 'g' && p.qty > STARCH_DRY_MAX && STARCH_RE.test(n)) flags.push(`${p.name} ${p.qty} g`);
    if (onePerson && p.qty >= EGGS_MAX && /\boeuf/.test(n)) flags.push(`${p.qty} oeufs`);
    vocab.set(n, (vocab.get(n) || 0) + 1);
    const c = canon(p.name);
    if (c) { if (!canonMap.has(c)) canonMap.set(c, new Set()); canonMap.get(c).add(n); }
  }
  if (flags.length) issues.portion.push({ title, yield: raw.yield || '', flags });
}
const dupes = [...canonMap].filter(([, s]) => s.size > 1).map(([c, s]) => ({ canon: c, forms: [...s] }));

if (MODE === 'vocab') {
  [...vocab.keys()].sort().forEach((n) => console.log(n));
  console.error(`\n${vocab.size} noms d'ingredients distincts (repas).`);
  process.exit(0);
}
if (MODE === 'json') {
  console.log(JSON.stringify({ counts: { repas: repas.length, vege: vege.length, ...Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])), dupes: dupes.length }, issues, dupes }, null, 1));
  process.exit(0);
}

const pr = (label, arr, fmt, cap = 40) => {
  console.log(`\n### ${label} (${arr.length})`);
  arr.slice(0, cap).forEach((x) => console.log('  ' + fmt(x)));
  if (arr.length > cap) console.log(`  ... +${arr.length - cap}`);
};
console.log(`== LINT liste de courses == ${repas.length} repas (dont ${vege.length} vege)`);
pr('Non classes (rayon=aut)', issues.aut, (x) => `[${x.title}] "${x.line}" -> "${x.name}"`);
pr('Unites parasites / chiffre dans le nom', issues.vague, (x) => `[${x.title}] "${x.line}" -> "${x.name}"`);
pr('Lignes composees (, & : et)', issues.compound, (x) => `[${x.title}] "${x.name}" (r=${x.r})`);
pr('"eau" (a exclure des courses)', issues.eau, (x) => `[${x.title}] "${x.line}"`);
pr('Doublons potentiels (meme canon, formes distinctes)', dupes, (x) => `${x.canon} :: ${x.forms.join('  |  ')}`);
pr('Portions suspectes (repas ~1 personne)', issues.portion, (x) => `[${x.title}] yield="${x.yield}" -> ${x.flags.join(', ')}`);
