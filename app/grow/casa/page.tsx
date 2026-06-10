'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ShoppingCart, Sparkles, Loader2, Plus, Check, Trash2, X,
  Package, PackageCheck, PackageX, AlertTriangle, Boxes, ArrowRight, Send,
  Wrench, Bell, Clock, CheckCircle2, Calendar, Pencil, RotateCcw,
  ChefHat, Flame, Users, ChevronDown, UtensilsCrossed,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';

const BRAND = 'hsl(var(--primary))';
const LARANJA = '#f97316';   // accent das receitas (cozinha)

const TABS = [
  { v: 'compras',    l: 'Compras',     icon: ShoppingCart },
  { v: 'despensa',   l: 'Despensa',    icon: Package },
  { v: 'receitas',   l: 'Receitas',    icon: ChefHat },
  { v: 'manutencao', l: 'Manutenções', icon: Wrench },
];

const ICONES_RECEITA = ['🍳', '🍝', '🥘', '🍲', '🥗', '🍛', '🍜', '🧆', '🥞', '🍰', '🍞', '🥩'];

// Status de uma receita vs. despensa — quantos ingredientes você já tem
function statusReceita(receita: any, despensa: any[]): { falta: number; total: number; ok: number } {
  const ings = receita.ingredientes || [];
  if (!ings.length) return { falta: 0, total: 0, ok: 0 };
  const tem = despensa.filter((d: any) => d.status === 'tem').map((d: any) => d.nome.toLowerCase());
  const has = (nome: string) => { const b = nome.toLowerCase(); return tem.some(t => t.includes(b) || b.includes(t)); };
  const ok = ings.filter((i: any) => has(i.nome)).length;
  return { falta: ings.length - ok, total: ings.length, ok };
}

// Presets de frequência (dias)
const FREQUENCIAS = [
  { label: 'Mensal',      dias: 30 },
  { label: 'Bimestral',   dias: 60 },
  { label: 'Trimestral',  dias: 90 },
  { label: 'Semestral',   dias: 180 },
  { label: 'Anual',       dias: 365 },
];

const ICONES_MANUT = ['🔧', '💧', '❄️', '🐜', '🚗', '💡', '🔥', '🚿', '🧯', '🪟', '🛢️', '🌡️'];

// Status de uma manutenção, calculado a partir de última + frequência
type StatusManut = 'emdia' | 'breve' | 'atrasada' | 'fazer';
const STATUS_MANUT: Record<StatusManut, { label: string; cor: string; icon: any }> = {
  emdia:    { label: 'Em dia',        cor: '#10b981', icon: CheckCircle2 },
  breve:    { label: 'Vence em breve', cor: '#f59e0b', icon: Clock },
  atrasada: { label: 'Atrasada',      cor: '#ef4444', icon: AlertTriangle },
  fazer:    { label: 'Nunca feita',   cor: 'hsl(var(--primary))', icon: RotateCcw },
};

function calcManut(m: any): { status: StatusManut; dias: number | null; proxima: Date | null; pct: number } {
  if (!m.ultima_data) return { status: 'fazer', dias: null, proxima: null, pct: 0 };
  const ultima = new Date(m.ultima_data + 'T12:00:00');
  const proxima = new Date(ultima); proxima.setDate(proxima.getDate() + (m.frequencia_dias || 90));
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const dias = Math.round((proxima.getTime() - hoje.getTime()) / 86400000);
  const limiteBreve = Math.max(7, Math.round((m.frequencia_dias || 90) * 0.15));
  const status: StatusManut = dias < 0 ? 'atrasada' : dias <= limiteBreve ? 'breve' : 'emdia';
  const pct = Math.min(100, Math.max(0, Math.round((1 - dias / (m.frequencia_dias || 90)) * 100)));
  return { status, dias, proxima, pct };
}

