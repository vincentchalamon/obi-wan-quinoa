#!/usr/bin/env node
/* Lint READ-ONLY du catalogue LOCAL vs pipeline liste de courses (logic.js) — SANS reseau.
   Detecte ce qui pollue la liste de courses (doublons singulier/pluriel, unites parasites, lignes
   composees, "eau", non classes), signale les portions suspectes (repas ~1 personne) et AVERTIT d'un
   allergene probable non declare (heuristique). Mesure AVANT/APRES l'harmonisation (WS-6) + hygiene continue.
   Usage :
     node scripts/lint_recipes.mjs           # rapport lisible
     node scripts/lint_recipes.mjs --vocab   # vocabulaire d'ingredients (derive SINGULARS)
     node scripts/lint_recipes.mjs --json    # rapport machine */
import { createRequire } from 'module';
import { readRecipes, suggestAllergenes } from './catalogue_lib.mjs';
const require = createRequire(import.meta.url);
const L = require('../logic.js');

const RECIPES_DIR = new URL('../recipes/', import.meta.url).pathname;
const MODE = process.argv.includes('--json') ? 'json' : process.argv.includes('--vocab') ? 'vocab' : 'report';
const hasType = (o, t) => (o.labels || []).map((x) => L.norm(x)).includes(t);

const sing = (w) => (w.length >= 4 && /(s|x)$/.test(w) ? w.slice(0, -1) : w);
const canon = (name) => (name || '').toLowerCase().replace(/œ/g, 'oe').replace(/\s+/g, ' ').trim().split(' ').map(sing).join(' ');
const VAGUE_RE = /^(cm|mm|verre|verres|branche|branches|bouquet|bouquets|goutte|gouttes|filet|filets|trait|traits|morceau|morceaux|tige|tiges|louche|louches|bol|bols|tasse|tasses|zeste|zestes|dose|doses)\b/i;
const STARCH_RE = /\b(riz|pate|pates|nouille|nouilles|spaghetti|penne|tagliatelle|vermicelle|coquillette|coquillettes|couscous|boulgour|semoule|polenta|quinoa|orge|epeautre|sarrasin|ble)\b/;
const KCAL_MAX = 1200, PROT_MAX = 90, STARCH_DRY_MAX = 120, EGGS_MAX = 4;

const all = readRecipes(RECIPES_DIR).map((r) => r.obj);
const repas = all.filter((o) => hasType(o, 'repas'));

const issues = { aut: [], vague: [], compound: [], eau: [], portion: [], allergene: [] };
const vocab = new Map();
const canonMap = new Map();

for (const o of all) {                                   // hygiene ingredients sur TOUT le catalogue
  const title = o.titre || '(sans titre)';
  for (const line of o.ingredients || []) {
    const p = L.parseQty(line), r = L.rayonFor(p.name), n = L.norm(p.name);
    const rec = { title, line, name: p.name, r };
    if (r === 'aut') issues.aut.push(rec);
    if (VAGUE_RE.test(p.name) || /\d/.test(p.name)) issues.vague.push(rec);
    if (/[,&:]| et /.test(p.name)) issues.compound.push(rec);
    if (n === 'eau') issues.eau.push(rec);
    vocab.set(n, (vocab.get(n) || 0) + 1);
    const c = canon(p.name);
    if (c) { if (!canonMap.has(c)) canonMap.set(c, new Set()); canonMap.get(c).add(n); }
  }
  const missing = suggestAllergenes(o.ingredients || []).filter((a) => !(o.allergenes || []).includes(a));
  if (missing.length) issues.allergene.push({ title, missing });
}
for (const o of repas) {                                  // garde-fous portions : recettes `repas` ~1 personne
  const kcal = o.kcal, prot = o.prot, flags = [];
  if (typeof kcal === 'number' && kcal > KCAL_MAX) flags.push(`kcal=${kcal}`);
  if (typeof prot === 'number' && prot > PROT_MAX) flags.push(`prot=${prot}`);
  for (const line of o.ingredients || []) {
    const p = L.parseQty(line), n = L.norm(p.name);
    if (p.unit === 'g' && p.qty > STARCH_DRY_MAX && STARCH_RE.test(n)) flags.push(`${p.name} ${p.qty} g`);
    if (p.qty >= EGGS_MAX && /\boeuf/.test(n)) flags.push(`${p.qty} oeufs`);
  }
  if (flags.length) issues.portion.push({ title: o.titre, flags });
}
const dupes = [...canonMap].filter(([, s]) => s.size > 1).map(([c, s]) => ({ canon: c, forms: [...s] }));

if (MODE === 'vocab') { [...vocab.keys()].sort().forEach((n) => console.log(n)); console.error(`\n${vocab.size} noms distincts.`); process.exit(0); }
if (MODE === 'json') { console.log(JSON.stringify({ counts: { total: all.length, repas: repas.length, ...Object.fromEntries(Object.entries(issues).map(([k, v]) => [k, v.length])), dupes: dupes.length }, issues, dupes }, null, 1)); process.exit(0); }

const pr = (label, arr, fmt, cap = 40) => { console.log(`\n### ${label} (${arr.length})`); arr.slice(0, cap).forEach((x) => console.log('  ' + fmt(x))); if (arr.length > cap) console.log(`  ... +${arr.length - cap}`); };
console.log(`== LINT catalogue local == ${all.length} recettes (dont ${repas.length} repas)`);
pr('Non classes (rayon=aut)', issues.aut, (x) => `[${x.title}] "${x.line}" -> "${x.name}"`);
pr('Unites parasites / chiffre dans le nom', issues.vague, (x) => `[${x.title}] "${x.line}" -> "${x.name}"`);
pr('Lignes composees (, & : et)', issues.compound, (x) => `[${x.title}] "${x.name}"`);
pr('"eau" (exclue des courses)', issues.eau, (x) => `[${x.title}] "${x.line}"`);
pr('Doublons potentiels (meme canon)', dupes, (x) => `${x.canon} :: ${x.forms.join('  |  ')}`);
pr('Allergene probable non declare (WARN)', issues.allergene, (x) => `[${x.title}] -> ${x.missing.join(', ')}`);
pr('Portions suspectes (repas ~1 personne)', issues.portion, (x) => `[${x.title}] ${x.flags.join(', ')}`);
