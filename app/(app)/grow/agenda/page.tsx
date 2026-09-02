'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import SectionSkeleton from '@/components/ui/SectionSkeleton';
import { useApi } from '@/lib/useApi';
import GrowHero from '@/components/grow/GrowHero';
import {
  CalendarDays, Plus, Loader2, Check, X, Trash2, Pencil, Bell, Clock,
  MapPin, ChevronLeft, ChevronRight, List, CalendarRange, CalendarX,
  User, Briefcase, Heart, Activity, Wallet, GraduationCap, Tag, ArrowUpRight,
  Home as HomeIcon, Stethoscope, Receipt, CreditCard, Wrench, Sun,
  ArrowLeftRight, TrendingUp, TrendingDown, ListChecks,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const STORAGE_KEY = 'sora-grow-agenda-view';
const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
// Formato compacto pra caber na célula do calendário: R$120 · R$1,2k · R$15k
const brlCompact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1000) return `R$${(a / 1000).toFixed(a >= 10000 ? 0 : 1).replace('.', ',')}k`;
  return `R$${Math.round(a)}`;
};

// ─── Categorias dos compromissos nativos (cor + ícone) ──────────────
type CatKey = 'pessoal' | 'trabalho' | 'familia' | 'saude' | 'financas' | 'estudos' | 'outro';
const CATEGORIAS: Record<CatKey, { label: string; cor: string; icon: any }> = {
  pessoal:  { label: 'Pessoal',  cor: 'hsl(var(--primary))', icon: User },
  trabalho: { label: 'Trabalho', cor: '#2563eb', icon: Briefcase },
  familia:  { label: 'Família',  cor: '#db2777', icon: Heart },
  saude:    { label: 'Saúde',    cor: '#0d9488', icon: Activity },
  financas: { label: 'Finanças', cor: '#16a34a', icon: Wallet },
  estudos:  { label: 'Estudos',  cor: '#4f46e5', icon: GraduationCap },
  outro:    { label: 'Outro',    cor: '#64748b', icon: Tag },
};

// ─── Famílias de origem (pro filtro + legenda do agregador) ─────────
type FamKey = 'compromisso' | 'tarefa' | 'saude' | 'financas' | 'casa' | 'transacao';
const FAMILIAS: Record<FamKey, { label: string; cor: string; icon: any }> = {
  compromisso: { label: 'Compromissos', cor: 'hsl(var(--primary))', icon: CalendarDays },
  tarefa:      { label: 'Tarefas',      cor: '#7c3aed', icon: ListChecks },
  saude:       { label: 'Saúde',        cor: '#0d9488', icon: Stethoscope },
  financas:    { label: 'Finanças',     cor: '#16a34a', icon: Wallet },
  casa:        { label: 'Casa',         cor: '#d97706', icon: HomeIcon },
  transacao:   { label: 'Movimentações', cor: '#0ea5e9', icon: ArrowLeftRight },
};
function familiaDe(source: string): FamKey {
  if (source === 'compromisso') return 'compromisso';
  if (source === 'tarefa') return 'tarefa';
  if (source === 'consulta') return 'saude';
  if (source === 'manutencao') return 'casa';
  if (source === 'transacao') return 'transacao';
  return 'financas';
}
// Ícone por source (mostrado na coluna de hora quando não há horário)
const ICONE_SOURCE: Record<string, any> = {
  compromisso: CalendarDays, consulta: Stethoscope, recorrencia: Receipt,
  divida: Receipt, fatura: CreditCard, fechamento: CreditCard, manutencao: Wrench,
  tarefa: ListChecks,       // tarefa do Grow com prazo (sempre privada)
  conta_negocio: Briefcase, // contas a pagar da empresa (aba Negócios)
  folha: User,              // salário de funcionário no dia do pagamento
};

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

function matrizMes(ano: number, mes: number): Date[] {
  const primeiro = new Date(ano, mes, 1);
  const ini = new Date(primeiro); ini.setDate(1 - primeiro.getDay());
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(ini); d.setDate(ini.getDate() + i); return d; });
}
const ordenarDia = (a: any, b: any) => (a.hora || '99:99').localeCompare(b.hora || '99:99');

