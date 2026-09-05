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

    for (const r of recorrentes) {
      // ⚠️ QUANTAS VEZES CAI NESTE MÊS — não mais um "1" implícito. Sem
      // isto o IPVA (anual) entraria em TODO mês da janela e a diarista
      // (semanal) uma vez em vez de quatro. E é aqui que a DURAÇÃO passa a
      // valer: acabada a recorrência, `venceEm` devolve false e ela some da
      // projeção sozinha, sem precisar de uma segunda regra de corte.
      const vezes = ocorrenciasNoMes(r, ym);
      if (!vezes) {
        // Acabou de acabar: o mês SEGUINTE ao fim ganha o mesmo aviso que a
        // última parcela de uma dívida — é a informação que muda decisão
        // ("a partir de março sobra isso").
        if (r.data_fim && String(r.data_fim).slice(0, 7) === somarMeses(ym, -1)) {
          eventos.push({
            tipo: 'fim_parcela',
            texto: `${r.descricao || 'Conta fixa'} acaba`,
            efeito: r.tipo === 'Recebimento' ? -cent(r.valor) : cent(r.valor),
          });
        }
        continue;
      }
      const v = cent(r.valor) * vezes;
      const estimado = !!r.valor_variavel;
      if (r.tipo === 'Recebimento') {
        dReceitasFixas += v;
        if (estimado) receitaEstimada += v; else receitaFirme += v;
      } else {
        dContasFixas += v;
        if (estimado) despesaEstimada += v; else despesaFirme += v;
      }
    }

    for (const d of parcelas) {
      const total = Number(d.parcelas_total) || 0;
      const pagas = Number(d.parcelas_pagas) || 0;
      const restantes = total > 0 ? Math.max(0, total - pagas) : Infinity;

      // ⚠️ AQUI ESTÁ O QUE FAZ A PROJEÇÃO DEIXAR DE SER UMA LINHA RETA. A
      // parcela entra enquanto sobrar parcela; quando acaba, o mês SEGUINTE
      // ganha um evento dizendo quanto sobra a mais. É a informação que muda
      // decisão ("dá pra assumir isso a partir de março").
      if (k < restantes) {
        despesaFirme += cent(d.valor_parcela);
        dParcelas += cent(d.valor_parcela);
      } else if (k === restantes && Number.isFinite(restantes)) {
        eventos.push({
          tipo: 'fim_parcela',
          texto: `${d.titulo || 'Parcela'} acaba`,
          efeito: cent(d.valor_parcela),
        });
      }
    }

    // ⚠️ FATURA SÓ NO MÊS DELA. Projetar fatura de cartão pra frente seria
    // inventar: ela depende de compras que ainda não aconteceram. O que o banco
    // já publicou entra; o resto fica de fora, e a tela diz isso.
    for (const f of faturas || []) {
      if (f.nos_previstos === false) continue;
      const restante = cent(f.restante);
      if (!(restante > 0) || !f.venc) continue;
      if (String(f.venc).slice(0, 7) !== ym) continue;
      despesaFirme += restante;
      dFaturas += restante;
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
