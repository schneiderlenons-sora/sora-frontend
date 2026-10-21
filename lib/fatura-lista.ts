// ─────────────────────────────────────────────────────────────────────────────
// QUAIS LANÇAMENTOS FORMAM UMA FATURA — fonte única da LISTA da fatura.
//
// Usada pelo detalhe do cartão (`DetalhesCartaoModal`) e pela visão "Por
// fatura" da aba Transações. ⚠️ As duas telas TÊM de mostrar a mesma lista pra
// mesma fatura: era inline no modal, e uma segunda cópia na aba Transações
// seria o começo das divergências "uma tela diz X, a outra diz Y" que este
// projeto já pagou caro pra fechar (5 cópias do vencimento de dívida, 7 do
// valor da fatura). Travado em `npm run eval:fatura-lista`, que compara com
// uma CÓPIA CONGELADA da lógica que vivia no modal.
//
// ⚠️ SÓ A LISTA. O VALOR da fatura vem do servidor (`/fatura/status`, que usa
// `faturaVista`) e pode ser diferente da soma dos lançamentos — parcelas que só
// o banco conhece, saldo rolado da fatura anterior. Quem exibe os dois tem de
// rotular os dois.
//
// ⚠️ SEM O `of_bill_id` DA COMPETÊNCIA (o critério "híbrido"). Medido em
// 21/10/2026 nas 727 faturas dos 321 cartões com ciclo: ligar o híbrido muda a
// lista de 107 (15%) e esvazia algumas inteiras — o agrupamento do emissor nem
// sempre coincide com o ciclo cadastrado. E o modal, na prática, já não o
// usava: o id chegava DEPOIS de a lista ser montada (ao abrir ia `null`; ao
// navegar ia o da fatura ANTERIOR, que é sempre errado). Fixar `null` mantém o
// que a pessoa vê ao abrir o cartão e conserta a navegação. Ligar o híbrido é
// decisão própria, com medição própria — não um efeito colateral desta lista.
// ─────────────────────────────────────────────────────────────────────────────

import { criterioDaFatura, pertenceAFatura, type Ciclo } from './ciclo-fatura';

/** Os meses-calendário que o ciclo toca (o ciclo cruza meses: 06/10 a 05/11). */
export function mesesDoCiclo(ciclo: Ciclo): string[] {
  return Array.from(new Set([ciclo.ini.slice(0, 7), ciclo.fim.slice(0, 7)]));
}

/**
 * A transação é deste cartão? As transações guardam `carteira_nome` (texto),
 * não o id da carteira — casa por nome, sem caixa nem espaço nas pontas.
 */
export function ehDoCartao(t: any, cartao: any): boolean {
  const nomeCartao = (cartao?.nome || '').trim().toLowerCase();
  return t?.wallet_id === cartao?.id || (t?.carteira_nome || '').trim().toLowerCase() === nomeCartao;
}

/**
 * Das listas buscadas (uma por mês do ciclo, + a da fatura aberta do emissor),
 * os lançamentos que pertencem à fatura — sem repetir, do mais novo pro mais
 * antigo.
 */
export function selecionarDaFatura(
  listas: any[][],
  cartao: any,
  ciclo: Ciclo,
  ehFaturaEmCurso: boolean,
): any[] {
  // Dedup: uma transação pode vir pelos dois caminhos (mês e fatura).
  const vistas = new Set<string>();
  const todas = listas.flat()
    .filter((t: any) => (t?.id && vistas.has(t.id) ? false : (vistas.add(t?.id), true)));
  const minhas = todas.filter((t: any) => ehDoCartao(t, cartao));
  // Critério UMA vez por fatura (ver criterioDaFatura): por transação,
  // misturava a fatura vinculada com as compras do ciclo novo.
  const criterio = criterioDaFatura(minhas, cartao, ehFaturaEmCurso, ciclo, null);
  // Inclui os CRÉDITOS (estorno/cashback) do ciclo, não só os Gasto: eles
  // abatem a fatura e o usuário precisa vê-los na lista pra bater com o
  // extrato do banco. Quem decide o sinal é `somarFatura`.
  const doCartao = minhas.filter(
    (t: any) => pertenceAFatura(t, cartao, ciclo, ehFaturaEmCurso, criterio, null));
  // ⚠️ ORDENA POR DATA. As buscas são por MÊS e chegam concatenadas, então sem
  // isto a lista saía "todo o mês de julho, depois todo o de agosto" — e a
  // fatura parecia parar em 31 de julho.
  doCartao.sort((a: any, b: any) => String(b.data).localeCompare(String(a.data)));
  return doCartao;
}
