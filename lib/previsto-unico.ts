import { api } from '@/lib/api';

/**
 * PREVISTO ÚNICO — um compromisso que acontece UMA vez: IPVA deste ano, uma
 * viagem, um presente. É a resposta à queixa "tudo o que informo em Previstos
 * acaba virando recorrente".
 *
 * Por baixo é só uma TRANSAÇÃO com `pago: false`. Não é recorrência, não tem
 * tabela própria, e é por isso que ela NÃO aparece na lista de contas fixas —
 * aparece no Extrato e em Transações, na data dela.
 *
 * ⚠️ FONTE ÚNICA. Existem duas portas para criar um previsto único (o
 * formulário do Extrato e o modo "Uma vez só" do modal de conta fixa), e as
 * duas passam por aqui. Duas implementações do mesmo lançamento divergiriam
 * no primeiro ajuste — e divergir aqui é o mesmo gasto entrando de dois jeitos.
 *
 * ⚠️ `pago: false` É EXPLÍCITO, e isso corrige uma armadilha. O backend só
 * grava `pago: false` sozinho quando a data é FUTURA (`ehFuturo` em
 * routes/transacoes.js). Um previsto com data de HOJE entrava como PAGO e
 * DEBITAVA a conta na hora — o contrário do que "previsto" promete. Ele volta
 * a ser pago do jeito de sempre: confirmando o lançamento pendente.
 */
export type NovoPrevistoUnico = {
  descricao: string;
  valor: number;
  /** YYYY-MM-DD */
  data: string;
  tipo: 'Gasto' | 'Recebimento';
  carteira: string | null;
  /** Ausente = o padrão histórico do Extrato ("Outros" / "Outras receitas"). */
  categoria?: string | null;
};

export async function criarPrevistoUnico(phone: string, p: NovoPrevistoUnico) {
  return api.transacoes.criar({
    phone,
    tipo: p.tipo,
    valor: p.valor,
    observacao: p.descricao,
    carteira_nome: p.carteira,
    data: p.data,
    categoria: p.categoria || (p.tipo === 'Gasto' ? 'Outros' : 'Outras receitas'),
    pago: false,
  });
}
