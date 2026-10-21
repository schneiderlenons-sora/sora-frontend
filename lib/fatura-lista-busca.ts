// Busca da lista da fatura (rede). A regra pura mora em lib/fatura-lista.ts
// — separada pra o eval rodar sem cliente do Supabase.
import { api } from '@/lib/api';
import { cicloPorCompetencia, competenciaAtual, type Ciclo } from '@/lib/ciclo-fatura';
import { mesesDoCiclo, selecionarDaFatura } from '@/lib/fatura-lista';

/**
 * Busca e seleciona os lançamentos da fatura `competencia` ('YYYY-MM' do
 * VENCIMENTO) do cartão. Mesmas buscas que o detalhe do cartão sempre fez.
 */
export async function carregarLancamentosDaFatura(
  phone: string,
  cartao: any,
  competencia: string,
  opcoes: { ehFaturaEmCurso?: boolean } = {},
): Promise<{ transacoes: any[]; ciclo: Ciclo; ehFaturaEmCurso: boolean }> {
  const ciclo = cicloPorCompetencia(cartao, competencia);
  const ehFaturaEmCurso = opcoes.ehFaturaEmCurso ?? competencia === competenciaAtual(cartao);
  const buscas: Promise<any>[] = mesesDoCiclo(ciclo).map((m) => api.transacoes.listar(phone, { mes: m, limit: 500 }));
  // Compra PARCELADA é lançada com a data da COMPRA, então pode estar meses
  // atrás do ciclo e nem seria carregada pela busca por mês. Quando o banco diz
  // qual fatura está aberta, busca também por ela. Best-effort: se a migration
  // 101 ainda não rodou, essa busca falha e as outras seguem.
  const faturaAberta = ehFaturaEmCurso ? cartao?.of_bill_atual : null;
  if (faturaAberta) {
    buscas.push(api.transacoes.listar(phone, { bill_id: faturaAberta, limit: 500 }).catch(() => null));
  }
  const rs = await Promise.all(buscas);
  const transacoes = selecionarDaFatura(rs.map((r: any) => r?.transacoes || []), cartao, ciclo, ehFaturaEmCurso);
  return { transacoes, ciclo, ehFaturaEmCurso };
}
