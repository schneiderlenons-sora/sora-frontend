'use client';

import type { Cache, ScopedMutator } from 'swr';
import { api } from './api';
import { chave } from './chaves-swr';

// ─────────────────────────────────────────────────────────────
// ⚠️ NÃO USA MAIS O `preload` DO SWR (nov/2026) — ele DEVOLVIA DADO VELHO.
//
// O `preload` guarda a requisição numa tabela do cache PADRÃO do SWR, e é
// dali que o SWR a reaproveita na próxima busca da chave. Só que o app usa
// OUTRO cache (`localStorageProvider`), e o `mutate()` que as telas chamam
// depois de uma ação limpa a tabela do cache DO APP — nunca a do padrão. Então
// a promessa pré-carregada (de antes da ação) ficava lá, e a PRIMEIRA
// revalidação depois dela recebia o dado velho sem ir ao servidor.
//
// Achado no teste de ponta a ponta dos Previstos: marcar uma conta como paga
// descontava a conta no servidor e a tela seguia com o saldo antigo — nenhuma
// requisição de `wallets` saía. Valia pra toda chave pré-carregada (saldo,
// resumo do mês, categorias, lista de lançamentos no hover da barra).
//
// Agora o aquecimento GRAVA no cache do app, e só se ele ainda não tiver o
// dado — inclusive no momento em que a resposta chega: uma resposta antiga
// nunca sobrescreve uma mais nova que a própria tela já buscou.
// ─────────────────────────────────────────────────────────────
export type CacheSWR = { cache: Cache; mutate: ScopedMutator };

const emVoo = new Set<string>();
function aquecer(cfg: CacheSWR, key: string, buscar: () => Promise<unknown>) {
  if (!cfg?.cache || emVoo.has(key)) return;
  const atual = cfg.cache.get(key);
  // Já tem dado, ou a própria TELA já está buscando esta chave (o SWR marca a
  // busca em andamento no cache): pedir de novo seria requisição em dobro —
  // foi o caso da rota de faturas (~4 s), pedida pelo dashboard E aqui.
  if (atual?.data !== undefined || atual?.isValidating) return;
  emVoo.add(key);
  buscar()
    .then((data) => {
      const agora = cfg.cache.get(key);
      // A tela buscou (ou está buscando) enquanto isto estava no ar: o dado
      // dela é o que vale — não grava nada por cima.
      if (agora?.data !== undefined || agora?.isValidating) return;
      // ⚠️ GRAVA O ESTADO COMPLETO, NÃO SÓ O DADO (nov/2026). O `mutate` grava
      // só `{ data, error }`; numa chave nova o campo `isLoading` fica AUSENTE,
      // e o SWR, ao montar uma tela que vai revalidar, monta o estado como
      // `{ isLoading: true, ...cache }` — ausente vira TRUE. Resultado medido:
      // a tela abria com o dado pré-carregado na mão e a baleia cobria tudo
      // durante a revalidação inteira (Cartões 1,8 s, Previstos 1,3 s,
      // Relatórios 1,2 s). Com `isLoading: false` gravado, a chave se comporta
      // como uma que o próprio SWR buscou: abre com o dado e revalida calada.
      cfg.cache.set(key, { ...(agora || {}), isLoading: false, isValidating: false });
      cfg.mutate(key, data, { revalidate: false });
    })
    .catch(() => { /* aquecimento é best-effort */ })
    .finally(() => { emVoo.delete(key); });
}
// Exportada só pro eval (lib/prefetch.eval.mjs).
export const aquecerChave = aquecer;

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

