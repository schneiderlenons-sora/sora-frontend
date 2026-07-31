// =============================================================================
// Tipos e leitura do DRE gerencial.
//
// A matemática NÃO mora aqui — ela é do backend (services/dre.js, com eval).
// Este arquivo só descreve o formato e monta a cascata para a tela, para que
// mudar a ordem das linhas não vire "editar quatro lugares".
// =============================================================================

export type DespesaCategoria = {
  categoria: string;
  valor: number;
  natureza: 'fixa' | 'variavel';
};

export type DreGerencial = {
  periodo: string;                 // 'YYYY-MM-01'
  em_curso: boolean;               // mês ainda rolando → número vivo
  receita_bruta: number;
  taxas_plataforma: number;
  taxas_gateway: number;
  reembolsos: number;
  chargebacks: number;
  comissoes_afiliado: number;
  impostos: number;
  receita_liquida: number;
  cmv: number;
  lucro_bruto: number;
  margem_bruta_pct: number;
  despesas_fixas: number;
  despesas_variaveis: number;
  custos_total: number;
  custos_por_categoria: Record<string, number>;
  despesas_por_categoria?: DespesaCategoria[];
  compras_estoque: number;
  resultado_operacional: number;
  lucro_liquido: number;
  margem_pct: number;
  margem_contribuicao: number;
  margem_contribuicao_pct?: number;
  ponto_equilibrio: number | null;
  falta_para_empatar?: number | null;
  total_vendas: number;
  ticket_medio: number;
  mrr: number;
  por_plataforma: { plataforma: string; valor: number; vendas: number }[];
  por_produto:    { nome: string; valor: number; vendas: number }[];
  anterior: Partial<DreGerencial> | null;
  historico: { periodo: string; receita_bruta: number; lucro_liquido: number; custos_total: number }[];
};

export type LinhaDre = {
  key: string;
  label: string;
  valor: number;
  /** total = linha de resultado (fundo destacado); deducao = subtrai */
  tipo: 'total' | 'deducao' | 'resultado';
  /** explica a linha para quem nunca leu um DRE — é a diferença entre um
   *  relatório e um relatório que ensina */
  ajuda?: string;
  detalhe?: { label: string; valor: number; meta?: string }[];
};

const LABEL_CATEGORIA: Record<string, string> = {
  aluguel: 'Aluguel', energia: 'Luz / Água', internet: 'Internet',
  folha: 'Funcionários', impostos: 'Impostos', manutencao: 'Manutenção',
  marketing: 'Marketing', transporte: 'Transporte', fornecedor: 'Fornecedor',
  outros: 'Outros',
  trafego_pago: 'Tráfego pago', ferramentas: 'Ferramentas', equipe: 'Equipe',
  assinaturas: 'Assinaturas', mentoria: 'Mentoria', infra: 'Infraestrutura',
  operacional: 'Operacional',
};
export const labelCat = (c: string) => LABEL_CATEGORIA[c] || c;

/** Monta a cascata na ordem contábil, escondendo o que é zero — linha zerada
 *  em DRE de loja física (taxa de gateway, chargeback) só faz ruído. */
