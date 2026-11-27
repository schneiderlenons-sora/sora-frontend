// =============================================================================
// Transações → "Cartões: Faturas" — o cartão aparece como UMA linha por fatura.
//
// Pedido de cliente (Arisson, nov/2026): ver a aba Transações como o extrato do
// banco — o que saiu das contas e, de cada cartão, só a fatura do mês ("Fatura
// Itaú Platinum · R$ 1.200 · em aberto"), que vira "paga" quando é paga. As
// compras continuam a um toque: a linha abre o detalhe da fatura.
//
// ⚠️ SÓ A TELA MUDA. Nenhum total do painel, dos relatórios ou do WhatsApp é
// tocado — é outra forma de olhar o mês. O valor de cada fatura vem PRONTO do
// servidor (`/wallets/faturas` → `faturaVista`), a mesma fonte da aba Cartões:
// somar as compras aqui criaria um segundo número pro mesmo cartão.
//
// ⚠️ "FATURA DO MÊS" = a que VENCE no mês (`competencia`). É visão de caixa: em
// dezembro aparece a fatura que vence em dezembro, mesmo que as compras sejam
// de novembro. As compras do cartão FEITAS no mês somem da lista (estão na
// fatura em que serão cobradas, a um toque).
//
// ⚠️ PAGAMENTO DA FATURA SÓ SOME QUANDO É RECONHECIDO COM CERTEZA. A Sora grava
// o pagamento feito pelo painel/WhatsApp como "Fatura <nome do cartão>"
// (categoria Fatura). Esse sai da lista e aparece DENTRO da linha da fatura
// ("pago em 05/12 · Itaú"), senão a mesma fatura apareceria duas vezes. O que o
// banco manda ("PAGAMENTO FATURA CARTAO…") não diz de qual cartão é: fica na
// lista como sempre — esconder dinheiro saindo da conta é pior que repetir.
// =============================================================================

import { faturaNaBase } from './moeda';
import { diaDe } from './data-br';

export type StatusLinhaFatura = 'paga' | 'parcial' | 'em_aberto' | 'vence_hoje' | 'atrasada';

export type PagamentoNaLinha = { id: string; data: string; valor: number; conta: string | null };

export type LinhaFatura = {
  chave: string;
  cartaoId: string;
  cartaoNome: string;
  competencia: string;
  /** Vencimento 'YYYY-MM-DD' — é a data em que a linha entra na lista. */
  venc: string;
  /** Total da fatura, na moeda do GRUPO. */
  valor: number;
  pago: number;
  restante: number;
  status: StatusLinhaFatura;
  /** Pagamentos deste cartão feitos NO MÊS que saíram da lista (ver cabeçalho). */
  pagamentos: PagamentoNaLinha[];
};

/** O que a rota devolve por cartão (só os campos usados aqui). */
export type FaturaDaRota = {
  cartao_id: string; nome: string; competencia: string; venc?: string | null;
  fatura?: number; pago?: number; restante?: number; quitada?: boolean;
  moeda?: string | null; taxa_base?: number | null; moeda_base?: string | null;
};

