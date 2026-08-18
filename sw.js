/* Service worker — cache hors-ligne.
   Stratégie : network-first sur le HTML et les JSON (pour voir les nouveaux menus en ligne),
   cache-first sur les fichiers statiques (icônes, manifeste). */
const CACHE = 'menu-v22';   // <-- incrémente ce numéro si besoin de purger le cache
const ASSETS = [
  './', './index.html', './logic.js', './catalogue.js', './manifest.webmanifest',
  './recipes/index.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

/* Précache dynamique du catalogue : après les assets fixes, on met en cache toutes les recettes et leurs
   images listées dans index.json (best-effort par item : un 404 ne casse pas l'install) -> catalogue et
   consultation disponibles hors-ligne dès la première visite. */
function precacheCatalogue(c){
  return fetch('./recipes/index.json').then(function(r){ return r.ok ? r.json() : {recipes:[]}; }).then(function(idx){
    var urls = [];
    (idx.recipes||[]).forEach(function(r){ urls.push('./recipes/'+r.id+'.json'); });
    return Promise.all(urls.map(function(u){
      return fetch(u).then(function(res){ if(res.ok){ return c.put(u, res.clone()).then(function(){
        // image éventuelle référencée par la recette
        return res.json().then(function(o){ return o.image ? fetch('./'+o.image).then(function(im){ if(im.ok) return c.put('./'+o.image, im); }).catch(function(){}) : null; });
      }); } }).catch(function(){});
    }));
  }).catch(function(){});
}

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(ASSETS).then(function(){ return precacheCatalogue(c); }); })
      .then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;
  // cross-origin (images distantes eventuelles) -> laisser le navigateur gerer, sinon NS_ERROR_INTERCEPTION_FAILED en navigation privee
  if(new URL(req.url).origin !== self.location.origin) return;
  var accept = req.headers.get('accept') || '';
  // JSON de données (recipes/menus) -> network-first : voir les nouveaux menus après un push
  if(new URL(req.url).pathname.endsWith('.json')){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      }).catch(function(){ return caches.match(req); })
    );
    return;
  }
  // HTML / navigation -> network-first
  if(req.mode === 'navigate' || accept.indexOf('text/html') !== -1){
    e.respondWith(
      fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return res;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
      })
    );
    return;
  }
  // statique -> cache-first
  e.respondWith(
    caches.match(req).then(function(r){
      return r || fetch(req).then(function(res){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); });
        return res;
      });
    })
  );
});
