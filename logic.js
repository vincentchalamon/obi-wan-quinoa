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
  /* Résout une référence {recipe:id} en objet recette ; midi/soir selon la position (slot 0 = midi, 1 = soir). */
  function resolveRepas(ref, slot, R){ const base = R[ref.recipe]; if(!base) return null;
    const o = slot===0 ? midi(base) : soir(base); o.id = ref.recipe; return o; }
  function materializeMenus(raw, R){
    const out = {};
    Object.keys(raw).forEach(function(wid){
      out[wid] = { jours: raw[wid].jours.map(function(day){
        return { repas: day.repas.map(function(ref,slot){ return resolveRepas(ref,slot,R); }).filter(Boolean) };
      }) };
    });
    return out;
  }

  /* ---------- Liste de courses ---------- */
  function frac(x){const w=Math.floor(x+1e-6),r=x-w;let f='';
    if(Math.abs(r-0.25)<.02)f='¼';else if(Math.abs(r-0.5)<.02)f='½';else if(Math.abs(r-0.75)<.02)f='¾';
    if(f)return (w>0?w:'')+f;
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

  /* ---------- Ingrédients texte libre (RecipeSage) ---------- */
  /* Normalisation pour matching (minuscules, sans accents). */
  function stripAccents(s){ return (s||'').normalize('NFD').replace(/[̀-ͯ]/g,''); }
  function norm(s){ return stripAccents((s||'').toLowerCase()).replace(/\s+/g,' ').trim(); }

  const FRAC_UNI={'½':'1/2','⅓':'1/3','⅔':'2/3','¼':'1/4','¾':'3/4',
    '⅕':'1/5','⅖':'2/5','⅗':'3/5','⅘':'4/5','⅙':'1/6','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'};
  /* unités reconnues (les plus longues d'abord pour éviter les préfixes) */
  const UNITS=[['c. à soupe','cs'],['c. à café','cc'],['cuillères à soupe','cs'],['cuillère à soupe','cs'],
    ['cuillères à café','cc'],['cuillère à café','cc'],['càs','cs'],['càc','cc'],
    ['kg','kg'],['mg','mg'],['ml','ml'],['cl','cl'],['gousses','gousse'],['gousse','gousse'],
    ['bottes','botte'],['botte','botte'],['tranches','tranche'],['tranche','tranche'],
    ['pincées','pincée'],['pincée','pincée'],['sachets','sachet'],['sachet','sachet'],
    ['boîtes','boîte'],['boîte','boîte'],['boites','boîte'],['boite','boîte'],['pots','pot'],['pot','pot'],['g','g'],['l','l']];
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
    ['leg',['haricot vert','pomme de terre','patate douce','patate','courgette','tomate','carotte','oignon','echalote','ail','poivron','piment','aubergine','epinard','salade','laitue','roquette','mache','concombre','betterave','champignon','brocoli','chou-fleur','chou fleur','chou','romanesco','poireau','celeri','courge','potimarron','butternut','potiron','citrouille','radis','navet','rutabaga','fenouil','petit pois','pousse','endive','artichaut','asperge','panais','blette','cresson','mais','gingembre','avocat','courgette jaune']],
    ['prot',['tofu','tempeh','seitan','oeuf','œuf','yaourt','skyr','lait','creme','feta','mozzarella','parmesan','ricotta','chevre','roquefort','gruyere','comte','emmental','halloumi','fromage','lentille','pois chiche','pois casse','haricot rouge','haricot blanc','haricot noir','feve','haricot','edamame','soja']],
    ['fru',['pomme','banane','poire','peche','nectarine','abricot','prune','fraise','framboise','mure','groseille','citron','orange','pamplemousse','clementine','raisin','kiwi','mangue','ananas','cerise','myrtille','melon','pasteque','figue','datte','grenade','rhubarbe']],
    ['epi',['farine','maizena','fecule','quinoa','riz','pate','nouille','spaghetti','penne','tagliatelle','vermicelle','couscous','boulgour','semoule','polenta','ble','orge','epeautre','sarrasin','pain','chapelure','flocon','avoine','chocolat','cacao','noix','noisette','amande','graine','tahini','conserve','coulis','concentre de tomate','bouillon','sucre','cassonade','sirop','confiture','pate feuilletee','pate brisee']],
    ['con',['sel','poivre','huile','vinaigre','sauce soja','tamari','sauce','harissa','epice','curry','cumin','paprika','curcuma','cannelle','muscade','herbe','thym','romarin','laurier','origan','basilic','persil','coriandre','estragon','ciboulette','moutarde','miel','levure','bicarbonate','vanille']],
  ];
  function rayonFor(name){ const n=norm(name);
    for(let i=0;i<RAYON_KEYWORDS.length;i++){ const kws=RAYON_KEYWORDS[i][1];
      for(let j=0;j<kws.length;j++){ if(n.indexOf(stripAccents(kws[j]))!==-1) return RAYON_KEYWORDS[i][0]; } }
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
  /* Génère un menu (forme menus.json) : days x perDay créneaux, sans répétition tant que le pool suffit
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
  function scaleNum(n, factor){ const v=parseFloat(String(n).replace(',','.'))*factor;
    if(!isFinite(v)) return String(n); return (Math.round(v*100)/100).toString().replace('.',','); }
  /* Multiplie par `factor` les quantités d'une ligne libre : "X g/kg/ml/cl/l" et un compte de tête ("4 bananes").
     Ne touche pas aux nombres sans unité en milieu de ligne ni aux "T45"/"70%". factor 1 -> inchangé. */
  function scaleIngredientLine(line, factor){
    if(!factor || factor===1 || !line) return line;
    let s=line.replace(/(\d+(?:[.,]\d+)?)(\s*)(kg|mg|ml|cl|g|l)\b/gi, function(m,n,sp,u){ return scaleNum(n,factor)+sp+u; });
    s=s.replace(/^(\s*)(\d+(?:[.,]\d+)?)(\s+)(?!(?:kg|mg|ml|cl|g|l)\b)/i, function(m,pre,n,sp){ return pre+scaleNum(n,factor)+sp; });
    return s;
  }
  /* Agrège les shop[] des repas non supprimés d'une semaine, cumule par clé n|u|r
     (q=null non cumulé), multiplie chaque quantité par les couverts du repas
     (couverts(di,ri) -> facteur, défaut 1), groupe par rayon dans l'ordre `rayons`. */
  function computeCourses(menu, wid, deleted, rayons, couverts){
    if(!menu) return null;
    const cv = couverts || function(){ return 1; };
    const map=new Map(), order=[];
    menu.jours.forEach(function(day,di){
      day.repas.forEach(function(r,ri){
        if(deleted.has(wid+':'+di+'-'+ri)) return;
        const f = cv(di,ri) || 1;
        (r.shop||[]).forEach(function(s){
          const k=norm(s.n)+'|'+(s.u||'')+'|'+s.r;          // cumul insensible à la casse/aux accents
          if(!map.has(k)){map.set(k,{n:s.n,u:s.u||'',r:s.r,q:(s.q==null?null:0),note:s.note||''});order.push(k);}
          const e=map.get(k);
          if(s.q!=null) e.q=(e.q==null?0:e.q)+s.q*f;
          if(s.note && !e.note) e.note=s.note;
        });
      });
    });
    const byR={}; rayons.forEach(function(x){byR[x[0]]=[];});
    order.forEach(function(k){const e=map.get(k); byR[e.r].push({n:e.n, u:e.u, r:e.r, q:e.q, note:e.note, disp:qLabel(e)});});
    return rayons.filter(function(x){return byR[x[0]].length;}).map(function(x){return {cls:x[0],rayon:x[1],items:byR[x[0]]};});
  }

  return { MOIS, JOURS, pad, idOf, parseId, addDays, startOfWeek, fmt,
           midi, soir, resolveRepas, materializeMenus, frac, qLabel, computeCourses,
           stripAccents, norm, parseQty, rayonFor, scaleIngredientLine,
           splitItems, tokenize, scoreRecipe, rankPool, generateMenu, pickAlternative };
});
