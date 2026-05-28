'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import ModalHabito, { periodoDoHorario } from '@/components/habitos/ModalHabito';
import GrowHero from '@/components/grow/GrowHero';
import {
  Plus, Target, Loader2, Check, Flame, Trash2, X, Sparkles, Pencil,
  Sun, Sunrise, Moon, Trophy, Calendar, BarChart3, Settings,
  ChevronLeft, ChevronRight, Award, Lock, GripVertical, Eye, EyeOff,
  Archive, ArchiveRestore, Activity,
} from 'lucide-react';

const BRAND = '#7c3aed';

const TABS = [
  { v: 'visao',      l: 'Visão',      icon: Target },
  { v: 'semana',     l: 'Semana',     icon: Calendar },
  { v: 'heatmap',    l: 'Heatmap',    icon: BarChart3 },
  { v: 'conquistas', l: 'Conquistas', icon: Trophy },
  { v: 'gerenciar',  l: 'Gerenciar',  icon: Settings },
];

const STORAGE_KEY = 'sora-grow-habitos-tab';

// ─── HELPERS ───────────────────────────────────────────────────────
const iso = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const fmtData = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const diaSemanaBR = (d: Date) => { const j = d.getDay(); return j === 0 ? 7 : j; };

function calcularStreak(habitoId: string, registros: any[]) {
  const set = new Set(registros.filter(r => r.habito_id === habitoId && r.concluido).map(r => r.data));
  let streak = 0;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  for (let i = 0; i < 400; i++) {
    const d = new Date(hoje); d.setDate(d.getDate() - i);
    if (set.has(iso(d))) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

function maiorStreak(habitoId: string, registros: any[]) {
  const datas = registros
    .filter(r => r.habito_id === habitoId && r.concluido)
    .map(r => r.data)
    .sort();
  let max = 0, cur = 0, prev: Date | null = null;
  for (const dStr of datas) {
    const d = new Date(dStr + 'T12:00:00');
    if (prev) {
      const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
      if (diff === 1) cur++;
      else cur = 1;
    } else cur = 1;
    if (cur > max) max = cur;
    prev = d;
  }
  return max;
}

export default function HabitosPage() {
  const { phone } = useAuth();
  const [habitos, setHabitos]       = useState<any[]>([]);
  const [registros, setRegistros]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editando, setEditando]     = useState<any | null>(null);
  const [tab, setTab]               = useState<string>('visao');
  const [incluirArquivados, setInclArq] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    try { const s = localStorage.getItem(STORAGE_KEY); if (s) setTab(s); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, tab); } catch {} }, [tab]);

  const carregar = useCallback(async (silent = false) => {
    if (!phone) return;
    if (!silent) setLoading(true);
    try {
      const r = await api.grow.habitos.listar(phone, { dias: 120, incluir_arquivados: true });
      setHabitos(r.habitos || []);
      setRegistros(r.registros || []);
    } finally { if (!silent) setLoading(false); }
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  function flash(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  }

  // Otimistic toggle — atualiza UI, persiste API, reverte se falhar
  async function toggleHabito(habito: any, data?: string) {
    if (!phone) return;
    const targetDate = data || iso(new Date());
    const existing = registros.find(r => r.habito_id === habito.id && r.data === targetDate);
    const novoValor = existing ? !existing.concluido : true;

    // Update otimista
    if (existing) {
      setRegistros(prev => prev.map(r =>
        r.habito_id === habito.id && r.data === targetDate ? { ...r, concluido: novoValor } : r
      ));
    } else {
      setRegistros(prev => [...prev, { habito_id: habito.id, data: targetDate, concluido: true }]);
    }

    // Confete só na primeira vez do dia
    if (novoValor && targetDate === iso(new Date())) {
      dispararConfete(habito.id, habito.cor);
    }

    try {
      await api.grow.habitos.toggle(habito.id, { phone, data: targetDate });
      if (data && data !== iso(new Date())) flash(`✓ Registrado em ${fmtData(targetDate)}`);
    } catch (e: any) {
      // Reverte
      setRegistros(prev => existing
        ? prev.map(r => r.habito_id === habito.id && r.data === targetDate ? { ...r, concluido: !novoValor } : r)
        : prev.filter(r => !(r.habito_id === habito.id && r.data === targetDate))
      );
      flash(e.message || 'Falhou ao registrar', false);
    }
  }

  function dispararConfete(habitoId: string, cor: string) {
    const el = document.querySelector(`[data-confete="${habitoId}"]`);
    if (!el) return;
    const partes = ['#7c3aed', '#ec4899', '#f59e0b', '#10b981', cor, '#06b6d4', '#f97316', '#84cc16'];
    partes.forEach((c, i) => {
      const p = document.createElement('span');
      p.className = 'sora-confete';
      p.style.background = c;
      p.style.setProperty('--dx', `${(Math.random() - 0.5) * 100}px`);
      p.style.setProperty('--dy', `${-40 - Math.random() * 60}px`);
      p.style.animationDelay = `${i * 20}ms`;
      el.appendChild(p);
      setTimeout(() => p.remove(), 1100);
    });
  }

  const hoje = iso(new Date());
  const diaSemHoje = diaSemanaBR(new Date());
  const habitosAtivos = habitos.filter(h => h.ativo);
  const habitosDeHoje = habitosAtivos.filter(h => (h.dias_semana || [1,2,3,4,5,6,7]).includes(diaSemHoje));
  const concluidosHoje = new Set(
    registros.filter(r => r.data === hoje && r.concluido).map(r => r.habito_id)
  );

  const progressoHoje = habitosDeHoje.length > 0
    ? <><strong className="text-foreground tabular">{concluidosHoje.size}</strong> de <strong className="text-foreground tabular">{habitosDeHoje.length}</strong> hábitos concluídos hoje.</>
    : <>Crie seu primeiro hábito e comece a construir consistência.</>;

  return (
    <div className="max-w-7xl mx-auto pb-24 relative space-y-6">
      <ConfeteCss />

      <GrowHero
        badge="Hábitos"
        titulo="Hábitos"
        subtitulo={progressoHoje}
      >
        <button onClick={() => { setEditando(null); setModalOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/30 transition-all">
          <Plus size={14} /> Novo hábito
        </button>
      </GrowHero>

      {/* TABS */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 animate-fade-in" style={{ animationDelay: '60ms' }}>
        {TABS.map(({ v, l, icon: Icon }) => {
          const ativo = tab === v;
          return (
            <button key={v} onClick={() => setTab(v)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                ativo
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}>
              <Icon size={12} />
              {l}
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
          {tab === 'visao'      && <TabVisao habitos={habitosDeHoje} registros={registros} concluidos={concluidosHoje} onToggle={toggleHabito} onNew={() => { setEditando(null); setModalOpen(true); }} onEdit={h => { setEditando(h); setModalOpen(true); }} />}
          {tab === 'semana'     && <TabSemana habitosAtivos={habitosAtivos} registros={registros} onToggle={toggleHabito} />}
          {tab === 'heatmap'    && <TabHeatmap habitosAtivos={habitosAtivos} registros={registros} />}
          {tab === 'conquistas' && <TabConquistas habitos={habitos} registros={registros} />}
          {tab === 'gerenciar'  && <TabGerenciar phone={phone!} habitos={habitos} registros={registros} incluirArquivados={incluirArquivados} setInclArq={setInclArq} onEdit={h => { setEditando(h); setModalOpen(true); }} onReload={carregar} onNew={() => { setEditando(null); setModalOpen(true); }} />}
        </div>
      )}

      {/* FAB */}
      <button onClick={() => { setEditando(null); setModalOpen(true); }}
              className="md:hidden fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-xl shadow-violet-600/40 flex items-center justify-center active:scale-95 transition-all"
              aria-label="Novo hábito">
        <Plus size={22} />
      </button>

      {/* TOAST */}
      {toast && (
        <div className={`fixed left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl text-sm font-semibold shadow-2xl animate-fade-in ${
          toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`} style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}>
          {toast.msg}
        </div>
      )}

      {modalOpen && phone && (
        <ModalHabito phone={phone} habito={editando} onClose={() => { setModalOpen(false); setEditando(null); }} onSuccess={() => { carregar(true); setModalOpen(false); setEditando(null); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 1 — VISÃO
// ═══════════════════════════════════════════════════════════════════
function TabVisao({ habitos, registros, concluidos, onToggle, onNew, onEdit }: any) {
  const total = habitos.length;
  const feitos = concluidos.size;
  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;

  // Cor dinâmica da barra
  const corBarra = pct === 0 ? '#94a3b8' : pct < 40 ? '#ef4444' : pct < 70 ? '#f59e0b' : pct < 100 ? '#10b981' : '#22c55e';

  // Agrupa por período
  const grupos: Record<string, any[]> = { manha: [], tarde: [], noite: [], livre: [] };
  habitos.forEach((h: any) => {
    const p = periodoDoHorario(h.horario_lembrete) as 'manha'|'tarde'|'noite'|'livre';
    grupos[p].push(h);
  });

  const periodosInfo = [
    { k: 'manha', l: 'Manhã', emoji: '🌅', icon: Sunrise },
    { k: 'tarde', l: 'Tarde', emoji: '☀️', icon: Sun },
    { k: 'noite', l: 'Noite', emoji: '🌙', icon: Moon },
    { k: 'livre', l: 'A qualquer hora', emoji: '✨', icon: Activity },
  ];

  if (total === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-violet-300 dark:border-violet-800 p-10 sm:p-14 bg-violet-50/30 dark:bg-violet-950/10 text-center animate-fade-in">
        <div className="text-7xl mb-4">🐋</div>
        <p className="text-lg font-bold text-foreground">Nenhum hábito pra hoje</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
          Crie seu primeiro hábito — beber água, ler, treinar, meditar. Comece pequeno e seja consistente.
        </p>
        <button onClick={onNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 mt-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700">
          <Plus size={14} /> Criar primeiro hábito
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Barra de progresso grossa */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5"
           style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Progresso de hoje</p>
            <p className="text-2xl font-bold tabular tracking-tight text-foreground mt-0.5">
              <span style={{ color: corBarra }}>{feitos}</span><span className="text-muted-foreground">/{total}</span>
              <span className="text-sm font-medium text-muted-foreground ml-2">hábitos</span>
            </p>
          </div>
          <p className="text-3xl font-bold tabular tracking-tight" style={{ color: corBarra }}>{pct}%</p>
        </div>
        <div className="relative h-4 rounded-full bg-muted overflow-hidden">
          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
               style={{
                 width: `${pct}%`,
                 background: `linear-gradient(90deg, ${corBarra} 0%, ${corBarra}cc 100%)`,
                 boxShadow: `0 0 18px ${corBarra}66`,
               }} />
        </div>
        {pct === 100 && (
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 text-center mt-2.5 animate-pulse">
            ✨ DIA PERFEITO ✨
          </p>
        )}
      </div>

      {/* Grupos por período */}
      {periodosInfo.map(({ k, l, emoji }) => {
        const list = grupos[k];
        if (!list || list.length === 0) return null;
        return (
          <div key={k}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1 flex items-center gap-1.5">
              <span className="text-sm">{emoji}</span> {l} <span className="text-muted-foreground/60 normal-case font-normal tracking-normal">· {list.length}</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {list.map((h: any) => {
                const feito = concluidos.has(h.id);
                const streak = calcularStreak(h.id, registros);
                return (
                  <HabitoCard key={h.id} habito={h} feito={feito} streak={streak} onToggle={() => onToggle(h)} onEdit={() => onEdit(h)} />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CARD DE HÁBITO ─────────────────────────────────────────────────
function HabitoCard({ habito, feito, streak, onToggle, onEdit }: any) {
  const cor = habito.cor || BRAND;
  return (
    <div
      onClick={onToggle}
      className={`group relative cursor-pointer rounded-2xl border backdrop-blur-xl p-4 transition-all active:scale-[0.98] ${
        feito
          ? 'border-emerald-200 dark:border-emerald-900/60 opacity-60'
          : 'border-border/40 hover:border-violet-300 dark:hover:border-violet-800 hover:scale-[1.005]'
      }`}
      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox 48px com confete container */}
        <div className="relative" data-confete={habito.id}>
          <button
            className={`relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
              feito ? 'scale-110' : 'hover:scale-105'
            }`}
            style={{
              background: feito ? cor : `${cor}1A`,
              boxShadow: feito ? `0 6px 18px -4px ${cor}` : 'none',
              border: feito ? 'none' : `2px solid ${cor}40`,
            }}
            aria-label={feito ? 'Desmarcar' : 'Marcar como feito'}
          >
            {feito ? (
              <Check size={24} className="text-white animate-check-pop" strokeWidth={3.5} />
            ) : (
              <span className="text-2xl opacity-90">{habito.icone}</span>
            )}
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold transition-all ${feito ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {habito.nome}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {streak > 0 && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${streak >= 7 ? 'text-orange-600 dark:text-orange-400 sora-streak-glow' : 'text-muted-foreground'}`}>
                <Flame size={10} className={streak >= 7 ? 'animate-pulse' : ''} />
                {streak}d
              </span>
            )}
            {habito.horario_lembrete && (
              <span className="text-[10px] text-muted-foreground tabular">⏰ {habito.horario_lembrete.slice(0, 5)}</span>
            )}
            {habito.tipo === 'eliminar' && <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">eliminar</span>}
          </div>
        </div>

        <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-muted transition-all">
          <Pencil size={12} className="text-muted-foreground" />
        </button>
      </div>

      {habito.motivo && !feito && (
        <p className="text-[10px] text-muted-foreground italic mt-2 ml-15 pl-1 line-clamp-1">
          "{habito.motivo}"
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 2 — SEMANA (grade 7 colunas × N hábitos)
// ═══════════════════════════════════════════════════════════════════
function TabSemana({ habitosAtivos, registros, onToggle }: any) {
  const [offset, setOffset] = useState(0); // 0 = semana atual

  const semana = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const diaSem = diaSemanaBR(hoje); // 1-7
    const segunda = new Date(hoje);
    segunda.setDate(hoje.getDate() - (diaSem - 1) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(segunda); d.setDate(segunda.getDate() + i);
      return d;
    });
  }, [offset]);

  const labelSemana = useMemo(() => {
    if (offset === 0) return 'Semana atual';
    if (offset === -1) return 'Semana passada';
    if (offset === 1) return 'Próxima semana';
    return offset < 0 ? `${Math.abs(offset)} semanas atrás` : `Em ${offset} semanas`;
  }, [offset]);

  const hojeIso = iso(new Date());
  const ehFuturo = (d: Date) => iso(d) > hojeIso;

  const concluidosPorDia = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    registros.filter(r => r.concluido).forEach(r => {
      if (!m[r.data]) m[r.data] = new Set();
      m[r.data].add(r.habito_id);
    });
    return m;
  }, [registros]);

  if (habitosAtivos.length === 0) {
    return (
      <EmptyTab emoji="🐋" titulo="Sem hábitos pra mostrar" desc="Crie hábitos pra ver a grade semanal de check-ins." />
    );
  }

  return (
    <div className="space-y-3">
      {/* Navegação */}
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset(o => o - 1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
          <ChevronLeft size={16} />
        </button>
        <div className="text-center">
          <p className="text-xs font-bold text-foreground">{labelSemana}</p>
          <p className="text-[10px] text-muted-foreground tabular">
            {fmtData(iso(semana[0]))} – {fmtData(iso(semana[6]))}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40">
              hoje
            </button>
          )}
          <button onClick={() => setOffset(o => o + 1)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Grade — scroll horizontal no mobile */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl overflow-x-auto scrollbar-none"
           style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="min-w-[600px]">

        {/* Header de dias */}
        <div className="grid border-b border-border/40" style={{ gridTemplateColumns: 'minmax(120px, 180px) repeat(7, minmax(52px, 1fr))' }}>
          <div className="p-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Hábito
          </div>
          {semana.map((d, i) => {
            const ehHoje = iso(d) === hojeIso;
            const ehAntiga = offset < 0;
            return (
              <div key={i} className={`p-2 text-center border-l border-border/40 transition-all ${
                ehHoje ? 'bg-violet-50 dark:bg-violet-950/30' : ehAntiga ? 'opacity-60' : ''
              }`}>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${ehHoje ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3)}
                </p>
                <p className={`text-sm font-bold tabular mt-0.5 ${ehHoje ? 'text-violet-700 dark:text-violet-300' : 'text-foreground'}`}>
                  {d.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Linhas de hábitos */}
        {habitosAtivos.map((h: any) => {
          const diasDoHabito = new Set(h.dias_semana || [1,2,3,4,5,6,7]);
          return (
            <div key={h.id} className="grid border-b border-border/40 last:border-b-0" style={{ gridTemplateColumns: 'minmax(120px, 180px) repeat(7, minmax(52px, 1fr))' }}>
              <div className="p-2.5 flex items-center gap-2 min-w-0">
                <span className="text-base flex-shrink-0">{h.icone}</span>
                <p className="text-xs font-semibold text-foreground truncate">{h.nome}</p>
              </div>
              {semana.map((d, i) => {
                const dIso = iso(d);
                const diaSem = diaSemanaBR(d);
                const programado = diasDoHabito.has(diaSem);
                const feito = concluidosPorDia[dIso]?.has(h.id);
                const futuro = ehFuturo(d);
                const ehHoje = dIso === hojeIso;

                return (
                  <button
                    key={i}
                    disabled={!programado || futuro}
                    onClick={() => onToggle(h, dIso)}
                    className={`p-2 border-l border-border/40 flex items-center justify-center transition-all ${
                      programado && !futuro ? 'hover:bg-muted/60 cursor-pointer' : 'cursor-default'
                    } ${ehHoje ? 'bg-violet-50/60 dark:bg-violet-950/20' : ''}`}
                    title={!programado ? 'Não programado pra este dia' : futuro ? 'Dia ainda não chegou' : feito ? 'Concluído' : 'Marcar'}
                  >
                    {!programado ? (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    ) : futuro ? (
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/15" />
                    ) : feito ? (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                           style={{ background: h.cor || BRAND }}>
                        <Check size={14} className="text-white" strokeWidth={3.5} />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full border-2 hover:scale-110 transition-transform"
                           style={{ borderColor: `${h.cor || BRAND}80` }} />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}

        {/* Rodapé com resumo */}
        <div className="grid bg-muted/30" style={{ gridTemplateColumns: 'minmax(120px, 180px) repeat(7, minmax(52px, 1fr))' }}>
          <div className="p-2.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
            Resumo
          </div>
          {semana.map((d, i) => {
            const dIso = iso(d);
            const diaSem = diaSemanaBR(d);
            const programados = habitosAtivos.filter((h: any) => (h.dias_semana || [1,2,3,4,5,6,7]).includes(diaSem));
            const total = programados.length;
            const feitos = programados.filter((h: any) => concluidosPorDia[dIso]?.has(h.id)).length;
            const futuro = ehFuturo(d);
            const ehHoje = dIso === hojeIso;
            const completo = !futuro && total > 0 && feitos === total;
            return (
              <div key={i} className={`p-2 text-center border-l border-border/40 ${ehHoje ? 'bg-violet-50 dark:bg-violet-950/30' : ''}`}>
                {futuro ? (
                  <span className="text-[10px] text-muted-foreground/50">·</span>
                ) : total === 0 ? (
                  <span className="text-[10px] text-muted-foreground/50">—</span>
                ) : (
                  <span className={`text-[10px] font-bold tabular ${completo ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                    {feitos}/{total} {completo && '✨'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        </div> {/* fecha min-w-[600px] (scroll container) */}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 3 — HEATMAP (4 meses estilo GitHub)
// ═══════════════════════════════════════════════════════════════════
function TabHeatmap({ habitosAtivos, registros }: any) {
  const dias = useMemo(() => {
    const arr: { data: string; dow: number; pct: number; feitos: number; total: number }[] = [];
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 119);
    // Backfill pra começar numa segunda-feira
    const dowInicio = diaSemanaBR(inicio); // 1-7
    inicio.setDate(inicio.getDate() - (dowInicio - 1));

    const totalDias = Math.ceil((hoje.getTime() - inicio.getTime()) / 86400000) + 1;

    for (let i = 0; i < totalDias; i++) {
      const d = new Date(inicio); d.setDate(inicio.getDate() + i);
      const dIso = iso(d);
      const dow = diaSemanaBR(d);
      const programados = habitosAtivos.filter((h: any) => (h.dias_semana || [1,2,3,4,5,6,7]).includes(dow));
      const feitos = programados.filter((h: any) =>
        registros.some((r: any) => r.habito_id === h.id && r.data === dIso && r.concluido)
      ).length;
      const total = programados.length;
      const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
      arr.push({ data: dIso, dow, pct, feitos, total });
    }
    return arr;
  }, [habitosAtivos, registros]);

  // Agrupa em colunas (cada coluna = 1 semana)
  const colunas = useMemo(() => {
    const cols: typeof dias[] = [];
    for (let i = 0; i < dias.length; i += 7) {
      cols.push(dias.slice(i, i + 7));
    }
    return cols;
  }, [dias]);

  // Labels de meses
  const labelsMes = useMemo(() => {
    const m: { col: number; mes: string }[] = [];
    let mesAnterior = -1;
    colunas.forEach((col, i) => {
      const primeira = col[0];
      if (!primeira) return;
      const d = new Date(primeira.data + 'T12:00:00');
      const mes = d.getMonth();
      if (mes !== mesAnterior) {
        m.push({ col: i, mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') });
        mesAnterior = mes;
      }
    });
    return m;
  }, [colunas]);

  // Stats
  const totalCheckins = registros.filter((r: any) => r.concluido).length;
  const diasPerfeitos = dias.filter(d => d.pct === 100 && d.total > 0).length;
  const streakAtual = useMemo(() => {
    let s = 0;
    for (let i = dias.length - 1; i >= 0; i--) {
      const d = dias[i];
      if (d.data > iso(new Date())) continue;
      if (d.total === 0) continue;
      if (d.pct > 0) s++; else break;
    }
    return s;
  }, [dias]);
  const maiorStreakGlobal = useMemo(() => {
    let max = 0, cur = 0;
    dias.forEach(d => {
      if (d.total > 0 && d.pct > 0) { cur++; if (cur > max) max = cur; }
      else if (d.total > 0) cur = 0;
    });
    return max;
  }, [dias]);

  if (habitosAtivos.length === 0) {
    return <EmptyTab emoji="🐋" titulo="Sem hábitos no heatmap" desc="Crie hábitos pra acompanhar sua consistência ao longo dos meses." />;
  }

  return (
    <div className="space-y-4">
      {/* Heatmap */}
      <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6"
           style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Consistência</p>
            <p className="text-base font-bold text-foreground">Últimos 4 meses</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>menos</span>
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map(n => (
                <div key={n} className="w-2.5 h-2.5 rounded-sm" style={{
                  background: n === 0 ? 'hsl(var(--muted))' : `rgba(124, 58, 237, ${0.2 + n * 0.2})`,
                }} />
              ))}
            </div>
            <span>mais</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-2">
          <div className="inline-block">
            {/* Labels de mês */}
            <div className="grid mb-1.5" style={{ gridTemplateColumns: 'auto repeat(' + colunas.length + ', 12px)', gap: 2 }}>
              <div /> {/* espaço pra labels dia semana */}
              {colunas.map((_, i) => {
                const label = labelsMes.find(m => m.col === i);
                return (
                  <div key={i} className="text-[9px] text-muted-foreground text-left h-3" style={{ minWidth: 12 }}>
                    {label ? label.mes.toUpperCase() : ''}
                  </div>
                );
              })}
            </div>

            {/* Grade */}
            <div className="flex gap-[2px]">
              {/* Labels dia semana */}
              <div className="flex flex-col gap-[2px] mr-1.5 text-[8px] text-muted-foreground">
                {['S','T','Q','Q','S','S','D'].map((d, i) => (
                  <div key={i} className="h-[10px] flex items-center" style={{ minWidth: 8 }}>{i % 2 === 1 ? d : ''}</div>
                ))}
              </div>
              {/* Colunas de semanas */}
              {colunas.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[2px]">
                  {Array.from({ length: 7 }).map((_, ri) => {
                    const d = col[ri];
                    if (!d) return <div key={ri} className="w-2.5 h-2.5" />;
                    const ehFuturo = d.data > iso(new Date());
                    if (ehFuturo) return <div key={ri} className="w-2.5 h-2.5 rounded-sm bg-muted/30" />;
                    let nivel = 0;
                    if (d.pct === 0 || d.total === 0) nivel = 0;
                    else if (d.pct <= 30) nivel = 1;
                    else if (d.pct <= 60) nivel = 2;
                    else if (d.pct <= 90) nivel = 3;
                    else nivel = 4;
                    const bg = nivel === 0 ? 'hsl(var(--muted))' : `rgba(124, 58, 237, ${0.2 + nivel * 0.2})`;
                    return (
                      <div key={ri}
                           title={`${fmtData(d.data)}: ${d.feitos}/${d.total} hábitos (${d.pct}%)`}
                           className="w-2.5 h-2.5 rounded-sm transition-transform hover:scale-150 hover:ring-1 hover:ring-violet-500 cursor-help"
                           style={{ background: bg }} />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatHeat icon={Check}   label="Check-ins totais"  value={totalCheckins}   cor={BRAND} />
        <StatHeat icon={Flame}   label="Streak atual"      value={streakAtual}     unit="dias" cor={streakAtual >= 7 ? '#f97316' : '#94a3b8'} pulse={streakAtual >= 7} />
        <StatHeat icon={Trophy}  label="Maior streak"      value={maiorStreakGlobal} unit="dias" cor="#f59e0b" />
        <StatHeat icon={Sparkles} label="Dias perfeitos"  value={diasPerfeitos}   cor="#10b981" />
      </div>
    </div>
  );
}

function StatHeat({ icon: Icon, label, value, unit, cor, pulse }: any) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-40"
           style={{ background: `radial-gradient(circle at top right, ${cor}24 0%, transparent 70%)` }} />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold tabular tracking-tight mt-1 text-foreground inline-flex items-baseline gap-1">
            {value}{unit && <span className="text-xs text-muted-foreground font-medium">{unit}</span>}
          </p>
        </div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${pulse ? 'animate-pulse' : ''}`} style={{ background: `${cor}1A` }}>
          <Icon size={16} style={{ color: cor }} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 4 — STREAKS & CONQUISTAS
// ═══════════════════════════════════════════════════════════════════
function TabConquistas({ habitos, registros }: any) {
  const ativos = habitos.filter((h: any) => h.ativo);

  const dadosHabitos = useMemo(() => ativos.map((h: any) => ({
    h,
    streak: calcularStreak(h.id, registros),
    maior: maiorStreak(h.id, registros),
  })).sort((a: any, b: any) => b.streak - a.streak), [ativos, registros]);

  const totalCheckins = registros.filter((r: any) => r.concluido).length;
  const maiorStreakGeral = Math.max(0, ...dadosHabitos.map((d: any) => d.maior));
  const teveGapERetornou = useMemo(() => {
    // tem algum hábito com streak >= 3 atual + algum gap >= 2 dias no histórico
    return dadosHabitos.some((d: any) => {
      if (d.streak < 3) return false;
      const datas = registros.filter((r: any) => r.habito_id === d.h.id && r.concluido).map((r: any) => r.data).sort();
      for (let i = 1; i < datas.length; i++) {
        const diff = Math.round((new Date(datas[i]).getTime() - new Date(datas[i-1]).getTime()) / 86400000);
        if (diff >= 3) return true;
      }
      return false;
    });
  }, [dadosHabitos, registros]);

  // Semana perfeita: 7 dias consecutivos com 100% dos hábitos do dia
  const semanaPerfeita = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let consec = 0, max = 0;
    for (let i = 0; i < 90; i++) {
      const d = new Date(hoje); d.setDate(d.getDate() - i);
      const dIso = iso(d);
      const dow = diaSemanaBR(d);
      const programados = ativos.filter((h: any) => (h.dias_semana || [1,2,3,4,5,6,7]).includes(dow));
      if (programados.length === 0) continue;
      const feitos = programados.filter((h: any) =>
        registros.some((r: any) => r.habito_id === h.id && r.data === dIso && r.concluido)
      ).length;
      if (feitos === programados.length) { consec++; if (consec > max) max = consec; }
      else consec = 0;
    }
    return max;
  }, [ativos, registros]);

  // Acha primeira data de conquista (pra exibir "desbloqueado em")
  const datasConquista = useMemo(() => {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const datas: Record<string, string | null> = {};

    // Primeira semana (7d), Consistente (30d), Centenário (100d) — primeiro hábito que atingiu
    [['semana_perfeita', 7], ['consistente', 30], ['centenario', 100]].forEach(([k, n]) => {
      let firstDate: string | null = null;
      ativos.forEach((h: any) => {
        const datasH = registros.filter((r: any) => r.habito_id === h.id && r.concluido).map((r: any) => r.data).sort();
        let cur = 0, prev: Date | null = null;
        for (const dStr of datasH) {
          const d = new Date(dStr + 'T12:00:00');
          if (prev) {
            const diff = Math.round((d.getTime() - prev.getTime()) / 86400000);
            cur = diff === 1 ? cur + 1 : 1;
          } else cur = 1;
          if (cur >= (n as number) && !firstDate) firstDate = dStr;
          prev = d;
        }
      });
      datas[k as string] = firstDate;
    });

    return datas;
  }, [ativos, registros]);

  const conquistas = [
    { id: 'semana',     emoji: '🌱', label: 'Primeira semana',  desc: '7 dias seguidos',           ok: maiorStreakGeral >= 7,    cor: '#10b981', dataKey: 'semana_perfeita' },
    { id: 'consistente',emoji: '💧', label: 'Consistente',      desc: '30 dias seguidos',          ok: maiorStreakGeral >= 30,   cor: '#06b6d4', dataKey: 'consistente' },
    { id: 'centenario', emoji: '🏆', label: 'Centenário',       desc: '100 dias seguidos',         ok: maiorStreakGeral >= 100,  cor: '#f59e0b', dataKey: 'centenario' },
    { id: 'semana_perf',emoji: '⚡', label: 'Semana perfeita',  desc: 'Todos os hábitos em 7 dias',ok: semanaPerfeita >= 7,      cor: '#a855f7' },
    { id: 'check100',   emoji: '🎯', label: '100 check-ins',    desc: 'Total acumulado',           ok: totalCheckins >= 100,     cor: '#ec4899' },
    { id: 'comeback',   emoji: '🦁', label: 'Voltei mais forte',desc: 'Retomou após gap',          ok: teveGapERetornou,         cor: '#f97316' },
  ];

  // Próximos marcos pra cada hábito
  const marcosProgresso = (streak: number) => {
    const marcos = [7, 14, 30, 60, 100, 200, 365];
    const proximo = marcos.find(m => m > streak);
    if (!proximo) return null;
    const anterior = marcos[marcos.indexOf(proximo) - 1] || 0;
    const pct = ((streak - anterior) / (proximo - anterior)) * 100;
    return { proximo, faltam: proximo - streak, pct };
  };

  if (ativos.length === 0) {
    return <EmptyTab emoji="🐋" titulo="Sem hábitos para acompanhar" desc="Crie hábitos pra começar a desbloquear conquistas." />;
  }

  return (
    <div className="space-y-5">
      {/* STREAKS ATIVOS */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Streaks ativos</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dadosHabitos.map(({ h, streak, maior }: any) => {
            const marco = marcosProgresso(streak);
            const cor = h.cor || BRAND;
            return (
              <div key={h.id} className="rounded-2xl border border-border/40 backdrop-blur-xl p-4"
                   style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                       style={{ background: `${cor}1A` }}>
                    {h.icone}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{h.nome}</p>
                    <p className="text-[10px] text-muted-foreground tabular">maior: {maior}d</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold tabular tracking-tight leading-none ${streak >= 7 ? 'sora-streak-glow' : ''}`}
                       style={{ color: streak === 0 ? '#94a3b8' : streak >= 7 ? '#f97316' : cor }}>
                      {streak}
                    </p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mt-0.5 flex items-center gap-0.5 justify-end">
                      {streak >= 7 && <Flame size={9} className="animate-pulse text-orange-500" />}
                      dias
                    </p>
                  </div>
                </div>
                {marco && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-muted-foreground">Próximo marco</span>
                      <span className="text-[10px] font-bold tabular text-foreground">{marco.faltam}d → {marco.proximo}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full transition-all duration-700" style={{ width: `${marco.pct}%`, background: cor }} />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CONQUISTAS */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 px-1">Conquistas</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {conquistas.map(c => {
            const dataDesbloqueio = c.dataKey ? datasConquista[c.dataKey] : null;
            return (
              <div key={c.id}
                   className={`rounded-2xl border backdrop-blur-xl p-4 text-center transition-all ${
                     c.ok
                       ? 'border-border/40 hover:scale-[1.03] hover:border-violet-300 dark:hover:border-violet-800'
                       : 'border-border/20 opacity-40 grayscale'
                   }`}
                   style={{ background: c.ok ? `${c.cor}10` : 'hsl(var(--bg-card) / 0.3)' }}>
                <div className="text-4xl mb-2 relative inline-flex">
                  {c.emoji}
                  {!c.ok && <Lock size={12} className="absolute -bottom-1 -right-1 text-muted-foreground bg-card rounded-full p-0.5" />}
                </div>
                <p className="text-xs font-bold text-foreground leading-tight">{c.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{c.desc}</p>
                {c.ok && dataDesbloqueio && (
                  <p className="text-[9px] font-bold uppercase tracking-wider mt-2" style={{ color: c.cor }}>
                    🎉 {fmtData(dataDesbloqueio)}
                  </p>
                )}
                {c.ok && !dataDesbloqueio && (
                  <p className="text-[9px] font-bold uppercase tracking-wider mt-2" style={{ color: c.cor }}>
                    desbloqueada
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB 5 — GERENCIAR (lista, drag-reorder, arquivar)
// ═══════════════════════════════════════════════════════════════════
function TabGerenciar({ phone, habitos, registros, incluirArquivados, setInclArq, onEdit, onReload, onNew }: any) {
  const ativos     = habitos.filter((h: any) => h.ativo);
  const arquivados = habitos.filter((h: any) => !h.ativo);
  const lista      = incluirArquivados ? [...ativos, ...arquivados] : ativos;

  const [ordemLocal, setOrdemLocal] = useState<any[]>(lista);
  const dragId = useRef<string | null>(null);

  // Sync com props
  useEffect(() => { setOrdemLocal(lista); }, [habitos, incluirArquivados]);

  function onDragStart(e: React.DragEvent, id: string) {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!dragId.current || dragId.current === id) return;
    setOrdemLocal(prev => {
      const idxFrom = prev.findIndex(h => h.id === dragId.current);
      const idxTo   = prev.findIndex(h => h.id === id);
      if (idxFrom === -1 || idxTo === -1) return prev;
      const novo = [...prev];
      const [moved] = novo.splice(idxFrom, 1);
      novo.splice(idxTo, 0, moved);
      return novo;
    });
  }

  async function onDragEnd() {
    if (!dragId.current) return;
    dragId.current = null;
    try {
      const ordens = ordemLocal.filter(h => h.ativo).map((h, i) => ({ id: h.id, ordem: i }));
      await api.grow.habitos.reordenar(phone, ordens);
    } catch (e: any) {
      onReload();
    }
  }

  async function alternarArquivo(h: any) {
    try {
      await api.grow.habitos.editar(h.id, { ativo: !h.ativo });
      onReload();
    } catch (e: any) { alert(e.message); }
  }

  const DIAS_LBL: any = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb', 7: 'Dom' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={onNew}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold shadow-lg shadow-violet-600/30">
          <Plus size={13} /> Novo hábito
        </button>

        <button onClick={() => setInclArq(!incluirArquivados)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border border-border/60 bg-card/60 backdrop-blur-xl hover:border-violet-300">
          {incluirArquivados ? <EyeOff size={12} /> : <Eye size={12} />}
          {incluirArquivados ? 'Ocultar arquivados' : `Mostrar arquivados (${arquivados.length})`}
        </button>
      </div>

      {lista.length === 0 ? (
        <EmptyTab emoji="🐋" titulo="Nenhum hábito cadastrado" desc="Adicione hábitos pra começar a acompanhá-los." />
      ) : (
        <div className="rounded-3xl border border-border/40 backdrop-blur-xl overflow-hidden"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          {ordemLocal.map((h, i) => {
            const arquivado = !h.ativo;
            const streak = calcularStreak(h.id, registros);
            return (
              <div key={h.id}
                   draggable={!arquivado}
                   onDragStart={e => onDragStart(e, h.id)}
                   onDragOver={e => onDragOver(e, h.id)}
                   onDragEnd={onDragEnd}
                   className={`group flex items-center gap-3 p-3.5 border-b border-border/40 last:border-b-0 transition-all ${
                     arquivado ? 'opacity-50 bg-muted/20' : 'hover:bg-muted/30 cursor-move'
                   }`}>
                {!arquivado && (
                  <GripVertical size={14} className="text-muted-foreground/50 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                )}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                     style={{ background: `${h.cor || BRAND}1A` }}>
                  {h.icone}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold text-foreground truncate ${arquivado ? 'line-through' : ''}`}>{h.nome}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground tabular flex-wrap">
                    {streak > 0 && <span className="inline-flex items-center gap-0.5"><Flame size={9} /> {streak}d</span>}
                    {h.horario_lembrete && <span>⏰ {h.horario_lembrete.slice(0, 5)}</span>}
                    <span>
                      {h.dias_semana?.length === 7 ? 'Todo dia' :
                        (h.dias_semana || []).map((d: number) => DIAS_LBL[d]).join(' ')}
                    </span>
                    {arquivado && <span className="text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider text-[9px]">arquivado</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => onEdit(h)} className="p-1.5 rounded-lg hover:bg-muted" title="Editar">
                    <Pencil size={12} className="text-muted-foreground" />
                  </button>
                  <button onClick={() => alternarArquivo(h)}
                          className="p-1.5 rounded-lg hover:bg-muted"
                          title={arquivado ? 'Restaurar' : 'Arquivar'}>
                    {arquivado ? <ArchiveRestore size={12} className="text-emerald-600" /> : <Archive size={12} className="text-amber-600" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// EMPTY TAB
// ═══════════════════════════════════════════════════════════════════
function EmptyTab({ emoji, titulo, desc }: any) {
  return (
    <div className="rounded-3xl border border-dashed border-border/60 p-10 sm:p-12 text-center animate-fade-in bg-muted/10">
      <div className="text-6xl mb-4">{emoji}</div>
      <p className="text-base font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CSS — confete, check pop, streak glow
// ═══════════════════════════════════════════════════════════════════
function ConfeteCss() {
  return (
    <style jsx global>{`
      .sora-confete {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 6px;
        height: 6px;
        border-radius: 1px;
        pointer-events: none;
        transform: translate(-50%, -50%);
        animation: sora-confete 1s ease-out forwards;
        z-index: 1;
      }
      @keyframes sora-confete {
        0%   { transform: translate(-50%, -50%) scale(1) rotate(0deg); opacity: 1; }
        100% { transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, -60px))) scale(0.3) rotate(360deg); opacity: 0; }
      }
      @keyframes sora-check-pop {
        0%   { transform: scale(0) rotate(-90deg); }
        60%  { transform: scale(1.3) rotate(0deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      .animate-check-pop { animation: sora-check-pop 350ms cubic-bezier(0.34, 1.56, 0.64, 1); }
      .sora-streak-glow {
        background: linear-gradient(90deg, #f97316, #ef4444);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        font-weight: 800;
      }
      .scrollbar-none::-webkit-scrollbar { display: none; }
      .scrollbar-none { scrollbar-width: none; }
    `}</style>
  );
}
