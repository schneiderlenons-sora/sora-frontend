// =============================================================================
// O CARD "PREVISTOS DE <MÊS>" — qual mês ele mostra, e em que estado está cada
// conta daquele mês.
//
// Nasceu de dois relatos do MESMO cliente, no mesmo print (out/2026):
//
//   1. "Previsões aparecem pagas sendo que nem paguei nada ainda."
//   2. "Previsões estão fixas no mês corrente. Mesmo que eu navegue entre os
//      meses, fica sempre aparecendo 'Previsto <mês corrente>'."
//
// ⚠️ O (1) NÃO ERA CONTAMINAÇÃO DE OUTRO MÊS, como parecia. Medido na conta
// dele: a recorrência ATIVA "Plano de Saúde" (modo `prever`) tem a transação
// de 2026-10 com **`pago = false`** — é a previsão MATERIALIZADA, não um
// pagamento. A rota `/previstos/ocorrencias` montava as `quitacoes` sem olhar
// `pago`, então qualquer transação amarrada à recorrência virava "paga".
// Atinge todo mundo que usa `prever`/`nao_lancar`, não só ele.
//
// ⚠️ E NÃO DÁ PRA FILTRAR `pago` NA ORIGEM. O Extrato Futuro usa a MESMA lista
// pra não desenhar a previsão por cima de um lançamento que já existe
// (`extrato-futuro.ts`: "já foi paga (vínculo)"). Filtrando lá, a previsão
// voltaria a ser projetada em cima da transação pendente e o saldo contaria a
// conta DUAS vezes. Por isso a rota passou a devolver `pago` e quem decide é
// cada tela: o Extrato segue pelo VÍNCULO, o card segue pelo PAGAMENTO.
// =============================================================================

/** 'YYYY-MM' do mês corrente em São Paulo. */
export function mesAtualSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
}

/** 'YYYY-MM-DD' de hoje em São Paulo. */
export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

export type PosicaoMes = 'passado' | 'corrente' | 'futuro';

/**
 * Onde o mês exibido está em relação a hoje.
 *
 * ⚠️ É ISTO que o card nunca soube. Ele usava o mês de HOJE em seis pontos
 * (título, busca de quitações, "pular", baixa, soma e contagem de ocorrências)
 * e ignorava o filtro da página — então a pessoa navegava para novembro e
 * seguia vendo outubro com a tela inteira escrita "Novembro".
 *
 * Comparação de STRING 'YYYY-MM', que é ordenável — `new Date(mes)` seria
 * interpretado como UTC e viraria o mês anterior à noite no Brasil.
 */
export function posicaoDoMes(mesRef: string, hoje = mesAtualSP()): PosicaoMes {
  const m = String(mesRef || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) return 'corrente';   // sem mês válido, age como hoje
  if (m < hoje) return 'passado';
  if (m > hoje) return 'futuro';
  return 'corrente';
}

/**
 * Esta conta já venceu, no mês que está sendo exibido?
 *
 * ⚠️ Dia solto não responde isso — era o erro antigo. `dia 20 < hoje 4` é
 * falso em outubro e seria falso em JULHO também, onde o dia 20 já passou
 * faz tempo. No mês futuro nada venceu; no passado, tudo venceu.
 */
export function venceuNoMes(dia: number | null | undefined, mesRef: string, hoje = mesAtualSP(), diaHoje?: number): boolean {
  if (!dia) return false;
  const pos = posicaoDoMes(mesRef, hoje);
  if (pos === 'futuro') return false;
  if (pos === 'passado') return true;
  const d = diaHoje ?? Number(hojeSP().slice(8, 10));
  return Number(dia) < d;
}

export type Quitacao = {
  recorrenciaId?: string | null;
  competencia?: string | null;
  transacaoId?: string | null;
  valor?: number | null;
  data?: string | null;
  /** A transação está PAGA? `false` = previsão lançada, aguardando pagamento. */
  pago?: boolean | null;
};

export type Ajuste = {
  recorrenciaId?: string | null;
  competencia?: string | null;
  status?: string | null;
  novoValor?: number | null;
  novaData?: string | null;
};

