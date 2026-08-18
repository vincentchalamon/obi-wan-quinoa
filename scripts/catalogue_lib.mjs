/* Lib partagee du catalogue local (require-able, Node uniquement, JAMAIS expediee au navigateur).
   Utilisee par export_catalogue.mjs / build_index.mjs / validate_recipes.mjs / lint_recipes.mjs et les tests.
   Fonctions pures : construction d'index canonique, hachage deterministe, validation, heuristique allergenes. */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const L = require('../logic.js');

export const TYPE_LABELS = ['repas', 'base', 'accompagnement', 'dessert'];
export const ALLERGENES = L.ALLERGENES;

/* Heuristique mot-cle -> allergene (best-effort). Sert au pre-remplissage a l'export ET au WARN du lint
   (allergene probable non declare). N'est PAS une garantie : la revue manuelle reste obligatoire. */
export const ALLERGEN_KEYWORDS = {
  gluten: ['farine', 'ble', 'pain', 'chapelure', 'semoule', 'boulgour', 'couscous', 'orge', 'epeautre', 'seitan', 'pate', 'pates', 'nouille', 'spaghetti', 'penne', 'tagliatelle', 'vermicelle', 'coquillette', 'biscuit', 'pate feuilletee', 'pate brisee'],
  lait: ['lait', 'beurre', 'creme', 'fromage', 'feta', 'mozzarella', 'parmesan', 'ricotta', 'chevre', 'yaourt', 'skyr', 'gruyere', 'comte', 'emmental', 'halloumi', 'cheddar', 'mascarpone', 'roquefort'],
  oeuf: ['oeuf', 'mayonnaise'],
  soja: ['soja', 'tofu', 'tempeh', 'edamame', 'tamari', 'miso'],
  'fruits-a-coque': ['amande', 'noisette', 'noix', 'pistache', 'cajou', 'pecan', 'macadamia'],
  sesame: ['sesame', 'tahini'],
  arachide: ['arachide', 'cacahuete'],
  moutarde: ['moutarde'],
  celeri: ['celeri'],
};

const splitLines = (s) => ('' + (s || '')).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
export const firstNum = (s) => { const m = ('' + (s == null ? '' : s)).match(/\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; };
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);

/* Allergenes suggeres par les lignes d'ingredients (mot entier, accents ignores via norm). */
export function suggestAllergenes(ingredients) {
  const hay = ' ' + (ingredients || []).map((l) => L.norm(l)).join('  ') + ' ';
  const out = [];
  for (const [al, kws] of Object.entries(ALLERGEN_KEYWORDS)) {
    if (kws.some((kw) => new RegExp('\\b' + L.stripAccents(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|x)?\\b').test(hay))) out.push(al);
  }
  return out;
}

/* Une ligne d'ingredient est-elle atomique + parseable ? (un seul ingredient, pas d'enumeration/sous-recette) */
export function ingredientIssue(line) {
  const p = L.parseQty(line);
  if (!p.name) return 'ligne non parseable';
  if (/[:,&]| et /.test(p.name)) return 'ligne composee (enumeration / sous-recette)';
  return null;
}

/* Entree d'index d'une recette (objet deja parse + octets bruts du fichier pour le hash deterministe). */
export function indexEntry(obj, rawBytes) {
  return {
    id: obj.id,
    titre: obj.titre,
    labels: obj.labels || [],
    allergenes: obj.allergenes || [],
    search: L.norm((obj.titre || '') + ' ' + (obj.ingredients || []).join(' ')),
    hash: hash(rawBytes),
  };
}

/* Construit l'index a partir de la liste [{obj, rawBytes}]. Serialisation deterministe : entrees triees
   par titre, version = hash des (id:hash) tries par id, ordre de cles fixe (via indexEntry). */
export function buildIndex(recipes) {
  const entries = recipes.map(({ obj, rawBytes }) => indexEntry(obj, rawBytes));
  entries.sort((a, b) => a.titre.localeCompare(b.titre, 'fr'));
  const sig = [...entries].sort((a, b) => a.id.localeCompare(b.id)).map((e) => e.id + ':' + e.hash).join('\n');
  return { version: hash(sig), recipes: entries };
}

/* Serialisation canonique unique de l'index (2 espaces + newline final) — partagee export/build/skill. */
export const serializeIndex = (index) => JSON.stringify(index, null, 2) + '\n';
/* Serialisation canonique d'un fichier recette (ordre de cles fixe, octets stables pour le hash). */
export function serializeRecipe(obj) {
  const o = { id: obj.id, titre: obj.titre, portions: obj.portions || 1, ingredients: obj.ingredients, etapes: obj.etapes, labels: obj.labels, allergenes: obj.allergenes };
  if (typeof obj.kcal === 'number') o.kcal = obj.kcal;
  if (typeof obj.prot === 'number') o.prot = obj.prot;
  if (obj.image) o.image = obj.image;
  return JSON.stringify(o, null, 2) + '\n';
}

/* Lit tous les fichiers recette d'un dossier -> [{ file, basename, obj, rawBytes }]. */
export function readRecipes(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort().map((f) => {
    const full = path.join(dir, f);
    const rawBytes = fs.readFileSync(full);
    return { file: full, basename: f.replace(/\.json$/, ''), obj: JSON.parse(rawBytes.toString('utf8')), rawBytes };
  });
}

/* Valide UNE recette. `ctx` = { basename, allIds:Map<id,count>, root (racine depot) }. Renvoie un tableau d'erreurs. */
export function validateRecipe(obj, ctx = {}) {
  const e = [];
  const req = ['id', 'titre', 'ingredients', 'etapes', 'labels'];
  for (const k of req) if (obj[k] == null) e.push(`champ requis manquant: ${k}`);
  if (obj.ingredients && !Array.isArray(obj.ingredients)) e.push('ingredients doit etre un tableau');
  if (obj.etapes && !Array.isArray(obj.etapes)) e.push('etapes doit etre un tableau');
  if (typeof obj.kcal !== 'number') e.push('kcal doit etre un nombre');
  if (typeof obj.prot !== 'number') e.push('prot doit etre un nombre');
  if (ctx.basename && obj.id !== ctx.basename) e.push(`id (${obj.id}) != nom de fichier (${ctx.basename})`);
  if (ctx.allIds && ctx.allIds.get(obj.id) > 1) e.push(`id en doublon dans le catalogue: ${obj.id}`);
  const labels = obj.labels || [];
  const types = labels.filter((l) => TYPE_LABELS.includes(L.norm(l)));
  if (types.length !== 1) e.push(`exactement un label de type attendu (${TYPE_LABELS.join('|')}), trouve: [${types.join(', ')}]`);
  for (const a of obj.allergenes || []) if (!ALLERGENES.includes(a)) e.push(`allergene hors set: ${a}`);
  for (const line of obj.ingredients || []) { const iss = ingredientIssue(line); if (iss) e.push(`ingredient "${line}": ${iss}`); }
  if (obj.image && ctx.root) { if (!fs.existsSync(path.join(ctx.root, obj.image))) e.push(`image absente: ${obj.image}`); }
  return e;
}
