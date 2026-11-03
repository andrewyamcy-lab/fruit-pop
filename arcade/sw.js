const CACHE_NAME="friend-arcade-v6-da-siu-yan";
const FILES=["./","./index.html","./app.js","./cloud.js","./firebase-config.js","./manifest.webmanifest","./icon-192.png","./aquarium/","./aquarium/index.html","./aquarium/app.js","./gatherings/","./gatherings/index.html","./gatherings/core.js","./gatherings/app.js","./da-siu-yan/","./da-siu-yan/index.html","./da-siu-yan/app.js","../balls/ball1.png","../balls/ball2.png","../balls/ball3.png","../balls/ball4.png","../balls/ball5.png","../balls/ball6.png","../balls/ball7.png"];
const OWN=new Set(FILES.map(x=>new URL(x,self.registration.scope).pathname));
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("friend-arcade-")&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!OWN.has(url.pathname))return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(c=>c.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match(event.request).then(r=>r||caches.match("./index.html"))));
});
