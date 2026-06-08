'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ShoppingCart, Sparkles, Loader2, Plus, Check, Trash2, X,
  Package, PackageCheck, PackageX, AlertTriangle, Boxes, ArrowRight, Send,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';

const BRAND = '#7c3aed';

const TABS = [
  { v: 'compras',  l: 'Compras',  icon: ShoppingCart },
  { v: 'despensa', l: 'Despensa', icon: Package },
];

const CATEGORIAS = [
  '🥬 Hortifruti', '🥩 Carnes', '🥛 Laticínios', '🍞 Padaria',
  '🍝 Mercearia', '🧴 Higiene', '🧼 Limpeza', '🥤 Bebidas',
  '🍫 Doces', '🐾 Pet', '📦 Outros',
];

// Estados da despensa — cor + ícone + rótulo (nunca cor sozinha)
type StatusKey = 'tem' | 'acabando' | 'acabou';
const STATUS: Record<StatusKey, { label: string; cor: string; icon: typeof Package }> = {
  tem:      { label: 'Tem',      cor: '#10b981', icon: PackageCheck },
  acabando: { label: 'Acabando', cor: '#f59e0b', icon: AlertTriangle },
  acabou:   { label: 'Acabou',   cor: '#ef4444', icon: PackageX },
};

const STORAGE_KEY = 'sora-grow-casa-tab';