const PREFETCHERS: Record<string, (p: string, c: CacheSWR) => void> = {
  '/transacoes': (p, c) => {
    const m = mesAtual();
    aquecer(c, chave.transacoes(p, { mes: m, limit: 500 }), () => api.transacoes.listar(p, { mes: m, limit: 500 }));
    aquecer(c, chave.wallets(p), () => api.wallets.listar(p));
    aquecer(c, chave.resumo(p, m), () => api.transacoes.resumo(p, m));
  },
  '/relatorios': (p, c) => {
    const m = mesAtual();
    aquecer(c, chave.resumo(p, m), () => api.transacoes.resumo(p, m));
    aquecer(c, chave.transacoes(p, { mes: m, limit: 500 }), () => api.transacoes.listar(p, { mes: m, limit: 500 }));
    aquecer(c, chave.wallets(p), () => api.wallets.listar(p));
    aquecer(c, chave.categorias(p), () => api.categorias.listar(p));
  },
  '/categorias': (p, c) => {
    const m = mesAtual();
    aquecer(c, chave.categorias(p), () => api.categorias.listar(p));
    aquecer(c, chave.resumo(p, m), () => api.transacoes.resumo(p, m));
    aquecer(c, chave.limites(p, m), () => api.limites.listar(p, m));
  },
  '/contas-bancarias': (p, c) => {
    aquecer(c, chave.wallets(p), () => api.wallets.listar(p));
  },
  '/cartao-de-credito': (p, c) => {
    aquecer(c, chave.wallets(p), () => api.wallets.listar(p));
    aquecer(c, chave.faturas(p, 0), () => api.wallets.faturas(p, 0));
  },
  // ⚠️ `/metas` e `/dividas` NÃO entram aqui, ao contrário de toda outra aba.
  // `metas.imagem_url` e `dividas.imagem_url` guardam a FOTO em base64 direto
  // na coluna (até ~150 KB por linha) — nenhuma outra rota prefetchada carrega
  // imagem. Prefetch dispara no HOVER (mouse passando pelo item da sidebar,
  // sem clique nenhum): baixar esse payload por um mero hover foi medido
  // como desperdício real de egress do Supabase. A rota em si continua
  // prefetchada por `router.prefetch()` no Sidebar (código, não dado) — só o
  // conteúdo com imagem espera o clique de verdade.
  '/limites-de-gastos': (p, c) => {
    const m = mesAtual();
    aquecer(c, chave.categorias(p), () => api.categorias.listar(p));
    aquecer(c, chave.resumo(p, m), () => api.transacoes.resumo(p, m));
    aquecer(c, chave.limites(p, m), () => api.limites.listar(p, m));
  },
  '/investimentos': (p, c) => {
    aquecer(c, `inv:lista:${p}`, () => api.investimentos.listar(p));
    aquecer(c, `inv:patrimonio:${p}`, () => api.investimentos.patrimonio(p));
  },
};

// Prefetch da aba que o usuário está prestes a clicar (chamado no hover/touch).
export function prefetchRota(rota: string, phone: string, c: CacheSWR) {
  if (!phone) return;
  const base = (rota || '').split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  try { PREFETCHERS[base]?.(phone, c); } catch { /* prefetch é best-effort */ }
}

// ─────────────────────────────────────────────────────────────
// AQUECIMENTO DAS ABAS NO OCIOSO (nov/2026) — pra a 1ª visita não mostrar a
// baleia.
//
// Medido em produção (conta no plano grátis, celular): a baleia cobria a tela
// por 0,8–1,6 s na 1ª visita a Cartões, Previstos e Relatórios, porque as
// chamadas abaixo NÃO vêm prontas do servidor (o SSR dessas abas não as traz)
// e o `useApi` segura a tela até a 1ª resposta. No celular não existe hover,
// então `prefetchRota` nunca rodava pra elas.
//
// Aqui entram SÓ as chaves que a tela pede ao abrir SEM dado do servidor — as
// que já vêm no SSR não precisam (e buscá-las de novo seria leitura em dobro).
// Grow fica de fora (decisão do dono).
//
// ⚠️ AS CHAVES TÊM DE SER IDÊNTICAS ÀS DA TELA no estado inicial (mês atual,
// aba padrão, sem filtro de membro). Chave diferente = aquecimento inútil.
// Conferido contra: PrevistosClient (aba "projecao", offset 0), RelatoriosClient
// (tab "graficos", mês/ano locais), CartaoClient e InvestimentosClient.
//
// ⚠️ DÍVIDAS VÊM COM FOTO (select '*', foto em base64 na linha). A exclusão de
// `/metas` e `/dividas` acima é do HOVER, que se repete a cada passada do
// mouse. Aqui é UMA vez por aparelho: `aquecer` não busca o que já está no
// cache, e o cache fica salvo no aparelho. Medido em 17/11/2026: 22 de 426
// dívidas têm foto, em 5 grupos; o pior soma 1,3 MB. Previstos não abre sem
// elas (a baleia ficaria), então entram.
// ─────────────────────────────────────────────────────────────
export type ItemAquecimento = { key: string; buscar: () => Promise<unknown> };

