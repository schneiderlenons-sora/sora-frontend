'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

const BRAND = '#61ce70';

const CATEGORIAS = [
  { v: 'trafego_pago',  label: 'Tráfego pago',  emoji: '📣' },
  { v: 'ferramentas',   label: 'Ferramentas',   emoji: '🛠️' },
  { v: 'equipe',        label: 'Equipe',        emoji: '👥' },
  { v: 'assinaturas',   label: 'Assinaturas',   emoji: '🔁' },
  { v: 'mentoria',      label: 'Mentoria',      emoji: '🎓' },
  { v: 'infra',         label: 'Infraestrutura', emoji: '🖥️' },
  { v: 'operacional',   label: 'Operacional',   emoji: '📦' },
  { v: 'outros',        label: 'Outros',        emoji: '✨' },
];

const fmt = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);

export default function ModalCustos({ periodo, onClose }: { periodo: string; onClose: () => void }) {
  const { phone } = useAuth();
  const [custos, setCustos] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Form de novo custo
  const [categoria, setCategoria]   = useState('trafego_pago');
  const [descricao, setDescricao]   = useState('');
  const [valor, setValor]           = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [data, setData]             = useState(new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando]     = useState(false);

  async function carregar() {
    if (!phone) return;
    setCarregando(true);
    try { setCustos(await api.negocios.custos.listar(phone, periodo)); }
    catch { setCustos([]); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [phone, periodo]);

  async function adicionar() {
    if (!phone || !descricao.trim() || !valor) return;
    setEnviando(true);
    try {
      await api.negocios.custos.criar({
        phone,
        categoria,
        descricao: descricao.trim(),
        valor: parseFloat(valor.replace(',', '.')) || 0,
        data,
        fornecedor: fornecedor.trim() || undefined,
      });
      setDescricao(''); setValor(''); setFornecedor('');
      await carregar();
    } catch (e: any) { alert(e.message); }
    finally { setEnviando(false); }
  }

  async function deletar(id: string) {
    if (!confirm('Excluir este custo?')) return;
    try { await api.negocios.custos.deletar(id); await carregar(); }
    catch (e: any) { alert(e.message); }
  }

  const total = custos.reduce((s, c) => s + (c.valor || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>

        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground tracking-tight">Custos do negócio</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Total no período: <span className="font-bold text-foreground tabular-nums">{fmt(total)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        {/* Form novo custo */}
        <div className="p-5 border-b border-border bg-muted/10">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Adicionar custo</p>

          <div className="flex gap-1.5 overflow-x-auto mb-3 pb-1 -mx-1 px-1">
            {CATEGORIAS.map(c => (
              <button key={c.v}
                      onClick={() => setCategoria(c.v)}
                      className={`flex-shrink-0 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                        categoria === c.v ? 'text-white shadow-sm' : 'text-foreground bg-muted/40 hover:bg-muted'
                      }`}
                      style={categoria === c.v ? { background: BRAND } : undefined}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <input
              type="text"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descrição (ex: Meta Ads)"
              className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-foreground/40"
            />
            <input
              type="text"
              value={fornecedor}
              onChange={e => setFornecedor(e.target.value)}
              placeholder="Fornecedor (opcional)"
              className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-foreground/40"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={valor}
              onChange={e => setValor(e.target.value)}
              placeholder="R$ valor"
              className="px-3 py-2 rounded-xl bg-card border border-border text-sm font-mono tabular-nums focus:outline-none focus:border-foreground/40"
            />
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              className="px-3 py-2 rounded-xl bg-card border border-border text-sm font-mono focus:outline-none focus:border-foreground/40"
            />
            <button onClick={adicionar}
                    disabled={enviando || !descricao.trim() || !valor}
                    className="px-4 py-2 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-50 inline-flex items-center gap-1.5"
                    style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              {enviando ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Adicionar
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-5">
          {carregando ? (
            <div className="text-center py-8"><Loader2 size={16} className="animate-spin text-muted-foreground mx-auto" /></div>
          ) : custos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 italic">Nenhum custo lançado neste período.</p>
          ) : (
            <ul className="space-y-1.5">
              {custos.map(c => {
                const cat = CATEGORIAS.find(x => x.v === c.categoria);
                return (
                  <li key={c.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/60 hover:border-border transition-colors">
                    <span className="text-base flex-shrink-0">{cat?.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{c.descricao}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {cat?.label}{c.fornecedor ? ` · ${c.fornecedor}` : ''} · {new Date(c.data).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{fmt(c.valor)}</span>
                    <button onClick={() => deletar(c.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