export default function CasaPage() {
  const { phone } = useAuth();
  const [tab, setTab] = useState('compras');
  const [itens, setItens]       = useState<any[]>([]);   // lista de compras
  const [despensa, setDespensa] = useState<any[]>([]);   // itens da despensa
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setTab(s); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, tab); } catch {} }, [tab]);

  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const [c, d] = await Promise.allSettled([
        api.grow.compras.listar(phone),
        api.grow.despensa.listar(phone),
      ]);
      if (c.status === 'fulfilled') setItens(c.value.itens || []);
      if (d.status === 'fulfilled') setDespensa(d.value.itens || []);
    } finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── stats do hero por aba ──
  const pendentesCompra = itens.filter(i => !i.comprado).length;
  const faltandoDespensa = despensa.filter(d => d.status !== 'tem').length;

  const subtitulo = tab === 'compras'
    ? `${pendentesCompra} pendente${pendentesCompra === 1 ? '' : 's'} · ${itens.length - pendentesCompra} comprado${itens.length - pendentesCompra === 1 ? '' : 's'}`
    : despensa.length
      ? `${despensa.length} item${despensa.length === 1 ? '' : 's'} · ${faltandoDespensa} pra repor`
      : 'Cadastre o que você sempre tem em casa.';

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <GrowHero
        badge="Casa"
        badgeColor="#d97706"
        badgeBgClass="bg-amber-100 dark:bg-amber-950/40"
        haloRgba="rgba(245,158,11,0.12)"
        titulo="Casa"
        subtitulo={subtitulo}
      />

      {/* TABS */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 animate-fade-in" style={{ animationDelay: '60ms' }}>
        {TABS.map(({ v, l, icon: Icon }) => {
          const ativo = tab === v;
          const badge = v === 'compras' ? pendentesCompra : faltandoDespensa;
          return (
            <button key={v} onClick={() => setTab(v)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                ativo ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}>
              <Icon size={12} />
              {l}
              {badge > 0 && (
                <span className={`ml-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-bold inline-flex items-center justify-center ${
                  ativo ? 'bg-white/25 text-white' : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                }`}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="card rounded-3xl p-16 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-violet-600" />
        </div>
      ) : (
        <div className="animate-fade-in">
          {tab === 'compras'  && <TabCompras phone={phone!} itens={itens} setItens={setItens} onReload={carregar} />}
          {tab === 'despensa' && <TabDespensa phone={phone!} despensa={despensa} setDespensa={setDespensa} onReload={carregar} onVerCompras={() => setTab('compras')} />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1 — COMPRAS (lista de compras)
// ═══════════════════════════════════════════════════════════════════
function TabCompras({ phone, itens, setItens, onReload }: any) {
  const [novoNome, setNovoNome] = useState('');
  const [novaCat,  setNovaCat]  = useState<string>('📦 Outros');
  const [novaQtd,  setNovaQtd]  = useState('1');
  const [enviando, setEnviando] = useState(false);
  const [enviado,  setEnviado]  = useState(false);

  const porCategoria = useMemo(() => {
    const m: Record<string, any[]> = {};
    itens.forEach((i: any) => {
      const c = i.categoria || '📦 Outros';
      (m[c] = m[c] || []).push(i);
    });
    return m;
  }, [itens]);

  const pendentes = itens.filter((i: any) => !i.comprado).length;
  const total = itens.length;
  const pct = total > 0 ? Math.round(((total - pendentes) / total) * 100) : 0;

  async function adicionar() {
    if (!phone || !novoNome.trim()) return;
    try {
      const novo = await api.grow.compras.adicionar({ phone, nome: novoNome.trim(), quantidade: novaQtd, categoria: novaCat });
      setItens((prev: any[]) => [novo, ...prev]);
      setNovoNome('');
    } catch (e: any) { alert(e.message); }
  }

  async function toggleItem(item: any) {
    setItens((prev: any[]) => prev.map(i => i.id === item.id ? { ...i, comprado: !i.comprado } : i));
    try {
      await api.grow.compras.atualizar(item.id, { phone, comprado: !item.comprado });
      if (item.despensa_item_id && !item.comprado) onReload(true); // repôs na despensa
    } catch (e: any) { alert(e.message); onReload(); }
  }

  async function deletar(item: any) {
    setItens((prev: any[]) => prev.filter(i => i.id !== item.id));
    try { await api.grow.compras.deletar(item.id, phone); } catch (e: any) { alert(e.message); onReload(); }
  }

  async function limparComprados() {
    if (!confirm('Remover todos os itens já comprados?')) return;
    setItens((prev: any[]) => prev.filter(i => !i.comprado));
    try { await api.grow.compras.limpar(phone); onReload(true); }
    catch (e: any) { alert(e.message); onReload(true); }
  }

  async function enviarWhatsapp() {
    setEnviando(true); setEnviado(false);
    try {
      await api.grow.compras.enviarWhatsapp(phone);
      setEnviado(true);
      setTimeout(() => setEnviado(false), 3000);
    } catch (e: any) { alert(e.message || 'Não consegui enviar a lista.'); }
    finally { setEnviando(false); }
  }

  return (
    <div className="space-y-4">
      {/* Progresso + ação */}
      {total > 0 && (
        <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{pct}% concluído</p>
            {total - pendentes > 0 && (
              <button onClick={limparComprados} className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-red-500 transition-colors">
                <Trash2 size={11} /> Limpar comprados
              </button>
            )}
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #f97316)' }} />
          </div>
        </div>
      )}

      {/* Adicionar */}
      <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex gap-2">
          <input value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionar()}
                 placeholder="Adicionar item..." className="input flex-1" />
          <input value={novaQtd} onChange={e => setNovaQtd(e.target.value)} placeholder="1" className="input w-14 text-center" />
          <button onClick={adicionar} disabled={!novoNome.trim()}
                  className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setNovaCat(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                novaCat === c ? 'bg-violet-600 text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Enviar lista pro WhatsApp */}
      {pendentes > 0 && (
        <button onClick={enviarWhatsapp} disabled={enviando}
          className={`w-full flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.99] disabled:opacity-60 ${
            enviado
              ? 'bg-emerald-600 text-white'
              : 'text-white shadow-lg shadow-emerald-600/25 hover:brightness-110'
          }`}
          style={enviado ? undefined : { background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)' }}>
          {enviando ? <Loader2 size={16} className="animate-spin" />
            : enviado ? <Check size={16} />
            : <Send size={15} />}
          {enviando ? 'Enviando…' : enviado ? 'Enviado! Confira o WhatsApp' : 'Enviar lista pro WhatsApp'}
        </button>
      )}

      {/* Lista */}
      {itens.length === 0 ? (
        <EmptyCard icon={ShoppingCart} titulo="Lista vazia" desc='Adicione itens acima, marque algo como "acabou" na Despensa, ou diga "comprar leite" pra Sora no WhatsApp.' />
      ) : (
        <div className="space-y-3">
          {Object.entries(porCategoria).map(([cat, lista]) => (
            <div key={cat} className="rounded-2xl border border-border/40 backdrop-blur-xl p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{cat}</p>
              <div className="space-y-1">
                {lista.map((item: any) => (
                  <div key={item.id} className="group flex items-center gap-3 p-2 rounded-xl hover:bg-muted/40 transition-colors">
                    <button onClick={() => toggleItem(item)} aria-label={item.comprado ? 'Desmarcar' : 'Marcar comprado'}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                        item.comprado ? 'bg-violet-600 scale-110' : 'bg-card border-2 border-muted-foreground/30 hover:border-violet-500'
                      }`}>
                      {item.comprado && <Check size={14} className="text-white" strokeWidth={3} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm font-medium ${item.comprado ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item.nome}</span>
                      {item.despensa_item_id && (
                        <span className="ml-2 inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 align-middle">
                          <Package size={9} /> despensa
                        </span>
                      )}
                    </div>
                    {item.quantidade && item.quantidade !== '1' && (
                      <span className="text-xs text-muted-foreground tabular">{item.quantidade}</span>
                    )}
                    <button onClick={() => deletar(item)} aria-label="Remover"
                            className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/40">
                      <X size={13} className="text-red-500" />
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

// ═══════════════════════════════════════════════════════════════════
// TAB 2 — DESPENSA (loop com a lista)
// ═══════════════════════════════════════════════════════════════════
function TabDespensa({ phone, despensa, setDespensa, onReload, onVerCompras }: any) {
  const [novoNome, setNovoNome] = useState('');
  const [novaCat,  setNovaCat]  = useState<string>('📦 Outros');

  const contagem = useMemo(() => ({
    total: despensa.length,
    acabando: despensa.filter((d: any) => d.status === 'acabando').length,
    acabou: despensa.filter((d: any) => d.status === 'acabou').length,
  }), [despensa]);

  const porCategoria = useMemo(() => {
    const m: Record<string, any[]> = {};
    // ordena: acabou → acabando → tem
    const ordem: Record<string, number> = { acabou: 0, acabando: 1, tem: 2 };
    [...despensa].sort((a, b) => (ordem[a.status] ?? 3) - (ordem[b.status] ?? 3)).forEach((i: any) => {
      const c = i.categoria || '📦 Outros';
      (m[c] = m[c] || []).push(i);
    });
    return m;
  }, [despensa]);

  async function adicionar() {
    if (!phone || !novoNome.trim()) return;
    try {
      const novo = await api.grow.despensa.adicionar({ phone, nome: novoNome.trim(), categoria: novaCat });
      setDespensa((prev: any[]) => [novo, ...prev]);
      setNovoNome('');
    } catch (e: any) { alert(e.message); }
  }

  async function mudarStatus(item: any, status: StatusKey) {
    if (item.status === status) return;
    setDespensa((prev: any[]) => prev.map(d => d.id === item.id ? { ...d, status } : d));
    try {
      await api.grow.despensa.atualizar(item.id, { phone, status });
      onReload(true); // o loop mexe na lista de compras — revalida em silêncio
    } catch (e: any) { alert(e.message); onReload(); }
  }

  async function deletar(item: any) {
    setDespensa((prev: any[]) => prev.filter(d => d.id !== item.id));
    try { await api.grow.despensa.deletar(item.id, phone); onReload(true); }
    catch (e: any) { alert(e.message); onReload(); }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {despensa.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox icon={Boxes}          label="Itens"    value={contagem.total}    cor="#7c3aed" />
          <StatBox icon={AlertTriangle}  label="Acabando" value={contagem.acabando} cor="#f59e0b" />
          <StatBox icon={PackageX}       label="Acabou"   value={contagem.acabou}   cor="#ef4444" />
        </div>
      )}

      {/* Banner do loop quando há itens a repor */}
      {(contagem.acabando + contagem.acabou) > 0 && (
        <button onClick={onVerCompras}
          className="w-full flex items-center gap-3 rounded-2xl border border-amber-300/50 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-left transition-all hover:scale-[1.005] active:scale-[0.99]">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/20">
            <ShoppingCart size={16} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{contagem.acabando + contagem.acabou} item(ns) na lista de compras</p>
            <p className="text-[11px] text-muted-foreground">Já adicionei o que tá acabando. Toque pra ver a lista.</p>
          </div>
          <ArrowRight size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
        </button>
      )}

      {/* Adicionar item à despensa */}
      <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex gap-2">
          <input value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && adicionar()}
                 placeholder="O que você sempre tem em casa..." className="input flex-1" />
          <button onClick={adicionar} disabled={!novoNome.trim()}
                  className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setNovaCat(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                novaCat === c ? 'bg-violet-600 text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Itens */}
      {despensa.length === 0 ? (
        <EmptyCard icon={Package} titulo="Despensa vazia"
          desc='Cadastre o que você sempre tem em casa (arroz, café, sabão...). Quando acabar, marque "Acabou" e a Sora joga direto na lista de compras.' />
      ) : (
        <div className="space-y-3">
          {Object.entries(porCategoria).map(([cat, lista]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">{cat}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {lista.map((item: any, i: number) => (
                  <DespensaCard key={item.id} item={item} index={i}
                    onStatus={(s: StatusKey) => mudarStatus(item, s)} onDelete={() => deletar(item)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card de item da despensa ───────────────────────────────────────
function DespensaCard({ item, index, onStatus, onDelete }: any) {
  const st = STATUS[item.status as StatusKey] || STATUS.tem;
  const naLista = item.status !== 'tem';
  return (
    <div className="group relative overflow-hidden rounded-2xl border backdrop-blur-xl p-3.5 transition-all animate-[slide-up_500ms_ease-out_both]"
         style={{
           animationDelay: `${index * 40}ms`,
           background: 'hsl(var(--bg-card) / 0.5)',
           borderColor: naLista ? `${st.cor}55` : 'hsl(var(--border) / 0.4)',
         }}>
      {/* halo de status */}
      {naLista && (
        <div className="absolute inset-0 pointer-events-none opacity-40"
             style={{ background: `radial-gradient(circle at top right, ${st.cor}22 0%, transparent 70%)` }} />
      )}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2.5">
          <p className="flex-1 text-sm font-bold text-foreground truncate">{item.nome}</p>
          {naLista && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: `${st.cor}1A`, color: st.cor }}>
              <ShoppingCart size={9} /> na lista
            </span>
          )}
          <button onClick={onDelete} aria-label="Remover item"
                  className="lg:opacity-0 lg:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 flex-shrink-0">
            <X size={13} className="text-red-500" />
          </button>
        </div>

        {/* Controle de status 3-estados (ícone + rótulo) */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted/40">
          {(['tem', 'acabando', 'acabou'] as StatusKey[]).map(s => {
            const conf = STATUS[s];
            const Icon = conf.icon;
            const ativo = item.status === s;
            return (
              <button key={s} onClick={() => onStatus(s)} aria-pressed={ativo}
                className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                  ativo ? 'text-white shadow-sm' : 'text-muted-foreground hover:bg-muted'
                }`}
                style={ativo ? { background: conf.cor } : undefined}>
                <Icon size={13} /> {conf.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Stat box (estilo glow das outras abas) ─────────────────────────
function StatBox({ icon: Icon, label, value, cor }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: `radial-gradient(circle at top right, ${cor}24 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: `${cor}1A` }}>
          <Icon size={16} style={{ color: cor }} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular tracking-tight mt-0.5" style={{ color: cor }}>{value}</p>
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────
function EmptyCard({ icon: Icon, titulo, desc }: any) {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 py-14 flex flex-col items-center text-center px-6 animate-fade-in bg-muted/10">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${BRAND}18` }}>
        <Icon size={26} style={{ color: BRAND }} />
      </div>
      <p className="text-base font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">{desc}</p>
    </div>
  );
}
