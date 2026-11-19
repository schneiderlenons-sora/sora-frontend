// =============================================================================
// Sora no ChatGPT e no Claude — quem vê a aba e o que ela mostra.
//
// ⚠️ ESPELHO de `sora-backend/src/config/iaConectada.js`. O backend é quem
// autoriza de verdade (o /mcp e a tela de consentimento conferem lá); isto só
// decide se a aba aparece no menu. Mexeu num, mexa no outro — `npm run
// eval:ia-conectada` compara as listas.
//
// ABERTA pra todo Premium/Platinum desde 19/11/2026 (quem não tem o plano vê a
// aba com cadeado, como as outras). Voltar ao teste fechado = `ABERTA = false`
// aqui + `IA_CONECTADA_ABERTA=0` no Render: aí só estas contas veem a aba.
// =============================================================================

export const EMAILS_TESTE_IA = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
  'comercialsora@gmail.com',
];

/** Os planos que incluem a Sora no ChatGPT/Claude (o vitalício da Completa é 'premium'). */
export const PLANOS_IA = ['premium', 'platinum'] as const;

export const ABERTA = true;

/** A aba "ChatGPT e Claude" aparece no menu desta pessoa? (o plano é conferido pelo gate) */
export function podeVerIaConectada(email?: string | null): boolean {
  if (ABERTA) return true;
  return EMAILS_TESTE_IA.includes((email || '').trim().toLowerCase());
}

/** Nome amigável de cada ferramenta (a aba mostra o que a IA consultou). */
export const NOME_FERRAMENTA: Record<string, string> = {
  resumo_do_mes: 'Resumo do mês',
  resumo_do_ano: 'Resumo do ano',
  listar_transacoes: 'Transações',
  contas_e_cartoes: 'Contas e cartões',
  faturas_dos_cartoes: 'Faturas dos cartões',
  dividas: 'Dívidas',
  metas: 'Metas',
  contas_fixas: 'Contas fixas',
  investimentos: 'Investimentos',
  limites_de_gastos: 'Limites de gastos',
  categorias: 'Categorias',
};

export type AcessoIa = { ok: boolean; motivo?: 'desligada' | 'teste' | 'plano' };

export type ConexaoIa = {
  id: string;
  cliente_nome: string;
  escopo: string;
  criada_em: string;
  ultimo_uso_em: string | null;
};

export type ConsultaIa = {
  ferramenta: string;
  ok: boolean;
  criado_em: string;
  conexao_id: string | null;
};

export type EstadoIa = {
  acesso: AcessoIa;
  url_mcp: string;
  pronto: boolean;
  conexoes: ConexaoIa[];
  consultas: ConsultaIa[];
};