export default function AgendaPage() {
  const { phone } = useAuth();
  const router = useRouter();
  const [view, setView]       = useState<'lista' | 'mes'>('lista');
  const [ocultas, setOcultas] = useState<Set<FamKey>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando]   = useState<any | null>(null);
  const [dataPrefill, setDataPrefill] = useState<string | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY) as any; if (s === 'lista' || s === 'mes') setView(s); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, view); } catch {} }, [view]);

  // ── Feed via SWR: mesma key do dashboard (GrowResumo) → cache compartilhado,
  // navegação instantânea entre o painel e a agenda.
  const { data: feedData, mutate: mFeed } = useApi(phone ? `grow:feed:${phone}` : null, () => api.grow.compromissos.feed(phone));
  const eventos: any[] = feedData?.eventos ?? [];
  const loading = feedData === undefined;
  const carregar = useCallback((_silent = false) => mFeed(), [mFeed]);

  // aplica filtro de famílias
  const visiveis = useMemo(() => eventos.filter(e => !ocultas.has(familiaDe(e.source))), [eventos, ocultas]);
  // Lista "Próximos" e as stats são só de AGENDA (compromissos, consultas,
  // contas…) — transações (passadas) só aparecem no calendário.
  const agendaVisiveis = useMemo(() => visiveis.filter(e => e.source !== 'transacao'), [visiveis]);

  const proximos7 = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const lim = new Date(hoje); lim.setDate(lim.getDate() + 7);
    return agendaVisiveis.filter(c => { const d = parseD(c.data); return d >= hoje && d <= lim; });
  }, [agendaVisiveis]);
  const proximo = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return [...agendaVisiveis].filter(c => parseD(c.data) >= hoje).sort((a, b) => a.data.localeCompare(b.data) || ordenarDia(a, b))[0] || null;
  }, [agendaVisiveis]);

  const subtitulo = eventos.length === 0
    ? 'Seus compromissos e tudo que tem data na Sora, num lugar só.'
    : `${proximos7.length} esta semana${proximo ? ` · próximo: ${rotuloDia(proximo.data).toLowerCase()}${proximo.hora ? ` ${proximo.hora}` : ''}` : ''}`;

  function toggleFamilia(f: FamKey) {
    setOcultas(prev => { const n = new Set(prev); n.has(f) ? n.delete(f) : n.add(f); return n; });
  }
  function abrirNovo(data?: string) { setEditando(null); setDataPrefill(data || null); setModalOpen(true); }
  function abrirEvento(e: any) {
    if (e.editavel) { setEditando(e.raw); setDataPrefill(null); setModalOpen(true); }
    else router.push(e.deeplink); // read-only → vai pra área de origem
  }
  async function deletar(e: any) {
    if (!e.editavel) return;
    if (!confirm(`Excluir "${e.titulo}"?`)) return;
    // Remoção otimista via SWR.
    try {
      await mFeed(
        async () => { await api.grow.compromissos.deletar(e.raw.id, phone!); return undefined; },
        {
          optimisticData: (cur: any) => ({ ...(cur || { eventos: [] }), eventos: (cur?.eventos || []).filter((x: any) => x.id !== e.id) }),
          rollbackOnError: true, populateCache: false, revalidate: true,
        },
      );
    } catch (err: any) { alert(err.message); }
  }

  return (
    <div className="max-w-7xl mx-auto pb-24 space-y-6">
      <GrowHero badge="Agenda" badgeIcon={CalendarDays} titulo="Agenda" subtitulo={subtitulo} />

      {/* Toggle de visão + Novo */}
      <div className="flex items-center justify-between gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/40">
          {([['lista', 'Próximos', List], ['mes', 'Mês', CalendarRange]] as const).map(([v, l, Icon]) => {
            const ativo = view === v;
            return (
              <button key={v} onClick={() => setView(v)} aria-pressed={ativo}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  ativo ? 'bg-primary text-white shadow-sm shadow-primary/20' : 'text-muted-foreground hover:text-foreground'
                }`}>
                <Icon size={13} /> {l}
              </button>
            );
          })}
        </div>
        <button onClick={() => abrirNovo()}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 transition-all active:scale-[0.98]">
          <Plus size={15} /> <span className="hidden sm:inline">Novo compromisso</span><span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* Filtro / legenda por origem */}
      <div className="flex items-center gap-1.5 flex-wrap animate-fade-in" style={{ animationDelay: '100ms' }}>
        {(Object.keys(FAMILIAS) as FamKey[]).map(f => {
          const fam = FAMILIAS[f]; const Icon = fam.icon; const on = !ocultas.has(f);
          return (
            <button key={f} onClick={() => toggleFamilia(f)} aria-pressed={on}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all border"
              style={on
                ? { background: `color-mix(in srgb, ${fam.cor} 8%, transparent)`, color: fam.cor, borderColor: `color-mix(in srgb, ${fam.cor} 25%, transparent)` }
                : { background: 'transparent', color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))', opacity: 0.55 }}>
              <Icon size={12} /> {fam.label}
            </button>
          );
        })}
      </div>

      {/* Briefing matinal */}
      {phone && <BriefingCard phone={phone} />}

      {loading ? (
        <SectionSkeleton />
      ) : (
        <div className="animate-fade-in">
          {view === 'lista'
            ? <ViewLista eventos={agendaVisiveis} onAbrir={abrirEvento} onDelete={deletar} onNovo={() => abrirNovo()} />
            : <ViewMes eventos={visiveis} onAbrir={abrirEvento} onDelete={deletar} onNovoNoDia={abrirNovo} />}
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
function ViewLista({ eventos, onAbrir, onDelete, onNovo }: any) {
  const grupos = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const futuros = eventos
      .filter((c: any) => parseD(c.data) >= hoje)
      .sort((a: any, b: any) => a.data.localeCompare(b.data) || ordenarDia(a, b));
    const m: Record<string, any[]> = {};
    futuros.forEach((c: any) => { (m[c.data] = m[c.data] || []).push(c); });
    return Object.entries(m);
  }, [eventos]);

  if (!grupos.length) {
    return <EmptyCard icon={CalendarX} titulo="Nada à frente"
      desc="Adicione um compromisso, ou ajuste o filtro de origem acima. Consultas, contas e manutenções com data aparecem aqui automaticamente."
      acao={<button onClick={onNovo} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold transition-colors"><Plus size={15} /> Criar compromisso</button>} />;
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
            {lista.map((e: any) => <EventoCard key={e.id} e={e} onAbrir={() => onAbrir(e)} onDelete={() => onDelete(e)} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Card de evento (compromisso editável OU agregado read-only) ────
function EventoCard({ e, onAbrir, onDelete }: any) {
  const fam = FAMILIAS[familiaDe(e.source)];
  const FamIcon = fam.icon;
  const SrcIcon = ICONE_SOURCE[e.source] || CalendarDays;
  const cat = e.source === 'compromisso' ? (CATEGORIAS[(e.raw?.categoria as CatKey)] || CATEGORIAS.outro) : null;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl flex items-stretch transition-all hover:border-border/70"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="w-1 flex-shrink-0" style={{ background: e.cor }} />
      {/* hora ou ícone da origem */}
      <div className="flex flex-col items-center justify-center w-16 flex-shrink-0 py-3 border-r border-border/30">
        {e.hora
          ? <span className="text-sm font-bold text-foreground tabular tracking-tight">{e.hora}</span>
          : <SrcIcon size={18} style={{ color: e.cor }} />}
      </div>
      {/* corpo */}
      <button onClick={onAbrir} className="flex-1 min-w-0 py-2.5 px-3 text-left">
        <p className="text-sm font-bold text-foreground line-clamp-2 break-words">{e.titulo}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: e.cor }}>
            {cat ? <cat.icon size={10} /> : <FamIcon size={10} />} {cat ? cat.label : fam.label}
          </span>
          {e.valor != null && (
            <span className="text-[11px] font-bold tabular" style={{ color: e.cor }}>{brl(e.valor)}</span>
          )}
          {e.local && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground min-w-0">
              <MapPin size={10} className="flex-shrink-0" /> <span className="truncate">{e.local}</span>
            </span>
          )}
          {e.editavel && e.raw?.lembrete_ativo && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary dark:text-primary">
              <Bell size={10} fill="currentColor" /> lembrete
            </span>
          )}
        </div>
      </button>
      {/* ações */}
      <div className="flex items-center gap-0.5 pr-2">
        {e.editavel ? (
          <>
            <button onClick={onAbrir} aria-label="Editar compromisso" className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} aria-label="Excluir compromisso" className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <button onClick={onAbrir} aria-label={`Abrir em ${fam.label}`} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ArrowUpRight size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// VIEW — MÊS (calendário)
// ═══════════════════════════════════════════════════════════════════
function ViewMes({ eventos, onAbrir, onDelete, onNovoNoDia }: any) {
  const hojeStr = iso(new Date());
  const [refMes, setRefMes] = useState(() => { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() }; });
  const [selecionado, setSelecionado] = useState<string>(hojeStr);

  // Separa AGENDA (compromissos, consultas, contas…) das TRANSAÇÕES (gastos/
  // receitas). Agenda vira chip/card; transação vira total do dia + lista no detalhe.
  const { porDiaAgenda, txPorDia } = useMemo(() => {
    const ag: Record<string, any[]> = {};
    const tx: Record<string, { gasto: number; receita: number; net: number; itens: any[] }> = {};
    for (const e of eventos as any[]) {
      if (e.source === 'transacao') {
        const d = (tx[e.data] = tx[e.data] || { gasto: 0, receita: 0, net: 0, itens: [] });
        if (e.tipo === 'gasto') d.gasto += e.valor || 0; else d.receita += e.valor || 0;
        d.itens.push(e);
      } else {
        (ag[e.data] = ag[e.data] || []).push(e);
      }
    }
    Object.values(ag).forEach(l => l.sort(ordenarDia));
    Object.values(tx).forEach(d => { d.net = d.receita - d.gasto; d.itens.sort((a, b) => (b.valor || 0) - (a.valor || 0)); });
    return { porDiaAgenda: ag, txPorDia: tx };
  }, [eventos]);

  const celulas = useMemo(() => matrizMes(refMes.ano, refMes.mes), [refMes]);
  const navMes = (delta: number) => setRefMes(({ ano, mes }) => {
    const d = new Date(ano, mes + delta, 1); return { ano: d.getFullYear(), mes: d.getMonth() };
  });
  const irHoje = () => { const d = new Date(); setRefMes({ ano: d.getFullYear(), mes: d.getMonth() }); setSelecionado(hojeStr); };
  const eventosDoDia = (porDiaAgenda[selecionado] || []);
  const txDoDia = txPorDia[selecionado];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground capitalize">
          {MESES[refMes.mes]} <span className="text-muted-foreground font-semibold">{refMes.ano}</span>
        </h2>
        <div className="flex items-center gap-1">
          <button onClick={irHoje} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-primary dark:text-primary hover:bg-primary/10 transition-colors">Hoje</button>
          <button onClick={() => navMes(-1)} aria-label="Mês anterior" className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={() => navMes(1)} aria-label="Próximo mês" className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-2 sm:p-3" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
          {DIAS_MIN.map((d, i) => (
            <div key={i} className="text-center sm:text-left sm:px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-1.5">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {celulas.map((d, i) => {
            const ds = iso(d);
            const noMes = d.getMonth() === refMes.mes;
            const ehHoje = ds === hojeStr;
            const sel = ds === selecionado;
            const evs = porDiaAgenda[ds] || [];
            const tx = txPorDia[ds];
            return (
              <div key={i} role="button" tabIndex={0}
                onClick={() => setSelecionado(ds)}
                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setSelecionado(ds); } }}
                aria-label={`${d.getDate()} — ${evs.length} compromisso${evs.length === 1 ? '' : 's'}`} aria-pressed={sel}
                className={`relative rounded-xl p-1 sm:p-1.5 min-h-[44px] sm:min-h-[112px] flex flex-col gap-1 cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  sel ? 'ring-2 ring-primary bg-primary/5'
                      : ehHoje ? 'bg-primary/10'
                      : noMes ? 'hover:bg-muted/50' : 'opacity-40 hover:bg-muted/30'
                }`}>
                {/* Número do dia */}
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[12px] sm:text-[13px] tabular leading-none w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
                    ehHoje ? 'bg-primary text-white font-bold' : noMes ? 'text-muted-foreground/50' : 'text-foreground font-medium'
                  }`}>{d.getDate()}</span>
                </div>
                {/* Pontinhos (mobile) — abaixo do número, centralizados e contidos
                    (flex-wrap garante que nunca escapem da célula) */}
                {evs.length > 0 && (
                  <div className="flex sm:hidden items-center justify-center gap-0.5 flex-wrap px-0.5" aria-hidden="true">
                    {evs.slice(0, 4).map((e: any, k: number) => (
                      <span key={k} className="w-1.5 h-1.5 rounded-full" style={{ background: e.cor }} />
                    ))}
                    {evs.length > 4 && <span className="text-[8px] font-bold text-muted-foreground leading-none">+</span>}
                  </div>
                )}
                {/* Chips com o título (desktop/tablet) */}
                {evs.length > 0 && (
                  <div className="hidden sm:flex flex-col gap-0.5 min-w-0">
                    {evs.slice(0, 3).map((e: any) => (
                      <button key={e.id} onClick={(ev) => { ev.stopPropagation(); onAbrir(e); }}
                        title={e.titulo}
                        className="w-full text-left rounded-md px-1.5 py-1 text-[10px] font-semibold leading-tight flex items-center gap-1 min-w-0 transition-all hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current"
                        style={{ background: `color-mix(in srgb, ${e.cor} 12%, transparent)`, color: e.cor }}>
                        {e.hora && <span className="tabular shrink-0 opacity-80">{e.hora}</span>}
                        <span className="truncate">{e.titulo}</span>
                      </button>
                    ))}
                    {evs.length > 3 && (
                      <button onClick={(ev) => { ev.stopPropagation(); setSelecionado(ds); }}
                        className="text-left text-[10px] font-bold text-muted-foreground hover:text-foreground px-1.5 transition-colors">
                        +{evs.length - 3} mais
                      </button>
                    )}
                  </div>
                )}
                {/* Total líquido do dia (transações) */}
                {tx && (
                  <div className="mt-auto flex items-center justify-center sm:justify-start px-0.5 pt-0.5">
                    <span className={`text-[9px] sm:text-[10px] font-bold tabular leading-none truncate ${tx.net < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {tx.net < 0 ? '−' : '+'}{brlCompact(tx.net)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-bold text-foreground capitalize">{rotuloDia(selecionado)}</p>
          <button onClick={() => onNovoNoDia(selecionado)}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-primary dark:text-primary hover:underline">
            <Plus size={13} /> Adicionar nesse dia
          </button>
        </div>
        {eventosDoDia.length === 0 && !txDoDia ? (
          <div className="rounded-2xl border border-dashed border-border/60 py-8 text-center bg-muted/10">
            <p className="text-sm text-muted-foreground">Nada nesse dia.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {eventosDoDia.map((e: any) => <EventoCard key={e.id} e={e} onAbrir={() => onAbrir(e)} onDelete={() => onDelete(e)} />)}
            {txDoDia && <MovimentacoesDoDia tx={txDoDia} onAbrir={onAbrir} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Card "Movimentações do dia" — gastos/receitas do dia selecionado
// ═══════════════════════════════════════════════════════════════════
function MovimentacoesDoDia({ tx, onAbrir }: any) {
  return (
    <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-4 space-y-3" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #0ea5e9 14%, transparent)' }}>
            <ArrowLeftRight size={13} style={{ color: '#0ea5e9' }} />
          </div>
          <p className="text-sm font-bold text-foreground">Movimentações</p>
        </div>
        <span className={`text-sm font-bold tabular ${tx.net < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {tx.net < 0 ? '−' : '+'}{brl(Math.abs(tx.net))}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-red-200/60 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/20 px-3 py-2 flex items-center gap-2 min-w-0">
          <TrendingDown size={14} className="text-red-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Gastos</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400 tabular truncate">{brl(tx.gasto)}</p>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-2 flex items-center gap-2 min-w-0">
          <TrendingUp size={14} className="text-emerald-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Receitas</p>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular truncate">{brl(tx.receita)}</p>
          </div>
        </div>
      </div>

      <div className="space-y-0.5">
        {tx.itens.map((t: any) => (
          <button key={t.id} onClick={() => onAbrir(t)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-left">
            <span className="flex items-center gap-2 min-w-0">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.tipo === 'gasto' ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-xs text-foreground truncate">{t.titulo}</span>
            </span>
            <span className={`text-xs font-bold tabular flex-shrink-0 ${t.tipo === 'gasto' ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {t.tipo === 'gasto' ? '−' : '+'}{brl(t.valor)}
            </span>
          </button>
        ))}
      </div>

      <button onClick={() => onAbrir(tx.itens[0])}
        className="w-full text-center text-[11px] font-bold text-muted-foreground hover:text-foreground pt-1 transition-colors">
        Ver no painel →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL — criar / editar compromisso
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
      phone, titulo: titulo.trim(), data, hora: diaTodo ? null : hora,
      categoria, cor: CATEGORIAS[categoria].cor, local: local.trim() || undefined,
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
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Reunião com a equipe" className="input" autoFocus maxLength={80} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} disabled={diaTodo} className="input disabled:opacity-40" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none -mt-2">
            <input type="checkbox" checked={diaTodo} onChange={e => setDiaTodo(e.target.checked)} className="w-4 h-4 accent-primary" />
            <span className="text-xs font-semibold text-foreground">Dia todo (sem horário)</span>
          </label>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Categoria</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(CATEGORIAS) as CatKey[]).map(k => {
                const cat = CATEGORIAS[k]; const Icon = cat.icon; const ativo = categoria === k;
                return (
                  <button key={k} onClick={() => setCategoria(k)} aria-pressed={ativo}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold transition-all"
                    style={ativo ? { background: cat.cor, color: '#fff' } : { background: `color-mix(in srgb, ${cat.cor} 8%, transparent)`, color: cat.cor }}>
                    <Icon size={12} /> {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Local <span className="normal-case font-normal text-muted-foreground/70">(opcional)</span></label>
            <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Escritório, online…" className="input" maxLength={80} />
          </div>

          <div className="rounded-xl bg-muted/30 p-3 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Bell size={15} className="text-primary dark:text-primary" /> Lembrar no WhatsApp
              </span>
              <button type="button" onClick={() => setLembrete(v => !v)} role="switch" aria-checked={lembrete}
                      className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${lembrete ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${lembrete ? 'translate-x-5' : ''}`} />
              </button>
            </label>
            {lembrete && (
              <div className="flex gap-1.5 flex-wrap animate-fade-in">
                {ANTEC.map(a => (
                  <button key={a.v} onClick={() => setAntec(a.v)} aria-pressed={antec === a.v}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                      antec === a.v ? 'bg-primary text-white' : 'bg-card text-muted-foreground hover:bg-muted'
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
// BRIEFING MATINAL (opt-in)
// ═══════════════════════════════════════════════════════════════════
function BriefingCard({ phone }: { phone: string }) {
  const [ativo, setAtivo]     = useState(false);
  const [horario, setHorario] = useState('07:00');
  const [carregado, setCarregado] = useState(false);
  const [status, setStatus]   = useState<'idle' | 'salvando' | 'salvo' | 'erro'>('idle');
  const [aberto, setAberto]   = useState(false);

  useEffect(() => {
    let vivo = true;
    api.grow.compromissos.briefing.get(phone)
      .then(r => { if (vivo) { setAtivo(!!r.ativo); setHorario(r.horario || '07:00'); if (r.ativo) setAberto(true); } })
      .catch(() => {})
      .finally(() => { if (vivo) setCarregado(true); });
    return () => { vivo = false; };
  }, [phone]);

  async function salvar(novoAtivo: boolean, novoHorario: string) {
    setStatus('salvando');
    try {
      await api.grow.compromissos.briefing.salvar({ phone, ativo: novoAtivo, horario: novoHorario });
      setStatus('salvo'); setTimeout(() => setStatus('idle'), 2000);
    } catch (e: any) { setStatus('erro'); alert(e.message || 'Não consegui salvar o briefing.'); }
  }
  function toggle() {
    const novo = !ativo; setAtivo(novo); if (novo) setAberto(true);
    salvar(novo, horario);
  }
  function mudarHorario(h: string) { setHorario(h); if (ativo) salvar(true, h); }

  if (!carregado) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4 animate-fade-in" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: 'radial-gradient(circle at top right, #f59e0b24 0%, transparent 70%)' }} />
      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#f59e0b1A' }}>
            <Sun size={16} style={{ color: '#d97706' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Briefing matinal</p>
            <p className="text-[11px] text-muted-foreground">A Sora te manda no WhatsApp tudo do seu dia, toda manhã.</p>
          </div>
          <button onClick={toggle} role="switch" aria-checked={ativo} aria-label="Ativar briefing matinal"
                  className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${ativo ? 'bg-amber-500' : 'bg-muted-foreground/30'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ativo ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {ativo && aberto && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/40 animate-fade-in">
            <Clock size={14} className="text-muted-foreground flex-shrink-0" />
            <label className="text-xs font-semibold text-foreground">Horário</label>
            <input type="time" value={horario} onChange={e => mudarHorario(e.target.value)} className="input w-28 py-1.5 text-sm" />
            <span className="flex-1" />
            {status === 'salvando' && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
            {status === 'salvo' && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><Check size={12} /> Salvo</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ────────────────────────────────────────────────────
function EmptyCard({ icon: Icon, titulo, desc, acao }: any) {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 py-14 flex flex-col items-center text-center px-6 animate-fade-in bg-muted/10">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: `color-mix(in srgb, ${BRAND} 9%, transparent)` }}>
        <Icon size={26} style={{ color: BRAND }} />
      </div>
      <p className="text-base font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">{desc}</p>
      {acao}
    </div>
  );
}
