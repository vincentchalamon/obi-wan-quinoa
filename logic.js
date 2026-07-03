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
  function startOfWeek(d){const x=new Date(d);x.setHours(0,0,0,0);return addDays(x,-((x.getDay()+7-4)%7));}/*jeudi=4*/
  function fmt(d){const j=d.getDate();return (j===1?'1ᵉʳ':j)+' '+MOIS[d.getMonth()];}

  /* ---------- Recettes ---------- */
  function midi(r){ return Object.assign({}, r, {moment:"Midi", heure:"12 h 30"}); }
  function soir(r){ return Object.assign({}, r, {moment:"Soir", heure:"19 h"}); }
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
    else s=frac(e.q);
    if(e.note) s = s ? s+' ('+e.note+')' : e.note;
    return s;
  }
  /* Agrège les shop[] des repas non supprimés d'une semaine, cumule par clé n|u|r
     (q=null non cumulé), ajoute les extras, groupe par rayon dans l'ordre `rayons`. */
  function computeCourses(menu, wid, deleted, rayons, extras){
    if(!menu) return null;
    const map=new Map(), order=[];
    menu.jours.forEach(function(day,di){
      day.repas.forEach(function(r,ri){
        if(deleted.has(wid+':'+di+'-'+ri)) return;
        (r.shop||[]).forEach(function(s){
          const k=s.n+'|'+(s.u||'')+'|'+s.r;
          if(!map.has(k)){map.set(k,{n:s.n,u:s.u||'',r:s.r,q:(s.q==null?null:0),note:s.note||''});order.push(k);}
          const e=map.get(k);
          if(s.q!=null) e.q=(e.q==null?0:e.q)+s.q;
          if(s.note && !e.note) e.note=s.note;
        });
      });
    });
    const byR={}; rayons.forEach(function(x){byR[x[0]]=[];});
    order.forEach(function(k){const e=map.get(k); byR[e.r].push({n:e.n, u:e.u, r:e.r, q:e.q, note:e.note, disp:qLabel(e)});});
    extras.forEach(function(x){ byR[x.r].push({n:x.n, disp:x.disp}); });
    return rayons.filter(function(x){return byR[x[0]].length;}).map(function(x){return {cls:x[0],rayon:x[1],items:byR[x[0]]};});
  }

  return { MOIS, JOURS, pad, idOf, parseId, addDays, startOfWeek, fmt,
           midi, soir, resolveRepas, materializeMenus, frac, qLabel, computeCourses };
});
