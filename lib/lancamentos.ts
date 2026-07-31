// =============================================================================
// Catálogo do LIVRO CAIXA do negócio (fase 2).
//
// No banco `categoria` é texto livre — este catálogo vive aqui de propósito:
// criar/renomear categoria não exige migration. Ícones são nomes do Lucide
// (resolvidos na tela), nunca emoji como ícone estrutural.
// =============================================================================

export type TipoLancamento = 'entrada' | 'saida';
export type StatusLancamento = 'pago' | 'pendente';

export interface Lancamento {
  id:              string;
  empresa_id:      string;
  tipo:            TipoLancamento;
  categoria?:      string | null;
  descricao:       string;
  valor:           number;          // CENTAVOS
  data:            string;          // YYYY-MM-DD
  status:          StatusLancamento;
  vencimento?:     string | null;
  pago_em?:        string | null;
  forma_pagamento?: string | null;
  contraparte?:    string | null;
  conta_id?:       string | null;   // conta do negócio (caixa) — migration 095
  recorrente?:     boolean;
  recorrencia?:    string | null;
  observacao?:     string | null;
  created_at?:     string;
}

// Conta do negócio (caixa nomeada) — migration 095.
export type TipoContaNegocio = 'dinheiro' | 'banco' | 'cartao' | 'outro';
export interface ContaNegocio {
  id:            string;
  empresa_id:    string;
  nome:          string;
  tipo:          TipoContaNegocio;
  saldo_inicial: number;            // CENTAVOS
  cor?:          string | null;
  ativa?:        boolean;
}

// ── Operação: clientes, produtos e vendas (migration 106) ──────────────────
// ⚠️ Dinheiro sempre em CENTAVOS, como no resto do painel.

export interface ClienteNegocio {
  id:         string;
  empresa_id: string;
  nome:       string;
  telefone?:  string | null;   // só dígitos — é por aqui que a Sora cobra
  email?:     string | null;
  documento?: string | null;
  endereco?:  string | null;
  observacao?: string | null;
  ativo?:     boolean;
}

/** Ficha do cliente: cadastro + quanto ele já rendeu. */
export interface ClienteFicha extends ClienteNegocio {
  resumo: {
    compras:      number;
    total_gasto:  number;
    lucro_gerado: number;
    ticket_medio: number;
    ultima_compra: string | null;
    em_aberto:    number;
  };
  vendas: { id: string; data: string; total: number; custo_total: number; status: string; forma_pagamento?: string | null }[];
}

export interface ProdutoNegocio {
  id:            string;
  empresa_id:    string;
  nome:          string;
  sku?:          string | null;
  codigo_barras?: string | null;
  categoria?:    string | null;
  preco:         number;        // CENTAVOS
  custo:         number;        // CENTAVOS
  unidade?:      string | null; // un, kg, h…
  eh_servico?:   boolean;       // serviço não tem estoque
  estoque_min?:  number | null;
  foto_url?:     string | null;
  ativo?:        boolean;
}

export interface ItemVenda {
  id?:         string;
  produto_id?: string | null;
  nome:        string;          // CONGELADO no momento da venda
  quantidade:  number;
  preco_unit:  number;          // CENTAVOS, congelado
  custo_unit:  number;          // CENTAVOS, congelado
  subtotal:    number;          // CENTAVOS
}

export interface VendaNegocio {
  id:           string;
  empresa_id:   string;
  cliente_id?:  string | null;
  cliente_nome?: string | null;
  data:         string;         // YYYY-MM-DD
  total:        number;
  desconto:     number;
  custo_total:  number;
  forma_pagamento?: string | null;
  status:       'pago' | 'pendente' | 'cancelada';
  vencimento?:  string | null;
  observacao?:  string | null;
  vendedor_id?: string | null;
  conta_id?:    string | null;
  lancamento_id?: string | null;
  itens?:       ItemVenda[];
  cliente?:     { id: string; nome: string; telefone?: string | null } | null;
}

/** Margem do produto em % (0 quando não dá pra calcular). */
export function margemProduto(p: Pick<ProdutoNegocio, 'preco' | 'custo'>): number {
  if (!p.preco) return 0;
  return Math.round(((p.preco - p.custo) / p.preco) * 1000) / 10;
}

/** Lucro da venda = total (já com desconto) − custo congelado dos itens. */
export function lucroVenda(v: Pick<VendaNegocio, 'total' | 'custo_total'>): number {
  return (v.total || 0) - (v.custo_total || 0);
}

/** Centro de custo (migration 105) — "qual parte do negócio consumiu isto". */
export interface CentroCusto {
  id:         string;
  empresa_id: string;
  nome:       string;
  cor?:       string | null;
  ativo?:     boolean;
}

/**
 * Painel da loja física — resposta de `GET /negocios/indicadores`.
 * ⚠️ Todo valor em CENTAVOS; percentual já vem em base 100 (12.5 = 12,5%).
 */
export interface IndicadoresNegocio {
  mes:              string;         // YYYY-MM
  receita:          number;
  despesa:          number;
  lucro:            number;
  margem:           number;         // %
  ticket_medio:     number;
  vendas_qtd:       number;
  lancamentos_qtd:  number;
  comparativo: {
    receita: number; despesa: number; lucro: number;   // variação % vs mês anterior
    anterior: { receita: number; despesa: number; lucro: number; margem: number };
  };
  a_receber:    PendenteNegocio;
  a_pagar:      PendenteNegocio;
  saldo_contas: number;
  contas:       { id: string; nome: string; tipo: string; saldo: number }[];
  evolucao:     { mes: string; receita: number; despesa: number; lucro: number }[];
  por_dia:      { dia: string; entrada: number; saida: number }[];
  por_categoria:{ categoria: string; valor: number }[];
  por_forma:    { forma: string; valor: number }[];
}

