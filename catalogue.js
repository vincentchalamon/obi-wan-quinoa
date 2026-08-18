/* Client du catalogue LOCAL d'Obi-Wan Quinoa (plus aucune dépendance réseau tierce).
   Chargé comme <script> classique par index.html (après logic.js) et require()-able par les tests.
   Les recettes vivent dans le dépôt : recipes/index.json (liste allégée) + recipes/<id>.json (détail). */
(function(root, factory){
  const L = (typeof require !== 'undefined') ? require('./logic.js') : root;
  const api = factory(L);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this, function(L){

  /* Liste allégée (id, titre, labels, allergenes, search, hash) — network-first via le service worker. */
  function catGetRecipes(){
    return fetch('recipes/index.json').then(function(res){
      if(!res.ok) throw new Error('index HTTP ' + res.status);
      return res.json();
    }).then(function(j){ return (j && j.recipes) || []; });
  }
  /* Détail brut d'une recette (schéma interne du dépôt, shop dérivé par catMapRecipe). */
  function catGetRecipe(id){
    return fetch('recipes/' + id + '.json').then(function(res){
      if(!res.ok) throw new Error('recette HTTP ' + res.status);
      return res.json();
    });
  }
  /* Recette brute (fichier) -> forme interne de l'app : shop[] dérivé des ingrédients (parseQty/rayonFor),
     l'eau exclue des courses (mais gardée dans les ingrédients). Mêmes champs qu'avant + allergenes. */
  function catMapRecipe(raw){
    const ingredients = raw.ingredients || [];
    const shop = ingredients.map(function(line){ const p = L.parseQty(line); const cu = L.canonUnit(p.qty, p.unit);
      return { n:p.name, q:cu.qty, u:cu.unit, r:L.rayonFor(p.name) }; })
      .filter(function(it){ return L.norm(it.n) !== 'eau'; });
    const rec = { id: raw.id, titre: raw.titre || '(sans titre)',
      ingredients: ingredients, etapes: raw.etapes || [], shop: shop,
      labels: raw.labels || [], allergenes: raw.allergenes || [] };
    if(raw.image) rec.image = raw.image;
    if(typeof raw.kcal === 'number') rec.kcal = raw.kcal;
    if(typeof raw.prot === 'number') rec.prot = raw.prot;
    return rec;
  }

  return { catGetRecipes, catGetRecipe, catMapRecipe };
});