export function cascata(d: DreGerencial): LinhaDre[] {
  const deducoes = [
    { key: 'taxa_plat', label: 'Taxas de plataforma', valor: d.taxas_plataforma },
    { key: 'taxa_gw',   label: 'Taxas de gateway',    valor: d.taxas_gateway },
    { key: 'refund',    label: 'Reembolsos',          valor: d.reembolsos },
    { key: 'cb',        label: 'Chargebacks',         valor: d.chargebacks },
    { key: 'comissao',  label: 'Comissões',           valor: d.comissoes_afiliado },
    { key: 'imposto',   label: 'Impostos',            valor: d.impostos },
  ].filter(l => l.valor > 0);

  const despesas = (d.despesas_por_categoria || []).length
    ? d.despesas_por_categoria!
    : Object.entries(d.custos_por_categoria || {})
        .map(([categoria, valor]) => ({ categoria, valor, natureza: 'variavel' as const }));

  const linhas: LinhaDre[] = [
    {
      key: 'receita', label: 'Receita bruta', valor: d.receita_bruta, tipo: 'total',
      ajuda: 'Tudo que entrou de venda, antes de qualquer desconto.',
      detalhe: d.por_plataforma?.map(p => ({ label: p.plataforma, valor: p.valor, meta: `${p.vendas} vendas` })),
    },
    ...deducoes.map(l => ({ ...l, tipo: 'deducao' as const })),
  ];

  if (deducoes.length) {
    linhas.push({
      key: 'rec_liq', label: 'Receita líquida', valor: d.receita_liquida, tipo: 'total',
      ajuda: 'O que sobrou da venda depois de taxas, devoluções e imposto.',
    });
  }

  if (d.cmv > 0) {
    linhas.push({
      key: 'cmv', label: 'Custo da mercadoria vendida', valor: d.cmv, tipo: 'deducao',
      ajuda: 'Quanto você pagou pelos produtos que saíram. Só conta quando vende — comprar estoque não é despesa.',
    });
    linhas.push({
      key: 'lucro_bruto', label: 'Lucro bruto', valor: d.lucro_bruto, tipo: 'total',
      ajuda: 'O que a venda gera antes de pagar as contas da operação.',
    });
  }

  if (d.despesas_fixas > 0) {
    linhas.push({
      key: 'fixas', label: 'Despesas fixas', valor: d.despesas_fixas, tipo: 'deducao',
      ajuda: 'Existem mesmo com a porta fechada: aluguel, salário, internet.',
      detalhe: despesas.filter(c => c.natureza === 'fixa')
        .map(c => ({ label: labelCat(c.categoria), valor: c.valor })),
    });
  }
  if (d.despesas_variaveis > 0) {
    linhas.push({
      key: 'variaveis', label: 'Despesas variáveis', valor: d.despesas_variaveis, tipo: 'deducao',
      ajuda: 'Sobem e descem junto com a venda: frete, anúncio, comissão.',
      detalhe: despesas.filter(c => c.natureza !== 'fixa')
        .map(c => ({ label: labelCat(c.categoria), valor: c.valor })),
    });
  }

  linhas.push({
    key: 'resultado', label: 'Resultado do mês', valor: d.lucro_liquido, tipo: 'resultado',
    ajuda: 'O que de fato ficou. Negativo significa que o mês consumiu caixa.',
  });

  return linhas;
}

/** CSV do DRE — para levar ao contador sem pedir integração nenhuma. */
export function csvDre(d: DreGerencial, empresa: string): string {
  const l = (label: string, v: number) =>
    `"${label}";"${(v / 100).toFixed(2).replace('.', ',')}"`;
  const linhas = [
    `"DRE — ${empresa}"`,
    `"Período";"${d.periodo.slice(0, 7)}"`,
    '',
    l('Receita bruta', d.receita_bruta),
    l('(-) Taxas de plataforma', d.taxas_plataforma),
    l('(-) Taxas de gateway', d.taxas_gateway),
    l('(-) Reembolsos', d.reembolsos),
    l('(-) Chargebacks', d.chargebacks),
    l('(-) Comissões', d.comissoes_afiliado),
    l('(-) Impostos', d.impostos),
    l('= Receita líquida', d.receita_liquida),
    l('(-) Custo da mercadoria vendida', d.cmv),
    l('= Lucro bruto', d.lucro_bruto),
    l('(-) Despesas fixas', d.despesas_fixas),
    l('(-) Despesas variáveis', d.despesas_variaveis),
    l('= Resultado do mês', d.lucro_liquido),
    '',
    `"Margem bruta";"${d.margem_bruta_pct}%"`,
    `"Margem líquida";"${d.margem_pct}%"`,
    d.ponto_equilibrio != null ? l('Ponto de equilíbrio', d.ponto_equilibrio) : '"Ponto de equilíbrio";"—"',
    l('Compras de estoque (não são despesa)', d.compras_estoque),
    '',
    '"Despesas por categoria";"Valor";"Natureza"',
    ...(d.despesas_por_categoria || []).map(c =>
      `"${labelCat(c.categoria)}";"${(c.valor / 100).toFixed(2).replace('.', ',')}";"${c.natureza === 'fixa' ? 'Fixa' : 'Variável'}"`),
  ];
  return linhas.join('\n');
}
