const CACHE='motohava-v2';
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icon.png','./icon-512.png'])));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',e=>{if(e.request.method==='GET'&&new URL(e.request.url).origin===self.location.origin)e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});
self.addEventListener('push',e=>{let d={title:'MotoHava',body:'Bugün motosiklet sürüşüne uygun hava var.'};try{d={...d,...e.data.json()}}catch{}e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'./icon.png',badge:'./icon.png',tag:'motohava-morning',data:{url:'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow(e.notification.data?.url||'./'))});
