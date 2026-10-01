// =============================================================================
// PREVISÕES DE MESES ANTERIORES QUE FICARAM EM ABERTO.
//
// POR QUE EXISTE (01/10/2026). Pedido do cliente (Vander), cobrado de novo
// depois de meses sem resposta: "conseguir apontar que um determinado
// pagamento se refere a uma previsão NAQUELE MÊS". E, no mesmo e-mail:
// "penso seriamente em parar de usar este recurso da previsão do mês".
//
// O Extrato Futuro começa SEMPRE em hoje — é o que faz o saldo projetado
// partir do saldo real. Consequência não intencional: a conta fixa de setembro
// que ninguém deu baixa some da tela em 1º de outubro. Ela não foi paga, não
// foi pulada, e não existe mais em lugar nenhum para ser conciliada. O
// pagamento atrasado chega e não tem a que se amarrar.
//
// ⚠️ ISTO NÃO ENTRA NO SALDO PROJETADO, E A SEPARAÇÃO É O PONTO. O saldo de
// partida do extrato é o saldo ATUAL das contas, que já reflete tudo que
// aconteceu. Somar aqui uma pendência de setembro cobraria duas vezes do mesmo
// dinheiro — é a mesma armadilha que o `jaNoSaldo` das linhas evita. Por isso
// a lista sai FORA do extrato, como pendência a conciliar.
//
// ⚠️ SÓ CONTA FIXA (recorrência). Dívida e fatura de mês passado têm as
// próprias telas e o próprio jeito de dar baixa; trazê-las pra cá criaria uma
// segunda porta pra quitar a mesma coisa.
// =============================================================================

import { ocorrenciasNoMes } from '@/lib/frequencia-recorrencia';
import { somarMeses, type ItemRecorrente } from '@/lib/previstos';

export type RecorrenciaAtrasavel = ItemRecorrente & {
  id?: string;
  carteira?: string | null;
};

export type Quitacao = { recorrenciaId: string; competencia: string };
export type Ajuste = { recorrenciaId: string; competencia: string; status?: string | null };

export type Pendencia = {
  recorrenciaId: string;
  /** 'YYYY-MM' — é ela que o `POST /previstos/quitar` recebe. */
  competencia: string;
  descricao: string;
  valor: number;
  tipo: 'Gasto' | 'Recebimento';
  carteira: string | null;
  estimado: boolean;
  /** Quantos meses atrás, pra tela dizer "de agosto" sem recalcular. */
  mesesAtras: number;
};

/** Quantos meses olhar para trás. Mais que isso vira lista que ninguém revisa. */
export const MESES_PADRAO = 3;

function cent(n: number) { return Math.round((Number(n) || 0) * 100) / 100; }

/**
 * As contas fixas de meses ANTERIORES que não foram pagas nem puladas.
 *
 * @param hojeYm 'YYYY-MM' do mês corrente (em São Paulo).
 */
export function pendenciasAnteriores(params: {
  recorrencias: RecorrenciaAtrasavel[];
  quitacoes?: Quitacao[];
  ajustes?: Ajuste[];
  hojeYm: string;
  meses?: number;
}): Pendencia[] {
  const { recorrencias, hojeYm } = params;
  const meses = Math.max(1, params.meses ?? MESES_PADRAO);

  const quitadas = new Set((params.quitacoes || []).map((q) => `${q.recorrenciaId}:${q.competencia}`));
  // ⚠️ Puladas e ADIADAS saem as duas. "Pulada" é decisão explícita de não
  // pagar; "movida" teve a data mudada e passa a viver na data nova — cobrá-la
  // aqui também faria a mesma conta aparecer em dois lugares.
  const resolvidas = new Set(
    (params.ajustes || [])
      .filter((a) => a.status === 'pulado' || a.status === 'movido')
      .map((a) => `${a.recorrenciaId}:${a.competencia}`),
  );

  const fora: Pendencia[] = [];

  // Do mês mais ANTIGO para o mais recente: é a ordem em que a pessoa resolve.
  for (let i = meses; i >= 1; i--) {
    const ym = somarMeses(hojeYm, -i);
    for (const r of recorrencias || []) {
      if (!r?.id) continue;                       // sem id não há como quitar
      if (!(Number(r.valor) > 0)) continue;
      // ⚠️ `ocorrenciasNoMes` é a MESMA função do extrato e da projeção. Ela
      // já sabe de frequência, início e fim — uma conta que ainda não existia
      // em agosto, ou que terminou, não vira pendência retroativa.
      const vezes = ocorrenciasNoMes(r, ym);
      if (!vezes) continue;

      const chave = `${r.id}:${ym}`;
      if (quitadas.has(chave) || resolvidas.has(chave)) continue;

      fora.push({
        recorrenciaId: r.id,
        competencia: ym,
        descricao: String(r.descricao || '').trim() || 'Conta fixa',
        valor: cent(Number(r.valor) * vezes),
        tipo: r.tipo === 'Recebimento' ? 'Recebimento' : 'Gasto',
        carteira: r.carteira ?? null,
        estimado: !!r.valor_variavel,
        mesesAtras: i,
      });
    }
  }

  return fora;
}

/** Quanto ainda falta conciliar, separado por tipo. */
export function totalPendente(lista: Pendencia[]) {
  let aPagar = 0;
  let aReceber = 0;
  for (const p of lista) {
    if (p.tipo === 'Recebimento') aReceber += p.valor;
    else aPagar += p.valor;
  }
  return { aPagar: cent(aPagar), aReceber: cent(aReceber), quantidade: lista.length };
}
