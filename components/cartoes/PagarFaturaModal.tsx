'use client';

import { useState } from 'react';
import { X, Loader2, Check, CreditCard, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import ContaDebitoSelect from '@/components/ui/ContaDebitoSelect';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtBR = (raw: string) => !raw ? '0,00' : (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  cartaoId:    string;
  cartaoNome:  string;
  valorFatura: number;
  onClose:  () => void;
  onPago:   () => void; // chamado após pagar com sucesso
}

// Uma linha = uma conta + o valor que sai dela. Com 1 linha é o pagamento
// normal; com 2+ divide a fatura entre contas (ex.: parte da esposa, parte do
// filho). Cada linha tem uma key estável pro React não bagunçar os selects.
interface Linha { key: number; walletId: string | null; valorRaw: string }

let _seq = 0;
const novaLinha = (valorRaw = ''): Linha => ({ key: ++_seq, walletId: null, valorRaw });

export default function PagarFaturaModal({ cartaoId, cartaoNome, valorFatura, onClose, onPago }: Props) {
  const { phone } = useAuth();
  // Começa com uma linha já preenchida com o valor da fatura (fluxo de sempre).
  const [linhas, setLinhas] = useState<Linha[]>(
    () => [novaLinha(valorFatura ? String(Math.round(valorFatura * 100)) : '')]
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const dividido = linhas.length > 1;
  const total = linhas.reduce((s, l) => s + (parseInt(l.valorRaw || '0', 10) / 100), 0);

  function setLinha(key: number, patch: Partial<Linha>) {
    setLinhas(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLinha() { setLinhas(ls => [...ls, novaLinha()]); }
  function removerLinha(key: number) { setLinhas(ls => ls.filter(l => l.key !== key)); }

  async function pagar() {
    setErro('');
    const itens = linhas
      .map(l => ({ wallet_id: l.walletId || '', valor: parseInt(l.valorRaw || '0', 10) / 100 }))
      .filter(i => i.wallet_id && i.valor > 0);

    if (!itens.length) { setErro('Escolha a conta e informe o valor.'); return; }
    // Duas linhas na mesma conta é permitido, mas provavelmente engano — avisa.
    const contas = new Set(itens.map(i => i.wallet_id));
    if (dividido && contas.size < itens.length) { setErro('Você repetiu a mesma conta em duas linhas.'); return; }

    setLoading(true);
    try {
      if (itens.length === 1) {
        await api.wallets.pagarFatura({ phone: phone!, cartao_id: cartaoId, wallet_id: itens[0].wallet_id, valor: itens[0].valor });
      } else {
        await api.wallets.pagarFatura({ phone: phone!, cartao_id: cartaoId, pagamentos: itens });
      }
      onPago();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Não consegui registrar o pagamento.');
    } finally { setLoading(false); }
  }

  const podePagar = linhas.some(l => l.walletId && (parseInt(l.valorRaw || '0', 10) / 100) > 0);
  const diferente = valorFatura > 0 && Math.abs(total - valorFatura) > 0.005;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <CreditCard size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">Pagar fatura</h2>
              <p className="text-xs text-muted-foreground truncate">{cartaoNome}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {valorFatura > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Fatura atual</span>
              <strong className="text-foreground tabular">{fmt(valorFatura)}</strong>
            </div>
          )}

          {/* Linhas de pagamento (conta + valor) */}
          <div className="space-y-3">
            {linhas.map((l, i) => (
              <div key={l.key} className="rounded-2xl border border-border/70 p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {dividido ? `Conta ${i + 1}` : 'Descontar de'}
                  </span>
                  {dividido && (
                    <button onClick={() => removerLinha(l.key)} aria-label="Remover conta"
                            className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <ContaDebitoSelect value={l.walletId} onChange={(id) => setLinha(l.key, { walletId: id })} label="" />
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-bold text-muted-foreground">R$</span>
                  <input inputMode="numeric" value={fmtBR(l.valorRaw)}
                         onChange={e => setLinha(l.key, { valorRaw: e.target.value.replace(/\D/g, '') })}
                         className="text-xl font-bold text-foreground bg-transparent border-none outline-none w-full tabular" />
                </div>
              </div>
            ))}
          </div>

          <button onClick={addLinha}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors">
            <Plus size={15} /> Dividir com outra conta
          </button>

          {/* Total (só quando dividido, pra conferência) */}
          {dividido && (
            <div className="flex items-center justify-between text-sm rounded-xl bg-muted/40 px-3 py-2.5">
              <span className="text-muted-foreground">Total dos pagamentos</span>
              <strong className={`tabular ${diferente ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{fmt(total)}</strong>
            </div>
          )}
          {dividido && diferente && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              O total ({fmt(total)}) é diferente da fatura ({fmt(valorFatura)}). Pode ser pagamento parcial — se não for, ajuste os valores.
            </p>
          )}

          {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={pagar} disabled={loading || !podePagar} className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Pagar {dividido ? fmt(total) : 'fatura'}
          </button>
        </div>
      </div>
    </div>
  );
}
