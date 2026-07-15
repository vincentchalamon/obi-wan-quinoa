/* Client RecipeSage d'Obi-Wan Quinoa (le catalogue public de l'owner sert de "base de données").
   Chargé comme <script> classique par index.html (après logic.js) et require()-able par les tests.
   API tRPC publique : GET <API>/<procédure>?input=<json urlencodé brut> (pas de superjson, pas de batch),
   CORS ouvert. Seules getRecipes et getRecipe sont publiques ; on ne pioche que dans l'userId de l'owner. */
(function(root, factory){
  const L = (typeof require !== 'undefined') ? require('./logic.js') : root;
  const api = factory(L);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this, function(L){

  /* userId public de l'owner : catalogue-source. Forker le projet pour utiliser le sien. */
  const OWNER_USER_ID = '4f329051-c9e5-45fb-9a61-069e3853ba61';
  const API = 'https://api.recipesage.com/trpc/';

  function rsUrl(proc, input){ return API + proc + '?input=' + encodeURIComponent(JSON.stringify(input)); }
  function rsGet(proc, input){
    return fetch(rsUrl(proc, input)).then(function(res){
      if(!res.ok) throw new Error(proc + ' HTTP ' + res.status);
      return res.json();
    }).then(function(j){ return j.result.data; });
  }

  /* Liste "lite" (id, title, yield, url, image, recipeLabels) filtrable par labels.
     Récupère TOUTES les pages (boucle par tranches de 200) pour ne rien tronquer si le catalogue grandit. */
  function rsGetRecipes(opts){
    opts = opts || {};
    const PAGE = 200, all = [];
    function page(offset){
      const input = { userIds:[OWNER_USER_ID], folder:'main', orderBy:'title', orderDirection:'asc', offset: offset, limit: PAGE };
      if(opts.labels && opts.labels.length){ input.labels = opts.labels; input.labelIntersection = !!opts.labelIntersection; }
      return rsGet('recipes.getRecipes', input).then(function(d){
        const batch = d.recipes || []; all.push.apply(all, batch);
        return batch.length === PAGE ? page(offset + PAGE) : all;
      });
    }
    return page(0);
  }
  /* Détail complet d'une recette (ingredients/instructions texte libre, champs nutrition*). */
  function rsGetRecipe(id){ return rsGet('recipes.getRecipe', { id: id }); }

  function firstNum(s){ if(s==null) return undefined; const m=(''+s).match(/\d+(?:[.,]\d+)?/); if(!m) return undefined;
    let raw=m[0]; if(/^\d{1,3}[.,]\d{3}$/.test(raw)) raw=raw.replace(/[.,]/,'');   // separateur de milliers -> entier
    return parseFloat(raw.replace(',','.')); }
  function splitLines(s){ return (s||'').split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean); }
  function labelsOf(raw){ return (raw.recipeLabels||[]).map(function(l){ return l.label && l.label.title; }).filter(Boolean); }

  /* Recette RecipeSage brute -> forme interne de l'app (titre/ingredients/etapes/shop/labels), shop[] dérivé via parseQty. */
  function rsMapRecipe(raw){
    const ingredients = splitLines(raw.ingredients);
    const shop = ingredients.map(function(line){ const p = L.parseQty(line);
      return { n:p.name, q:p.qty, u:p.unit, r:L.rayonFor(p.name) }; })
      .filter(function(it){ return L.norm(it.n) !== 'eau'; });   // l'eau ne va pas sur la liste de courses (garde "eau de fleur d'oranger", etc.)
    const rec = { id: raw.id, titre: raw.title || '(sans titre)',
      ingredients: ingredients, etapes: splitLines(raw.instructions), shop: shop, labels: labelsOf(raw) };
    const img = (raw.recipeImages && raw.recipeImages[0] && raw.recipeImages[0].image) ? raw.recipeImages[0].image.location : '';
    if(img) rec.image = img;                 // photo (recettes RecipeSage uniquement)
    if(raw.url) rec.url = raw.url;            // lien source
    const kc = firstNum(raw.nutritionCalories); if(kc != null) rec.kcal = kc;   // nutrition affichée seulement si présente
    const pr = firstNum(raw.nutritionProtein);  if(pr != null) rec.prot = pr;
    return rec;
  }

  return { OWNER_USER_ID, rsUrl, rsGetRecipes, rsGetRecipe, rsMapRecipe };
});
