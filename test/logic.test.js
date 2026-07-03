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

test('startOfWeek renvoie le jeudi (weekday 4) de la semaine AMAP', () => {
  // vendredi 3 juillet 2026 -> jeudi 2 juillet
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 3))), '2026-07-02');
  // jeudi 2 juillet -> lui-même
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 2))), '2026-07-02');
  // mercredi 8 juillet -> jeudi 2 juillet (dernier jour de la semaine AMAP)
  assert.equal(L.idOf(L.startOfWeek(new Date(2026, 6, 8))), '2026-07-02');
  assert.equal(L.startOfWeek(new Date(2026, 6, 2)).getDay(), 4);
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
  const data = L.computeCourses(menu, '2026-07-02', new Set(), RAYONS, []);
  const leg = data.find((s) => s.cls === 'leg');
  const courgette = leg.items.find((i) => i.n === 'Courgettes');
  assert.equal(courgette.q, 3);
  assert.equal(courgette.disp, '3');
  const con = data.find((s) => s.cls === 'con');
  assert.equal(con.items[0].disp, '');   // q null -> pas de quantité
});

test('computeCourses : repas supprimé exclu, rayons vides omis, extras ajoutés', () => {
  const menu = { jours: [
    { repas: [{ shop: [{ n: 'Tofu', q: 200, u: 'g', r: 'prot' }] }] },
    { repas: [{ shop: [{ n: 'Tomates', q: 2, u: '', r: 'leg' }] }] },
  ] };
  const deleted = new Set(['2026-07-02:0-0']); // supprime le tofu
  const data = L.computeCourses(menu, '2026-07-02', deleted, RAYONS, [{ r: 'fru', n: 'Pommes', disp: '~7' }]);
  assert.ok(!data.find((s) => s.cls === 'prot'));      // rayon prot vide -> omis
  assert.ok(data.find((s) => s.cls === 'leg'));
  const fru = data.find((s) => s.cls === 'fru');
  assert.equal(fru.items[0].n, 'Pommes');
});

test('computeCourses : menu absent -> null', () => {
  assert.equal(L.computeCourses(null, '2026-07-02', new Set(), RAYONS, []), null);
});
