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

  // ── A DATA QUE O BANCO INFORMA VENCE QUALQUER DERIVAÇÃO (migration 154) ──
  //
  // Relato: "a próxima parcela vence dia 06 de OUTUBRO" contra "em 2 dias"
  // na tela. O resto desta função deriva a data do calendário — a próxima
  // ocorrência do dia N que ainda não passou —, que é o melhor possível numa
  // dívida lançada à mão e ERRADO numa do Open Finance: lá o emissor conhece
  // o cronograma e a Sora não tem pagamento registrado pra corrigir o rumo
  // (as parcelas pagas chegam como CONTAGEM, não como registro).
  //
  // ⚠️ E o caso que quebra o calendário é o mais comum em empréstimo:
  // ANTECIPAÇÃO. Quem adianta parcelas fica com a próxima meses à frente,
  // enquanto o calendário segue apontando o mês que vem.
  //
  // ⚠️ Só vale enquanto a data NÃO PASSOU. Cronograma do banco envelhece: se
  // ele ficou pra trás (sync parado, parcela vencida e não paga), voltar a
  // derivar do calendário é o comportamento honesto — melhor do que exibir
  // uma data no passado como se fosse "a próxima".
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
