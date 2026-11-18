// =====================================================================
// Próximo vencimento de uma DÍVIDA — PORTE FIEL de
// `sora-backend/src/services/vencimentoDivida.js` (que é o CANÔNICO).
//
// Mexeu num, mexa no outro e rode os DOIS evals
// (`npm run eval:vencimento-divida` nos dois repos) — o do front compara
// campo a campo contra a saída do backend.
//
// BUG QUE ISTO CORRIGE: o card dizia "Próxima parcela em 3 dias" mesmo depois
// do usuário pagar a parcela do mês. A regra antiga só olhava `dia_vencimento`
// e o calendário — nunca o pagamento.
//
// Tudo em string 'YYYY-MM-DD': comparação lexicográfica, sem fuso pra errar
// (`toISOString()` é UTC — às 21h no BR já virou o dia seguinte).
// =====================================================================

const DIA_MS = 86400000;

export type DividaVenc = {
  dia_vencimento?: number | null;
  data_inicio?: string | null;
  status?: string | null;
  /** 'YYYY-MM-DD' do último pagamento de parcela (juros de atraso não conta). */
  ultimo_pagamento?: string | null;
  /** Vencimento da próxima parcela SEGUNDO O EMISSOR (migration 154, só Open
   *  Finance). Vence a derivação por calendário enquanto não tiver passado. */
  proximo_vencimento?: string | null;
  parcelas_total?: number | string | null;
  parcelas_pagas?: number | string | null;
};

function partes(iso: string) {
  const [Y, M, D] = String(iso).slice(0, 10).split('-').map(Number);
  return { Y, M: M - 1, D };
}

/** Último dia do mês (Y, M) — M pode estar fora de 0..11 que o Date normaliza. */
export function ultimoDiaDoMes(Y: number, M: number): number {
  return new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
}

/**
 * Ocorrência do dia `dia` no mês (Y, M), CLAMPADA ao último dia do mês.
 * Dívida que vence dia 31 vence em 28/02 — nunca "03/03" (que é o que
 * `new Date(Y, 1, 31)` devolve por rollover, o bug da regra antiga).
 */
