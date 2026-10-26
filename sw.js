// NW28 Absensi: service worker sederhana.
// Halaman selalu diambil dari internet dulu (supaya update langsung masuk);
// salinan terakhir hanya dipakai kalau sedang tidak ada sinyal. Data (Supabase) tidak pernah di-cache.
const C='nw28-shell-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(['./','icon-192.png'])).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  e.respondWith(fetch(r).then(res=>{if(res.ok&&r.mode==='navigate'){const cp=res.clone();caches.open(C).then(c=>c.put('./',cp))}return res})
    .catch(()=>caches.match(r.mode==='navigate'?'./':r).then(m=>m||Response.error())));
});
