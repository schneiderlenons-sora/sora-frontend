'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import GrowHero from '@/components/grow/GrowHero';
import {
  CalendarDays, Plus, Loader2, Check, X, Trash2, Pencil, Bell, Clock,
  MapPin, ChevronLeft, ChevronRight, List, CalendarRange, CalendarX,
  User, Briefcase, Heart, Activity, Wallet, GraduationCap, Tag,
} from 'lucide-react';

const BRAND = '#7c3aed';
const STORAGE_KEY = 'sora-grow-agenda-view';

// ─── Categorias (cor + ícone + rótulo) ──────────────────────────────
type CatKey = 'pessoal' | 'trabalho' | 'familia' | 'saude' | 'financas' | 'estudos' | 'outro';
const CATEGORIAS: Record<CatKey, { label: string; cor: string; icon: any }> = {
  pessoal:  { label: 'Pessoal',  cor: '#7c3aed', icon: User },
  trabalho: { label: 'Trabalho', cor: '#2563eb', icon: Briefcase },
  familia:  { label: 'Família',  cor: '#db2777', icon: Heart },
  saude:    { label: 'Saúde',    cor: '#0d9488', icon: Activity },
  financas: { label: 'Finanças', cor: '#16a34a', icon: Wallet },
  estudos:  { label: 'Estudos',  cor: '#4f46e5', icon: GraduationCap },
  outro:    { label: 'Outro',    cor: '#64748b', icon: Tag },
};
const catDe = (k: string): { label: string; cor: string; icon: any } => CATEGORIAS[(k as CatKey)] || CATEGORIAS.outro;

const ANTEC = [
  { v: 0,    l: 'Na hora' },
  { v: 10,   l: '10 min antes' },
  { v: 30,   l: '30 min antes' },
  { v: 60,   l: '1 hora antes' },
  { v: 1440, l: '1 dia antes' },
];

// ─── Helpers de data ────────────────────────────────────────────────
const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const parseD = (s: string) => new Date(s + 'T12:00:00');
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DIAS_MIN = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function rotuloDia(dataStr: string): string {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = parseD(dataStr); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  if (diff === -1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

// 42 células (6 semanas) começando no domingo da 1ª semana
function matrizMes(ano: number, mes: number): Date[] {
  const primeiro = new Date(ano, mes, 1);
  const ini = new Date(primeiro); ini.setDate(1 - primeiro.getDay());
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(ini); d.setDate(ini.getDate() + i); return d; });
}

