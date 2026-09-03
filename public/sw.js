// Service Worker mínimo — necessário pro Chrome/Edge habilitarem o prompt de instalação PWA.
// IMPORTANTE: bumpar CACHE quando mudar a estratégia ou se houver suspeita
// de versão obsoleta sendo servida no painel.

const CACHE = 'sora-v8';
const OFFLINE = '/offline.html';

self.addEventListener('install', (event) => {
  // A página de offline é pré-cacheada: quando ela for necessária, por
  // definição não haverá rede pra buscá-la.
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE)).catch(() => {})
  );
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

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // ── NAVEGAÇÃO (HTML) ──────────────────────────────────────────────────────
  //
  // ⚠️ AQUI MORAVA UM BUG QUE DERRUBAVA O PWA INTEIRO, e é por isso que o
  // tratamento é tão específico.
  //
  // Antes o SW simplesmente NÃO interceptava navegação, porque interceptar
  // causava "This page couldn't load". A causa é sutil: requisição de navegação
  // tem `redirect: 'manual'`, e devolver por `respondWith` uma resposta que
  // VEIO DE REDIRECT (`res.redirected === true`) é um erro do protocolo — o
  // navegador recusa a resposta e mostra a tela de falha. E a Sora redireciona
  // bastante: apex → www, `/` → `/dashboard`, o middleware de locale, os guards
  // de auth. Ou seja, o caso comum caía justo na armadilha.
  //
  // A correção é reconstruir a resposta sem a marca de redirect. O corpo, o
  // status e os headers são os mesmos — só o sinalizador que o navegador recusa
  // deixa de existir.
  //
  // Com isso dá pra ter o que faltava: quando a rede FALHA de verdade (avião,
  // túnel, sem sinal), em vez da tela de erro do Chrome aparece a página de
  // offline da Sora. É também o que um revisor da Play Store testa.
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request);
        if (res.redirected) {
          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          });
        }
        return res;
      } catch {
        // Só chega aqui quando NÃO houve resposta nenhuma — falha de rede real.
        // Erro do servidor (500, 404) não cai aqui: aquilo é resposta, e a
        // página de offline mentiria sobre o que aconteceu.
        const off = await caches.match(OFFLINE);
        return off || Response.error();
      }
    })());
    return;
  }

  // ── ASSETS ────────────────────────────────────────────────────────────────
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
