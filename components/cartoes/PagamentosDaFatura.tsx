'use client';

// ─────────────────────────────────────────────────────────────────────────────
// OS PAGAMENTOS JÁ LANÇADOS NESTA FATURA — e o botão de desfazer.
//
// PERGUNTA DE CLIENTE (01/10/2026): "paguei a fatura por engano numa conta
// manual, tem como reverter?". Não tinha. E o caminho que ele tentaria sozinho
// deixava a conta PIOR:
//
//   pagar fatura grava em DOIS lugares — o lançamento que debita a conta E o
//   registro em `pagamentos_fatura`, de onde sai `restante = fatura − pago`.
//
// Apagando só o lançamento na aba Transações, o saldo voltava e o registro
// SOBREVIVIA (a chave estrangeira é `on delete set null`): o dinheiro voltava
// para a conta e a fatura continuava marcada como paga, sem nenhuma tela que
// mostrasse esse registro. Medido na base: 322 pagamentos, 14 já sem vínculo.
//
// Aqui os dois saem juntos, numa operação só, e a lista existe primeiro para
// que o pagamento deixe de ser invisível.
// ─────────────────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Undo2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useDinheiro } from '@/lib/moeda-base';
import { useConfirmar, useAvisar } from '@/contexts/ConfirmContext';
import { fmtDataBR } from '@/lib/data-br';

type Pagamento = {
  id: string; competencia: string; valor: number; data: string;
  transacao_id: string | null; conta: string | null; transacao_existe: boolean;
};

export default function PagamentosDaFatura({
  phone, cartaoId, competencia, moeda, onDesfeito,
}: {
  phone: string;
  cartaoId: string;
  competencia: string;
  /** O cartão pode estar em outra moeda que a do grupo (migration 168). */
  moeda?: string | null;
  /** Recarrega o modal: o `pago`/`restante` mudaram no servidor. */
  onDesfeito: () => void;
}) {
  const fmt = useDinheiro({ moeda: moeda ?? undefined });
  const confirmar = useConfirmar();
  const avisar = useAvisar();

  const [lista, setLista] = useState<Pagamento[] | null>(null);
  const [desfazendo, setDesfazendo] = useState<string | null>(null);

  const carregar = useCallback(() => {
    if (!phone || !cartaoId || !competencia) return;
    api.wallets.faturaPagamentos(phone, cartaoId, competencia)
      .then((r) => setLista(r?.pagamentos ?? []))
      // Informativo: sem a migration 096 a lista só não aparece, e o modal
      // continua funcionando igual.
      .catch(() => setLista([]));
  }, [phone, cartaoId, competencia]);

  useEffect(() => { setLista(null); carregar(); }, [carregar]);

  async function desfazer(p: Pagamento) {
    // ⚠️ A CONFIRMAÇÃO NOMEIA VALOR, CONTA E O QUE VAI ACONTECER COM O SALDO.
    // É dinheiro saindo de uma fatura e voltando pra uma conta: "tem certeza?"
    // sozinho não dá à pessoa o que ela precisa pra decidir.
    const devolve = p.transacao_existe && p.conta;
    const ok = await confirmar({
      titulo: 'Desfazer este pagamento?',
      mensagem: (
        <>
          A fatura volta a mostrar <b className="text-foreground">{fmt(p.valor)}</b> em aberto
          {devolve
            ? <> e o valor retorna para a conta <b className="text-foreground">{p.conta}</b>.</>
            : <>. O lançamento correspondente não foi encontrado, então nenhum saldo será alterado.</>}
          <br /><br />
          O lançamento desta fatura também será apagado.
        </>
      ),
      confirmar: 'Desfazer pagamento',
      cancelar: 'Manter',
      perigo: true,
    });
    if (!ok) return;

    setDesfazendo(p.id);
    try {
      const r = await api.wallets.desfazerPagamentoFatura(p.id);
      if (r?.jaDesfeito) {
        await avisar({ titulo: 'Este pagamento já tinha sido desfeito.' });
      } else if (r?.saldoDevolvido) {
        await avisar({
          titulo: 'Pagamento desfeito',
          mensagem: <>Devolvemos {fmt(r.valorDevolvido ?? 0)} para a conta <b className="text-foreground">{r.conta}</b>.</>,
        });
      }
      carregar();
      onDesfeito();
    } catch (e: any) {
      // ⚠️ O motivo da recusa (409) vem pronto do servidor — cartão do banco
      // ou fatura que já rolou. Mostrar o texto dele é melhor que um genérico.
      await avisar({
        titulo: 'Não consegui desfazer',
        mensagem: e?.message || 'Tente de novo em instantes.',
      });
    } finally { setDesfazendo(null); }
  }

  if (lista === null || lista.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        {lista.length === 1 ? 'Pagamento lançado' : 'Pagamentos lançados'}
      </p>
      <ul className="space-y-1.5">
        {lista.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-foreground tabular">
                {fmt(p.valor)}
                {p.conta && <span className="text-muted-foreground"> · {p.conta}</span>}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {p.data ? fmtDataBR(p.data) : ''}
                {!p.transacao_existe && (
                  <span className="inline-flex items-center gap-1 ml-1 text-amber-600 dark:text-amber-400">
                    <AlertCircle size={10} /> sem lançamento
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => desfazer(p)}
              disabled={desfazendo === p.id}
              // 36px de alvo e rótulo escrito: ícone sozinho aqui seria uma
              // ação destrutiva sem nome.
              className="h-9 px-2.5 rounded-lg text-[11px] font-semibold text-muted-foreground
                         hover:text-foreground border border-border inline-flex items-center gap-1.5
                         disabled:opacity-50 flex-shrink-0"
            >
              {desfazendo === p.id
                ? <Loader2 size={12} className="animate-spin" />
                : <Undo2 size={12} />}
              Desfazer
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
