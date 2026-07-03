/* Service worker — cache hors-ligne.
   Stratégie : network-first sur le HTML et les JSON (pour voir les nouveaux menus en ligne),
   cache-first sur les fichiers statiques (icônes, manifeste). */
const CACHE = 'menu-v6';   // <-- incrémente ce numéro si besoin de purger le cache
const ASSETS = [
  './', './index.html', './logic.js', './manifest.webmanifest',
  './recipes.json', './menus.json',
  './icon-192.png', './icon-512.png', './icon-maskable-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); }));
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
