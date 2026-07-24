'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, CreditCard, Plus, Trash2, Wallet as WalletIcon } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtBR = (raw: string) => !raw ? '0,00' : (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  cartaoId:    string;
  cartaoNome:  string;
  valorFatura: number;
  onClose:  () => void;
  onPago:   () => void; // chamado após pagar com sucesso
}

// Uma linha = uma conta + o valor que sai dela (+ um apelido opcional de quem
// pagou). Com 1 linha é o pagamento normal; com 2+ divide a fatura entre contas
// (ex.: parte da esposa, parte do filho). Key estável pro React.
interface Linha { key: number; walletId: string; valorRaw: string; quem: string }

let _seq = 0;
const novaLinha = (valorRaw = ''): Linha => ({ key: ++_seq, walletId: '', valorRaw, quem: '' });

export default function PagarFaturaModal({ cartaoId, cartaoNome, valorFatura, onClose, onPago }: Props) {
  const { phone } = useAuth();
  const [contas, setContas] = useState<{ id: string; nome: string; saldo: number }[]>([]);
  const [linhas, setLinhas] = useState<Linha[]>(
    () => [novaLinha(valorFatura ? String(Math.round(valorFatura * 100)) : '')]
  );
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  // Portal só depois de montar no cliente (SSR não tem document).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Carrega as contas (sem cartões de crédito — não se paga fatura com fatura).
  useEffect(() => {
    if (!phone) return;
    api.wallets.listar(phone)
      .then((ws: any[]) => {
        const cs = (ws || []).filter(w => w.tipo !== 'Crédito').map(w => ({ id: w.id, nome: w.nome, saldo: w.saldo || 0 }));
        setContas(cs);
        // Uma conta só → já seleciona na primeira linha.
        if (cs.length === 1) setLinhas(ls => ls.map((l, i) => (i === 0 && !l.walletId ? { ...l, walletId: cs[0].id } : l)));
      })
      .catch(() => setContas([]));
  }, [phone]);

  const dividido = linhas.length > 1;
  const total = linhas.reduce((s, l) => s + (parseInt(l.valorRaw || '0', 10) / 100), 0);
  const diferente = valorFatura > 0 && Math.abs(total - valorFatura) > 0.005;

  function setLinha(key: number, patch: Partial<Linha>) {
    setLinhas(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));
  }
  function addLinha() { setLinhas(ls => [...ls, novaLinha()]); }
  function removerLinha(key: number) { setLinhas(ls => ls.filter(l => l.key !== key)); }

  async function pagar() {
    setErro('');
    const itens = linhas
      .map(l => ({ wallet_id: l.walletId, valor: parseInt(l.valorRaw || '0', 10) / 100, descricao: l.quem.trim() }))
      .filter(i => i.wallet_id && i.valor > 0);

    if (!itens.length) { setErro('Escolha a conta e informe o valor.'); return; }
    const contasUsadas = new Set(itens.map(i => i.wallet_id));
    if (dividido && contasUsadas.size < itens.length) { setErro('Você repetiu a mesma conta em duas linhas.'); return; }

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

  if (!mounted) return null;

  // Portal pro body: escapa de qualquer ancestral com backdrop-blur/transform
  // (os cards do painel usam), que prendem o position:fixed e faziam o modal
  // aparecer ATRÁS do card de Faturas em vez de cobrir a tela.
  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92dvh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <CreditCard size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">Pagar fatura</h2>
              <p className="text-xs text-muted-foreground truncate">{cartaoNome}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Corpo (rola no mobile) */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain">
          {valorFatura > 0 && (
            <div className="flex items-center justify-between text-sm rounded-xl bg-muted/40 px-3.5 py-2.5">
              <span className="text-muted-foreground">Fatura atual</span>
              <strong className="text-foreground tabular">{fmt(valorFatura)}</strong>
            </div>
          )}

          {contas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta cadastrada pra pagar a fatura.</p>
          ) : (
            <div className="space-y-3">
              {linhas.map((l, i) => (
                <div key={l.key} className="rounded-2xl border border-border/70 p-3.5 space-y-3 bg-muted/20">
                  {dividido && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pagamento {i + 1}</span>
                      <button onClick={() => removerLinha(l.key)} aria-label="Remover" className="p-1.5 -m-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}

                  {/* Conta (sempre visível) */}
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      <WalletIcon size={12} className="text-primary" /> De qual conta
                    </label>
                    <select value={l.walletId} onChange={e => setLinha(l.key, { walletId: e.target.value })}
                            className="input py-2.5 w-full">
                      <option value="">Selecione a conta…</option>
                      {contas.map(c => <option key={c.id} value={c.id}>{c.nome} — {fmt(c.saldo)}</option>)}
                    </select>
                  </div>

                  {/* Valor + quem pagou */}
                  <div className={`grid gap-3 ${dividido ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Valor</label>
                      <div className="flex items-baseline gap-1 input py-2.5">
                        <span className="text-sm font-bold text-muted-foreground">R$</span>
                        <input inputMode="numeric" value={fmtBR(l.valorRaw)}
                               onChange={e => setLinha(l.key, { valorRaw: e.target.value.replace(/\D/g, '') })}
                               className="text-lg font-bold text-foreground bg-transparent border-none outline-none w-full tabular p-0" />
                      </div>
                    </div>
                    {dividido && (
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Quem pagou</label>
                        <input value={l.quem} maxLength={40} placeholder="Ex.: Esposa"
                               onChange={e => setLinha(l.key, { quem: e.target.value })}
                               className="input py-2.5 w-full" />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <button onClick={addLinha}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-sm font-semibold text-muted-foreground hover:bg-muted/40 active:scale-[0.99] transition-all">
                <Plus size={15} /> Dividir com outra conta
              </button>

              {dividido && (
                <div className="flex items-center justify-between text-sm rounded-xl bg-muted/40 px-3.5 py-2.5">
                  <span className="text-muted-foreground">Total dos pagamentos</span>
                  <strong className={`tabular ${diferente ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'}`}>{fmt(total)}</strong>
                </div>
              )}
              {dividido && diferente && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400">
                  O total ({fmt(total)}) é diferente da fatura ({fmt(valorFatura)}). Pode ser pagamento parcial — se não for, ajuste os valores.
                </p>
              )}
            </div>
          )}

          {erro && <p className="text-xs text-red-600 font-medium" role="alert">{erro}</p>}
        </div>

        {/* Footer fixo */}
        <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-border bg-muted/20 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button onClick={onClose} className="btn-ghost px-4 py-2.5 text-sm">Cancelar</button>
          <button onClick={pagar} disabled={loading || !podePagar} className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Pagar {dividido ? fmt(total) : 'fatura'}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
