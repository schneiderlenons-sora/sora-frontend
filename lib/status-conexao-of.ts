// =============================================================================
// EM QUE PÉ ESTÁ A CONEXÃO DE OPEN FINANCE DESTA CARTEIRA.
//
// POR QUE EXISTE (30/09/2026). Relato de cliente: "minha conta padrão não
// atualiza o valor após receber os valores, segue prints". O print mostrava
// R$ 74,33 no card do Santander com a linha **"Saldo do banco · atualizado há
// 2 h"** logo abaixo — e um PIX de R$ 1.666,66 recebido no mesmo dia na lista
// de movimentações.
//
// ⚠️ O SALDO ESTAVA PARADO DE VERDADE, E A TELA AFIRMAVA O CONTRÁRIO. A
// sincronização daquela conexão estava falhando havia horas
// (`of_conexoes.status = 'error'`), mas o card lia só `ultima_sync` — que o
// backend grava APENAS no sucesso (`polpCelcoinSync.js`: o `catch` escreve
// `status`/`ultimo_erro` e não toca na data, de propósito). Resultado: a data
// do último sucesso continuava lá e a Sora anunciava frescor que não tinha.
//
// É a mesma família do valor FÓSSIL do cartão: o problema nunca foi o número
// velho, foi o sistema não saber dizer "hoje eu não sei".
//
// ⚠️ SÓ AFIRMA COM A LISTA EM MÃOS. Falha ao buscar as conexões devolve
// `indefinido` — alarme falso faria o cliente duvidar de um banco que está
// funcionando.
//
// ⚠️ A ALLOWLIST É PORTE FIEL de `STATUS_VIVO` em
// `sora-backend/src/services/openFinanceProvider.js`. Mexeu lá, espelhe aqui.
// Status desconhecido conta como NÃO-vivo (o lado seguro: no pior caso a tela
// pede conferência; o contrário é jurar que o saldo é de agora).
// =============================================================================

/** Espelho de `STATUS_VIVO` do backend. Os valores chegam em minúsculas. */
export const STATUS_VIVO = ['updated', 'updating', 'authorised', 'authorized'];

export type EstadoConexao =
  | 'ok'          // sincronizou e o último ciclo deu certo
  | 'encerrada'   // a carteira ficou presa num consentimento que não existe mais
  | 'expirada'    // a autorização do banco venceu — reconectar RESOLVE
  | 'falhando'    // a última tentativa deu erro — reconectar NÃO resolve
  | 'indefinido'; // não dá pra afirmar nada (e então a tela não afirma)

export type ConexaoOF = { status?: string | null; ultima_sync?: string | null } | undefined | null;

export function estadoConexao(opts: {
  /** A carteira vem do Open Finance? (`of_conta_id` preenchido) */
  doBanco: boolean;
  /** A lista de conexões chegou? Sem ela, nada é afirmado. */
  pronto: boolean;
  /** `of_consent_id` da carteira. Trilho legado não tem — e aí não dá pra saber. */
  consentId?: string | null;
  /** A conexão correspondente, ou `undefined` se não está mais na lista. */
  conexao: ConexaoOF;
}): EstadoConexao {
  const { doBanco, pronto, consentId, conexao } = opts;

  if (!doBanco) return 'indefinido';
  if (!pronto) return 'indefinido';
  if (!consentId) return 'indefinido';

  // Sumiu da lista = desconectada (desconectar move a linha pro histórico).
  if (!conexao) return 'encerrada';

  const status = String(conexao.status || '').toLowerCase();

  // ⚠️ Sem status a conexão ACABOU de nascer e ainda não tentou nada. Chamar
  // isso de falha marcaria de vermelho justamente quem conectou agora.
  if (!status) return 'indefinido';

  if (STATUS_VIVO.includes(status)) return 'ok';
  if (status === 'expired') return 'expirada';
  return 'falhando';
}

/**
 * A tela pode anunciar "atualizado há X"?
 *
 * ⚠️ SÓ EM `ok`. Em `falhando` a data existe (é a do último sucesso) e é
 * exatamente ela que enganava o cliente — mostrar a data ali é pior do que não
 * mostrar data nenhuma, porque transforma um dado velho em promessa de frescor.
 */
export function podeAnunciarFrescor(estado: EstadoConexao): boolean {
  return estado === 'ok';
}
