'use client';

import type { Cache } from 'swr';

// Cache do SWR persistido em localStorage. Ao abrir/recarregar/reabrir o app, o
// SWR já tem o ÚLTIMO dado em mãos → mostra na hora e revalida em silêncio
// (acaba com a "baleia" de 1-3s ao inicializar). Padrão oficial do SWR,
// adaptado com salvamento também no background (mobile).
const KEY = 'sora-swr-cache-v1';

export function localStorageProvider(): Cache {
  // SSR: sem window → Map em memória (o provider roda de novo no cliente).
  if (typeof window === 'undefined') return new Map() as unknown as Cache;

  let map: Map<string, unknown>;
  try {
    map = new Map(JSON.parse(localStorage.getItem(KEY) || '[]'));
  } catch {
    map = new Map();
  }

  const salvar = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
      // quota estourou / modo privado → ignora (segue só com cache em memória)
    }
  };

  // beforeunload cobre desktop; visibilitychange(hidden) cobre mobile/background
  // (onde beforeunload quase nunca dispara).
  window.addEventListener('beforeunload', salvar);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') salvar();
  });

  return map as unknown as Cache;
}

// Limpa o cache persistido — chamar no LOGOUT: num PC compartilhado, o próximo
// usuário não pode herdar dados financeiros do anterior.
export function limparCacheSWR() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
