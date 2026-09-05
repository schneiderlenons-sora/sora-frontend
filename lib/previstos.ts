// =============================================================================
// Projeção dos próximos meses — a aritmética da aba Previstos.
//
// Irmã de `lib/saldo-projetado.ts`, que responde "como eu fecho ESTE mês". Aqui
// a pergunta é "como ficam os PRÓXIMOS", e ela só tem resposta porque a Sora
// sabe coisas que um app de recorrências não sabe:
//
//   · dívida TEM FIM — `parcelas_total` e `parcelas_pagas` dizem em que mês a
//     parcela para, então a projeção não é uma linha reta;
//   · fatura de cartão tem ciclo e valor publicados pelo banco;
//   · conta de valor variável é sabidamente incerta, e pode ser separada em vez
//     de somada como se fosse certa.
//
// ⚠️ COMPROMETIDO × ESTIMADO ANDAM SEPARADOS ATÉ O FIM. Somar os dois num número
// só transformaria "a luz costuma vir uns R$ 200" em "você vai pagar R$ 200",
// e é sobre esse número que a pessoa decide se pode comprar algo. A separação é
// o que permite a tela dizer "entre X e Y" em vez de cravar um valor que a
// gente não tem.
// =============================================================================

export type ItemRecorrente = {
  tipo: 'Gasto' | 'Recebimento';
  valor: number;
  dia_vencimento?: number | null;
  valor_variavel?: boolean | null;
  /** 'nao_lancar' segue contando na projeção: o dinheiro sai igual. */
  modo_lancamento?: string | null;
  // Migration 157. Ausentes = mensal e pra sempre, que é o que toda
  // recorrência anterior a ela é — então a projeção de quem não mexer nos
  // campos novos não muda em nada.
  descricao?: string | null;
  frequencia?: 'semanal' | 'mensal' | 'anual' | null;
  dia_semana?: number | null;
  mes_vencimento?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
};

export type ItemParcelado = {
  titulo?: string | null;
  valor_parcela: number;
  dia_vencimento?: number | null;
  parcelas_total?: number | null;
  parcelas_pagas?: number | null;
  status?: string | null;
  nos_previstos?: boolean | null;
};

export type FaturaProjetada = {
  nome?: string | null;
  restante: number;
  /** 'YYYY-MM-DD' do vencimento. */
  venc?: string | null;
  nos_previstos?: boolean | null;
};

/** Um evento que MUDA o mês em relação ao anterior — o miolo da tela. */
export type EventoMes = {
  tipo: 'fim_parcela' | 'fatura';
  texto: string;
  /** Positivo = sobra mais dinheiro a partir daqui. */
  efeito: number;
};

export type MesProjetado = {
  /** 'YYYY-MM' */
  ym: string;
  /** Quanto entra, separado por confiança. */
  receitaFirme: number;
  receitaEstimada: number;
  /** Quanto sai, separado por confiança. */
  despesaFirme: number;
  despesaEstimada: number;
  /** receita − despesa, contando as duas confianças. */
  resultado: number;
  /** Saldo com que o mês COMEÇA (o acumulado do mês anterior). */
  saldoInicial: number;
  /** Saldo acumulado a partir do saldo inicial informado. */
  saldoAcumulado: number;
  /**
   * De onde vem cada parte, pra a tela poder abrir "Despesas" em
   * "contas fixas · parcelas · faturas" sem recalcular nada por fora.
   *
   * ⚠️ É a soma AGENDADA, sempre — mesmo no mês 0, onde os totais acima são
   * substituídos pelo realizado. As duas coisas respondem perguntas
   * diferentes ("o que já saiu" × "o que estava marcado pra sair"), e
   * misturá-las faria a soma do detalhe não bater com o total logo acima.
   */
  detalhe: {
    receitasFixas: number;
    contasFixas:   number;
    parcelas:      number;
    faturas:       number;
  };
  /** Há valor variável neste mês? Então o número é aproximado. */
  aproximado: boolean;
  eventos: EventoMes[];
};

import { ocorrenciasNoMes } from '@/lib/frequencia-recorrencia';

const cent = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** 'YYYY-MM' de hoje no fuso de São Paulo — nunca `toISOString()` (é UTC). */
export function ymHojeSP(agora: Date = new Date()): string {
  return agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
}

