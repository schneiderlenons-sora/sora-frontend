'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

const CATEGORIAS = [
  { emoji: '🛒', nome: 'Mercado' },
  { emoji: '🍽️', nome: 'Restaurante' },
  { emoji: '🚗', nome: 'Transporte' },
  { emoji: '💊', nome: 'Saúde' },
  { emoji: '🏠', nome: 'Aluguel' },
  { emoji: '📺', nome: 'Assinaturas' },
  { emoji: '🎬', nome: 'Lazer' },
  { emoji: '📚', nome: 'Educação' },
  { emoji: '👕', nome: 'Vestuário' },
  { emoji: '🐶', nome: 'Pet' },
  { emoji: '🥖', nome: 'Padaria' },
  { emoji: '🛜', nome: 'Internet' },
  { emoji: '✈️', nome: 'Viagem' },
  { emoji: '💰', nome: 'Salário' },
  { emoji: '🔄', nome: 'Transferência' },
  { emoji: '📦', nome: 'Outros' },
];

interface Props {
  phone: string;
  wallets: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function NovaTransacaoModal({ phone, wallets, onClose, onSuccess }: Props) {
  const [tipo,       setTipo]       = useState<'Gasto' | 'Receita'>('Gasto');
  const [valor,      setValor]      = useState('');
  const [descricao,  setDescricao]  = useState('');
  const [categoria,  setCategoria]  = useState('');
  const [catEmoji,   setCatEmoji]   = useState('');
  const [walletId,   setWalletId]   = useState(wallets[0]?.id || '');
  const [data,       setData]       = useState(new Date().toISOString().slice(0, 10));
  const [recorrente, setRecorrente] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [erro,       setErro]       = useState('');

  function handleValorInput(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    setValor(raw);
  }

  function formatValorDisplay(raw: string) {
    if (!raw) return '0,00';
    const num = parseInt(raw, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleSalvar() {
    if (!valor || valor === '0') return;
    if (!categoria) { setErro('Selecione uma categoria.'); return; }
    setErro('');
    setLoading(true);
    try {
      await api.transacoes.criar({
        phone,
        tipo,
        valor: parseInt(valor, 10) / 100,
        observacao: descricao,
        categoria: `${catEmoji} ${categoria}`,
        wallet_id: walletId || undefined,
        data,
        recorrente,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar transação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Nova Transação</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Toggle Despesa / Receita */}
          <div className="relative flex bg-muted rounded-2xl p-1">
            <div
              className="absolute top-1 bottom-1 rounded-xl transition-all duration-200"
              style={{
                width: 'calc(50% - 4px)',
                left: tipo === 'Gasto' ? '4px' : 'calc(50%)',
                background: tipo === 'Gasto' ? 'hsl(0 72% 58%)' : '#61D17B',
              }}
            />
            {(['Gasto', 'Receita'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`relative flex-1 py-2 text-sm font-semibold rounded-xl transition-colors duration-200 ${tipo === t ? 'text-white' : 'text-muted-foreground'}`}
              >
                {t === 'Gasto' ? '💸 Despesa' : '💰 Receita'}
              </button>
            ))}
          </div>

          {/* Valor */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Valor</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">R$</span>
              <input
                type="tel"
                inputMode="numeric"
                value={formatValorDisplay(valor)}
                onChange={handleValorInput}
                className="text-5xl font-bold text-foreground bg-transparent border-none outline-none text-center w-full tabular"
              />
            </div>
          </div>

          {/* Descrição */}
          <input
            type="text"
            placeholder="Ex: Supermercado, Academia, Netflix..."
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            className="input"
          />

          {/* Categorias */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">Categoria</p>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIAS.map(cat => (
                <button
                  key={cat.nome}
                  onClick={() => { setCategoria(cat.nome); setCatEmoji(cat.emoji); }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    categoria === cat.nome
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40 hover:bg-muted'
                  }`}
                >
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{cat.nome}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Conta */}
          {wallets.length > 0 && (
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Conta</label>
              <select value={walletId} onChange={e => setWalletId(e.target.value)} className="input">
                {wallets.map(w => (
                  <option key={w.id} value={w.id}>{w.nome}</option>
                ))}
              </select>
            </div>
          )}

          {/* Data */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2 block">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className="input" />
          </div>

          {/* Recorrente */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-medium text-foreground">Recorrente</p>
              <p className="text-xs text-muted-foreground">Se repete todo mês</p>
            </div>
            <button
              onClick={() => setRecorrente(v => !v)}
              className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
              style={{ background: recorrente ? '#61D17B' : 'hsl(var(--fg-muted) / .3)' }}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${recorrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {erro && <p className="text-xs text-red-500 text-center">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={loading || !valor || valor === '0'}
            className="btn btn-primary w-full"
            style={{ padding: '12px 16px', fontSize: '15px' }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar transação'}
          </button>
        </div>
      </div>
    </div>
  );
}
