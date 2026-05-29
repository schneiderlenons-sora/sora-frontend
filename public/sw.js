// Service Worker mínimo — necessário pro Chrome/Edge habilitarem o prompt de instalação PWA.
// IMPORTANTE: bumpar CACHE quando mudar a estratégia ou se houver suspeita
// de versão obsoleta sendo servida no painel.

const CACHE = 'sora-v6';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
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

  // NÃO intercepta navegações (HTML). Deixa o navegador lidar nativamente.
  // Isso evita quebrar redirects (ex: apex → www) que, interceptados pelo
  // SW, causavam a tela "This page couldn't load" no PWA.
  if (event.request.mode === 'navigate') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Só assets estáticos same-origin: network-first com cache de fallback.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
