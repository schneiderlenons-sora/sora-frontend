// =============================================================================
// Ordem e situação dos chamados no painel admin — regra PURA (eval:chamados-admin).
//
// Pedido do dono (nov/2026): "organize pelos abertos; finalizado vai pro fim;
// e quero saber quando o cliente respondeu". Depois (25/11): o mais recente
// primeiro em cada bloco, e busca por nome. A situação sai da CONVERSA, não
// só do campo `status`: um chamado "em andamento" cujo cliente acabou de
// responder precisa de você tanto quanto um novo.
//
//   precisa_resposta  → o cliente falou por último (ou nunca foi respondido)
//   aguardando_cliente→ você respondeu por último
//   resolvido         → encerrado (a conversa foi apagada; vai pro fim)
//
// Melhoria sem resposta NÃO "precisa de resposta": sugestão não espera
// retorno, e contá-la deixaria o contador sempre aceso (eram 6 de 11 abertos).
// =============================================================================

export type MsgResumo = { autor: 'usuario' | 'suporte'; lida_em?: string | null; created_at: string };
export type ChamadoBase = { id: string; status: string; tipo?: string | null; created_at: string };
export type Situacao = 'precisa_resposta' | 'aguardando_cliente' | 'resolvido';

export type ChamadoComSituacao<T> = T & {
  situacao: Situacao;
  /** Mensagens do CLIENTE que o suporte ainda não abriu. */
  nao_lidas: number;
  /** Total de mensagens na conversa (sem o relato de abertura). */
  mensagens: number;
  /** Última atividade: última mensagem, ou a abertura. */
  ultima_atividade: string;
  ultimo_autor: 'usuario' | 'suporte' | null;
};

export function situacaoDoChamado<T extends ChamadoBase>(c: T, msgs: MsgResumo[]): ChamadoComSituacao<T> {
  const ordenadas = [...msgs].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const ultima = ordenadas[ordenadas.length - 1] || null;
  const naoLidas = ordenadas.filter((m) => m.autor === 'usuario' && !m.lida_em).length;
  const respondido = ordenadas.some((m) => m.autor === 'suporte');

  let situacao: Situacao;
  if (c.status === 'resolvido') situacao = 'resolvido';
  else if (naoLidas > 0 || ultima?.autor === 'usuario') situacao = 'precisa_resposta';
  else if (!respondido) situacao = c.tipo === 'melhoria' ? 'aguardando_cliente' : 'precisa_resposta';
  else situacao = 'aguardando_cliente';

  return {
    ...c,
    situacao,
    nao_lidas: naoLidas,
    mensagens: ordenadas.length,
    ultima_atividade: ultima ? (ultima.created_at > c.created_at ? ultima.created_at : c.created_at) : c.created_at,
    ultimo_autor: ultima?.autor || null,
  };
}

const PESO: Record<Situacao, number> = { precisa_resposta: 0, aguardando_cliente: 1, resolvido: 2 };

/**
 * Ordem da lista: precisa de resposta → aguardando o cliente → resolvidos, e
 * DENTRO de cada bloco o MAIS RECENTE PRIMEIRO (pedido do dono, 25/11/2026:
 * "por ordem de último chamado"). Recente = última atividade — a abertura ou a
 * última mensagem —, então chamado novo e cliente que acabou de responder sobem
 * pro topo juntos. Resolvidos: pela abertura (a conversa deles foi apagada).
 *
 * Antes, em "precisa de resposta", o mais ANTIGO vinha primeiro (o mais
 * atrasado) — o dono preferiu achar o último que chegou.
 */
export function ordenarChamados<T extends ChamadoComSituacao<ChamadoBase>>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (PESO[a.situacao] !== PESO[b.situacao]) return PESO[a.situacao] - PESO[b.situacao];
    if (a.situacao === 'resolvido') return b.created_at.localeCompare(a.created_at);
    return b.ultima_atividade.localeCompare(a.ultima_atividade);
  });
}

/** Texto comparável: sem acento, sem caixa, sem espaço sobrando. */
export function chaveBusca(s: string | null | undefined): string {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * A busca do painel acha este chamado? Por NOME ou E-MAIL (todas as palavras
 * digitadas, em qualquer ordem, sem acento nem caixa) ou por TELEFONE (só os
 * dígitos, a partir de 4 — "(14) 99188" acha 5514991889199). Busca vazia acha
 * tudo.
 */
export function casaBusca(c: { nome?: string | null; email?: string | null; phone?: string | null }, termo: string): boolean {
  const t = chaveBusca(termo);
  if (!t) return true;
  const texto = chaveBusca(`${c.nome || ''} ${c.email || ''}`);
  if (t.split(' ').every((p) => texto.includes(p))) return true;
  const digitos = t.replace(/\D/g, '');
  return digitos.length >= 4 && String(c.phone || '').replace(/\D/g, '').includes(digitos);
}
