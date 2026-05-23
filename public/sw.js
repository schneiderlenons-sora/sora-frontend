// Service Worker mínimo — necessário pro Chrome/Edge habilitarem o prompt de instalação PWA.
// Network-first com fallback em cache pra lidar com offline básico.
// IMPORTANTE: bumpar CACHE quando mudar a estratégia ou se houver suspeita
// de versão obsoleta sendo servida no painel.

const CACHE = 'sora-v3';

self.addEventListener('install', () => {
  // Força essa nova versão a substituir a antiga imediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpa caches antigos e assume controle de todas as abas abertas
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) return;

  // Documentos HTML (navegação) NUNCA são cacheados — sempre da rede.
  // Isso evita servir páginas obsoletas após deploy / hot reload.
  const isHTML =
    event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((c) => c || Response.error()))
    );
    return;
  }

  // Assets estáticos: network-first com cache de fallback
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((c) => c || Response.error()))
  );
});
