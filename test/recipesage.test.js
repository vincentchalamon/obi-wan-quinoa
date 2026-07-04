/* Tests de la logique pure du client RecipeSage (mapping + URL). Réseau non testé ici. */
const test = require('node:test');
const assert = require('node:assert/strict');
const RS = require('../recipesage.js');

test('rsUrl : GET tRPC avec input JSON urlencodé', () => {
  const url = RS.rsUrl('recipes.getRecipe', { id: 'abc' });
  assert.ok(url.startsWith('https://api.recipesage.com/trpc/recipes.getRecipe?input='));
  assert.ok(decodeURIComponent(url.split('input=')[1]).includes('"id":"abc"'));
});

test('rsMapRecipe : RecipeSage brut -> forme interne (shop dérivé, nutrition si présente)', () => {
  const raw = {
    id: 'x1', title: 'Test',
    ingredients: '80 g de farine\n1 gousse d’ail\nHuile d’olive',
    instructions: 'Étape 1\nÉtape 2',
    recipeLabels: [{ label: { title: 'repas' } }, { label: { title: 'vegan' } }],
    recipeImages: [{ image: { location: 'http://img' } }],
    url: 'http://src',
    nutritionCalories: null, nutritionProtein: '32 g',
  };
  const r = RS.rsMapRecipe(raw);
  assert.equal(r.id, 'x1');
  assert.equal(r.titre, 'Test');
  assert.deepEqual(r.labels, ['repas', 'vegan']);
  assert.equal(r.image, 'http://img');
  assert.equal(r.ingredients.length, 3);
  assert.equal(r.etapes.length, 2);

  const byName = (n) => r.shop.find((s) => s.n === n);
  assert.deepEqual(byName('farine'), { n: 'farine', q: 80, u: 'g', r: 'epi' });
  assert.deepEqual(byName('ail'), { n: 'ail', q: 1, u: 'gousse', r: 'leg' });
  assert.deepEqual(byName('Huile d’olive'), { n: 'Huile d’olive', q: null, u: '', r: 'con' });

  assert.equal(r.kcal, undefined);   // nutritionCalories null -> absent
  assert.equal(r.prot, 32);          // "32 g" -> 32
});
