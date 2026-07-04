/* Tests de la logique pure (logic.js). Zéro dépendance : node --test test/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

test('idOf / parseId : aller-retour de date', () => {
  assert.equal(L.idOf(new Date(2026, 6, 3)), '2026-07-03');
  const d = L.parseId('2026-07-03');
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 6);
  assert.equal(d.getDate(), 3);
});

test('addDays normalise à minuit et décale', () => {
  const d = L.addDays(new Date(2026, 6, 3, 15, 30), 2);
  assert.equal(L.idOf(d), '2026-07-05');
  assert.equal(d.getHours(), 0);
});

test('startOfWeek : défaut jeudi (weekday 4) de la semaine AMAP', () => {
  // vendredi 3 juillet 2026 -> jeudi 2 juillet
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 3))), '2026-07-02');
  // jeudi 2 juillet -> lui-même
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 2))), '2026-07-02');
  // mercredi 8 juillet -> jeudi 2 juillet (dernier jour de la semaine AMAP)
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 8))), '2026-07-02');
  assert.equal(L.startOfWeek(new Date(2026, 6, 2)).getDay(), 4);
});

test('startOfWeek : début de semaine paramétrable (ws)', () => {
  // vendredi 3 juillet 2026, semaine démarrant le lundi (1) -> lundi 29 juin
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 3), 1)), '2026-06-29');
  assert.equal(L.startOfWeek(new Date(2026, 6, 3), 1).getDay(), 1);
  // même jour, semaine démarrant le dimanche (0) -> dimanche 28 juin
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 3), 0)), '2026-06-28');
});

test('fmt : 1er abrégé et mois en toutes lettres', () => {
  assert.equal(L.fmt(new Date(2026, 6, 1)), '1ᵉʳ juillet');
  assert.equal(L.fmt(new Date(2026, 6, 3)), '3 juillet');
});

test('frac : fractions unicode et décimales à la française', () => {
  assert.equal(L.frac(1), '1');
  assert.equal(L.frac(0.5), '½');
  assert.equal(L.frac(0.25), '¼');
  assert.equal(L.frac(1.75), '1¾');
  assert.equal(L.frac(0.3), '0,3');
});

test('qLabel : unités, pluriels et note', () => {
  assert.equal(L.qLabel({ q: 80, u: 'g' }), '80 g');
  assert.equal(L.qLabel({ q: 200, u: 'ml' }), '200 ml');
  assert.equal(L.qLabel({ q: 1, u: 'gousse' }), '1 gousse');
  assert.equal(L.qLabel({ q: 2, u: 'gousse' }), '2 gousses');
  assert.equal(L.qLabel({ q: null, u: '', note: 'option' }), 'option');
  assert.equal(L.qLabel({ q: 0.5, u: '' }), '½');
});

test('materializeMenus : slot 0 = Midi, slot 1 = Soir, référence inconnue filtrée', () => {
  const R = { a: { titre: 'A', kcal: 100, prot: 10, shop: [] } };
  const raw = { '2026-07-02': { jours: [{ repas: [{ recipe: 'a' }, { recipe: 'inconnu' }] }] } };
  const m = L.materializeMenus(raw, R);
  const repas = m['2026-07-02'].jours[0].repas;
  assert.equal(repas.length, 1);            // 'inconnu' filtré
  assert.equal(repas[0].moment, 'Midi');
  assert.equal(repas[0].titre, 'A');
});

const RAYONS = [['prot', 'Protéines & laitages'], ['leg', 'Légumes'], ['epi', 'Épicerie & féculents'], ['con', 'Condiments & épices'], ['fru', 'Fruits']];

test('computeCourses : cumul par clé n|u|r, q:null non cumulé, groupement par rayon', () => {
  const menu = { jours: [
    { repas: [{ shop: [
      { n: 'Courgettes', q: 1, u: '', r: 'leg' },
      { n: 'Huile d’olive', q: null, u: '', r: 'con' },
    ] }] },
    { repas: [{ shop: [
      { n: 'Courgettes', q: 2, u: '', r: 'leg' },   // cumule -> 3
      { n: 'Huile d’olive', q: null, u: '', r: 'con' }, // reste null
    ] }] },
  ] };
  const data = L.computeCourses(menu, '2026-07-02', new Set(), RAYONS);
  const leg = data.find((s) => s.cls === 'leg');
  const courgette = leg.items.find((i) => i.n === 'Courgettes');
  assert.equal(courgette.q, 3);
  assert.equal(courgette.disp, '3');
  const con = data.find((s) => s.cls === 'con');
  assert.equal(con.items[0].disp, '');   // q null -> pas de quantité
});

test('computeCourses : repas supprimé exclu, rayons vides omis', () => {
  const menu = { jours: [
    { repas: [{ shop: [{ n: 'Tofu', q: 200, u: 'g', r: 'prot' }] }] },
    { repas: [{ shop: [{ n: 'Tomates', q: 2, u: '', r: 'leg' }] }] },
  ] };
  const deleted = new Set(['2026-07-02:0-0']); // supprime le tofu
  const data = L.computeCourses(menu, '2026-07-02', deleted, RAYONS);
  assert.ok(!data.find((s) => s.cls === 'prot'));      // rayon prot vide -> omis
  assert.ok(data.find((s) => s.cls === 'leg'));
});

test('computeCourses : les couverts multiplient les quantités (q:null inchangé)', () => {
  const menu = { jours: [
    { repas: [{ shop: [
      { n: 'Quinoa', q: 80, u: 'g', r: 'epi' },
      { n: 'Sel', q: null, u: '', r: 'con' },
    ] }] },                                            // di=0 ri=0 -> 2 couverts
    { repas: [{ shop: [{ n: 'Quinoa', q: 80, u: 'g', r: 'epi' }] }] }, // di=1 ri=0 -> 1 couvert
  ] };
  const couverts = (di) => (di === 0 ? 2 : 1);
  const data = L.computeCourses(menu, '2026-07-02', new Set(), RAYONS, couverts);
  const quinoa = data.find((s) => s.cls === 'epi').items.find((i) => i.n === 'Quinoa');
  assert.equal(quinoa.q, 240);                          // 80*2 + 80*1
  const sel = data.find((s) => s.cls === 'con').items[0];
  assert.equal(sel.q, null);                            // condiment (q:null) jamais multiplié
});

test('computeCourses : menu absent -> null', () => {
  assert.equal(L.computeCourses(null, '2026-07-02', new Set(), RAYONS), null);
});

test('parseQty : quantité + unité + nom (notes et connecteurs retirés)', () => {
  let p = L.parseQty('80 g de yaourt à la grecque (0-3%)');
  assert.equal(p.qty, 80); assert.equal(p.unit, 'g'); assert.equal(p.name, 'yaourt à la grecque');
  p = L.parseQty('4 bananes bien mûres (+ 1 pour le décor)');
  assert.equal(p.qty, 4); assert.equal(p.unit, ''); assert.equal(p.name, 'bananes bien mûres');
  p = L.parseQty('1 c. à café de vanille');
  assert.equal(p.qty, 1); assert.equal(p.unit, 'cc'); assert.equal(p.name, 'vanille');
  p = L.parseQty('1 gousse d’ail');
  assert.equal(p.qty, 1); assert.equal(p.unit, 'gousse'); assert.equal(p.name, 'ail');
});

test('parseQty : fractions unicode et texte, ranges -> borne basse', () => {
  assert.equal(L.parseQty('½ citron').qty, 0.5);
  assert.equal(L.parseQty('1/2 citron').qty, 0.5);
  assert.equal(L.parseQty('1-2 oignons').qty, 1);
});

test('parseQty : ligne sans quantité -> qty null, nom = ligne brute', () => {
  const p = L.parseQty('Huile d’olive');
  assert.equal(p.qty, null); assert.equal(p.unit, ''); assert.equal(p.name, 'Huile d’olive');
});

test('rayonFor : classification par mots-clés, défaut aut', () => {
  assert.equal(L.rayonFor('Courgettes'), 'leg');
  assert.equal(L.rayonFor('Tofu ferme'), 'prot');
  assert.equal(L.rayonFor('pommes'), 'fru');
  assert.equal(L.rayonFor('farine T45'), 'epi');
  assert.equal(L.rayonFor('Huile d’olive'), 'con');
  assert.equal(L.rayonFor('objet mystère'), 'aut');
});

const POOL = [
  { id: 'a', titre: 'Salade de courgettes', ingredients: ['courgette', 'huile'], labels: ['repas'] },
  { id: 'b', titre: 'Curry de lentilles', ingredients: ['lentilles', 'curry'], labels: ['repas'] },
  { id: 'c', titre: 'Chili', ingredients: ['haricots rouges', 'tomate'], labels: ['repas'] },
];

test('tokenize : découpe "1 courgette; 3 tomates" en noms normalisés', () => {
  assert.deepEqual(L.tokenize('1 courgette; 3 tomates\n2 oignons'), ['courgette', 'tomates', 'oignons']);
});

test('splitItems : sépare ; virgule et retour-ligne mais garde la virgule décimale', () => {
  assert.deepEqual(L.splitItems('1 courgette; 3 tomates\n2 oignons'), ['1 courgette', '3 tomates', '2 oignons']);
  assert.deepEqual(L.splitItems('courgette, tomate'), ['courgette', 'tomate']);
  assert.deepEqual(L.splitItems('1,5 kg de tomates'), ['1,5 kg de tomates']);   // virgule décimale non coupée
});

test('tokenize : virgule décimale préservée (pas coupée en deux items)', () => {
  assert.deepEqual(L.tokenize('1,5 kg de tomates; courgette'), ['tomates', 'courgette']);
});

test('scaleIngredientLine : ×couverts sur qté+unité et compte de tête, épargne T45/%', () => {
  assert.equal(L.scaleIngredientLine('Pois chiches — 250 g', 2), 'Pois chiches — 500 g');
  assert.equal(L.scaleIngredientLine('250 g de pois chiches', 2), '500 g de pois chiches');
  assert.equal(L.scaleIngredientLine('4 bananes bien mûres', 2), '8 bananes bien mûres');
  assert.equal(L.scaleIngredientLine('Farine T45 — 70 g', 3), 'Farine T45 — 210 g');
  assert.equal(L.scaleIngredientLine('Chocolat 70% — 100 g', 2), 'Chocolat 70% — 200 g');
  assert.equal(L.scaleIngredientLine('Sel', 2), 'Sel');
  assert.equal(L.scaleIngredientLine('Pois chiches — 250 g', 1), 'Pois chiches — 250 g');
});

test('scoreRecipe : compte les aliments dispo présents dans la recette', () => {
  assert.equal(L.scoreRecipe(POOL[0], ['courgette', 'tomate']), 1);   // courgette seule
  assert.equal(L.scoreRecipe(POOL[2], ['courgette', 'tomate']), 1);   // tomate seule
  assert.equal(L.scoreRecipe(POOL[0], []), 0);
});

test('generateMenu : 7 jours x 2, ids du pool, meilleur score en tête, recyclage si pool petit', () => {
  const menu = L.generateMenu(POOL, ['courgette'], { rng: () => 0.5 });
  assert.equal(menu.jours.length, 7);
  const total = menu.jours.reduce((n, d) => n + d.repas.length, 0);
  assert.equal(total, 14);
  const ids = menu.jours.flatMap((d) => d.repas.map((r) => r.recipe));
  ids.forEach((id) => assert.ok(['a', 'b', 'c'].includes(id)));
  assert.equal(menu.jours[0].repas[0].recipe, 'a');   // 'a' matche "courgette" -> score max -> 1er créneau
});

test('pickAlternative : renvoie la meilleure recette non déjà utilisée', () => {
  assert.equal(L.pickAlternative(POOL, ['courgette'], new Set(['a']), { rng: () => 0.5 }), 'b');
});