/** Soma meses a um 'YYYY-MM'. */
export function somarMeses(ym: string, n: number): string {
  const [Y, M] = ym.split('-').map(Number);
  const total = (Y * 12) + (M - 1) + n;
  const ano = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${ano}-${String(mes).padStart(2, '0')}`;
}

/** Quantos meses de `a` até `b` (negativo se b for antes). */
export function distanciaMeses(a: string, b: string): number {
  const [Y1, M1] = a.split('-').map(Number);
  const [Y2, M2] = b.split('-').map(Number);
  return (Y2 - Y1) * 12 + (M2 - M1);
}

/** Uma linha que cai num mês da projeção. */
export type LinhaMes = {
  origem: 'recorrencia' | 'divida' | 'fatura';
  tipo: 'Gasto' | 'Recebimento';
  /** Valor JÁ multiplicado pelas ocorrências do mês. */
  valor: number;
  vezes: number;
  /** Conta de valor variável — o número é estimativa. */
  estimado: boolean;
  ref: any;
};

/**
 * O QUE CAI NO MÊS `ym` — fonte única.
 *
 * ⚠️ EXISTE PORQUE O CARD E O GRÁFICO NÃO PODEM DIVERGIR. A tela precisa
 * listar linha a linha o que compõe um mês; a projeção precisa somar o mesmo
 * mês. Com duas implementações dessas regras, basta um ajuste em uma delas
 * pra o card exibir R$ 1.240 embaixo de uma barra desenhada em R$ 1.310 —
 * e não há como o usuário saber qual das duas está certa. `projetarMeses`
 * SOMA daqui; a tela AGRUPA daqui.
 *
 * `k` é o índice do mês na janela (0 = mês corrente): é ele que decide até
 * quando a parcela de uma dívida ainda cai.
 */
export function linhasDoMes(params: {
  ym: string;
  k: number;
  recorrencias: ItemRecorrente[];
  dividas: ItemParcelado[];
  faturas: FaturaProjetada[];
}): LinhaMes[] {
  const { ym, k, recorrencias, dividas, faturas } = params;
  const linhas: LinhaMes[] = [];

  // ⚠️ `nao_lancar` entra igual: o modo diz se a Sora CRIA a transação, não
  // se o dinheiro sai. Deixá-lo de fora faria a projeção ignorar justamente
  // as contas de quem usa Open Finance.
  for (const r of recorrencias || []) {
    if (!(Number(r.valor) > 0)) continue;
    // ⚠️ QUANTAS VEZES CAI NESTE MÊS — não um "1" implícito. Sem isto o IPVA
    // (anual) entraria em TODO mês da janela e a diarista (semanal) uma vez
    // em vez de quatro. E é aqui que a DURAÇÃO passa a valer: acabada a
    // recorrência, `venceEm` devolve false e ela some sozinha.
    const vezes = ocorrenciasNoMes(r, ym);
    if (!vezes) continue;
    linhas.push({
      origem: 'recorrencia',
      tipo: r.tipo,
      valor: cent(r.valor) * vezes,
      vezes,
      estimado: !!r.valor_variavel,
      ref: r,
    });
  }

  for (const d of dividas || []) {
    if (d.status === 'quitada') continue;
    if (!(Number(d.valor_parcela) > 0)) continue;
    if (d.nos_previstos === false) continue;
    // A parcela entra enquanto sobrar parcela.
    const total = Number(d.parcelas_total) || 0;
    const pagas = Number(d.parcelas_pagas) || 0;
    const restantes = total > 0 ? Math.max(0, total - pagas) : Infinity;
    if (k >= restantes) continue;
    linhas.push({
      origem: 'divida',
      tipo: 'Gasto',
      valor: cent(d.valor_parcela),
      vezes: 1,
      estimado: false,
      ref: d,
    });
  }

  // ⚠️ FATURA SÓ NO MÊS DELA. Projetar fatura de cartão pra frente seria
  // inventar: ela depende de compras que ainda não aconteceram. O que o banco
  // já publicou entra; o resto fica de fora, e a tela diz isso.
  for (const f of faturas || []) {
    if (f.nos_previstos === false) continue;
    const restante = cent(f.restante);
    if (!(restante > 0) || !f.venc) continue;
    if (String(f.venc).slice(0, 7) !== ym) continue;
    linhas.push({ origem: 'fatura', tipo: 'Gasto', valor: restante, vezes: 1, estimado: false, ref: f });
  }

  return linhas;
}

/**
 * Projeta `quantidade` meses a partir de `inicio` (inclusive).
 *
 * ⚠️ O MÊS 0 NÃO É PROJEÇÃO. Quem chama passa em `realizado` o que já aconteceu
 * no mês corrente; sem isso o primeiro mês apareceria como se nada tivesse
 * entrado nem saído, contradizendo o resto do painel a um centímetro de
 * distância.
 */
export function projetarMeses(params: {
  inicio: string;
  quantidade: number;
  saldoInicial: number;
  recorrencias: ItemRecorrente[];
  dividas: ItemParcelado[];
  faturas: FaturaProjetada[];
  /** Realizado do mês 0 — o que já entrou e saiu de fato. */
  realizado?: { receitas: number; gastos: number };
}): MesProjetado[] {
  const { inicio, quantidade, saldoInicial, recorrencias, dividas, faturas, realizado } = params;

  // As recorrências valem em TODO mês da janela: são mensais por definição.
  // `nao_lancar` entra igual — o modo diz se a Sora cria a transação, não se o
  // dinheiro sai. Deixá-lo de fora faria a projeção ignorar justamente as
  // contas de quem usa Open Finance.
  const recorrentes = (recorrencias || []).filter((r) => Number(r.valor) > 0);

  const parcelas = (dividas || []).filter(
    (d) => d.status !== 'quitada'
      && Number(d.valor_parcela) > 0
      && d.nos_previstos !== false,
  );

  const meses: MesProjetado[] = [];
  let saldo = cent(saldoInicial);

  for (let k = 0; k < quantidade; k += 1) {
    const ym = somarMeses(inicio, k);
    const eventos: EventoMes[] = [];

    let receitaFirme = 0;
    let receitaEstimada = 0;
    let despesaFirme = 0;
    let despesaEstimada = 0;

    // Detalhe por ORIGEM — o que a tela abre embaixo de "Despesas".
    let dReceitasFixas = 0;
    let dContasFixas = 0;
    let dParcelas = 0;
    let dFaturas = 0;

    const saldoInicial = saldo;

    // ⚠️ A SOMA VEM DE `linhasDoMes`, a MESMA função que a tela usa pra
    // listar. Enquanto as duas eram implementações separadas das mesmas
    // regras, nada impedia o card de somar um valor e a barra de desenhar
    // outro para o mesmo mês.
    for (const l of linhasDoMes({ ym, k, recorrencias: recorrentes, dividas: parcelas, faturas: faturas || [] })) {
      if (l.tipo === 'Recebimento') {
        dReceitasFixas += l.valor;
        if (l.estimado) receitaEstimada += l.valor; else receitaFirme += l.valor;
        continue;
      }
      if (l.origem === 'recorrencia') dContasFixas += l.valor;
      else if (l.origem === 'divida') dParcelas += l.valor;
      else dFaturas += l.valor;
      if (l.estimado) despesaEstimada += l.valor; else despesaFirme += l.valor;
    }

    // ── EVENTOS ────────────────────────────────────────────────────────────
    // ⚠️ ESTES SÃO O MIOLO DA ABA. Um gráfico de barras quase iguais não
    // informa nada; o que muda decisão é "em dezembro a parcela do sofá acaba
    // e sobram R$ 200 por mês".
    for (const r of recorrentes) {
      // Acabou de acabar: o mês SEGUINTE ao fim ganha o aviso.
      if (ocorrenciasNoMes(r, ym)) continue;
      if (r.data_fim && String(r.data_fim).slice(0, 7) === somarMeses(ym, -1)) {
        eventos.push({
          tipo: 'fim_parcela',
          texto: `${r.descricao || 'Conta fixa'} acaba`,
          efeito: r.tipo === 'Recebimento' ? -cent(r.valor) : cent(r.valor),
        });
      }
    }

    for (const d of parcelas) {
      const total = Number(d.parcelas_total) || 0;
      const pagas = Number(d.parcelas_pagas) || 0;
      const restantes = total > 0 ? Math.max(0, total - pagas) : Infinity;
      if (k === restantes && Number.isFinite(restantes)) {
        eventos.push({
          tipo: 'fim_parcela',
          texto: `${d.titulo || 'Parcela'} acaba`,
          efeito: cent(d.valor_parcela),
        });
      }
    }

    for (const f of faturas || []) {
      if (f.nos_previstos === false) continue;
      const restante = cent(f.restante);
      if (!(restante > 0) || !f.venc) continue;
      if (String(f.venc).slice(0, 7) !== ym) continue;
      eventos.push({
        tipo: 'fatura',
        texto: `Fatura ${f.nome || 'do cartão'}`,
        efeito: -restante,
      });
    }
    // Mês 0 usa o REALIZADO no lugar da projeção de receita/despesa firme —
    // o que já aconteceu não é previsão.
    if (k === 0 && realizado) {
      receitaFirme = cent(realizado.receitas);
      despesaFirme = cent(realizado.gastos);
    }

    const resultado = cent(
      (receitaFirme + receitaEstimada) - (despesaFirme + despesaEstimada),
    );
    saldo = cent(saldo + resultado);

    meses.push({
      ym,
      receitaFirme: cent(receitaFirme),
      receitaEstimada: cent(receitaEstimada),
      despesaFirme: cent(despesaFirme),
      despesaEstimada: cent(despesaEstimada),
      resultado,
      saldoInicial: cent(saldoInicial),
      saldoAcumulado: saldo,
      detalhe: {
        receitasFixas: cent(dReceitasFixas),
        contasFixas:   cent(dContasFixas),
        parcelas:      cent(dParcelas),
        faturas:       cent(dFaturas),
      },
      aproximado: receitaEstimada > 0 || despesaEstimada > 0,
      eventos,
    });
  }

  return meses;
}

/**
 * O primeiro mês em que o saldo acumulado fica negativo, se houver.
 *
 * ⚠️ Devolve `null` quando nunca fica — e não o último mês. É a diferença entre
 * "você fura o caixa em janeiro" e um alerta que aparece sempre, que a pessoa
 * aprende a ignorar em duas semanas.
 */
export function primeiroMesNoVermelho(meses: MesProjetado[]): MesProjetado | null {
  return meses.find((m) => m.saldoAcumulado < 0) || null;
}