export function ocorrencia(Y: number, M: number, dia: number): string {
  const base = new Date(Date.UTC(Y, M, 1));
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth();
  const d = Math.min(Math.max(1, dia), ultimoDiaDoMes(y, m));
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Dias inteiros de `a` até `b` (b − a). Negativo = b no passado. */
export function diffDias(a: string, b: string): number {
  const A = partes(a); const B = partes(b);
  return Math.round((Date.UTC(B.Y, B.M, B.D) - Date.UTC(A.Y, A.M, A.D)) / DIA_MS);
}

/**
 * Hoje no fuso de São Paulo, 'YYYY-MM-DD' — o MESMO `hojeSP()` do backend.
 *
 * Vale tanto no SSR (a Vercel roda em UTC: às 21h no BR `toISOString()` já
 * devolve o dia seguinte e a parcela pulava de dia) quanto no browser (assim o
 * card não diverge do número que o backend manda na revalidação).
 */
export function hojeSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Qual vencimento aquele pagamento quitou.
 *
 * É a ocorrência de `dia` MAIS PRÓXIMA da data do pagamento — é o que separa
 * "paguei a de agosto adiantado (dia 7, vence 10)" de "paguei a de julho
 * atrasado (dia 12, venceu 10)". Empate fica com a ocorrência ANTERIOR.
 */
export function vencimentoCoberto(pagamento: string, dia: number): string {
  const { Y, M } = partes(pagamento);
  let melhor = '';
  let menor = Infinity;
  for (const k of [-1, 0, 1]) {                 // ascendente: empate fica na 1ª (anterior)
    const cand = ocorrencia(Y, M + k, dia);
    const dist = Math.abs(diffDias(cand, pagamento));
    if (dist < menor) { menor = dist; melhor = cand; }
  }
  return melhor;
}

/**
 * Próximo vencimento da dívida. `null` quando quitada ou sem dia de vencimento.
 *
 * Sem `ultimo_pagamento` (dívida do Open Finance, onde a contagem de pagas vem
 * do banco e não há pagamento registrado na Sora) o resultado é o mesmo de
 * antes — a mudança só tira o aviso de quem JÁ pagou.
 */
export function proximoVencimento(
  divida: DividaVenc,
  hoje: string = hojeSP(),
): { data: string; dias: number; quitadaNoCiclo: boolean; fonte?: 'banco' } | null {
  const dia = Number(divida?.dia_vencimento);
  if (!dia || dia < 1 || dia > 31) return null;
  if (divida.status === 'quitada') return null;

  // ── A DATA DO BANCO VENCE A DERIVAÇÃO POR CALENDÁRIO (migration 154) ────
  //
  // Relato: "a próxima parcela vence dia 06 de OUTUBRO" contra "em 2 dias"
  // na tela. O resto desta função deriva a data do calendário — a próxima
  // ocorrência do dia N que ainda não passou —, que é o melhor possível numa
  // dívida lançada à mão e errado numa do Open Finance: lá o emissor conhece
  // o cronograma e a Sora não registra pagamento nenhum.
  //
  // ⚠️ ANTECIPAÇÃO é o caso que o calendário nunca acerta — e a primeira
  // tentativa de resolver isso também errou, por supor que as parcelas pagas
  // fossem as N PRIMEIRAS. No Nubank a antecipação amortiza pelo FIM: 8 pagas
  // de 36 eram os índices 0, 1 e 30..35. Quem calcula a data é
  // `proximaParcelaAberta` no sync (menor índice em aberto); aqui só se
  // CONSOME o resultado.
  //
  // ⚠️ Só vale enquanto a data NÃO PASSOU. Cronograma de banco envelhece (sync
  // parado, parcela vencida e não paga), e exibir data no passado como "a
  // próxima" seria pior do que voltar a derivar do calendário.
  const doBanco = divida?.proximo_vencimento
    ? String(divida.proximo_vencimento).slice(0, 10)
    : null;
  if (doBanco && doBanco >= hoje) {
    return { data: doBanco, dias: diffDias(hoje, doBanco), quitadaNoCiclo: false, fonte: 'banco' };
  }

  const { Y, M } = partes(hoje);

  // 1) Próxima ocorrência que ainda não passou (hoje conta como "vence hoje").
  let k = 0;
  let venc = ocorrencia(Y, M, dia);
  if (venc < hoje) { k = 1; venc = ocorrencia(Y, M + k, dia); }

  // 2) A 1ª parcela nunca vence no mês da compra: se cair em/antes do
  //    `data_inicio`, pula pro mês seguinte.
  if (divida.data_inicio && venc <= String(divida.data_inicio).slice(0, 10)) {
    k += 1;
    venc = ocorrencia(Y, M + k, dia);
  }

  // 3) O pagamento já cobriu essa parcela? Então a próxima é a seguinte.
  //    Só ANDA pra frente: pagamento antigo nunca joga o vencimento pro
  //    passado (quem está atrasado continua vendo a próxima data real).
  let quitadaNoCiclo = false;
  const pago = divida.ultimo_pagamento ? String(divida.ultimo_pagamento).slice(0, 10) : null;
  if (pago) {
    const coberta = vencimentoCoberto(pago, dia);
    if (coberta >= venc) {
      const c = partes(coberta);
      venc = ocorrencia(c.Y, c.M + 1, dia);
      quitadaNoCiclo = true;
    }
  }

  return { data: venc, dias: diffDias(hoje, venc), quitadaNoCiclo };
}

// =====================================================================
// ATRASO — porte fiel de `vencidaNoMes`, `parcelasEmAtraso` e
// `statusDeAtraso` do backend (nov/2026). O backend GRAVA o status (cron
// diário e edição); o card calcula com a MESMA regra pra mostrar o atraso
// na hora — sem esperar o cron da manhã seguinte — e dizer DESDE QUANDO.
// `eval:vencimento-divida` compara as duas cópias caso a caso.
// =====================================================================

/** A parcela DESTE MÊS já venceu e não foi paga? (a regra de antes) */
export function vencidaNoMes(divida: DividaVenc, hoje: string = hojeSP()): boolean {
  const dia = Number(divida?.dia_vencimento);
  if (!dia || dia < 1 || dia > 31) return false;
  if (divida.status === 'quitada') return false;
  const total = Number(divida.parcelas_total) || 0;
  if (total > 0 && (Number(divida.parcelas_pagas) || 0) >= total) return false;

  const { Y, M } = partes(hoje);
  const venc = ocorrencia(Y, M, dia);
  if (venc >= hoje) return false;
  if (divida.data_inicio && venc <= String(divida.data_inicio).slice(0, 10)) return false;
  if (divida.proximo_vencimento && String(divida.proximo_vencimento).slice(0, 10) > venc) return false;

  const pago = divida.ultimo_pagamento ? String(divida.ultimo_pagamento).slice(0, 10) : null;
  if (pago && vencimentoCoberto(pago, dia) >= venc) return false;
  return true;
}

export const MAX_PARCELAS_ATRASO = 12;

export type AtrasoDivida = {
  /** a parcela vencida MAIS ANTIGA sem pagamento */
  desde: string;
  /** a mais recente que já venceu */
  ultima: string;
  /** dias de atraso da mais antiga */
  dias: number;
  quantas: number;
  /** bateu no teto da janela (MAX_PARCELAS_ATRASO) */
  ouMais: boolean;
  /** há pagamento registrado (sem ele, só a parcela do mês conta) */
  comPagamento: boolean;
};

/**
 * Parcelas JÁ VENCIDAS e sem pagamento — "atrasada ATÉ PAGAR", mas só com
 * PROVA (pagamento registrado). Sem pagamento registrado: só a parcela do
 * mês corrente, como sempre foi. Ver o porquê no backend.
 */
export function parcelasEmAtraso(divida: DividaVenc, hoje: string = hojeSP()): AtrasoDivida | null {
  const dia = Number(divida?.dia_vencimento);
  if (!dia || dia < 1 || dia > 31) return null;
  if (divida.status === 'quitada') return null;
  const total = Number(divida.parcelas_total) || 0;
  const pagas = Number(divida.parcelas_pagas) || 0;
  if (total > 0 && pagas >= total) return null;

  const pago = divida.ultimo_pagamento ? String(divida.ultimo_pagamento).slice(0, 10) : null;
  const { Y, M } = partes(hoje);

  if (!pago) {
    if (!vencidaNoMes(divida, hoje)) return null;
    const venc = ocorrencia(Y, M, dia);
    return { desde: venc, ultima: venc, dias: diffDias(venc, hoje), quantas: 1, ouMais: false, comPagamento: false };
  }

  let base = M;
  let ultima = ocorrencia(Y, M, dia);
  if (ultima >= hoje) { base = M - 1; ultima = ocorrencia(Y, base, dia); }

  const inicio = divida.data_inicio ? String(divida.data_inicio).slice(0, 10) : null;
  if (inicio && ultima <= inicio) return null;
  if (divida.proximo_vencimento && String(divida.proximo_vencimento).slice(0, 10) > ultima) return null;

  const coberta = vencimentoCoberto(pago, dia);
  if (coberta >= ultima) return null;

  const teto = total > 0 ? Math.min(MAX_PARCELAS_ATRASO, total - pagas) : MAX_PARCELAS_ATRASO;
  let quantas = 0;
  let desde = ultima;
  let ouMais = false;
  for (let i = 0; ; i++) {
    const v = ocorrencia(Y, base - i, dia);
    if (v <= coberta) break;
    if (inicio && v <= inicio) break;
    if (quantas >= teto) { ouMais = quantas >= MAX_PARCELAS_ATRASO; break; }
    quantas += 1;
    desde = v;
  }
  return { desde, ultima, dias: diffDias(desde, hoje), quantas, ouMais, comPagamento: true };
}

/** O status que a dívida deve ter AGORA — só alterna 'ativa' ↔ 'em_atraso'. */
export function statusDeAtraso(divida: DividaVenc, hoje: string = hojeSP()): string | null | undefined {
  const atual = divida?.status;
  if (atual !== 'ativa' && atual !== 'em_atraso') return atual;
  return parcelasEmAtraso(divida, hoje) ? 'em_atraso' : 'ativa';
}