const cent = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;
const POUCO = 0.009;

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function ultimoDiaDoMes(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${mes}-${String(d).padStart(2, '0')}`;
}

function statusDe(venc: string, pago: number, restante: number, quitada: boolean, hoje: string): StatusLinhaFatura {
  if (quitada || restante <= POUCO) return 'paga';
  if (venc < hoje) return 'atrasada';
  if (pago > POUCO) return 'parcial';
  if (venc === hoje) return 'vence_hoje';
  return 'em_aberto';
}

/**
 * As faturas que vencem no `mes`, uma por cartão, já na moeda do grupo.
 * `respostas` = as listas de `/wallets/faturas` de mais de um deslocamento (a
 * fatura "atual" de cada cartão pode vencer neste mês ou no seguinte, então o
 * mês pedido cai em deslocamentos diferentes conforme o cartão).
 *
 * `semCambio`: cartões em outra moeda sem cotação — as compras deles NÃO saem
 * da lista (sumiriam sem nada no lugar).
 */
export function faturasDoMes(p: {
  mes: string; hoje: string; moedaBase?: string | null;
  respostas: (FaturaDaRota[] | null | undefined)[];
}): { linhas: LinhaFatura[]; semCambio: Set<string> } {
  const linhas: LinhaFatura[] = [];
  const semCambio = new Set<string>();
  const vistos = new Set<string>();
  for (const lista of p.respostas) {
    for (const bruta of lista || []) {
      if (!bruta || bruta.competencia !== p.mes || vistos.has(bruta.cartao_id)) continue;
      vistos.add(bruta.cartao_id);
      const f = faturaNaBase(bruta as never, p.moedaBase) as FaturaDaRota | null;
      if (!f) { semCambio.add(bruta.cartao_id); continue; }
      const valor = cent(f.fatura);
      const pago = cent(f.pago);
      const restante = cent(f.restante ?? valor - pago);
      // Fatura zerada não é conta de ninguém: não vira linha.
      if (valor <= POUCO && restante <= POUCO) continue;
      const venc = f.venc && f.venc.slice(0, 7) === p.mes ? f.venc.slice(0, 10) : ultimoDiaDoMes(p.mes);
      linhas.push({
        chave: `fatura:${f.cartao_id}:${f.competencia}`,
        cartaoId: f.cartao_id, cartaoNome: f.nome || 'Cartão', competencia: f.competencia,
        venc, valor, pago, restante: Math.max(0, restante),
        status: statusDe(venc, pago, restante, !!f.quitada, p.hoje),
        pagamentos: [],
      });
    }
  }
  return { linhas, semCambio };
}

/**
 * De qual cartão é este PAGAMENTO de fatura — ou null quando não dá pra
 * afirmar. Só reconhece o texto que a Sora grava ("Fatura <cartão>", inclusive
 * "· Esposa (externo)" e "(anterior)"); com dois cartões de nomes parecidos,
 * vence o nome mais longo ("Itaú Platinum" antes de "Itaú").
 */
export function cartaoDoPagamento(
  t: { tipo?: string; categoria?: string | null; observacao?: string | null; carteira_nome?: string | null; wallet_nome?: string | null },
  cartoes: { id: string; nome: string }[],
  nomesCartao: Set<string>,
): string | null {
  if (t.tipo !== 'Gasto' || norm(t.categoria) !== 'fatura') return null;
  const conta = t.carteira_nome || t.wallet_nome || null;
  if (conta && nomesCartao.has(conta)) return null;      // lado do CARTÃO: já some como compra do cartão
  const obs = norm(t.observacao);
  let melhor: { id: string; tam: number } | null = null;
  for (const c of cartoes) {
    const n = norm(c.nome);
    if (!n) continue;
    if (obs === `fatura ${n}` || obs.startsWith(`fatura ${n} `)) {
      if (!melhor || n.length > melhor.tam) melhor = { id: c.id, tam: n.length };
    }
  }
  return melhor ? melhor.id : null;
}

export type FiltrosLinha = {
  busca?: string;
  tipo?: string;                // 'todos' | 'Gasto' | 'Recebimento'
  status?: string;              // 'todos' | 'pago' | 'pendente'
  categoria?: string;           // 'todas' | nome
  /** 'todas' | 'so_contas' | 'so_cartoes' | nome de uma conta/cartão */
  conta?: string;
  /** Filtro de membro ou de cartão virtual ligado: fatura não é de ninguém. */
  outroFiltro?: boolean;
};

/** A linha da fatura passa pelos mesmos filtros da lista? */
export function linhaPassa(l: LinhaFatura, f: FiltrosLinha): boolean {
  if (f.outroFiltro) return false;
  if (f.tipo && f.tipo !== 'todos' && f.tipo !== 'Gasto') return false;
  if (f.status === 'pago' && l.status !== 'paga') return false;
  if (f.status === 'pendente' && l.status === 'paga') return false;
  if (f.categoria && f.categoria !== 'todas' && norm(f.categoria) !== 'fatura') return false;
  // 'so_contas' e uma conta que não é este cartão caem aqui (fatura é do cartão).
  const conta = f.conta || 'todas';
  if (conta !== 'todas' && conta !== 'so_cartoes' && conta !== l.cartaoNome) return false;
  const q = norm(f.busca);
  if (q && !norm(`fatura ${l.cartaoNome}`).includes(q)) return false;
  return true;
}

export type ItemLista<T> = { tipo: 'tx'; tx: T } | { tipo: 'fatura'; linha: LinhaFatura };

/**
 * Monta a lista da tela: tira as compras do cartão (menos as de cartão sem
 * câmbio), tira os pagamentos reconhecidos de cartão que TEM linha (e os põe
 * dentro dela) e intercala as linhas pela data, mais recente primeiro.
 * As transações chegam já ordenadas (mais recente primeiro) e a ordem delas é
 * mantida.
 */
export function montarListaComFaturas<T extends {
  id: string; data?: string | null; tipo?: string; categoria?: string | null; valor?: number;
  observacao?: string | null; carteira_nome?: string | null; wallet_nome?: string | null;
}>(p: {
  txs: T[];
  linhas: LinhaFatura[];
  cartoes: { id: string; nome: string }[];
  semCambio?: Set<string>;
}): { itens: ItemLista<T>[]; txs: T[]; linhas: LinhaFatura[] } {
  const nomesCartao = new Set(p.cartoes.map((c) => c.nome));
  const nomeSemCambio = new Set(p.cartoes.filter((c) => p.semCambio?.has(c.id)).map((c) => c.nome));
  const porCartao = new Map(p.linhas.map((l) => [l.cartaoId, { ...l, pagamentos: [] as PagamentoNaLinha[] }]));

  const txs: T[] = [];
  for (const t of p.txs) {
    const conta = t.carteira_nome || t.wallet_nome || null;
    if (conta && nomesCartao.has(conta) && !nomeSemCambio.has(conta)) continue;   // compra do cartão
    const cartaoId = cartaoDoPagamento(t, p.cartoes, nomesCartao);
    const linha = cartaoId ? porCartao.get(cartaoId) : undefined;
    if (linha) {
      linha.pagamentos.push({ id: t.id, data: diaDe(t.data), valor: cent(t.valor), conta });
      continue;
    }
    txs.push(t);
  }

  const linhas = [...porCartao.values()]
    .map((l) => ({ ...l, pagamentos: l.pagamentos.sort((a, b) => a.data.localeCompare(b.data)) }))
    .sort((a, b) => b.venc.localeCompare(a.venc) || a.cartaoNome.localeCompare(b.cartaoNome, 'pt-BR'));

  const itens: ItemLista<T>[] = [];
  let i = 0;
  for (const t of txs) {
    const dia = diaDe(t.data);
    while (i < linhas.length && linhas[i].venc >= dia) itens.push({ tipo: 'fatura', linha: linhas[i++] });
    itens.push({ tipo: 'tx', tx: t });
  }
  while (i < linhas.length) itens.push({ tipo: 'fatura', linha: linhas[i++] });
  return { itens, txs, linhas };
}

/** Soma das faturas da lista e o que delas ainda está em aberto. */
export function totaisDasFaturas(linhas: LinhaFatura[]): { valor: number; aPagar: number; abertas: number } {
  let valor = 0, aPagar = 0, abertas = 0;
  for (const l of linhas) {
    valor += l.valor;
    if (l.status !== 'paga') { aPagar += l.restante; abertas++; }
  }
  return { valor: cent(valor), aPagar: cent(aPagar), abertas };
}

/** Deslocamentos de `/wallets/faturas` que contêm a fatura que vence em `mes`. */
export function deslocamentosDoMes(ymHoje: string, mes: string): [number, number] {
  const [ya, ma] = ymHoje.split('-').map(Number);
  const [yb, mb] = mes.split('-').map(Number);
  const d = (yb * 12 + mb) - (ya * 12 + ma);
  return [d - 1, d];
}