/** O que aconteceu com esta conta no mês exibido. */
export type Situacao = 'paga' | 'lancada' | 'pulada' | 'aberta';

export type EstadoOcorrencia = {
  situacao: Situacao;
  /** Valor REAL quando já existe lançamento, ou o ajustado, ou o da regra. */
  valor: number | null;
  transacaoId: string | null;
};

/**
 * Cruza quitações e ajustes de UMA competência e diz o estado de cada conta.
 *
 * ⚠️ `pago === false` É INFORMAÇÃO, não ausência. Em `prever`/`nao_lancar` a
 * transação nasce pendente de propósito: ela É a previsão daquele mês. Tratá-la
 * como paga foi o bug; tratá-la como inexistente seria o oposto — a pessoa
 * perderia o valor REAL que já chegou do banco (no caso medido, a regra dizia
 * R$ 1.962,78 e o lançamento real era R$ 2.051,68).
 *
 * ⚠️ `pago` AUSENTE (undefined) conta como PAGA. É o payload de um backend
 * ainda não atualizado: antes desta mudança toda quitação significava paga, e
 * inverter isso faria o selo sumir de quem realmente pagou durante o deploy.
 */
export function estadoDasOcorrencias(
  competencia: string,
  quitacoes: Quitacao[] | null | undefined,
  ajustes: Ajuste[] | null | undefined,
): Map<string, EstadoOcorrencia> {
  const mapa = new Map<string, EstadoOcorrencia>();
  const comp = String(competencia || '').slice(0, 7);
  if (!comp) return mapa;

  for (const q of quitacoes || []) {
    if (!q?.recorrenciaId || q.competencia !== comp) continue;
    const pago = q.pago === undefined || q.pago === null ? true : !!q.pago;
    const id = String(q.recorrenciaId);
    const anterior = mapa.get(id);
    // ⚠️ PAGA VENCE LANÇADA. Pode haver mais de uma transação na mesma
    // competência (a prevista + a que o banco trouxe); se alguma está paga,
    // a conta está paga.
    if (anterior?.situacao === 'paga' && !pago) continue;
    mapa.set(id, {
      situacao: pago ? 'paga' : 'lancada',
      valor: q.valor == null ? null : Number(q.valor),
      transacaoId: q.transacaoId ? String(q.transacaoId) : null,
    });
  }

  for (const a of ajustes || []) {
    if (!a?.recorrenciaId || a.competencia !== comp) continue;
    const id = String(a.recorrenciaId);
    if (a.status === 'pulado') {
      // ⚠️ Pulada NÃO sobrescreve paga: se a pessoa pulou e depois pagou, o
      // fato mais forte é o pagamento.
      if (mapa.get(id)?.situacao === 'paga') continue;
      mapa.set(id, { situacao: 'pulada', valor: null, transacaoId: null });
      continue;
    }
    // Ajuste de VALOR sem quitação: a conta segue aberta, com outro valor.
    if (a.novoValor != null && !mapa.has(id)) {
      mapa.set(id, { situacao: 'aberta', valor: Number(a.novoValor), transacaoId: null });
    }
  }
  return mapa;
}

/** Conta que ainda vai sair do bolso neste mês (entra no total previsto). */
export function contaNoTotal(e: EstadoOcorrencia | undefined): boolean {
  if (!e) return true;                    // sem nada registrado: está aberta
  return e.situacao === 'lancada' || e.situacao === 'aberta';
}

/**
 * Quanto esta conta pesa no mês exibido.
 *
 * ⚠️ O VALOR DO LANÇAMENTO VENCE O DA REGRA. Quando o mês já tem transação, o
 * número real é o dela — era o que faltava para o total bater com o que o
 * cliente vê no extrato do banco.
 */
export function valorNoMes(
  e: EstadoOcorrencia | undefined,
  valorDaRegra: number | null | undefined,
  ocorrencias = 1,
): number {
  if (!contaNoTotal(e)) return 0;
  if (e && e.valor != null && Number.isFinite(e.valor)) return Number(e.valor);
  return (Number(valorDaRegra) || 0) * (ocorrencias || 0);
}
