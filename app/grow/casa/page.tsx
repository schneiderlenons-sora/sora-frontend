'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ShoppingCart, Sparkles, Loader2, Plus, Check, Trash2, X,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';

const BRAND = '#7c3aed';

const CATEGORIAS = [
  '🥬 Hortifruti', '🥩 Carnes', '🥛 Laticínios', '🍞 Padaria',
  '🍝 Mercearia', '🧴 Higiene', '🧼 Limpeza', '🥤 Bebidas',
  '🍫 Doces', '🐾 Pet', '📦 Outros',
];

export default function CasaPage() {
  const { phone } = useAuth();
  const [itens, setItens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoNome, setNovoNome] = useState('');
  const [novaCat,  setNovaCat]  = useState<string>('📦 Outros');
  const [novaQtd,  setNovaQtd]  = useState('1');

  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const r = await api.grow.compras.listar(phone);
      setItens(r.itens || []);
    } finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const porCategoria = useMemo(() => {
    const m: Record<string, any[]> = {};
    itens.forEach(i => {
      const c = i.categoria || '📦 Outros';
      if (!m[c]) m[c] = [];
      m[c].push(i);
    });
    return m;
  }, [itens]);

  const pendentes = itens.filter(i => !i.comprado).length;
  const total = itens.length;
  const pct = total > 0 ? Math.round(((total - pendentes) / total) * 100) : 0;

  async function adicionar() {
    if (!phone || !novoNome.trim()) return;
    try {
      const novo = await api.grow.compras.adicionar({ phone, nome: novoNome.trim(), quantidade: novaQtd, categoria: novaCat });
      setItens(prev => [novo, ...prev]);
      setNovoNome('');
    } catch (e: any) { alert(e.message); }
  }

  async function toggleItem(item: any) {
    if (!phone) return;
    setItens(prev => prev.map(i => i.id === item.id ? { ...i, comprado: !i.comprado } : i));
    try { await api.grow.compras.atualizar(item.id, { phone, comprado: !item.comprado }); }
    catch (e: any) { alert(e.message); carregar(); }
  }

  async function deletar(item: any) {
    if (!phone) return;
    setItens(prev => prev.filter(i => i.id !== item.id));
    try { await api.grow.compras.deletar(item.id, phone); } catch (e: any) { alert(e.message); carregar(); }
  }

  async function limparComprados() {
    if (!phone) return;
    if (!confirm('Remover todos os itens já comprados?')) return;
    // Otimista: remove já da UI
    setItens(prev => prev.filter(i => !i.comprado));
    try { await api.grow.compras.limpar(phone); carregar(true); }
    catch (e: any) { alert(e.message); carregar(true); }
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Casa"
        badgeColor="#d97706"
        badgeBgClass="bg-amber-100 dark:bg-amber-950/40"
        haloRgba="rgba(245,158,11,0.12)"
        titulo="Lista de compras"
        subtitulo={`${pendentes} pendente${pendentes === 1 ? '' : 's'} · ${total - pendentes} comprado${total - pendentes === 1 ? '' : 's'}`}
      >
        {total - pendentes > 0 && (
          <button onClick={limparComprados} className="btn-ghost px-3 py-2 text-xs gap-1.5 inline-flex items-center">
            <Trash2 size={12} /> Limpar comprados
          </button>
        )}
      </GrowHero>

      {total > 0 && (
        <div className="card rounded-2xl p-4 animate-fade-in" style={{ animationDelay: '30ms' }}>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full transition-all duration-700"
                 style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2">{pct}% concluído</p>
        </div>
      )}

      {/* Adicionar */}
      <div className="card rounded-2xl p-4 animate-fade-in" style={{ animationDelay: '60ms' }}>
        <div className="flex gap-2">
          <input
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionar()}
            placeholder="Adicionar item..."
            className="input flex-1"
          />
          <input
            value={novaQtd}
            onChange={e => setNovaQtd(e.target.value)}
            placeholder="1"
            className="input w-16 text-center"
          />
          <button onClick={adicionar} disabled={!novoNome.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setNovaCat(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                novaCat === c ? 'bg-violet-600 text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card rounded-3xl p-12 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-violet-600" />
        </div>
      ) : itens.length === 0 ? (
        <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: `${BRAND}22` }}>
            <ShoppingCart size={26} style={{ color: BRAND }} />
          </div>
          <p className="text-base font-bold text-foreground">Lista vazia</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
            Adicione itens acima ou diga "comprar leite" pra Sora no WhatsApp.
          </p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
          {Object.entries(porCategoria).map(([cat, lista]) => (
            <div key={cat} className="card rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{cat}</p>
              <div className="space-y-1">
                {lista.map(item => (
                  <div key={item.id} className="group flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 transition-colors">
                    <button onClick={() => toggleItem(item)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                        item.comprado ? 'bg-violet-600 scale-110' : 'bg-card border-2 border-muted-foreground/30 hover:border-violet-500'
                      }`}>
                      {item.comprado && <Check size={13} className="text-white" strokeWidth={3} />}
                    </button>
                    <span className={`flex-1 text-sm font-medium ${item.comprado ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {item.nome}
                    </span>
                    {item.quantidade && item.quantidade !== '1' && (
                      <span className="text-xs text-muted-foreground tabular">{item.quantidade}</span>
                    )}
                    <button onClick={() => deletar(item)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40">
                      <X size={12} className="text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
