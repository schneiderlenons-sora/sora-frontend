'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';

type Wallet = { id: string; nome: string; tipo?: string };

interface Props {
  tx: any;
  phone: string;
  wallets: Wallet[];
  onClose: () => void;
  onSaved: () => void;
  /** Opt-in (#6 otimista): se fornecido, o modal fecha na HORA e delega o save
   *  — o pai troca a linha no cache na hora e chama `doSave()` em segundo plano
   *  (rollback no erro). Ausente → fluxo await padrão. */
  onOptimisticSave?: (optimisticRow: any, doSave: () => Promise<any>) => void;
}

// Modal de edição de uma transação — principal uso: corrigir a categoria
// (Open Finance traz muita coisa como "Outros"). Também ajusta tipo, valor,
// descrição, conta, data e status. Usa PUT /api/transacoes/:id.
export default function EditarTransacaoModal({ tx, phone, wallets, onClose, onSaved, onOptimisticSave }: Props) {
  const [tipo,       setTipo]       = useState<'Gasto' | 'Recebimento'>(tx.tipo === 'Recebimento' ? 'Recebimento' : 'Gasto');
  const [categoria,  setCategoria]  = useState<string>(tx.categoria || '');
  const [valor,      setValor]      = useState<string>(String(tx.valor ?? ''));
  const [observacao, setObservacao] = useState<string>(tx.observacao || '');
  const [carteira,   setCarteira]   = useState<string>(tx.carteira_nome || tx.wallet_nome || '');
  const [data,       setData]       = useState<string>((tx.data || '').slice(0, 10));
  const [pago,       setPago]       = useState<boolean>(tx.pago !== false);

  const [cats,     setCats]     = useState<string[]>(tx.categoria ? [tx.categoria] : []);
  const [salvando, setSalvando] = useState(false);
  const [erro,     setErro]     = useState('');

  // Carrega o catálogo de categorias do grupo pro seletor.
  useEffect(() => {
    api.categorias.listar(phone)
      .then((cs: any[]) => {
        const nomes = (cs || []).map(c => c.nome).filter(Boolean);
        setCats(Array.from(new Set([tx.categoria, ...nomes].filter(Boolean))));
      })
      .catch(() => { /* mantém ao menos a atual */ });
  }, [phone, tx.categoria]);

  async function salvar() {
    if (salvando) return;
    setErro('');
    const v = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(v) || v <= 0) { setErro('Informe um valor válido.'); return; }

    const payload = {
      phone, tipo, categoria: categoria || 'Outros', valor: v,
      observacao, carteira_nome: carteira || undefined, data, pago,
    };

    // #6 otimista (opt-in): fecha na hora e delega o save pro pai, que troca a
    // linha no cache imediatamente e chama a API em segundo plano.
    if (onOptimisticSave) {
      const optimisticRow = { ...tx, ...payload, wallet_nome: carteira || undefined };
      onOptimisticSave(optimisticRow, () => api.transacoes.editar(tx.id, payload));
      onClose();
      return;
    }

    setSalvando(true);
    try {
      await api.transacoes.editar(tx.id, payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Editar transação</h2>
          <button onClick={() => !salvando && onClose()} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
            {(['Gasto', 'Recebimento'] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                      className={`h-10 rounded-xl text-sm font-bold transition-all ${
                        tipo === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}>
                {t === 'Gasto' ? '🔴 Gasto' : '🟢 Recebimento'}
              </button>
            ))}
          </div>

          {/* Categoria (destaque) */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} className="input w-full">
              {!cats.includes(categoria) && categoria && <option value={categoria}>{nomeCategoria(categoria)}</option>}
              {cats.map(c => <option key={c} value={c}>{nomeCategoria(c)}</option>)}
              {!cats.includes('Outros') && <option value="Outros">Outros</option>}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Descrição</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} className="input w-full" placeholder="Ex.: Mercado, Uber…" />
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Valor (R$)</label>
              <input type="number" step="any" value={valor} onChange={e => setValor(e.target.value)} className="input w-full tabular" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full" />
            </div>
          </div>

          {/* Conta */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Conta / cartão</label>
            <select value={carteira} onChange={e => setCarteira(e.target.value)} className="input w-full">
              {carteira && !wallets.some(w => w.nome === carteira) && <option value={carteira}>{carteira}</option>}
              {wallets.map(w => <option key={w.id} value={w.nome}>{w.nome}</option>)}
            </select>
          </div>

          {/* Pago */}
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
            <span className="text-sm font-medium text-foreground">Pago</span>
            <input type="checkbox" checked={pago} onChange={e => setPago(e.target.checked)} className="w-5 h-5 accent-primary" />
          </label>

          {erro && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={() => !salvando && onClose()} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
