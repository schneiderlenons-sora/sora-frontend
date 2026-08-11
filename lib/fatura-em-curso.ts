import { competenciaAtual, cicloPorCompetencia, hojeSP } from './ciclo-fatura';

/**
 * Quantas faturas à frente da `competenciaAtual` está a fatura EM CURSO — a que
 * o banco considera aberta.
 *
 * POR QUE ISTO EXISTE. `competenciaAtual` é "a próxima a VENCER", e entre o
 * fechamento e o vencimento isso deixa de ser a fatura em curso. Num cartão que
 * fecha 08 e vence 13, no dia 11/08 ela ainda aponta pra fatura que FECHOU dia
 * 08 — mas o emissor já virou a chave, e o `saldo` que o sync gravou é o da
 * fatura NOVA. As telas então mostravam o valor de uma fatura em cima dos
 * lançamentos de outra: R$ 560,68 (a de setembro, no banco) sobre uma lista que
 * parava em 31 de julho. Foi lido como "paguei e continua na fatura velha" e
 * "está faltando lançamento".
 *
 * SÓ VALE PRO CARTÃO DE OPEN FINANCE. Nele o valor é do banco, e é o banco quem
 * decide qual fatura está aberta. No cartão manual a fatura fechada e não paga
 * TEM de continuar à vista — some-la seria esconder dívida.
 *
 * ⚠️ É decisão de TELA, não aritmética. `competenciaAtual` e todo o
 * `lib/ciclo-fatura.ts` (porte fiel do backend, eval de 1313 casos) seguem
 * intocados: aqui só escolhemos por qual fatura a tela COMEÇA.
 */
export function offsetFaturaEmCurso(cartao: any): number {
  if (!cartao?.of_conta_id) return 0;
  const ciclo = cicloPorCompetencia(cartao, competenciaAtual(cartao));
  return ciclo.fim < hojeSP() ? 1 : 0;
}
