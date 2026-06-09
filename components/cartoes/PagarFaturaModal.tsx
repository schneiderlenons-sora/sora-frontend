'use client';

import { useState } from 'react';
import { X, Loader2, Check, CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import ContaDebitoSelect from '@/components/ui/ContaDebitoSelect';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

interface Props {
  cartaoId:    string;
  cartaoNome:  string;
  valorFatura: number;
  onClose:  () => void;
  onPago:   () => void; // chamado após pagar com sucesso
}

export default function PagarFaturaModal({ cartaoId, cartaoNome, valorFatura, onClose, onPago }: Props) {
  const { phone } = useAuth();
  const [valorRaw, setValorRaw] = useState<string>(valorFatura ? String(Math.round(valorFatura * 100)) : '');
  const [walletId, setWalletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  const valor = parseInt(valorRaw || '0', 10) / 100;
  const fmtBR = (raw: string) => !raw ? '0,00' : (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  async function pagar() {
    setErro('');
    if (!valor || valor <= 0) { setErro('Informe o valor da fatura.'); return; }
    if (!walletId) { setErro('Escolha a conta de onde sai o pagamento.'); return; }
    setLoading(true);
    try {
      await api.wallets.pagarFatura({ phone: phone!, cartao_id: cartaoId, wallet_id: walletId, valor });
      onPago();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Não consegui registrar o pagamento.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
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

        <div className="p-6 space-y-5">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Valor a pagar</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">R$</span>
              <input inputMode="numeric" value={fmtBR(valorRaw)} autoFocus
                     onChange={e => setValorRaw(e.target.value.replace(/\D/g, ''))}
                     className="text-4xl font-bold text-foreground bg-transparent border-none outline-none text-center w-full tabular" />
            </div>
            {valorFatura > 0 && valor !== valorFatura && (
              <p className="text-[11px] text-muted-foreground mt-2">Fatura atual: <strong className="text-foreground tabular">{fmt(valorFatura)}</strong></p>
            )}
          </div>

          <ContaDebitoSelect value={walletId} onChange={setWalletId} label="Descontar de qual conta?" />

          {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={pagar} disabled={loading || !valor || !walletId} className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Pagar fatura
          </button>
        </div>
      </div>
    </div>
  );
}