/** Lista PURA do que aquecer — separada do agendamento pra ser testada. */
export function itensDoAquecimento(
  p: string,
  opts: { investimentos?: boolean; agora?: Date } = {},
): ItemAquecimento[] {
  const agora = opts.agora || new Date();
  // Relatórios usa mês/ano LOCAIS (`new Date().getMonth()`).
  const mesLocal = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const anoLocal = agora.getFullYear();
  // Previstos usa o mês de SÃO PAULO (`ymHojeSP`).
  const ymSP = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
  const [anoSP, mesSP] = ymSP.split('-').map(Number);
  const PERIODO_PADRAO_PREVISTOS = 6; // `useState<number>(6)` em PrevistosClient

  const itens: ItemAquecimento[] = [
    // Relatórios (barra de baixo) — o resto da aba vem do SSR.
    { key: chave.anual(p, anoLocal), buscar: () => api.transacoes.anual(p, anoLocal) },
    { key: chave.limites(p, mesLocal), buscar: () => api.limites.listar(p, mesLocal) },
    // Cartões — as faturas não vêm no SSR.
    { key: chave.faturas(p, 0), buscar: () => api.wallets.faturas(p, 0) },
    { key: chave.faturas(p, 1), buscar: () => api.wallets.faturas(p, 1) },
    // Previstos — a aba inteira é só cliente.
    { key: chave.recorrencias(p), buscar: () => api.recorrencias.listar(p) },
    { key: chave.dividas(p), buscar: () => api.dividas.listar(p) },
    { key: chave.wallets(p), buscar: () => api.wallets.listar(p) },
    { key: chave.resumo(p, ymSP), buscar: () => api.transacoes.resumo(p, ymSP) },
    { key: chave.anual(p, anoSP), buscar: () => api.transacoes.anual(p, anoSP) },
    { key: chave.transacoes(p, { mes: ymSP, limit: 500 }), buscar: () => api.transacoes.listar(p, { mes: ymSP, limit: 500 }) },
  ];
  // Previstos também pede o ano ANTERIOR quando o período padrão passa da
  // virada (de janeiro a maio).
  if (PERIODO_PADRAO_PREVISTOS > mesSP) {
    itens.push({ key: chave.anual(p, anoSP - 1), buscar: () => api.transacoes.anual(p, anoSP - 1) });
  }
  // Investimentos é do plano — sem acesso, a rota responde 403 e seria gasto.
  if (opts.investimentos) {
    itens.push({ key: `inv:movimentos:${p}`, buscar: () => api.investimentos.movimentos(p) });
  }
  // Sem repetir chave (ano local e de SP quase sempre coincidem).
  const vistas = new Set<string>();
  return itens.filter((i) => (vistas.has(i.key) ? false : (vistas.add(i.key), true)));
}

/**
 * Aquece as abas em LOTES PEQUENOS e espaçados — a mesma lição do aquecimento
 * de rotas no Sidebar: disparar tudo de uma vez enfileira atrás das 6 conexões
 * do navegador e atrasa justamente o que a pessoa está vendo. O backend
 * (Render, plano gratuito) também sente rajadas. Devolve o cancelador.
 */
export function aquecerAbasNoOcioso(
  phone: string,
  c: CacheSWR,
  opts: { investimentos?: boolean; esperaMs?: number; lote?: number; intervaloMs?: number } = {},
): () => void {
  if (!phone) return () => {};
  const itens = itensDoAquecimento(phone, { investimentos: opts.investimentos });
  const LOTE = opts.lote ?? 2;
  const INTERVALO = opts.intervaloMs ?? 600;
  const ESPERA = opts.esperaMs ?? 2500;
  const timers: number[] = [];
  let cancelado = false;
  for (let i = 0; i < itens.length; i += LOTE) {
    const fatia = itens.slice(i, i + LOTE);
    timers.push(window.setTimeout(() => {
      if (cancelado) return;
      try { fatia.forEach((it) => aquecer(c, it.key, it.buscar)); } catch { /* best-effort */ }
    }, ESPERA + (i / LOTE) * INTERVALO));
  }
  return () => { cancelado = true; timers.forEach((t) => clearTimeout(t)); };
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
export function prefetchTopTabs(phone: string, c: CacheSWR) {
  if (!phone) return;
  const m = mesAtual();
  try {
    aquecer(c, chave.wallets(phone), () => api.wallets.listar(phone));
    aquecer(c, chave.categorias(phone), () => api.categorias.listar(phone));
    aquecer(c, chave.resumo(phone, m), () => api.transacoes.resumo(phone, m));
  } catch { /* prefetch é best-effort */ }
}
