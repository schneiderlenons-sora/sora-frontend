'use client';

// =============================================================================
// "Faturas nos previstos" — considerar ou não a fatura de cada cartão.
//
// Pedido do dono (nov/2026): "ter a opção de desconsiderar o valor da fatura
// nos previstos e poder considerar novamente". A opção EXISTIA (wallets.
// nos_previstos, migration 123), mas só no card da aba Transações, como um olho
// de 11px que no computador aparecia só com o mouse em cima. Na aba Previstos,
// fatura desconsiderada simplesmente sumia — e com ela a única volta.
//
// Aqui a fatura de fora CONTINUA NA LISTA, com o interruptor desligado: é o que
// deixa voltar atrás. `role="switch"` + texto do estado (nunca só a cor).
// =============================================================================

import { CreditCard, Loader2 } from 'lucide-react';
import { useDinheiro } from '@/lib/moeda-base';
import { useFmt } from '@/lib/valores-ocultos';

export type FaturaPrevisao = {
  cartao_id: string;
  nome?: string | null;
  restante?: number | string | null;
  venc?: string | null;
  nos_previstos?: boolean | null;
};

export default function FaturasNaPrevisao({ faturas, ocupado, erro, onAlternar }: {
  faturas: FaturaPrevisao[];
  ocupado: string | null;
  erro?: string | null;
  onAlternar: (cartaoId: string, considerar: boolean) => void;
}) {
  const fmt = useFmt(useDinheiro());
  // Só fatura com valor em aberto: a paga não tem o que considerar.
  const lista = faturas.filter((f) => Number(f.restante) > 0.01);
  if (!lista.length) return null;
  const fora = lista.filter((f) => f.nos_previstos === false).length;

  return (
    <section className="card rounded-2xl overflow-hidden mt-4">
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-sm font-bold text-foreground">Faturas nos previstos</h3>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          {fora
            ? `${fora === 1 ? '1 fatura não está' : `${fora} faturas não estão`} sendo considerada${fora === 1 ? '' : 's'} no que vai sobrar.`
            : 'O valor em aberto de cada cartão entra no que vai sair. Desligue o que você não quer considerar.'}
        </p>
      </div>
      <ul className="divide-y divide-border/50">
        {lista.map((f) => {
          const considerando = f.nos_previstos !== false;
          const dia = String(f.venc || '').slice(8, 10);
          const mes = String(f.venc || '').slice(5, 7);
          const carregando = ocupado === f.cartao_id;
          return (
            <li key={f.cartao_id}>
              <button
                type="button"
                role="switch"
                aria-checked={considerando}
                aria-label={`Considerar a fatura do ${f.nome || 'cartão'} nos previstos`}
                disabled={carregando}
                onClick={() => onAlternar(f.cartao_id, !considerando)}
                className="w-full flex items-center gap-3 px-5 py-3 min-h-[56px] text-left hover:bg-muted/30 transition-colors disabled:opacity-60"
              >
                <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'color-mix(in srgb, #8b5cf6 13%, transparent)' }}>
                  <CreditCard size={16} style={{ color: '#8b5cf6' }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-medium truncate ${considerando ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {f.nome || 'Cartão'}
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    {dia ? `vence ${dia}/${mes} · ` : ''}
                    {considerando ? 'considerando' : 'não considerando'}
                  </span>
                </span>
                <span className={`text-sm font-bold tabular-nums ${considerando ? 'text-foreground' : 'text-muted-foreground line-through decoration-1'}`}>
                  {fmt(Number(f.restante) || 0)}
                </span>
                {/* O interruptor. Com o rótulo ao lado na linha de cima, o estado
                    nunca depende só da cor. */}
                <span aria-hidden
                      className={`relative w-10 h-6 rounded-full flex-shrink-0 transition-colors ${considerando ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  {carregando
                    ? <Loader2 size={12} className="absolute inset-0 m-auto animate-spin text-white" />
                    : <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[left] duration-200 ${considerando ? 'left-[18px]' : 'left-0.5'}`} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {erro && (
        <p role="alert" className="px-5 py-2.5 text-xs font-medium text-red-600 dark:text-red-400 border-t border-border/50">{erro}</p>
      )}
    </section>
  );
}
