'use client';

import { preload } from 'swr';
import { api } from './api';

// ─────────────────────────────────────────────────────────────
// Prefetch dos dados das abas — casado com as CHAVES do useApi de cada página.
// Dispara com os params PADRÃO (mês atual, sem filtro), que é o estado inicial
// das páginas → a chave bate e a página reaproveita a requisição já em voo.
// (Se a chave mudar numa página, aqui só vira um request desperdiçado — não
// quebra nada; manter em sincronia.)
// ─────────────────────────────────────────────────────────────

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PREFETCHERS: Record<string, (p: string) => void> = {
  '/transacoes': (p) => {
    const m = mesAtual();
    preload(`tx:list:${p}:${m}`, () => api.transacoes.listar(p, { mes: m, limit: 500 }));
    preload(`tx:wallets:${p}`, () => api.wallets.listar(p));
    preload(`tx:resumo:${p}:${m}`, () => api.transacoes.resumo(p, m));
  },
  '/relatorios': (p) => {
    const m = mesAtual();
    preload(`rel:resumo:${p}:${m}:todos`, () => api.transacoes.resumo(p, m, { criado_por: undefined }));
    preload(`rel:txs:${p}:${m}:todos`, () => api.transacoes.listar(p, { mes: m, limit: 500, criado_por: undefined }));
    preload(`rel:wallets:${p}`, () => api.wallets.listar(p));
    preload(`rel:cats:${p}`, () => api.categorias.listar(p));
  },
  '/categorias': (p) => {
    const m = mesAtual();
    preload(`cat:list:${p}`, () => api.categorias.listar(p));
    preload(`cat:resumo:${p}:${m}`, () => api.transacoes.resumo(p, m));
    preload(`cat:limites:${p}:${m}`, () => api.limites.listar(p, m));
  },
  '/contas-bancarias': (p) => {
    preload(`contas:wallets:${p}`, () => api.wallets.listar(p));
  },
  '/cartao-de-credito': (p) => {
    const m = mesAtual();
    preload(`cart:wallets:${p}`, () => api.wallets.listar(p));
    preload(`cart:txmes:${p}:${m}`, () => api.transacoes.listar(p, { mes: m, limit: 500 }));
  },
  '/metas': (p) => { preload(`metas:${p}`, () => api.metas.listar(p)); },
  '/dividas': (p) => { preload(`dividas:${p}`, () => api.dividas.listar(p)); },
  '/limites-de-gastos': (p) => {
    const m = mesAtual();
    preload(`lim:cats:${p}`, () => api.categorias.listar(p));
    preload(`lim:resumo:${p}:${m}`, () => api.transacoes.resumo(p, m));
    preload(`lim:config:${p}:${m}`, () => api.limites.listar(p, m));
  },
  '/investimentos': (p) => {
    preload(`inv:lista:${p}`, () => api.investimentos.listar(p));
    preload(`inv:patrimonio:${p}`, () => api.investimentos.patrimonio(p));
  },
};

// Prefetch da aba que o usuário está prestes a clicar (chamado no hover/touch).
export function prefetchRota(rota: string, phone: string) {
  if (!phone) return;
  const base = (rota || '').split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  try { PREFETCHERS[base]?.(phone); } catch { /* prefetch é best-effort */ }
}

// Aquece as abas mais usadas no tempo ocioso → 1ª visita já instantânea.
export function prefetchTopTabs(phone: string) {
  ['/transacoes', '/categorias', '/relatorios'].forEach((r) => prefetchRota(r, phone));
}
