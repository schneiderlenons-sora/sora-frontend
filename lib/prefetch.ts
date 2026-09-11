'use client';

import { preload } from 'swr';
import { api } from './api';
import { chave } from './chaves-swr';

// ─────────────────────────────────────────────────────────────
// Prefetch dos dados das abas — casado com as CHAVES do useApi de cada página.
// Dispara com os params PADRÃO (mês atual, sem filtro), que é o estado inicial
// das páginas → a chave bate e a página reaproveita a requisição já em voo.
//
// ⚠️ AS CHAVES VÊM DE `lib/chaves-swr.ts`, NUNCA ESCRITAS À MÃO AQUI. Enquanto
// cada aba tinha o próprio prefixo, este arquivo pedia a MESMA URL várias vezes
// com nomes diferentes e o SWR não tinha como deduplicar: medido num celular
// emulado, aquecer estas três abas disparava `resumo?mes` 3×, `wallets` 2×,
// `categorias` 2× e `transacoes?limit=500` 2×. Agora o conjunto abaixo tem 4
// requisições distintas no total, e elas servem as três abas de uma vez.
// ─────────────────────────────────────────────────────────────

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const PREFETCHERS: Record<string, (p: string) => void> = {
  '/transacoes': (p) => {
    const m = mesAtual();
    preload(chave.transacoes(p, { mes: m, limit: 500 }), () => api.transacoes.listar(p, { mes: m, limit: 500 }));
    preload(chave.wallets(p), () => api.wallets.listar(p));
    preload(chave.resumo(p, m), () => api.transacoes.resumo(p, m));
  },
  '/relatorios': (p) => {
    const m = mesAtual();
    preload(chave.resumo(p, m), () => api.transacoes.resumo(p, m));
    preload(chave.transacoes(p, { mes: m, limit: 500 }), () => api.transacoes.listar(p, { mes: m, limit: 500 }));
    preload(chave.wallets(p), () => api.wallets.listar(p));
    preload(chave.categorias(p), () => api.categorias.listar(p));
  },
  '/categorias': (p) => {
    const m = mesAtual();
    preload(chave.categorias(p), () => api.categorias.listar(p));
    preload(chave.resumo(p, m), () => api.transacoes.resumo(p, m));
    preload(chave.limites(p, m), () => api.limites.listar(p, m));
  },
  '/contas-bancarias': (p) => {
    preload(chave.wallets(p), () => api.wallets.listar(p));
  },
  '/cartao-de-credito': (p) => {
    preload(chave.wallets(p), () => api.wallets.listar(p));
    preload(chave.faturas(p, 0), () => api.wallets.faturas(p, 0));
  },
  // ⚠️ `/metas` e `/dividas` NÃO entram aqui, ao contrário de toda outra aba.
  // `metas.imagem_url` e `dividas.imagem_url` guardam a FOTO em base64 direto
  // na coluna (até ~150 KB por linha) — nenhuma outra rota prefetchada carrega
  // imagem. Prefetch dispara no HOVER (mouse passando pelo item da sidebar,
  // sem clique nenhum): baixar esse payload por um mero hover foi medido
  // como desperdício real de egress do Supabase. A rota em si continua
  // prefetchada por `router.prefetch()` no Sidebar (código, não dado) — só o
  // conteúdo com imagem espera o clique de verdade.
  '/limites-de-gastos': (p) => {
    const m = mesAtual();
    preload(chave.categorias(p), () => api.categorias.listar(p));
    preload(chave.resumo(p, m), () => api.transacoes.resumo(p, m));
    preload(chave.limites(p, m), () => api.limites.listar(p, m));
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

// ⚠️ AQUECE SÓ O QUE O DASHBOARD JÁ IA BUSCAR DE QUALQUER JEITO.
//
// Antes aquecia `/transacoes`, `/categorias` e `/relatorios` — o que, com as
// chaves unificadas, ainda traria `transacoes?limit=500`: a consulta MAIS PESADA
// do app, de uma aba que a pessoa talvez nem abra, disputando a fila com o
// conteúdo do dashboard. Num celular a fila é o gargalo real: o navegador abre
// 6 conexões por host e o dashboard já enche isso sozinho.
//
// Estas três são baratas, servem VÁRIAS abas por causa da chave compartilhada
// (categorias serve /categorias, /limites-de-gastos e /relatorios; wallets serve
// 5 telas) e o dashboard já as pede — então aqui elas custam ZERO requisição
// extra e só garantem que a aba seguinte abra sem rede.
export function prefetchTopTabs(phone: string) {
  if (!phone) return;
  const m = mesAtual();
  try {
    preload(chave.wallets(phone), () => api.wallets.listar(phone));
    preload(chave.categorias(phone), () => api.categorias.listar(phone));
    preload(chave.resumo(phone, m), () => api.transacoes.resumo(phone, m));
  } catch { /* prefetch é best-effort */ }
}
