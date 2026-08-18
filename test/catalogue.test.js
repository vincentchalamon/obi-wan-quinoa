/* Tests du loader catalogue local (catalogue.js) : mapping brut (fichier) -> forme interne. Réseau non testé. */
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../catalogue.js');

test('catMapRecipe : dérive shop des ingrédients + passe nutrition/allergenes', () => {
  const raw = {
    id: 'test', titre: 'Test', portions: 1,
    ingredients: ['80 g de farine', '1 gousse d’ail', 'Huile d’olive'],
    etapes: ['Étape 1', 'Étape 2'],
    labels: ['repas', 'végétarien'], allergenes: ['gluten'],
    kcal: 420, prot: 18, image: 'recipes/images/test.jpg',
  };
  const r = C.catMapRecipe(raw);
  assert.equal(r.id, 'test');
  assert.equal(r.titre, 'Test');
  assert.deepEqual(r.labels, ['repas', 'végétarien']);
  assert.deepEqual(r.allergenes, ['gluten']);
  assert.equal(r.image, 'recipes/images/test.jpg');
  assert.equal(r.kcal, 420);
  assert.equal(r.prot, 18);
  assert.equal(r.etapes.length, 2);

  const byName = (n) => r.shop.find((s) => s.n === n);
  assert.deepEqual(byName('farine'), { n: 'farine', q: 80, u: 'g', r: 'epi' });
  assert.deepEqual(byName('ail'), { n: 'ail', q: 1, u: 'gousse', r: 'leg' });
  assert.deepEqual(byName('Huile d’olive'), { n: 'Huile d’olive', q: null, u: '', r: 'con' });
});

test('catMapRecipe : "eau" exclue du shop mais conservée dans les ingrédients', () => {
  const raw = { id: 't2', titre: 'T', etapes: ['x'], labels: ['repas'], allergenes: [],
    ingredients: ['200 g quinoa', '25 ml eau', 'eau', '1 cl eau de fleur d’oranger'], kcal: 1, prot: 1 };
  const r = C.catMapRecipe(raw);
  assert.equal(r.ingredients.length, 4);
  const names = r.shop.map((s) => s.n);
  assert.ok(!names.includes('eau'));
  assert.ok(names.includes('quinoa'));
  assert.ok(names.includes('eau de fleur d’oranger'));
});

test('catMapRecipe : nutrition absente -> champs omis', () => {
  const r = C.catMapRecipe({ id: 't3', titre: 'T', ingredients: [], etapes: [], labels: ['dessert'] });
  assert.equal('kcal' in r, false);
  assert.equal('prot' in r, false);
  assert.deepEqual(r.allergenes, []);
});
