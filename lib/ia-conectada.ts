// =============================================================================
// Sora no ChatGPT — quem vê a aba (teste fechado) e os textos do que ela lê.
//
// ⚠️ ESPELHO de `sora-backend/src/config/iaConectada.js`. O backend é quem
// autoriza de verdade (o /mcp e a tela de consentimento conferem lá); isto só
// decide se a aba aparece no menu. Mexeu num, mexa no outro — `npm run
// eval:ia-conectada` compara as listas.
//
// Enquanto o app não estiver publicado no diretório do ChatGPT, só estas contas
// veem a aba (mesmo modelo do Open Finance no começo). Abrir pra todo
// Premium/Platinum = `ABERTA = true` aqui + `IA_CONECTADA_ABERTA=1` no Render.
// =============================================================================

export const EMAILS_TESTE_CHATGPT = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
  'comercialsora@gmail.com',
];

/** Os planos que incluem a Sora no ChatGPT (o vitalício da Completa é 'premium'). */
export const PLANOS_CHATGPT = ['premium', 'platinum'] as const;

const ABERTA = false;

/** A aba "ChatGPT" aparece no menu desta pessoa? (o plano é conferido pelo gate) */
export function podeVerChatgpt(email?: string | null): boolean {
  if (ABERTA) return true;
  return EMAILS_TESTE_CHATGPT.includes((email || '').trim().toLowerCase());
}

/** Nome amigável de cada ferramenta (a aba mostra o que o ChatGPT consultou). */
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

export type AcessoChatgpt = { ok: boolean; motivo?: 'desligada' | 'teste' | 'plano' };

export type ConexaoChatgpt = {
  id: string;
  cliente_nome: string;
  escopo: string;
  criada_em: string;
  ultimo_uso_em: string | null;
};

export type ConsultaChatgpt = {
  ferramenta: string;
  ok: boolean;
  criado_em: string;
  conexao_id: string | null;
};

export type EstadoChatgpt = {
  acesso: AcessoChatgpt;
  url_mcp: string;
  pronto: boolean;
  conexoes: ConexaoChatgpt[];
  consultas: ConsultaChatgpt[];
};
