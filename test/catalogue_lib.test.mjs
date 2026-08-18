/* Tests de la lib catalogue (scripts/catalogue_lib.mjs) : index déterministe + validation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, serializeIndex, serializeRecipe, validateRecipe, indexEntry, suggestAllergenes, ingredientIssue } from '../scripts/catalogue_lib.mjs';

const rec = (over = {}) => Object.assign({
  id: 'tarte-tomate', titre: 'Tarte tomate', portions: 1,
  ingredients: ['200 g de farine', '3 tomates'], etapes: ['a'],
  labels: ['repas', 'végétarien'], allergenes: ['gluten'], kcal: 400, prot: 12,
}, over);
const withBytes = (o) => ({ obj: o, rawBytes: Buffer.from(serializeRecipe(o)) });

test('buildIndex : déterministe (même entrée -> même version/hash), trié par titre', () => {
  const a = buildIndex([withBytes(rec({ id: 'b', titre: 'Zébu' })), withBytes(rec({ id: 'a', titre: 'Abricot' }))]);
  const b = buildIndex([withBytes(rec({ id: 'a', titre: 'Abricot' })), withBytes(rec({ id: 'b', titre: 'Zébu' }))]);
  assert.equal(a.version, b.version);                     // ordre d'entrée indifférent
  assert.deepEqual(a.recipes.map((r) => r.id), ['a', 'b']); // trié par titre
  assert.equal(serializeIndex(a), serializeIndex(b));      // sérialisation canonique stable
});

test('buildIndex : un changement de contenu change version + hash de la recette', () => {
  const base = buildIndex([withBytes(rec())]);
  const changed = buildIndex([withBytes(rec({ kcal: 401 }))]);
  assert.notEqual(base.version, changed.version);
  assert.notEqual(base.recipes[0].hash, changed.recipes[0].hash);
});

test('indexEntry : porte search (titre + ingrédients) + allergenes', () => {
  const e = indexEntry(rec(), Buffer.from('x'));
  assert.ok(e.search.includes('tarte') && e.search.includes('tomate') && e.search.includes('farine'));
  assert.deepEqual(e.allergenes, ['gluten']);
});

test('validateRecipe : recette conforme -> aucune erreur', () => {
  assert.deepEqual(validateRecipe(rec(), { basename: 'tarte-tomate', allIds: new Map([['tarte-tomate', 1]]) }), []);
});

test('validateRecipe : rejette nutrition manquante, 0/2 label de type, allergène hors set, id != fichier', () => {
  assert.ok(validateRecipe(rec({ kcal: undefined }), { basename: 'tarte-tomate' }).some((e) => /kcal/.test(e)));
  assert.ok(validateRecipe(rec({ labels: ['végétarien'] }), { basename: 'tarte-tomate' }).some((e) => /label de type/.test(e)));
  assert.ok(validateRecipe(rec({ labels: ['repas', 'dessert'] }), { basename: 'tarte-tomate' }).some((e) => /label de type/.test(e)));
  assert.ok(validateRecipe(rec({ allergenes: ['plutonium'] }), { basename: 'tarte-tomate' }).some((e) => /allergene hors set/.test(e)));
  assert.ok(validateRecipe(rec(), { basename: 'autre-nom' }).some((e) => /nom de fichier/.test(e)));
});

test('validateRecipe : rejette une ligne d’ingrédient composée / non atomique', () => {
  assert.ok(validateRecipe(rec({ ingredients: ['sel, poivre'] }), { basename: 'tarte-tomate' }).some((e) => /composee/.test(e)));
  assert.ok(validateRecipe(rec({ ingredients: ['vinaigrette : huile, citron'] }), { basename: 'tarte-tomate' }).some((e) => /composee/.test(e)));
});

test('validateRecipe : id en doublon dans le catalogue', () => {
  assert.ok(validateRecipe(rec(), { basename: 'tarte-tomate', allIds: new Map([['tarte-tomate', 2]]) }).some((e) => /doublon/.test(e)));
});

test('suggestAllergenes : détecte gluten/lait/oeuf par mot-clé', () => {
  const a = suggestAllergenes(['200 g farine', '2 oeufs', '50 g beurre']);
  ['gluten', 'oeuf', 'lait'].forEach((x) => assert.ok(a.includes(x), x));
});

test('ingredientIssue : ligne atomique OK, composée KO', () => {
  assert.equal(ingredientIssue('200 g de farine'), null);
  assert.ok(ingredientIssue('sel, poivre'));
});