export interface PendenteNegocio {
  total:       number;
  qtd:         number;
  vencido:     number;
  vencido_qtd: number;
  proximos:    { descricao: string; valor: number; vencimento: string; vencido: boolean }[];
}

export const CATEGORIAS_ENTRADA = [
  { v: 'vendas',    label: 'Vendas',          icone: 'ShoppingBag' },
  { v: 'servicos',  label: 'Serviços',        icone: 'Wrench' },
  { v: 'outros',    label: 'Outras receitas', icone: 'Plus' },
];

export const CATEGORIAS_SAIDA = [
  { v: 'fornecedor', label: 'Fornecedor',   icone: 'Truck' },
  { v: 'aluguel',    label: 'Aluguel',      icone: 'Home' },
  { v: 'energia',    label: 'Luz / Água',   icone: 'Zap' },
  { v: 'internet',   label: 'Internet',     icone: 'Wifi' },
  { v: 'folha',      label: 'Funcionários', icone: 'Users' },
  { v: 'impostos',   label: 'Impostos',     icone: 'Landmark' },
  { v: 'manutencao', label: 'Manutenção',   icone: 'Wrench' },
  { v: 'marketing',  label: 'Marketing',    icone: 'Megaphone' },
  { v: 'transporte', label: 'Transporte',   icone: 'Car' },
  { v: 'outros',     label: 'Outros',       icone: 'Package' },
];

export const FORMAS_PAGAMENTO = [
  { v: 'dinheiro',      label: 'Dinheiro' },
  { v: 'pix',           label: 'Pix' },
  { v: 'debito',        label: 'Débito' },
  { v: 'credito',       label: 'Crédito' },
  { v: 'boleto',        label: 'Boleto' },
  { v: 'transferencia', label: 'Transferência' },
];

export const categoriasDe = (tipo: TipoLancamento) =>
  tipo === 'entrada' ? CATEGORIAS_ENTRADA : CATEGORIAS_SAIDA;

export function labelCategoria(tipo: TipoLancamento, v?: string | null): string {
  if (!v) return 'Sem categoria';
  return categoriasDe(tipo).find(c => c.v === v)?.label || v;
}

export function labelForma(v?: string | null): string {
  if (!v) return '';
  return FORMAS_PAGAMENTO.find(f => f.v === v)?.label || v;
}

/** Centavos → "R$ 1.234,56" (a UI usa tabular-nums pra não pular). */
export const fmtCent = (c: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((c || 0) / 100);

/** Totais de um conjunto de lançamentos. Pendentes NÃO entram no caixa
 *  realizado — só contam quando pagos (senão o saldo do dia mente). */
export function totais(lancs: Lancamento[]) {
  let entradas = 0, saidas = 0, aPagar = 0;
  for (const l of lancs) {
    if (l.status === 'pendente') {
      if (l.tipo === 'saida') aPagar += l.valor;
      continue;
    }
    if (l.tipo === 'entrada') entradas += l.valor;
    else saidas += l.valor;
  }
  return { entradas, saidas, saldo: entradas - saidas, aPagar };
}

/** Saldo realizado por conta do negócio: saldo_inicial + entradas pagas −
 *  saídas pagas (pendente NÃO conta, igual ao caixa). Retorna, por conta, o
 *  saldo e os totais; inclui uma linha virtual "sem conta" pros lançamentos
 *  antigos/sem conta_id que tenham movimento. */
export function saldoPorConta(lancs: Lancamento[], contas: ContaNegocio[]) {
  const acc = new Map<string, { entradas: number; saidas: number }>();
  const bump = (id: string, l: Lancamento) => {
    const a = acc.get(id) || { entradas: 0, saidas: 0 };
    if (l.tipo === 'entrada') a.entradas += l.valor; else a.saidas += l.valor;
    acc.set(id, a);
  };
  for (const l of lancs) {
    if (l.status !== 'pago') continue;          // só realizado
    bump(l.conta_id || '__sem__', l);
  }
  const linhas = contas.map(c => {
    const a = acc.get(c.id) || { entradas: 0, saidas: 0 };
    return { conta: c, saldo: (c.saldo_inicial || 0) + a.entradas - a.saidas, ...a };
  });
  // "Sem conta" só aparece se houver movimento órfão (não polui quem já organizou).
  const orfao = acc.get('__sem__');
  if (orfao && (orfao.entradas || orfao.saidas)) {
    linhas.push({ conta: null as unknown as ContaNegocio, saldo: orfao.entradas - orfao.saidas, ...orfao });
  }
  return linhas;
}

/** Agrupa por dia (YYYY-MM-DD) preservando a ordem recebida. */
export function porDia(lancs: Lancamento[]): { dia: string; itens: Lancamento[] }[] {
  const mapa = new Map<string, Lancamento[]>();
  for (const l of lancs) {
    if (!mapa.has(l.data)) mapa.set(l.data, []);
    mapa.get(l.data)!.push(l);
  }
  return Array.from(mapa, ([dia, itens]) => ({ dia, itens }));
}
