// CataractControl Service Worker — Web Push + offline shell
var CACHE = 'cc-v1';

self.addEventListener('install', function(e) {
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(clients.claim());
});

// Push notification received from Supabase Edge Function
self.addEventListener('push', function(e) {
  var data = {};
  try { data = e.data ? e.data.json() : {}; } catch(err) { data = {title:'CataractControl', body: e.data ? e.data.text() : ''}; }
  var title = data.title || 'CataractControl';
  var options = {
    body: data.body || 'Você tem retornos pendentes hoje.',
    icon: '/nse/icon-192.png',
    badge: '/nse/icon-192.png',
    tag: 'cc-retorno',
    renotify: true,
    data: { url: data.url || '/nse/' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var target = (e.notification.data && e.notification.data.url) ? e.notification.data.url : '/nse/';
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url.indexOf('/nse/') !== -1 && 'focus' in list[i]) {
          return list[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