export default function AgendaPage() {
  const { phone } = useAuth();
  const [comps, setComps]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView]       = useState<'lista' | 'mes'>('lista');
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);
  const [dataPrefill, setDataPrefill] = useState<string | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY) as any; if (s === 'lista' || s === 'mes') setView(s); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, view); } catch {} }, [view]);

  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const r = await api.grow.compromissos.listar(phone);
      setComps(r.itens || []);
    } catch { /* tolerante: aba vazia se a migration ainda não rodou */ }
    finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  // próximos 7 dias (hoje incluso)
  const proximos7 = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const lim = new Date(hoje); lim.setDate(lim.getDate() + 7);
    return comps.filter(c => { const d = parseD(c.data); return d >= hoje && d <= lim; });
  }, [comps]);

  const proximo = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return comps.filter(c => parseD(c.data) >= hoje)[0] || null;
  }, [comps]);

  const subtitulo = comps.length === 0
    ? 'Seus compromissos num só lugar — e a Sora te lembra na hora.'
    : `${proximos7.length} esta semana${proximo ? ` · próximo: ${rotuloDia(proximo.data).toLowerCase()}${proximo.hora ? ` ${proximo.hora}` : ''}` : ''}`;

  function abrirNovo(data?: string) { setEditando(null); setDataPrefill(data || null); setModalOpen(true); }
  function abrirEdicao(c: any) { setEditando(c); setDataPrefill(null); setModalOpen(true); }

  async function deletar(c: any) {
    if (!confirm(`Excluir "${c.titulo}"?`)) return;
    setComps(prev => prev.filter(x => x.id !== c.id));
    try { await api.grow.compromissos.deletar(c.id, phone!); } catch (e: any) { alert(e.message); carregar(); }
  }

  return (
    <div className="max-w-5xl mx-auto pb-24 space-y-6">
      <GrowHero
        badge="Agenda"
        badgeIcon={CalendarDays}
        titulo="Agenda"
        subtitulo={subtitulo}
      />

      {/* Toggle de visão + Novo */}
      <div className="flex items-center justify-between gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/40">
          {([['lista', 'Próximos', List], ['mes', 'Mês', CalendarRange]] as const).map(([v, l, Icon]) => {
            const ativo = view === v;
            return (
              <button key={v} onClick={() => setView(v)} aria-pressed={ativo}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  ativo ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/20' : 'text-muted-foreground hover:text-foreground'
                }`}>
                <Icon size={13} /> {l}
              </button>
            );
          })}
        </div>
        <button onClick={() => abrirNovo()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/25 transition-all active:scale-[0.98]">
          <Plus size={15} /> <span className="hidden sm:inline">Novo compromisso</span><span className="sm:hidden">Novo</span>
        </button>
      </div>

      {loading ? (
        <div className="card rounded-3xl p-16 flex items-center justify-center">
          <Loader2 size={22} className="animate-spin text-violet-600" />
        </div>
      ) : (
        <div className="animate-fade-in">
          {view === 'lista'
            ? <ViewLista comps={comps} onEdit={abrirEdicao} onDelete={deletar} onNovo={() => abrirNovo()} />
            : <ViewMes comps={comps} onEdit={abrirEdicao} onDelete={deletar} onNovoNoDia={abrirNovo} />}
        </div>
      )}

      {modalOpen && (
        <ModalCompromisso phone={phone!} item={editando} dataPrefill={dataPrefill}
          onClose={() => { setModalOpen(false); setEditando(null); setDataPrefill(null); }}
          onSaved={() => { carregar(true); setModalOpen(false); setEditando(null); setDataPrefill(null); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW — PRÓXIMOS (lista agrupada por dia)
// ═══════════════════════════════════════════════════════════════════
function ViewLista({ comps, onEdit, onDelete, onNovo }: any) {
  const grupos = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const futuros = comps
      .filter((c: any) => parseD(c.data) >= hoje)
      .sort((a: any, b: any) => a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99'));
    const m: Record<string, any[]> = {};
    futuros.forEach((c: any) => { (m[c.data] = m[c.data] || []).push(c); });
    return Object.entries(m);
  }, [comps]);

  if (!grupos.length) {
    return <EmptyCard icon={CalendarX} titulo="Nenhum compromisso à frente"
      desc="Adicione reuniões, eventos, consultas ou aniversários — a Sora te lembra no WhatsApp na hora certa."
      acao={<button onClick={onNovo} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors"><Plus size={15} /> Criar compromisso</button>} />;
  }

  return (
    <div className="space-y-5">
      {grupos.map(([dia, lista]: any, gi: number) => (
        <div key={dia} className="animate-[slide-up_500ms_ease-out_both]" style={{ animationDelay: `${gi * 50}ms` }}>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <p className="text-sm font-bold text-foreground capitalize">{rotuloDia(dia)}</p>
            <span className="text-[11px] text-muted-foreground tabular">
              {parseD(dia).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
            </span>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] font-bold text-muted-foreground tabular">{lista.length}</span>
          </div>
          <div className="space-y-2">
            {lista.map((c: any) => <CompromissoCard key={c.id} c={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card de compromisso ────────────────────────────────────────────
function CompromissoCard({ c, onEdit, onDelete }: any) {
  const cat = catDe(c.categoria);
  const Icon = cat.icon;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl flex items-stretch transition-all hover:border-border/70"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      {/* barra de cor da categoria */}
      <div className="w-1 flex-shrink-0" style={{ background: cat.cor }} />
      {/* hora */}
      <div className="flex flex-col items-center justify-center w-16 flex-shrink-0 py-3 border-r border-border/30">
        {c.hora ? (
          <span className="text-sm font-bold text-foreground tabular tracking-tight">{c.hora}</span>
        ) : (
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center leading-tight">Dia<br />todo</span>
        )}
      </div>
      {/* corpo */}
      <div className="flex-1 min-w-0 py-2.5 px-3">
        <p className="text-sm font-bold text-foreground truncate">{c.titulo}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: cat.cor }}>
            <Icon size={10} /> {cat.label}
          </span>
          {c.local && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
              <MapPin size={10} className="flex-shrink-0" /> <span className="truncate">{c.local}</span>
            </span>
          )}
          {c.lembrete_ativo && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
              <Bell size={10} fill="currentColor" /> lembrete
            </span>
          )}
        </div>
      </div>
      {/* ações */}
      <div className="flex items-center gap-0.5 pr-2">
        <button onClick={onEdit} aria-label="Editar compromisso" className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={onDelete} aria-label="Excluir compromisso" className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW — MÊS (calendário)
// ═══════════════════════════════════════════════════════════════════
function ViewMes({ comps, onEdit, onDelete, onNovoNoDia }: any) {
  const hojeStr = iso(new Date());
  const [refMes, setRefMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() }; });
  const [selecionado, setSelecionado] = useState<string>(hojeStr);

  const porDia = useMemo(() => {
    const m: Record<string, any[]> = {};
    comps.forEach((c: any) => { (m[c.data] = m[c.data] || []).push(c); });
    Object.values(m).forEach(l => l.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')));
    return m;
  }, [comps]);

  const celulas = useMemo(() => matrizMes(refMes.ano, refMes.mes), [refMes]);
  const navMes = (delta: number) => setRefMes(({ ano, mes }) => {
    const d = new Date(ano, mes + delta, 1); return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const irHoje = () => { const d = new Date(); setRefMes({ ano: d.getFullYear(), mes: d.getMonth() }); setSelecionado(hojeStr); };

  const eventosDoDia = (porDia[selecionado] || []);

  return (
    <div className="space-y-4">
      {/* Header do mês */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground capitalize">
          {MESES[refMes.mes]} <span className="text-muted-foreground font-semibold">{refMes.ano}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={irHoje} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 transition-colors">Hoje</button>
          <button onClick={() => navMes(-1)} aria-label="Mês anterior" className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={() => navMes(1)} aria-label="Próximo mês" className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Grade */}
      <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-2 sm:p-3" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="grid grid-cols-7 mb-1">
          {DIAS_MIN.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celulas.map((d, i) => {
            const ds = iso(d);
            const noMes = d.getMonth() === refMes.mes;
            const ehHoje = ds === hojeStr;
            const sel = ds === selecionado;
            const eventos = porDia[ds] || [];
            return (
              <button key={i} onClick={() => setSelecionado(ds)} aria-label={`${d.getDate()} — ${eventos.length} compromisso(s)`} aria-pressed={sel}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 ${
                  sel ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                      : ehHoje ? 'bg-violet-500/10 text-foreground'
                      : noMes ? 'text-foreground hover:bg-muted/60' : 'text-muted-foreground/40 hover:bg-muted/40'
                }`}>
                <span className={`text-[13px] tabular ${ehHoje && !sel ? 'font-bold text-violet-600 dark:text-violet-400' : sel ? 'font-bold' : 'font-medium'}`}>{d.getDate()}</span>
                {eventos.length > 0 && (
                  <div className="flex items-center gap-0.5">
                    {eventos.slice(0, 3).map((e: any, k: number) => (
                      <span key={k} className="w-1.5 h-1.5 rounded-full" style={{ background: sel ? 'rgba(255,255,255,0.9)' : catDe(e.categoria).cor }} />
                    ))}
                    {eventos.length > 3 && <span className={`text-[8px] font-bold ${sel ? 'text-white/90' : 'text-muted-foreground'}`}>+</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Eventos do dia selecionado */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-bold text-foreground capitalize">{rotuloDia(selecionado)}</p>
          <button onClick={() => onNovoNoDia(selecionado)}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-violet-600 dark:text-violet-400 hover:underline">
            <Plus size={13} /> Adicionar nesse dia
          </button>
        </div>
        {eventosDoDia.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center bg-muted/10">
            <p className="text-sm text-muted-foreground">Nada marcado nesse dia.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {eventosDoDia.map((c: any) => <CompromissoCard key={c.id} c={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL — criar / editar
// ═══════════════════════════════════════════════════════════════════
function ModalCompromisso({ phone, item, dataPrefill, onClose, onSaved }: any) {
  const [titulo, setTitulo]   = useState(item?.titulo || '');
  const [data, setData]       = useState<string>(item?.data || dataPrefill || iso(new Date()));
  const [diaTodo, setDiaTodo] = useState<boolean>(item ? !item.hora : false);
  const [hora, setHora]       = useState<string>(item?.hora || '09:00');
  const [categoria, setCategoria] = useState<CatKey>((item?.categoria as CatKey) || 'pessoal');
  const [local, setLocal]     = useState(item?.local || '');
  const [lembrete, setLembrete] = useState<boolean>(item?.lembrete_ativo ?? true);
  const [antec, setAntec]     = useState<number>(item?.lembrete_antecedencia ?? 60);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    if (!titulo.trim()) { setErro('Dê um título pro compromisso.'); return; }
    if (!data) { setErro('Escolha a data.'); return; }
    setErro(''); setSalvando(true);
    const body = {
      phone, titulo: titulo.trim(), data,
      hora: diaTodo ? null : hora,
      categoria, cor: CATEGORIAS[categoria].cor,
      local: local.trim() || undefined,
      lembrete_ativo: lembrete, lembrete_antecedencia: antec,
    };
    try {
      if (item) await api.grow.compromissos.atualizar(item.id, body);
      else await api.grow.compromissos.adicionar(body);
      onSaved();
    } catch (e: any) { setErro(e.message || 'Não consegui salvar.'); setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">{item ? 'Editar compromisso' : 'Novo compromisso'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Título */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Reunião com a equipe" className="input" autoFocus maxLength={80} />
          </div>

          {/* Data + hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} disabled={diaTodo}
                     className="input disabled:opacity-40" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none -mt-2">
            <input type="checkbox" checked={diaTodo} onChange={e => setDiaTodo(e.target.checked)} className="w-4 h-4 accent-violet-600" />
            <span className="text-xs font-semibold text-foreground">Dia todo (sem horário)</span>
          </label>

          {/* Categoria */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Categoria</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(CATEGORIAS) as CatKey[]).map(k => {
                const cat = CATEGORIAS[k]; const Icon = cat.icon; const ativo = categoria === k;
                return (
                  <button key={k} onClick={() => setCategoria(k)} aria-pressed={ativo}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all"
                    style={ativo
                      ? { background: cat.cor, color: '#fff' }
                      : { background: `${cat.cor}14`, color: cat.cor }}>
                    <Icon size={12} /> {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Local */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Local <span className="normal-case font-normal text-muted-foreground/70">(opcional)</span></label>
            <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Escritório, online…" className="input" maxLength={80} />
          </div>

          {/* Lembrete */}
          <div className="rounded-xl bg-muted/30 p-3 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bell size={15} className="text-violet-600 dark:text-violet-400" /> Lembrar no WhatsApp
              </span>
              <button type="button" onClick={() => setLembrete(v => !v)} role="switch" aria-checked={lembrete}
                      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${lembrete ? 'bg-violet-600' : 'bg-muted-foreground/30'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lembrete ? 'translate-x-5' : ''}`} />
              </button>
            </label>
            {lembrete && (
              <div className="flex gap-1.5 flex-wrap animate-fade-in">
                {ANTEC.map(a => (
                  <button key={a.v} onClick={() => setAntec(a.v)} aria-pressed={antec === a.v}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      antec === a.v ? 'bg-violet-600 text-white' : 'bg-card text-muted-foreground hover:bg-muted'
                    }`}>
                    <Clock size={10} /> {a.l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando || !titulo.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {item ? 'Salvar' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────
function EmptyCard({ icon: Icon, titulo, desc, acao }: any) {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 py-14 flex flex-col items-center text-center px-6 animate-fade-in bg-muted/10">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `${BRAND}18` }}>
        <Icon size={26} style={{ color: BRAND }} />
      </div>
      <p className="text-base font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">{desc}</p>
      {acao}
    </div>
  );
}
