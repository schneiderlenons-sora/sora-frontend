// =============================================================================
// QUEM PODE DAR BAIXA NUMA CONTA FIXA, E COMO.
//
// Relato de cliente (Vander, 26/09/2026): "tem coisas que já paguei (setembro)
// mas não consigo flegar como pago, pois não consigo fazer a conciliação (…)
// Acredito que esta funcionalidade de previsão, da forma que está, não é útil".
//
// ⚠️ ELE ESTAVA CERTO, E DEU PRA MEDIR: das 9 contas fixas ATIVAS da conta
// dele, **ZERO** ofereciam o botão de baixa. Duas condições o escondiam:
//   · `!jaPassou(dia)` — o botão nasceu pra ANTECIPAR pagamento, então sumia
//     depois do vencimento. Mas é AÍ que a pessoa quer marcar: a conta venceu,
//     ela pagou. As 9 já tinham vencido.
//   · `modo === 'lancar'` — 7 das 9 estavam em `prever`/`nao_lancar`.
// Sem saída, ele usou "pular" em contas que PAGOU. Pular significa "não vai
// acontecer": o dado dele ficou dizendo o contrário do que aconteceu.
//
// Esta regra mora aqui, fora do componente, porque é decisão pura e testável —
// dentro do .tsx só daria pra verificar por cópia no eval.
// =============================================================================

export type ContaFixa = {
  dia_vencimento?: number | null;
  modo_lancamento?: string | null;
  frequencia?: string | null;
  valor_variavel?: boolean | null;
  valor?: number | string | null;
};

/**
 * A linha oferece "Já paguei / Já recebi"?
 *
 * ⚠️ O VENCIMENTO NÃO ENTRA. Relançar não é risco: `resolvidasNoMes` já impede
 * o cron de lançar o que tem baixa, e o backend recusa data futura.
 */
export function podeDarBaixa(
  i: ContaFixa,
  estado: { paga?: boolean; pulada?: boolean; ocorrenciasNoMes?: number } = {},
): boolean {
  if (estado.paga || estado.pulada) return false;
  // Semanal fica de fora: a baixa é por MÊS, e numa conta semanal ela
  // esconderia as outras três semanas.
  if ((i.frequencia || 'mensal') === 'semanal') return false;
  // Valor variável tem o real diferente da estimativa — o Extrato Futuro, que
  // PERGUNTA o valor, é o lugar dela.
  if (i.valor_variavel) return false;
  if (!(Number(i.valor) > 0)) return false;
  if (estado.ocorrenciasNoMes !== undefined && estado.ocorrenciasNoMes <= 0) return false;
  return true;
}

/**
 * Nesta conta a baixa AMARRA um lançamento que já existe, em vez de criar um?
 *
 * ⚠️ É o que separa "a Sora lança" de "o banco lança". Em `lancar` a Sora é a
 * fonte e criar está certo. Em `prever`/`nao_lancar` a cobrança chega pelo
 * Open Finance — criar ali seria a duplicata que a baixa existe pra evitar, e
 * é por isso que esses modos não podiam simplesmente ganhar o botão antigo.
 */
export function baixaPrecisaVincular(i: ContaFixa): boolean {
  return (i.modo_lancamento || 'lancar') !== 'lancar';
}
