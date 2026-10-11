// Service worker mínimo: permite instalar a app no ecrã inicial. Não guarda nada em cache
// (os dados vêm sempre frescos da rede), por isso nunca mostra uma versão antiga.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
