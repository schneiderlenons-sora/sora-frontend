// Service Worker mínimo — necessário pro Chrome/Edge habilitarem o prompt de instalação PWA.
// Versão simples: network-first com fallback em cache pra lidar com offline básico.

const CACHE = 'sora-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Só faz cache de requests GET, não de API/POST
  if (event.request.method !== 'GET') return;

  // Network-first: tenta rede, cacheia resposta; offline -> cache
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        // Cacheia apenas same-origin (não cacheia Supabase/Render etc.)
        const isSameOrigin = new URL(event.request.url).origin === self.location.origin;
        if (isSameOrigin && res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((c) => c || Response.error()))
  );
});