function labelFrequencia(dias: number): string {
  const p = FREQUENCIAS.find(f => f.dias === dias);
  if (p) return p.label;
  if (dias % 30 === 0) return `A cada ${dias / 30} meses`;
  if (dias % 7 === 0) return `A cada ${dias / 7} semanas`;
  return `A cada ${dias} dias`;
}

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
  const [manutencoes, setManut] = useState<any[]>([]);   // manutenções
  const [receitas, setReceitas] = useState<any[]>([]);   // receitas
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setTab(s); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, tab); } catch {} }, [tab]);

  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const [c, d, mn, rc] = await Promise.allSettled([
        api.grow.compras.listar(phone),
        api.grow.despensa.listar(phone),
        api.grow.manutencoes.listar(phone),
        api.grow.receitas.listar(phone),
      ]);
      if (c.status === 'fulfilled') setItens(c.value.itens || []);
      if (d.status === 'fulfilled') setDespensa(d.value.itens || []);
      if (mn.status === 'fulfilled') setManut(mn.value.itens || []);
      if (rc.status === 'fulfilled') setReceitas(rc.value.itens || []);
    } finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── stats do hero por aba ──
  const pendentesCompra = itens.filter(i => !i.comprado).length;
  const faltandoDespensa = despensa.filter(d => d.status !== 'tem').length;
  const manutAtencao = manutencoes.filter(m => {
    const s = calcManut(m).status;
    return s === 'atrasada' || s === 'breve' || s === 'fazer';
  }).length;
  const receitasProntas = receitas.filter(r => {
    const s = statusReceita(r, despensa);
    return s.total > 0 && s.falta === 0;
  }).length;

  const subtitulo = tab === 'compras'
    ? `${pendentesCompra} pendente${pendentesCompra === 1 ? '' : 's'} · ${itens.length - pendentesCompra} comprado${itens.length - pendentesCompra === 1 ? '' : 's'}`
    : tab === 'despensa'
      ? (despensa.length ? `${despensa.length} item${despensa.length === 1 ? '' : 's'} · ${faltandoDespensa} pra repor` : 'Cadastre o que você sempre tem em casa.')
      : tab === 'receitas'
        ? (receitas.length ? `${receitas.length} receita${receitas.length === 1 ? '' : 's'}${receitasProntas ? ` · ${receitasProntas} dá pra fazer agora` : ''}` : 'Salve suas receitas e cozinhe sem stress.')
        : (manutencoes.length ? `${manutencoes.length} manutenç${manutencoes.length === 1 ? 'ão' : 'ões'} · ${manutAtencao} pedem atenção` : 'Nunca mais esqueça uma manutenção.');

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
          const badge = v === 'compras' ? pendentesCompra : v === 'despensa' ? faltandoDespensa : v === 'receitas' ? receitasProntas : manutAtencao;
          return (
            <button key={v} onClick={() => setTab(v)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                ativo ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
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
          <Loader2 size={22} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="animate-fade-in">
          {tab === 'compras'    && <TabCompras phone={phone!} itens={itens} setItens={setItens} onReload={carregar} />}
          {tab === 'despensa'   && <TabDespensa phone={phone!} despensa={despensa} setDespensa={setDespensa} onReload={carregar} onVerCompras={() => setTab('compras')} />}
          {tab === 'receitas'   && <TabReceitas phone={phone!} receitas={receitas} setReceitas={setReceitas} despensa={despensa} onReload={carregar} onVerCompras={() => setTab('compras')} />}
          {tab === 'manutencao' && <TabManutencoes phone={phone!} manutencoes={manutencoes} setManut={setManut} onReload={carregar} />}
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
                  className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setNovaCat(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                novaCat === c ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
                        item.comprado ? 'bg-primary scale-110' : 'bg-card border-2 border-muted-foreground/30 hover:border-primary'
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
          <StatBox icon={Boxes}          label="Itens"    value={contagem.total}    cor='hsl(var(--primary))' />
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
                  className="inline-flex items-center gap-1.5 px-4 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          {CATEGORIAS.map(c => (
            <button key={c} onClick={() => setNovaCat(c)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                novaCat === c ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
           borderColor: naLista ? `color-mix(in srgb, ${st.cor} 33%, transparent)` : 'hsl(var(--border) / 0.4)',
         }}>
      {/* halo de status */}
      {naLista && (
        <div className="absolute inset-0 pointer-events-none opacity-40"
             style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${st.cor} 13%, transparent) 0%, transparent 70%)` }} />
      )}
      <div className="relative">
        <div className="flex items-center gap-2 mb-2.5">
          <p className="flex-1 text-sm font-bold text-foreground truncate">{item.nome}</p>
          {naLista && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                  style={{ background: `color-mix(in srgb, ${st.cor} 10%, transparent)`, color: st.cor }}>
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

// ═══════════════════════════════════════════════════════════════════
// TAB 3 — RECEITAS (loop "cozinhar" com a lista de compras)
// ═══════════════════════════════════════════════════════════════════
function TabReceitas({ phone, receitas, setReceitas, despensa, onReload, onVerCompras }: any) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);

  // Ordena: dá pra fazer agora → falta pouco → resto
  const ordenadas = useMemo(() => {
    return [...receitas]
      .map((r: any) => ({ r, s: statusReceita(r, despensa) }))
      .sort((a, b) => {
        const fa = a.s.total === 0 ? 99 : a.s.falta;
        const fb = b.s.total === 0 ? 99 : b.s.falta;
        return fa - fb;
      });
  }, [receitas, despensa]);

  const prontas = ordenadas.filter(x => x.s.total > 0 && x.s.falta === 0).length;

  async function deletar(item: any) {
    if (!confirm(`Excluir a receita "${item.nome}"?`)) return;
    setReceitas((prev: any[]) => prev.filter(r => r.id !== item.id));
    try { await api.grow.receitas.deletar(item.id, phone); } catch (e: any) { alert(e.message); onReload(); }
  }

  return (
    <div className="space-y-4">
      {/* Banner: dá pra cozinhar agora */}
      {prontas > 0 && (
        <div className="relative overflow-hidden rounded-2xl border p-4"
             style={{ borderColor: '#10b98155', background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-40"
               style={{ background: 'radial-gradient(circle at top right, #10b98124 0%, transparent 70%)' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#10b9811A' }}>
              <UtensilsCrossed size={16} style={{ color: '#10b981' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">{prontas} receita{prontas === 1 ? '' : 's'} pra fazer agora</p>
              <p className="text-[11px] text-muted-foreground">Você já tem todos os ingredientes na despensa.</p>
            </div>
          </div>
        </div>
      )}

      {/* Nova receita */}
      <button onClick={() => { setEditando(null); setModalOpen(true); }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.99]">
        <Plus size={15} /> Nova receita
      </button>

      {/* Lista */}
      {receitas.length === 0 ? (
        <EmptyCard icon={ChefHat} titulo="Nenhuma receita ainda"
          desc='Salve suas receitas com os ingredientes. Na hora de cozinhar, a Sora confere a despensa e manda o que falta direto pra lista de compras.' />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ordenadas.map(({ r, s }: any, i: number) => (
            <ReceitaCard key={r.id} item={r} status={s} index={i} phone={phone} despensa={despensa}
              onReload={onReload} onVerCompras={onVerCompras}
              onEdit={() => { setEditando(r); setModalOpen(true); }} onDelete={() => deletar(r)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ModalReceita phone={phone} item={editando}
          onClose={() => { setModalOpen(false); setEditando(null); }}
          onSaved={() => { onReload(true); setModalOpen(false); setEditando(null); }} />
      )}
    </div>
  );
}

// ─── Card de receita ────────────────────────────────────────────────
function ReceitaCard({ item, status, index, phone, despensa, onReload, onVerCompras, onEdit, onDelete }: any) {
  const [aberto, setAberto] = useState(false);
  const [cozinhando, setCozinhando] = useState(false);
  const [resultado, setResultado] = useState<{ adicionados: string[]; jaTem: string[] } | null>(null);

  const ings = item.ingredientes || [];
  const temNome = useMemo(() => {
    const tem = despensa.filter((d: any) => d.status === 'tem').map((d: any) => d.nome.toLowerCase());
    return (nome: string) => { const b = nome.toLowerCase(); return tem.some((t: string) => t.includes(b) || b.includes(t)); };
  }, [despensa]);

  // estado visual: pronta (verde) / falta pouco (âmbar) / falta (laranja) / sem ingredientes
  const estado = status.total === 0 ? 'vazia'
    : status.falta === 0 ? 'pronta'
    : status.falta <= 2 ? 'quase' : 'falta';
  const corEstado = estado === 'pronta' ? '#10b981' : estado === 'quase' ? '#f59e0b' : LARANJA;
  const labelEstado = estado === 'vazia' ? 'Sem ingredientes'
    : estado === 'pronta' ? 'Dá pra fazer agora'
    : `Falta ${status.falta} item${status.falta === 1 ? '' : 's'}`;
  const meta = [
    item.tempo_min ? { icon: Clock, txt: `${item.tempo_min}min` } : null,
    item.porcoes ? { icon: Users, txt: `${item.porcoes} porç.` } : null,
    status.total ? { icon: UtensilsCrossed, txt: `${status.total} ingred.` } : null,
  ].filter(Boolean) as { icon: any; txt: string }[];

  async function cozinhar() {
    setCozinhando(true); setResultado(null);
    try {
      const r = await api.grow.receitas.cozinhar(item.id, phone);
      setResultado({ adicionados: r.adicionados || [], jaTem: r.jaTem || [] });
      if ((r.adicionados || []).length) onReload(true); // mexeu na lista de compras
    } catch (e: any) { alert(e.message || 'Não consegui preparar a lista.'); }
    finally { setCozinhando(false); }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 transition-all animate-[slide-up_500ms_ease-out_both]"
         style={{
           animationDelay: `${index * 40}ms`,
           background: 'hsl(var(--bg-card) / 0.5)',
           borderColor: estado === 'pronta' ? '#10b98155' : 'hsl(var(--border) / 0.4)',
         }}>
      {estado === 'pronta' && (
        <div className="absolute inset-0 pointer-events-none opacity-40"
             style={{ background: 'radial-gradient(circle at top right, #10b98122 0%, transparent 70%)' }} />
      )}
      <div className="relative">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: `${LARANJA}1A` }}>
            {item.icone || '🍳'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{item.nome}</p>
            <div className="flex items-center gap-2.5 mt-0.5 flex-wrap">
              {meta.map((mt, k) => (
                <span key={k} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular">
                  <mt.icon size={11} /> {mt.txt}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onEdit} aria-label="Editar receita" className="p-2 rounded-lg text-muted-foreground hover:bg-muted flex-shrink-0">
            <Pencil size={13} />
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: corEstado }}>
            {estado === 'pronta' ? <CheckCircle2 size={13} /> : estado === 'vazia' ? <AlertTriangle size={13} /> : <ShoppingCart size={13} />}
            {labelEstado}
          </span>
          {status.total > 0 && (
            <button onClick={() => setAberto(v => !v)} aria-expanded={aberto}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
              {aberto ? 'Ocultar' : 'Ver ingredientes'}
              <ChevronDown size={13} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>

        {/* Ingredientes + preparo (expansível) */}
        {aberto && (
          <div className="mb-3 rounded-xl bg-muted/30 p-3 space-y-2.5 animate-fade-in">
            <div className="space-y-1.5">
              {ings.map((ing: any) => {
                const tem = temNome(ing.nome);
                return (
                  <div key={ing.id || ing.nome} className="flex items-center gap-2 text-[13px]">
                    {tem
                      ? <Check size={13} className="text-emerald-500 flex-shrink-0" strokeWidth={3} />
                      : <span className="w-[13px] h-[13px] rounded-full border-2 border-muted-foreground/40 flex-shrink-0" />}
                    <span className={`flex-1 min-w-0 truncate ${tem ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{ing.nome}</span>
                    {ing.quantidade && <span className="text-[11px] text-muted-foreground tabular flex-shrink-0">{ing.quantidade}</span>}
                  </div>
                );
              })}
            </div>
            {item.modo_preparo && (
              <div className="pt-2.5 border-t border-border/40">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Modo de preparo</p>
                <p className="text-[13px] text-foreground/90 whitespace-pre-wrap leading-relaxed">{item.modo_preparo}</p>
              </div>
            )}
          </div>
        )}

        {/* Resultado do "cozinhar" */}
        {resultado && (
          <div className="mb-3 rounded-xl p-3 animate-fade-in" style={{ background: '#10b9810F', border: '1px solid #10b98133' }}>
            {resultado.adicionados.length > 0 ? (
              <>
                <p className="text-[13px] font-bold text-foreground flex items-center gap-1.5">
                  <ShoppingCart size={13} style={{ color: LARANJA }} /> {resultado.adicionados.length} na lista de compras
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{resultado.adicionados.join(', ')}</p>
                {resultado.jaTem.length > 0 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">✓ Você já tinha: {resultado.jaTem.join(', ')}</p>
                )}
                <button onClick={onVerCompras} className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold" style={{ color: LARANJA }}>
                  Ver lista de compras <ArrowRight size={12} />
                </button>
              </>
            ) : (
              <p className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Você tem tudo! Bom apetite 🍽️
              </p>
            )}
          </div>
        )}

        {/* Ações */}
        <div className="flex items-center gap-2">
          <button onClick={cozinhar} disabled={cozinhando || status.total === 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-white text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
            style={{ background: status.total === 0 ? '#9ca3af' : `linear-gradient(135deg, ${LARANJA} 0%, #ea580c 100%)` }}>
            {cozinhando ? <Loader2 size={14} className="animate-spin" /> : <Flame size={14} />}
            {cozinhando ? 'Conferindo despensa…' : 'Cozinhar'}
          </button>
          <button onClick={onDelete} aria-label="Excluir receita"
                  className="p-2.5 rounded-xl text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de receita (criar/editar) ────────────────────────────────
function ModalReceita({ phone, item, onClose, onSaved }: any) {
  const [nome, setNome]     = useState(item?.nome || '');
  const [icone, setIcone]   = useState(item?.icone || '🍳');
  const [tempo, setTempo]   = useState<string>(item?.tempo_min ? String(item.tempo_min) : '');
  const [porcoes, setPorcoes] = useState<string>(item?.porcoes ? String(item.porcoes) : '');
  const [preparo, setPreparo] = useState(item?.modo_preparo || '');
  const [ings, setIngs] = useState<{ nome: string; quantidade: string }[]>(
    item?.ingredientes?.length
      ? item.ingredientes.map((i: any) => ({ nome: i.nome, quantidade: i.quantidade || '' }))
      : [{ nome: '', quantidade: '' }]
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function setIng(i: number, campo: 'nome' | 'quantidade', val: string) {
    setIngs(prev => prev.map((x, k) => k === i ? { ...x, [campo]: val } : x));
  }
  function addIng() { setIngs(prev => [...prev, { nome: '', quantidade: '' }]); }
  function rmIng(i: number) { setIngs(prev => prev.length === 1 ? prev : prev.filter((_, k) => k !== i)); }

  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome pra receita.'); return; }
    setErro(''); setSalvando(true);
    const body = {
      phone, nome: nome.trim(), icone,
      tempo_min: tempo ? parseInt(tempo) : null,
      porcoes: porcoes ? parseInt(porcoes) : null,
      modo_preparo: preparo.trim() || undefined,
      ingredientes: ings.filter(i => i.nome.trim()).map(i => ({ nome: i.nome.trim(), quantidade: i.quantidade.trim() || undefined })),
    };
    try {
      if (item) await api.grow.receitas.atualizar(item.id, body);
      else await api.grow.receitas.adicionar(body);
      onSaved();
    } catch (e: any) { setErro(e.message || 'Não consegui salvar.'); setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">{item ? 'Editar receita' : 'Nova receita'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Ícone */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Ícone</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONES_RECEITA.map(ic => (
                <button key={ic} onClick={() => setIcone(ic)}
                  className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                    icone === ic ? 'ring-2 ring-orange-500 bg-orange-50 dark:bg-orange-950/40 scale-105' : 'bg-muted/40 hover:bg-muted'
                  }`}>{ic}</button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Nome da receita</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Strogonoff de frango" className="input" autoFocus maxLength={60} />
          </div>

          {/* Tempo + porções */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Tempo (min)</label>
              <input type="number" min={0} inputMode="numeric" value={tempo} onChange={e => setTempo(e.target.value)} placeholder="30" className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Porções</label>
              <input type="number" min={0} inputMode="numeric" value={porcoes} onChange={e => setPorcoes(e.target.value)} placeholder="4" className="input" />
            </div>
          </div>

          {/* Ingredientes */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Ingredientes</label>
            <div className="space-y-2">
              {ings.map((ing, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={ing.nome} onChange={e => setIng(i, 'nome', e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter' && i === ings.length - 1 && ing.nome.trim()) addIng(); }}
                         placeholder="Ingrediente" className="input flex-1" />
                  <input value={ing.quantidade} onChange={e => setIng(i, 'quantidade', e.target.value)}
                         placeholder="qtd" className="input w-20 text-center" />
                  <button onClick={() => rmIng(i)} aria-label="Remover ingrediente"
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex-shrink-0 disabled:opacity-30"
                          disabled={ings.length === 1}>
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addIng} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary dark:text-primary hover:underline">
              <Plus size={13} /> Adicionar ingrediente
            </button>
          </div>

          {/* Modo de preparo */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Modo de preparo <span className="normal-case font-normal text-muted-foreground/70">(opcional)</span></label>
            <textarea value={preparo} onChange={e => setPreparo(e.target.value)} rows={4}
                      placeholder={'1. Refogue a cebola e o alho...\n2. Adicione o frango...'}
                      className="input resize-none leading-relaxed" />
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !nome.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {item ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 4 — MANUTENÇÕES
// ═══════════════════════════════════════════════════════════════════
function TabManutencoes({ phone, manutencoes, setManut, onReload }: any) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);

  const comStatus = useMemo(() => {
    const rank: Record<StatusManut, number> = { atrasada: 0, fazer: 1, breve: 2, emdia: 3 };
    return manutencoes
      .map((m: any) => ({ m, calc: calcManut(m) }))
      .sort((a: any, b: any) => rank[a.calc.status as StatusManut] - rank[b.calc.status as StatusManut]);
  }, [manutencoes]);

  const contagem = useMemo(() => {
    const c = { emdia: 0, breve: 0, atrasada: 0, fazer: 0 };
    comStatus.forEach(({ calc }: any) => { c[calc.status as StatusManut]++; });
    return c;
  }, [comStatus]);

  async function marcarFeito(item: any) {
    setManut((prev: any[]) => prev.map(m => m.id === item.id ? { ...m, ultima_data: new Date().toISOString().slice(0, 10) } : m));
    try { await api.grow.manutencoes.feito(item.id, phone); onReload(true); }
    catch (e: any) { alert(e.message); onReload(); }
  }

  async function toggleLembrete(item: any) {
    const novo = !item.lembrete_ativo;
    setManut((prev: any[]) => prev.map(m => m.id === item.id ? { ...m, lembrete_ativo: novo } : m));
    try { await api.grow.manutencoes.atualizar(item.id, { phone, lembrete_ativo: novo }); }
    catch (e: any) { alert(e.message); onReload(); }
  }

  async function deletar(item: any) {
    setManut((prev: any[]) => prev.filter(m => m.id !== item.id));
    try { await api.grow.manutencoes.deletar(item.id, phone); } catch (e: any) { alert(e.message); onReload(); }
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      {manutencoes.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatBox icon={CheckCircle2}  label="Em dia"   value={contagem.emdia}                    cor="#10b981" />
          <StatBox icon={Clock}         label="Em breve" value={contagem.breve}                    cor="#f59e0b" />
          <StatBox icon={AlertTriangle} label="Atrasadas" value={contagem.atrasada + contagem.fazer} cor="#ef4444" />
        </div>
      )}

      {/* Nova manutenção */}
      <button onClick={() => { setEditando(null); setModalOpen(true); }}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.99]">
        <Plus size={15} /> Nova manutenção
      </button>

      {/* Lista */}
      {manutencoes.length === 0 ? (
        <EmptyCard icon={Wrench} titulo="Nenhuma manutenção"
          desc='Cadastre o que precisa de cuidado periódico (filtro de água, ar-condicionado, dedetização...). A Sora calcula a próxima data e pode te avisar no WhatsApp.' />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {comStatus.map(({ m, calc }: any, i: number) => (
            <ManutencaoCard key={m.id} item={m} calc={calc} index={i}
              onFeito={() => marcarFeito(m)} onToggleLembrete={() => toggleLembrete(m)}
              onEdit={() => { setEditando(m); setModalOpen(true); }} onDelete={() => deletar(m)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ModalManutencao phone={phone} item={editando}
          onClose={() => { setModalOpen(false); setEditando(null); }}
          onSaved={() => { onReload(true); setModalOpen(false); setEditando(null); }} />
      )}
    </div>
  );
}

// ─── Card de manutenção ─────────────────────────────────────────────
function ManutencaoCard({ item, calc, index, onFeito, onToggleLembrete, onEdit, onDelete }: any) {
  const st = STATUS_MANUT[calc.status as StatusManut];
  const StatusIcon = st.icon;
  const textoQuando = calc.status === 'fazer' ? 'Marque quando fizer pela 1ª vez'
    : calc.dias < 0 ? `Atrasada há ${Math.abs(calc.dias)} dia${Math.abs(calc.dias) === 1 ? '' : 's'}`
    : calc.dias === 0 ? 'Vence hoje'
    : `Próxima em ${calc.dias} dia${calc.dias === 1 ? '' : 's'}`;

  return (
    <div className="relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 transition-all animate-[slide-up_500ms_ease-out_both]"
         style={{
           animationDelay: `${index * 40}ms`,
           background: 'hsl(var(--bg-card) / 0.5)',
           borderColor: calc.status === 'emdia' ? 'hsl(var(--border) / 0.4)' : `color-mix(in srgb, ${st.cor} 33%, transparent)`,
         }}>
      {calc.status !== 'emdia' && (
        <div className="absolute inset-0 pointer-events-none opacity-40"
             style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${st.cor} 13%, transparent) 0%, transparent 70%)` }} />
      )}
      <div className="relative">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style={{ background: `color-mix(in srgb, ${st.cor} 10%, transparent)` }}>
            {item.icone || '🔧'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{item.nome}</p>
            <p className="text-[11px] text-muted-foreground tabular">
              {labelFrequencia(item.frequencia_dias)}
              {item.ultima_data && ` · última ${new Date(item.ultima_data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}`}
            </p>
          </div>
          {/* Lembrete + editar + excluir */}
          <button onClick={onToggleLembrete} aria-label={item.lembrete_ativo ? 'Desativar lembrete' : 'Ativar lembrete'} aria-pressed={item.lembrete_ativo}
                  className={`p-2 rounded-lg transition-colors flex-shrink-0 ${item.lembrete_ativo ? 'text-primary dark:text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}>
            <Bell size={15} fill={item.lembrete_ativo ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onEdit} aria-label="Editar" className="lg:opacity-0 lg:group-hover:opacity-100 p-2 rounded-lg text-muted-foreground hover:bg-muted flex-shrink-0">
            <Pencil size={13} />
          </button>
        </div>

        {/* Barra de progresso do ciclo */}
        <div className="h-2 rounded-full bg-muted overflow-hidden mb-2.5">
          <div className="h-full transition-all duration-700"
               style={{ width: `${calc.status === 'fazer' ? 100 : calc.pct}%`, background: st.cor }} />
        </div>

        {/* Status + ação */}
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: st.cor }}>
            <StatusIcon size={13} /> {textoQuando}
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={onDelete} aria-label="Excluir" className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
              <Trash2 size={13} />
            </button>
            <button onClick={onFeito}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                    style={{ background: `color-mix(in srgb, ${st.cor} 10%, transparent)`, color: st.cor }}>
              <Check size={13} /> Fiz hoje
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de manutenção (criar/editar) ─────────────────────────────
function ModalManutencao({ phone, item, onClose, onSaved }: any) {
  const [nome, setNome]       = useState(item?.nome || '');
  const [icone, setIcone]     = useState(item?.icone || '🔧');
  const [freq, setFreq]       = useState<number>(item?.frequencia_dias || 90);
  const [primeiraVez, setPrimeiraVez] = useState<boolean>(!item?.ultima_data);
  const [ultima, setUltima]   = useState<string>(item?.ultima_data || new Date().toISOString().slice(0, 10));
  const [lembrete, setLembrete] = useState<boolean>(item?.lembrete_ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!nome.trim()) { setErro('Dê um nome pra manutenção.'); return; }
    setErro(''); setSalvando(true);
    const body = {
      phone, nome: nome.trim(), icone, frequencia_dias: freq,
      ultima_data: primeiraVez ? null : ultima, lembrete_ativo: lembrete,
    };
    try {
      if (item) await api.grow.manutencoes.atualizar(item.id, body);
      else await api.grow.manutencoes.adicionar(body);
      onSaved();
    } catch (e: any) { setErro(e.message || 'Não consegui salvar.'); setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">{item ? 'Editar manutenção' : 'Nova manutenção'}</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Ícone */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Ícone</label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONES_MANUT.map(ic => (
                <button key={ic} onClick={() => setIcone(ic)}
                  className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all ${
                    icone === ic ? 'ring-2 ring-primary bg-primary/10 dark:bg-primary/10/40 scale-105' : 'bg-muted/40 hover:bg-muted'
                  }`}>{ic}</button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">O que é</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Trocar filtro de água" className="input" autoFocus maxLength={60} />
          </div>

          {/* Frequência */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">A cada quanto tempo</label>
            <div className="flex gap-1.5 flex-wrap mb-2">
              {FREQUENCIAS.map(f => (
                <button key={f.dias} onClick={() => setFreq(f.dias)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all ${
                    freq === f.dias ? 'bg-primary text-white' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}>{f.label}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" min={1} value={freq} onChange={e => setFreq(parseInt(e.target.value) || 1)} className="input w-20 text-center" />
              <span className="text-sm text-muted-foreground">dias entre cada manutenção</span>
            </div>
          </div>

          {/* Última vez */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer select-none mb-2">
              <input type="checkbox" checked={primeiraVez} onChange={e => setPrimeiraVez(e.target.checked)} className="w-4 h-4 accent-primary" />
              <span className="text-xs font-semibold text-foreground">Nunca fiz / não sei a última vez</span>
            </label>
            {!primeiraVez && (
              <div>
                <label className="text-[11px] text-muted-foreground mb-1 block">Última vez que foi feita</label>
                <input type="date" value={ultima} max={new Date().toISOString().slice(0, 10)} onChange={e => setUltima(e.target.value)} className="input" />
              </div>
            )}
          </div>

          {/* Lembrete */}
          <label className="flex items-center justify-between gap-3 cursor-pointer select-none rounded-xl bg-muted/30 p-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bell size={15} className="text-primary dark:text-primary" /> Avisar no WhatsApp quando vencer
            </span>
            <button type="button" onClick={() => setLembrete(v => !v)} role="switch" aria-checked={lembrete}
                    className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${lembrete ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lembrete ? 'translate-x-5' : ''}`} />
            </button>
          </label>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !nome.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {item ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat box (estilo glow das outras abas) ─────────────────────────
function StatBox({ icon: Icon, label, value, cor }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${cor} 14%, transparent) 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-2" style={{ background: `color-mix(in srgb, ${cor} 10%, transparent)` }}>
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
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${BRAND} 9%, transparent)` }}>
        <Icon size={26} style={{ color: BRAND }} />
      </div>
      <p className="text-base font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">{desc}</p>
    </div>
  );
}
