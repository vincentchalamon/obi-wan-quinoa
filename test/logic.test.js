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

test('frac : fractions ASCII lisibles et décimales à la française', () => {
  assert.equal(L.frac(1), '1');
  assert.equal(L.frac(0.5), '1/2');
  assert.equal(L.frac(0.25), '1/4');
  assert.equal(L.frac(1.75), '1 3/4');
  assert.equal(L.frac(0.3), '0,3');
});

test('qLabel : unités, pluriels et note', () => {
  assert.equal(L.qLabel({ q: 80, u: 'g' }), '80 g');
  assert.equal(L.qLabel({ q: 200, u: 'ml' }), '200 ml');
  assert.equal(L.qLabel({ q: 1, u: 'gousse' }), '1 gousse');
  assert.equal(L.qLabel({ q: 2, u: 'gousse' }), '2 gousses');
  assert.equal(L.qLabel({ q: null, u: '', note: 'option' }), 'option');
  assert.equal(L.qLabel({ q: 0.5, u: '' }), '1/2');
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

test('computeCourses : cumul insensible à la casse, accents préservés', () => {
  const menu = { jours: [
    { repas: [{ shop: [{ n: 'Tomate', q: 2, u: '', r: 'leg' }, { n: 'Pâte', q: 100, u: 'g', r: 'epi' }] }] },
    { repas: [{ shop: [{ n: 'tomate', q: 3, u: '', r: 'leg' }, { n: 'Pâté', q: 50, u: 'g', r: 'epi' }] }] },
  ] };
  const data = L.computeCourses(menu, '2026-07-02', new Set(), RAYONS);
  const leg = data.find((s) => s.cls === 'leg');
  assert.equal(leg.items.length, 1); assert.equal(leg.items[0].q, 5);   // "Tomate"/"tomate" fusionnés (casse)
  const epi = data.find((s) => s.cls === 'epi');
  assert.equal(epi.items.length, 2);                                    // "Pâte"/"Pâté" distincts (accent préservé)
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

test('parseQty : parenthèse de tête retirée du nom', () => {
  const p = L.parseQty('450 g (1 lb) de ricotta');
  assert.equal(p.qty, 450); assert.equal(p.unit, 'g'); assert.equal(p.name, 'ricotta');
});

test('rayonFor : classification par mots-clés, défaut aut', () => {
  assert.equal(L.rayonFor('Courgettes'), 'leg');
  assert.equal(L.rayonFor('Tofu ferme'), 'prot');
  assert.equal(L.rayonFor('pommes'), 'fru');
  assert.equal(L.rayonFor('farine T45'), 'epi');
  assert.equal(L.rayonFor('Huile d’olive'), 'con');
  assert.equal(L.rayonFor('chou-fleur'), 'leg');
  assert.equal(L.rayonFor('chèvre frais'), 'prot');
  assert.equal(L.rayonFor('noisettes'), 'epi');
  assert.equal(L.rayonFor('thym'), 'con');
  assert.equal(L.rayonFor('maïs doux'), 'leg');       // "maïs" reconnu (mot entier + pluriel)
  assert.equal(L.rayonFor('pesto maison'), 'aut');    // mais pas "maison" (pas de faux positif de sous-chaîne)
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

test('scaleIngredientLine : ×couverts sur TOUTES les quantités, épargne T45/%/°', () => {
  assert.equal(L.scaleIngredientLine('Pois chiches — 250 g', 2), 'Pois chiches — 500 g');
  assert.equal(L.scaleIngredientLine('250 g de pois chiches', 2), '500 g de pois chiches');
  assert.equal(L.scaleIngredientLine('4 bananes bien mûres', 2), '8 bananes bien mûres');
  assert.equal(L.scaleIngredientLine('Œufs durs — 2', 2), 'Œufs durs — 4');          // compte après tiret
  assert.equal(L.scaleIngredientLine('Ail — 1 gousse', 2), 'Ail — 2 gousse');        // unité non-poids
  assert.equal(L.scaleIngredientLine('Concombre — ½', 2), 'Concombre — 1');          // fraction unicode
  assert.equal(L.scaleIngredientLine('Oignon jaune — ¼', 2), 'Oignon jaune — 1/2');
  assert.equal(L.scaleIngredientLine('Yaourt grec — 100 g (0-3%)', 2), 'Yaourt grec — 200 g (0-3%)'); // % épargné
  assert.equal(L.scaleIngredientLine('Farine T45 — 70 g', 3), 'Farine T45 — 210 g'); // T45 épargné
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

test('generateMenu : respecte les labels midi/soir quand présents', () => {
  const pool = [
    { id: 'm1', titre: '', ingredients: [], labels: ['repas', 'midi'] },
    { id: 's1', titre: '', ingredients: [], labels: ['repas', 'soir'] },
    { id: 'x1', titre: '', ingredients: [], labels: ['repas'] },
    { id: 'x2', titre: '', ingredients: [], labels: ['repas'] },
  ];
  const menu = L.generateMenu(pool, [], { rng: () => 0.5, days: 1, perDay: 2 });
  assert.equal(menu.jours[0].repas[0].recipe, 'm1');   // créneau midi -> recette labellisée "midi"
  assert.equal(menu.jours[0].repas[1].recipe, 's1');   // créneau soir -> recette labellisée "soir"
});

test('rayonFor : ligature œ et pluriel "petits pois" classés correctement', () => {
  assert.equal(L.rayonFor('Œufs'), 'prot');            // ligature œ -> oe
  assert.equal(L.rayonFor('oeuf'), 'prot');
  assert.equal(L.rayonFor('petits pois'), 'leg');      // pluriel des deux mots
  assert.equal(L.rayonFor('petit pois'), 'leg');
  assert.equal(L.rayonFor('haricots verts'), 'leg');   // pluriel 1er mot d'un mot-clé composé
  assert.equal(L.rayonFor('pommes de terre'), 'leg');
  assert.equal(L.rayonFor('coquillettes'), 'epi');
  assert.equal(L.rayonFor('cheddar râpé'), 'prot');
  assert.equal(L.rayonFor('beurre'), 'con');
});

test('parseQty : cuillères abrégées (c. à s. / c à s) reconnues', () => {
  assert.equal(L.parseQty('2 c. à s. de sauce soja').unit, 'cs');
  assert.equal(L.parseQty('1 c. à c. de paprika').unit, 'cc');
  assert.equal(L.parseQty('1 c à s huile').unit, 'cs');
});

test('scaleIngredientLine : fractions ASCII en entrée et sortie', () => {
  assert.equal(L.scaleIngredientLine('1/2 citron', 2), '1 citron');
  assert.equal(L.scaleIngredientLine('1/4 oignon', 2), '1/2 oignon');
  assert.equal(L.scaleIngredientLine('1 oignon', 0.5), '1/2 oignon');
});

test('canonName : singulier/pluriel + ligature œ, accents préservés, invariables (Lexique)', () => {
  assert.equal(L.canonName('Oeufs'), 'oeuf');
  assert.equal(L.canonName('Œufs'), 'oeuf');            // ligature œ -> oe
  assert.equal(L.canonName('Tomates'), 'tomate');
  assert.equal(L.canonName('pommes de terre'), 'pomme de terre');
  assert.equal(L.canonName('Pâtes'), 'pâte');
  assert.equal(L.canonName('Pâté'), 'pâté');            // accent préservé -> distinct de "pâte"
  ['radis', 'ananas', 'maïs', 'noix', 'pois', 'couscous'].forEach((w) =>
    assert.equal(L.canonName(w), w));                   // invariables : non tronquées (pas "anana")
});

test('computeCourses : fusionne singulier/pluriel et ligature œ', () => {
  const menu = { jours: [
    { repas: [{ shop: [{ n: 'Tomate', q: 2, u: '', r: 'leg' }, { n: 'Œufs', q: 1, u: '', r: 'prot' }] }] },
    { repas: [{ shop: [{ n: 'Tomates', q: 3, u: '', r: 'leg' }, { n: 'oeuf', q: 2, u: '', r: 'prot' }] }] },
  ] };
  const data = L.computeCourses(menu, '2026-07-02', new Set(), RAYONS);
  const leg = data.find((s) => s.cls === 'leg');
  assert.equal(leg.items.length, 1); assert.equal(leg.items[0].q, 5);   // Tomate + Tomates fusionnés
  const prot = data.find((s) => s.cls === 'prot');
  assert.equal(prot.items.length, 1); assert.equal(prot.items[0].q, 3); // Œufs + oeuf fusionnés
});

test('rayonFor : safran (con), lardons/faux lardons (prot)', () => {
  assert.equal(L.rayonFor('safran'), 'con');
  assert.equal(L.rayonFor('faux lardons'), 'prot');
  assert.equal(L.rayonFor('lardons fumés'), 'prot');
  assert.equal(L.rayonFor('menthe'), 'con');
  assert.equal(L.rayonFor('vin blanc sec'), 'epi');
  assert.equal(L.rayonFor('vinaigre de vin'), 'con');   // pas de collision avec le mot-clé "vin blanc"
});
