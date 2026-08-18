/* Logique pure d'Obi-Wan Quinoa (sans DOM, sans état global).
   Chargée comme <script> classique par index.html (fonctions exposées en global)
   et require()-able par les tests Node (module.exports). Voir test/logic.test.js. */
(function(root, factory){
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else Object.assign(root, api);
})(typeof self !== 'undefined' ? self : this, function(){

  /* ---------- Dates ---------- */
  const MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const JOURS=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  function pad(n){return (n<10?'0':'')+n;}
  function idOf(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
  function parseId(s){const p=s.split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);x.setHours(0,0,0,0);return x;}
  function startOfWeek(d, ws){const x=new Date(d);x.setHours(0,0,0,0);const w=(ws==null?4:ws);return addDays(x,-((x.getDay()+7-w)%7));}/*ws=jour de début (0=dim..6=sam), défaut jeudi=4*/
  function fmt(d){const j=d.getDate();return (j===1?'1ᵉʳ':j)+' '+MOIS[d.getMonth()];}

  /* ---------- Recettes ---------- */
  function midi(r){ return Object.assign({}, r, {moment:"Midi"}); }
  function soir(r){ return Object.assign({}, r, {moment:"Soir"}); }
  /* Résout une référence {recipe:id} en objet recette ; midi/soir selon la position (slot 0 = midi, 1 = soir).
     Créneau vide (ref.recipe null ou recette absente) -> placeholder {vide:true} CONSERVÉ (menu au fil de l'eau) :
     ne jamais filtrer, sinon l'indexation di/ri et l'attribution midi/soir se décalent. */
  function resolveRepas(ref, slot, R){ const moment = slot===0 ? 'Midi' : 'Soir';
    const base = ref && ref.recipe ? R[ref.recipe] : null;
    if(!base) return { moment:moment, vide:true, id:(ref&&ref.recipe)||null, titre:'', ingredients:[], etapes:[], shop:[], labels:[] };
    const o = slot===0 ? midi(base) : soir(base); o.id = ref.recipe; return o; }
  function materializeMenus(raw, R){
    const out = {};
    Object.keys(raw).forEach(function(wid){
      out[wid] = { jours: raw[wid].jours.map(function(day){
        return { repas: day.repas.map(function(ref,slot){ return resolveRepas(ref,slot,R); }) };   // placeholders conservés
      }) };
    });
    return out;
  }

  /* ---------- Liste de courses ---------- */
  function frac(x){const w=Math.floor(x+1e-6),r=x-w;let f='';
    if(Math.abs(r-0.25)<.02)f='1/4';else if(Math.abs(r-0.5)<.02)f='1/2';else if(Math.abs(r-0.75)<.02)f='3/4';
    if(f)return w>0?(w+' '+f):f;
    return (Math.round(x*10)/10).toString().replace('.',',');}
  function qLabel(e){
    let s;
    if(e.q==null){ s=''; }
    else if(e.u==='g') s=Math.round(e.q)+' g';
    else if(e.u==='ml') s=Math.round(e.q)+' ml';
    else if(e.u==='gousse') s=frac(e.q)+' gousse'+(e.q>1?'s':'');
    else if(e.u==='botte') s=frac(e.q)+' botte'+(e.q>1?'s':'');
    else if(e.u==='tranche') s=Math.round(e.q)+' tranche'+(e.q>1?'s':'');
    else s=frac(e.q)+(e.u?' '+e.u:'');
    if(e.note) s = s ? s+' ('+e.note+')' : e.note;
    return s;
  }

  /* ---------- Ingrédients texte libre ---------- */
  /* Normalisation pour matching (minuscules, sans accents). */
  function stripAccents(s){ return (s||'').replace(/œ/g,'oe').replace(/Œ/g,'Oe').normalize('NFD').replace(/[̀-ͯ]/g,''); }
  /* Apostrophes typographiques unifiées ('’‘`´ -> ') pour que "huile d'olive" == "huile d’olive". */
  function norm(s){ return stripAccents((s||'').toLowerCase()).replace(/['’‘`´]/g,"'").replace(/\s+/g,' ').trim(); }

  /* Invariables au pluriel (noms/adjectifs en -s/-x, source : Lexique 3.83, colonne "nombre" vide).
     Évitent les faux stems de la singularisation (ananas -> anana, noix -> noi). Régénérable via le
     vocabulaire du catalogue (scripts/lint_recipes.mjs --vocab) recoupé au lexique. Voir README « Sources ». */
  const SINGULARS = new Set(['ananas','anis','brebis','cassis','couscous','doux','faux','frais','maïs','noix','pois','radis','vieux']);
  function singular(w){ return (w.length>=4 && /[sx]$/.test(w) && !SINGULARS.has(w)) ? w.slice(0,-1) : w; }
  /* Forme canonique d'un nom pour le cumul : minuscule + ligature œ->oe + espaces normalisés,
     ACCENTS PRÉSERVÉS (donc "Pâte" != "Pâté"), puis singularisation régulière -s/-x par mot (sauf
     invariables). Fusionne oeuf/oeufs, tomate/tomates, pomme de terre/pommes de terre. */
  function canonName(n){ return (n||'').toLowerCase().replace(/œ/g,'oe').replace(/['’‘`´]/g,"'").replace(/\s+/g,' ').trim().split(' ').map(singular).join(' '); }

  /* Synonymes de COURSES : variantes d'un même produit d'achat -> une clé canonique commune (pour cumuler
     dans la liste de courses). Le nom AFFICHÉ reste celui de la recette (aucune modification des recettes).
     On ne fusionne QUE des produits identiques ; les vraies distinctions sont préservées (sucre != sucre
     glace/vanillé/de canne ; beurre != demi-sel/allégé/cacahuète ; huile d'olive/sésame distinctes ;
     lait != coco/végétal/soja ; riz != basmati/risotto ; crème bare laissée telle quelle car ambiguë). */
  const SHOP_SYNONYMS = {
    'farine t55':'farine','farine de blé':'farine','farine de blé t55':'farine','farine à gâteau francine':'farine',
    'sucre en poudre':'sucre','sucre blanc':'sucre','sucre pour faire dégorger les pêche':'sucre',
    'beurre doux':'beurre','beurre fondu':'beurre','beurre mou':'beurre','beurre pour le moule':'beurre',
    'huile neutre':'huile végétale',
    'oeuf moyen':'oeuf','oeuf frais':'oeuf','oeuf extra-frai':'oeuf',
    'lait légèrement tiède':'lait',
    'crème liquide entière':'crème liquide','crème fraîche épaisse':'crème fraîche',
    'yaourt à la grecque':'yaourt grec','yaourt grec ou fromage blanc épai':'yaourt grec',
    'tomate ronde':'tomate',
    'citron non traité':'citron','citron bio':'citron','citron jaune non traité':'citron',
    'oignon jaune':'oignon','oignon blanc':'oignon',
    'pois chiche égoutté':'pois chiche','pois chiche cuit':'pois chiche',
    'haricot rouge égoutté':'haricot rouge','haricot rouge cuit':'haricot rouge',
    'parmesan râpé':'parmesan','parmesan végétarien':'parmesan',
    'zeste citron':'zeste de citron','zeste de citron jaune non traité':'zeste de citron',
    'banane bien mûre':'banane','banane trè mûre':'banane',
    'bicarbonate alimentaire':'bicarbonate de soude',
    'fromage râpé allégé':'fromage râpé',
    'persil plat':'persil','basilic frais':'basilic','cannelle en poudre':'cannelle','champignon de pari':'champignon',
  };
  /* Clé de cumul d'un ingrédient dans la liste de courses (canonName + synonymes de produit). */
  function shopCanon(name){ const c=canonName(name); return SHOP_SYNONYMS[c] || c; }

  /* Normalise l'unité de cumul : poids -> g, volumes -> ml (conversions EXACTES uniquement, pas les
     cuillères qui sont approximatives). Fusionne "2 kg" et "300 g", "1 l"/"20 cl" et "500 ml". */
  function canonUnit(qty, unit){
    if(qty==null) return { qty:qty, unit:unit };
    if(unit==='kg') return { qty:qty*1000, unit:'g' };
    if(unit==='l')  return { qty:qty*1000, unit:'ml' };
    if(unit==='cl') return { qty:qty*10,   unit:'ml' };
    return { qty:qty, unit:unit };
  }

  /* Slug d'identité d'une recette (nom de fichier). Sert UNIQUEMENT à la création : un renommage
     conserve le slug d'origine. Sans accents, [a-z0-9] et tirets, sans tiret de bord. */
  function slugify(titre){ return norm(titre).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,''); }

  /* Allergènes déclarables (set fermé, aligné annexe II INCO/UE). Le champ recette `allergenes`
     est un sous-ensemble de ces clés (allergènes PRÉSENTS dans la recette). */
  const ALLERGENES=['gluten','crustaces','oeuf','poisson','arachide','soja','lait','fruits-a-coque','celeri','moutarde','sesame','sulfites','lupin','mollusques'];

  const FRAC_UNI={'½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4',
    '⅕':'1/5','⅖':'2/5','⅗':'3/5','⅘':'4/5','⅙':'1/6','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
  /* unités reconnues (les plus longues d'abord pour éviter les préfixes) */
  const UNITS=[['c. à soupe','cs'],['c. à café','cc'],['cuillères à soupe','cs'],['cuillère à soupe','cs'],
    ['cuillères à café','cc'],['cuillère à café','cc'],['càs','cs'],['càc','cc'],
    ['c. à s.','cs'],['c. à c.','cc'],['c. à s','cs'],['c. à c','cc'],['c à s','cs'],['c à c','cc'],
    ['kg','kg'],['mg','mg'],['grammes','g'],['gramme','g'],['gr','g'],   // alias "gramme(s)"/"gr" -> g (recettes hétérogènes)
    ['millilitres','ml'],['millilitre','ml'],['ml','ml'],['cl','cl'],['gousses','gousse'],['gousse','gousse'],
    ['bottes','botte'],['botte','botte'],['tranches','tranche'],['tranche','tranche'],
    ['pincées','pincée'],['pincée','pincée'],['sachets','sachet'],['sachet','sachet'],
    ['boîtes','boîte'],['boîte','boîte'],['boites','boîte'],['boite','boîte'],['pots','pot'],['pot','pot'],
    ['pièces',''],['pièce',''],   // "pièce(s)" = à l'unité (retire le mot parasite du nom : "pièce(s) oeuf" -> "oeuf")
    ['g','g'],['l','l']];
  /* Parse une ligne d'ingrédient libre -> {qty:number|null, unit, name, raw}. Non parsable -> qty:null, name=ligne brute. */
  function parseQty(line){
    const raw=(line||'').replace(/\s+/g,' ').trim();
    let s=raw;
    Object.keys(FRAC_UNI).forEach(function(k){ s=s.split(k).join(' '+FRAC_UNI[k]+' '); });
    s=s.replace(/\s+/g,' ').trim();
    let qty=null, rest=s;
    const fr=s.match(/^(\d+)\s*\/\s*(\d+)\b(.*)$/);
    if(fr){ qty=(+fr[1])/(+fr[2]); rest=fr[3]; }
    else{ const n=s.match(/^(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|à)\s*\d+(?:[.,]\d+)?)?(.*)$/);
      if(n){ qty=parseFloat(n[1].replace(',','.')); rest=n[2]; } }
    rest=rest.replace(/^\s+/,'');
    let unit='';
    for(let i=0;i<UNITS.length;i++){ const tok=UNITS[i][0];
      const re=new RegExp('^'+tok.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![a-zà-ÿ])','i');
      if(re.test(rest)){ unit=UNITS[i][1]; rest=rest.slice(tok.length); break; } }
    let name=rest.replace(/^\s*\([^)]*\)\s*/,'');              // retire une parenthèse de tête ("(1 lb) ...")
    name=name.replace(/^\s*(?:de |d'|d’|des |du |l'|l’)/i,'').replace(/\s+/g,' ').trim();
    name=name.replace(/\s*\([^)]*\)\s*$/,'').trim();          // retire une note finale entre parenthèses
    if(!name) name=raw;                                        // secours : ligne brute
    return { qty:(qty!=null && isFinite(qty)?qty:null), unit:unit, name:name, raw:raw };
  }

  /* Rayon d'un ingrédient par mots-clés (défaut "aut" = Autres). */
  const RAYON_KEYWORDS=[
    ['leg',['haricot vert','haricots verts','pomme de terre','pommes de terre','patate douce','patate','courgette','tomate','carotte','oignon','echalote','ail','poivron','piment','aubergine','epinard','salade','laitue','roquette','mache','concombre','betterave','champignon','brocoli','chou-fleur','chou fleur','chou','romanesco','poireau','celeri','courge','potimarron','butternut','potiron','citrouille','radis','navet','rutabaga','fenouil','petit pois','petits pois','pousse','endive','artichaut','asperge','panais','blette','cresson','mais','gingembre','avocat','courgette jaune']],
    ['prot',['tofu','tempeh','seitan','oeuf','œuf','yaourt','skyr','lait','creme','feta','mozzarella','parmesan','ricotta','chevre','roquefort','gruyere','comte','emmental','halloumi','cheddar','vieux-lille','chorizo','fromage','lentille','pois chiche','pois casse','haricot rouge','haricot blanc','haricot noir','feve','haricot','edamame','soja','lardon']],
    ['fru',['pomme','banane','poire','peche','nectarine','abricot','prune','fraise','framboise','mure','groseille','citron','orange','pamplemousse','clementine','raisin','kiwi','mangue','ananas','cerise','myrtille','melon','pasteque','figue','datte','grenade','rhubarbe']],
    ['epi',['farine','maizena','fecule','quinoa','riz','pate','nouille','spaghetti','penne','tagliatelle','vermicelle','coquillette','couscous','boulgour','semoule','polenta','ble','orge','epeautre','sarrasin','pain','chapelure','flocon','avoine','chocolat','cacao','noix','noisette','amande','pignon','graine','tahini','conserve','coulis','concentre de tomate','bouillon','sucre','cassonade','sirop','confiture','pate feuilletee','pate brisee','vin blanc','vin rouge']],
    ['con',['sel','poivre','huile','beurre','margarine','vinaigre','sauce soja','tamari','sauce','harissa','epice','curry','cumin','paprika','curcuma','safran','cannelle','muscade','herbe','thym','romarin','laurier','origan','basilic','menthe','persil','coriandre','estragon','ciboulette','moutarde','miel','levure','bicarbonate','vanille']],
  ];
  /* Regex compilées : mot entier + pluriel éventuel (s/x). Évite les faux positifs de sous-chaîne
     ("mais" dans "maison") tout en acceptant les pluriels ("courgette" -> "courgettes"). */
  const RAYON_RE = RAYON_KEYWORDS.map(function(g){ return [g[0], g[1].map(function(kw){
    return new RegExp('\\b'+stripAccents(kw).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:s|x)?\\b'); })]; });
  function rayonFor(name){ const n=norm(name);
    for(let i=0;i<RAYON_RE.length;i++){ const res=RAYON_RE[i][1];
      for(let j=0;j<res.length;j++){ if(res[j].test(n)) return RAYON_RE[i][0]; } }
    return 'aut';
  }

  /* ---------- Générateur de menus (sans IA) ---------- */
  /* Découpe une saisie "1 courgette; 3 tomates" en tokens normalisés (pour le matching). */
  /* Découpe une saisie en items : sépare sur ; retour-ligne et virgule — sauf virgule décimale ("1,5"). */
  function splitItems(input){ return (input||'').split(/[;\n]+|,(?!\d)/).map(function(x){ return x.trim(); }).filter(Boolean); }
  function tokenize(input){ return splitItems(input).map(function(part){ return norm(parseQty(part).name); }).filter(Boolean); }
  /* Score d'une recette = nb de tokens dispo trouvés dans (titre + ingrédients + labels). */
  function scoreRecipe(recipe, tokens){ if(!tokens || !tokens.length) return 0;
    const hay=norm((recipe.titre||'')+' '+((recipe.ingredients||[]).join(' '))+' '+((recipe.labels||[]).join(' ')));
    let s=0; tokens.forEach(function(t){ if(t && hay.indexOf(t)!==-1) s++; }); return s; }
  /* Ordonne le pool : meilleur score d'abord, non récemment utilisé, puis aléatoire (rng injectable). */
  function rankPool(pool, tokens, opts){ opts=opts||{}; const rng=opts.rng||Math.random, hist=opts.history||new Set();
    return pool.map(function(r){ return { id:r.id, score:scoreRecipe(r,tokens), recent:hist.has(r.id)?1:0, rand:rng() }; })
      .sort(function(a,b){ return (b.score-a.score) || (a.recent-b.recent) || (a.rand-b.rand); }); }
  /* Génère un menu ({jours:[{repas:[{recipe:id}]}]}) : days x perDay créneaux, sans répétition tant que le pool suffit
     (recyclage si le pool est plus petit que le nombre de créneaux). */
  function generateMenu(pool, tokens, opts){
    opts=opts||{}; const days=opts.days||7, perDay=opts.perDay||2;
    const ranked=rankPool(pool, tokens, opts);
    const labelsById={}; pool.forEach(function(r){ labelsById[r.id]=r.labels||[]; });
    const used=new Set();
    /* prochain id : non utilisé + label préféré, sinon non utilisé, sinon recyclage (pool trop petit). */
    function pick(pref){
      let i;
      if(pref){ for(i=0;i<ranked.length;i++){ const id=ranked[i].id; if(!used.has(id) && labelsById[id].indexOf(pref)!==-1){ used.add(id); return id; } } }
      for(i=0;i<ranked.length;i++){ const id=ranked[i].id; if(!used.has(id)){ used.add(id); return id; } }
      if(!ranked.length) return null;
      used.clear(); const id=ranked[0].id; used.add(id); return id;
    }
    const jours=[];
    for(let d=0; d<days; d++){ const repas=[];
      for(let s=0; s<perDay; s++){ const pref=(perDay===2)?(s===0?'midi':'soir'):null;
        const id=pick(pref); if(id==null) break; repas.push({ recipe:id }); }
      jours.push({ repas: repas }); }
    return { jours: jours };
  }
  /* Propose une alternative pour un créneau : meilleure recette non déjà utilisée dans la semaine. */
  function pickAlternative(pool, tokens, excludeIds, opts){
    const ranked=rankPool(pool, tokens, opts), ex=excludeIds||new Set();
    for(let i=0;i<ranked.length;i++){ if(!ex.has(ranked[i].id)) return ranked[i].id; }
    return ranked.length ? ranked[0].id : null;              // tout est exclu -> recycle le meilleur
  }

  /* ---------- Mise à l'échelle des quantités d'un ingrédient (affichage recette selon les couverts) ---------- */
  const FRAC_VAL={'¼':0.25,'½':0.5,'¾':0.75,'⅓':1/3,'⅔':2/3,'⅕':0.2,'⅖':0.4,'⅗':0.6,'⅘':0.8,'⅙':1/6,'⅛':0.125,'⅜':0.375,'⅝':0.625,'⅞':0.875};
  /* Valeur numérique d'un token quantité : entier/décimale, fraction "a/b", fraction unicode "½", ou mixte "1½". */
  function qtyValue(tok){
    tok=(''+tok).trim(); let total=0; const last=tok.slice(-1);
    if(FRAC_VAL[last]!==undefined){ total+=FRAC_VAL[last]; tok=tok.slice(0,-1).trim(); }
    if(tok){ if(tok.indexOf('/')!==-1){ const p=tok.split('/'); total+=(+p[0])/(+p[1]); }
      else total+=parseFloat(tok.replace(',','.')); }
    return total;
  }
  /* Met à l'échelle par `factor` TOUTES les quantités d'une ligne d'ingrédient, quelle que soit leur position
     ("Œufs — 2", "1 gousse", "½ citron", "80 g", "4 bananes"). Épargne les nombres collés à une lettre
     ("T45") et les pourcentages/températures ("70%", "165°C"). factor 1 -> inchangé. */
  function scaleIngredientLine(line, factor){
    if(!factor || factor===1 || !line) return line;
    return line.replace(/\d+\/\d+|\d+(?:[.,]\d+)?[¼½¾⅓⅔⅕⅖⅗⅘⅙⅛⅜⅝⅞]?|[¼½¾⅓⅔⅕⅖⅗⅘⅙⅛⅜⅝⅞]/g, function(tok, offset, full){
      const before=full.charAt(offset-1), after=full.slice(offset+tok.length);
      if(/[A-Za-zÀ-ÿ]/.test(before)) return tok;     // chiffre collé à une lettre (T45, code)
      if(/^\s*[%°]/.test(after)) return tok;         // pourcentage / température
      const v=qtyValue(tok); if(!isFinite(v)||v<=0) return tok;
      return frac(v*factor);
    });
  }
  /* Agrège les shop[] d'une semaine en UNE ligne par produit et par rayon (clé shopCanon|rayon : les
     variantes du même produit et ses différentes unités ne se dédoublent plus). Les quantités sont
     cumulées PAR UNITÉ (couverts appliqués), puis affichées combinées ("430 g + 2 c. à soupe").
     Repas supprimés séparés : un produit sans aucune contribution conservée est marqué exclu:true (grisé).
     Une ligne à UNE seule unité numérique reste éditable (q/u) ; sinon q=null (affichage combiné). */
  function addUnit(m, u, q, f){ if(q==null){ if(!m.has(u)) m.set(u,null); } else m.set(u, (m.get(u)==null?0:m.get(u)) + q*f); }
  function dispUnits(m, note){
    const parts=[]; m.forEach(function(q,u){ if(q!=null) parts.push(qLabel({q:q,u:u})); });
    if(parts.length) return parts.join(' + ');
    return note || '';   // que des q:null (condiment) -> note éventuelle
  }
  function computeCourses(menu, wid, deleted, rayons, couverts){
    if(!menu) return null;
    const cv = couverts || function(){ return 1; };
    const map=new Map(), order=[];
    menu.jours.forEach(function(day,di){
      day.repas.forEach(function(r,ri){
        const del = deleted.has(wid+':'+di+'-'+ri);
        const f = cv(di,ri) || 1;
        (r.shop||[]).forEach(function(s){
          const k=shopCanon(s.n)+'|'+s.r;   // UNE ligne par produit+rayon (unité hors clé)
          if(!map.has(k)){map.set(k,{n:s.n,r:s.r,note:s.note||'',kept:false,keptU:new Map(),exclU:new Map()});order.push(k);}
          const e=map.get(k);
          if(del) addUnit(e.exclU, s.u||'', s.q, f);
          else { e.kept=true; addUnit(e.keptU, s.u||'', s.q, f); }
          if(s.note && !e.note) e.note=s.note;
        });
      });
    });
    const byR={}; rayons.forEach(function(x){byR[x[0]]=[];});
    order.forEach(function(k){ const e=map.get(k); const exclu=!e.kept;
      const buckets = exclu ? e.exclU : e.keptU;
      const numeric = []; buckets.forEach(function(q,u){ if(q!=null) numeric.push([u,q]); });
      const single = (!exclu && numeric.length===1 && buckets.size===1) ? numeric[0] : null;   // éditable si 1 seule unité
      byR[e.r].push({ n:e.n, r:e.r, exclu:exclu, note:e.note,
        u: single?single[0]:'', q: single?single[1]:null, disp: dispUnits(buckets, e.note) });
    });
    return rayons.filter(function(x){return byR[x[0]].length;}).map(function(x){return {cls:x[0],rayon:x[1],items:byR[x[0]]};});
  }

  /* ---------- Catalogue local : filtre, delta, choix d'un repas ---------- */
  /* Filtre la liste allégée (index.json) côté client : type(s), régime(s), allergènes à EXCLURE, recherche
     texte (sur le champ `search` = titre + ingrédients). Tout comparé via norm (accents/casse). */
  function catalogueFilter(recipes, opts){
    opts=opts||{};
    const types=(opts.types||[]).map(norm), diets=(opts.diets||[]).map(norm),
      excl=(opts.excludeAllergenes||[]), q=norm(opts.query||'');
    return (recipes||[]).filter(function(r){
      const labels=(r.labels||[]).map(norm);
      if(types.length && !types.some(function(t){ return labels.indexOf(t)!==-1; })) return false;
      if(diets.length && !diets.every(function(d){ return labels.indexOf(d)!==-1; })) return false;
      if(excl.length && (r.allergenes||[]).some(function(a){ return excl.indexOf(a)!==-1; })) return false;
      if(q && (r.search||norm(r.titre||'')).indexOf(q)===-1) return false;
      return true;
    });
  }
  /* Compare deux index (par id + hash) -> {added, changed, removed} (ids). Pour le téléchargement delta. */
  function diffCatalogue(oldIndex, newIndex){
    const o={}, n={};
    ((oldIndex&&oldIndex.recipes)||[]).forEach(function(r){ o[r.id]=r.hash; });
    ((newIndex&&newIndex.recipes)||[]).forEach(function(r){ n[r.id]=r.hash; });
    const added=[], changed=[], removed=[];
    Object.keys(n).forEach(function(id){ if(!(id in o)) added.push(id); else if(o[id]!==n[id]) changed.push(id); });
    Object.keys(o).forEach(function(id){ if(!(id in n)) removed.push(id); });
    return { added:added, changed:changed, removed:removed };
  }
  /* Choisit 1 recette pour un créneau (menu au fil de l'eau) : meilleure du pool non déjà utilisée. */
  function pickSlotRecipe(pool, tokens, usedIds, opts){
    const ranked=rankPool(pool, tokens, opts||{}), ex=usedIds||new Set();
    for(let i=0;i<ranked.length;i++){ if(!ex.has(ranked[i].id)) return ranked[i].id; }
    return ranked.length ? ranked[0].id : null;
  }

  /* ---------- Mode IA : prompt de rédaction de recette ---------- */
  /* Le deep link ouvre Claude Code AVEC le dépôt : la skill y est lisible, donc le prompt la pointe au
     lieu de recopier ses règles. La session cloud a git + le proxy GitHub : elle publie en committant
     directement le fichier recette sur main (pas de PR ; l'auteur relit avant de pousser). */
  const IA_REPO='vincentchalamon/obi-wan-quinoa';
  const IA_SKILL='.claude/skills/recipe/SKILL.md';
  /* Anti-doublons : le catalogue local (recipes/index.json) est lisible dans la session ; l'app embarque
     aussi les titres au cas où. */
  function iaDoublons(titres){
    if(!titres || !titres.length)
      return 'Vérifie recipes/index.json pour ne pas créer de doublon (titre ou concept proche).';
    return 'N’en redéveloppe aucune de déjà présente — voici les '+titres.length+' recettes du catalogue : '+titres.join(' · ')+'.';
  }
  function buildRecipePrompt(demande, opts){
    opts=opts||{};
    const d=(demande||'').trim();
    return [
      'Applique la skill '+IA_SKILL+' de ce dépôt (repères nutritionnels : .claude/skills/recipe/references/nutrition.md) '
        +'pour me rédiger UNE recette. Si tu ne peux pas la lire : https://raw.githubusercontent.com/'+IA_REPO+'/main/'+IA_SKILL,
      '',
      'Ma demande : '+(d || 'à toi de choisir, surprends-moi avec un produit de saison'),
      'Saison : '+(opts.mois||'')+'. Régime : '+(opts.diet==='vegan'
        ? 'strictement vegan, aucun produit animal'
        : 'lacto-ovo végétarien, oeufs et laitages autorisés')+'.',
      '',
      iaDoublons(opts.titres),
      '',
      'Une fois la recette validée avec moi : crée le fichier recipes/<slug>.json (schéma interne, avec allergenes), '
        +'ajoute l’image éventuelle dans recipes/images/, régénère l’index (node scripts/build_index.mjs), valide '
        +'(node scripts/validate_recipes.mjs), montre-moi le diff, puis committe directement sur main (sans PR).'
    ].join('\n');
  }

  return { MOIS, JOURS, pad, idOf, parseId, addDays, startOfWeek, fmt,
           midi, soir, resolveRepas, materializeMenus, frac, qLabel, computeCourses,
           stripAccents, norm, canonName, shopCanon, canonUnit, slugify, ALLERGENES, parseQty, rayonFor, scaleIngredientLine,
           splitItems, tokenize, scoreRecipe, rankPool, generateMenu, pickAlternative,
           catalogueFilter, diffCatalogue, pickSlotRecipe, buildRecipePrompt };
});
