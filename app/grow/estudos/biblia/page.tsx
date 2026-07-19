'use client';

import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import EstudosNav from '../EstudosNav';
import { PLANOS, planoPorId, diasDoPlano, versiculoDoDia, type Plano } from '@/lib/biblia';
import {
  BookMarked, Sparkles, Flame, Check, ChevronRight, Quote, X, Loader2,
  CalendarDays, PenLine, RotateCcw,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const CATEGORIAS: { id: Plano['categoria']; titulo: string }[] = [
  { id: 'trilha',    titulo: 'Trilhas' },
  { id: 'livro',     titulo: 'Por livro' },
  { id: 'tematico',  titulo: 'Temáticos (7 dias)' },
];

const fmtData = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

export default function BibliaPage() {
  const { phone, perfil } = useAuth();
  const { data, mutate } = useApi(phone ? `biblia:${phone}` : null, () => api.biblia.get(phone));
  const recarregar = useCallback(() => mutate(), [mutate]);

  const [salvando, setSalvando] = useState(false);
  const [reflexaoAberta, setReflexaoAberta] = useState<{ referencia: string; dia: number | null } | null>(null);

  const versiculo = useMemo(() => versiculoDoDia(), []);
  const nome = perfil?.name?.split(' ')[0] || '';

  const planoAtivo = planoPorId(data?.plano?.plano_id);
  const streak: number = data?.streak ?? 0;

  // Progresso do plano ativo.
  const prog = useMemo(() => {
    if (!planoAtivo) return null;
    const dias = diasDoPlano(planoAtivo);
    const concluidosSet = new Set<number>(
      (data?.diasConcluidos ?? [])
        .filter((c: any) => c.plano_id === planoAtivo.id)
        .map((c: any) => c.dia)
    );
    const proximo = dias.find(d => !concluidosSet.has(d.dia)) || null;
    return { dias, feitos: concluidosSet.size, total: dias.length, proximo, concluidosSet };
  }, [planoAtivo, data]);

  async function escolherPlano(id: string) {
    setSalvando(true);
    try { await api.biblia.definirPlano(id); await recarregar(); }
    finally { setSalvando(false); }
  }

  async function marcarLido(referencia: string, dia: number | null, reflexao?: string, minutos?: number) {
    setSalvando(true);
    try {
      await api.biblia.registrar({ plano_id: planoAtivo?.id ?? null, dia, referencia, duracao_min: minutos ?? 0, reflexao: reflexao ?? null });
      await recarregar();
    } finally { setSalvando(false); setReflexaoAberta(null); }
  }

  const carregando = data === undefined;

  return (
    <div className="max-w-5xl mx-auto pb-20 space-y-5">

      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-border/60 animate-fade-in"
           style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
        <div className="absolute inset-0 pointer-events-none opacity-50"
             style={{ background: 'radial-gradient(ellipse at top right, color-mix(in srgb, hsl(var(--primary)) 12%, transparent) 0%, transparent 60%)' }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 dark:bg-primary/15 mb-3">
            <BookMarked size={12} style={{ color: BRAND }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>Bíblia</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            Estudo bíblico
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-md leading-relaxed">
            {streak > 0
              ? <>🔥 <strong className="text-foreground">{streak} dia{streak > 1 ? 's' : ''}</strong> na Palavra{nome ? `, ${nome}` : ''}. Continue firme.</>
              : <>Um plano, um versículo por dia, e a constância cuida do resto.</>}
          </p>
        </div>
      </div>

      <EstudosNav />

      {/* VERSÍCULO DO DIA */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/40"
           style={{ background: 'hsl(var(--bg-card) / 0.6)', animationDelay: '40ms' }}>
        <div aria-hidden className="absolute -top-6 -left-3 opacity-[0.07]" style={{ color: BRAND }}>
          <Quote size={120} strokeWidth={1} />
        </div>
        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: BRAND }}>Versículo do dia</p>
          <p className="text-lg sm:text-2xl font-semibold text-foreground leading-relaxed tracking-tight">
            "{versiculo.texto}"
          </p>
          <p className="text-sm font-bold mt-4" style={{ color: BRAND }}>{versiculo.ref}</p>
        </div>
      </div>

      {carregando ? (
        <div className="rounded-3xl border border-border/40 p-6 animate-pulse" style={{ background: 'hsl(var(--bg-card) / 0.5)', minHeight: 160 }} />
      ) : planoAtivo && prog ? (
        <PlanoAtivoCard
          plano={planoAtivo} prog={prog} streak={streak} salvando={salvando}
          onMarcar={() => prog.proximo && marcarLido(prog.proximo.referencia, prog.proximo.dia)}
          onReflexao={() => prog.proximo && setReflexaoAberta({ referencia: prog.proximo.referencia, dia: prog.proximo.dia })}
        />
      ) : (
        <div className="rounded-3xl border border-dashed border-border p-8 text-center animate-fade-in" style={{ animationDelay: '80ms' }}>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl mb-3" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <BookMarked size={22} style={{ color: BRAND }} />
          </div>
          <p className="text-base font-bold text-foreground">Escolha um plano pra começar</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Uma leitura curta por dia, no seu ritmo. Você pode trocar quando quiser.</p>
        </div>
      )}

      {/* CATÁLOGO DE PLANOS */}
      <div className="space-y-5 animate-fade-in" style={{ animationDelay: '120ms' }}>
        {CATEGORIAS.map(cat => {
          const doGrupo = PLANOS.filter(p => p.categoria === cat.id);
          if (!doGrupo.length) return null;
          return (
            <div key={cat.id}>
              <h2 className="text-sm font-bold text-foreground mb-3 px-1">{cat.titulo}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {doGrupo.map((p, i) => (
                  <PlanoCard
                    key={p.id} plano={p} ativo={planoAtivo?.id === p.id} salvando={salvando}
                    delay={i * 40} onEscolher={() => escolherPlano(p.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* HISTÓRICO RECENTE */}
      {!!(data?.leituras?.length) && (
        <div className="rounded-3xl border border-border/40 p-5 sm:p-6 animate-fade-in" style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '160ms' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Suas leituras recentes</p>
          <ul className="space-y-2.5">
            {data.leituras.slice(0, 8).map((l: any) => (
              <li key={l.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 12%, transparent)' }}>
                  <Check size={14} style={{ color: BRAND }} strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{l.referencia}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {fmtData(l.data)}{l.duracao_min ? ` · ${l.duracao_min}min` : ''}
                  </p>
                  {l.reflexao && <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2 italic">"{l.reflexao}"</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* SHEET DE REFLEXÃO */}
      {reflexaoAberta && (
        <ReflexaoSheet
          referencia={reflexaoAberta.referencia} salvando={salvando}
          onFechar={() => setReflexaoAberta(null)}
          onSalvar={(reflexao, minutos) => marcarLido(reflexaoAberta.referencia, reflexaoAberta.dia, reflexao, minutos)}
        />
      )}
    </div>
  );
}

// ── Card do plano ATIVO (anel de progresso + leitura de hoje) ────────────────
function PlanoAtivoCard({ plano, prog, streak, salvando, onMarcar, onReflexao }: {
  plano: Plano;
  prog: { feitos: number; total: number; proximo: { dia: number; referencia: string } | null };
  streak: number; salvando: boolean; onMarcar: () => void; onReflexao: () => void;
}) {
  const pct = prog.total ? Math.round((prog.feitos / prog.total) * 100) : 0;
  const concluido = !prog.proximo;

  return (
    <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
         style={{ background: 'hsl(var(--bg-card) / 0.6)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">

        {/* Anel de progresso */}
        <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0">
          <AnelProgresso pct={pct} />
          <div className="sm:hidden">
            <p className="text-lg" aria-hidden>{plano.emoji}</p>
            <p className="text-sm font-bold text-foreground leading-tight">{plano.nome}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Dia {Math.min(prog.feitos + (concluido ? 0 : 1), prog.total)} de {prog.total}</p>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* nome (desktop) + streak */}
          <div className="hidden sm:flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-bold text-foreground truncate">{plano.emoji} {plano.nome}</p>
            {streak > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-bold flex-shrink-0" style={{ color: '#f97316' }}>
                <Flame size={13} /> {streak}
              </span>
            )}
          </div>

          {concluido ? (
            <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 text-center">
              <p className="text-sm font-bold text-foreground">🎉 Plano concluído!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Você leu os {prog.total} dias. Escolha outro plano pra continuar.</p>
            </div>
          ) : (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Leitura de hoje</p>
              <p className="text-xl font-bold text-foreground tracking-tight mt-0.5">{prog.proximo!.referencia}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={onMarcar} disabled={salvando}
                        className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 disabled:opacity-60 active:scale-[0.98] transition-all"
                        style={{ minHeight: 44 }}>
                  {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={3} />} Marcar como lido
                </button>
                <button onClick={onReflexao} disabled={salvando}
                        className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40 disabled:opacity-60"
                        style={{ minHeight: 44 }}>
                  <PenLine size={15} /> Com reflexão
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Anel SVG de progresso (theme-aware via var(--primary)).
function AnelProgresso({ pct }: { pct: number }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="relative w-[76px] h-[76px] flex-shrink-0">
      <svg width="76" height="76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" stroke="hsl(var(--muted))" />
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
                stroke={BRAND} strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
                style={{ transition: 'stroke-dashoffset 500ms ease-out' }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-base font-bold text-foreground tabular-nums">{pct}%</span>
      </div>
    </div>
  );
}

// ── Card de plano no catálogo ────────────────────────────────────────────────
function PlanoCard({ plano, ativo, salvando, delay, onEscolher }: {
  plano: Plano; ativo: boolean; salvando: boolean; delay: number; onEscolher: () => void;
}) {
  return (
    <div className="relative rounded-2xl border border-border/40 backdrop-blur-xl p-4 flex flex-col animate-[slide-up_500ms_ease-out_both]"
         style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: `${delay}ms` }}>
      {ativo && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: BRAND }}>
          <Check size={9} strokeWidth={3} /> Ativo
        </span>
      )}
      <span className="text-2xl mb-2" aria-hidden>{plano.emoji}</span>
      <p className="text-sm font-bold text-foreground leading-tight">{plano.nome}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-snug flex-1">{plano.descricao}</p>
      <div className="flex items-center justify-between mt-3">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays size={11} /> {plano.duracaoDias} dias
        </span>
        <button onClick={onEscolher} disabled={salvando || ativo}
                className={`inline-flex items-center gap-1 h-8 px-3 rounded-lg text-xs font-bold transition-all disabled:opacity-60 ${
                  ativo ? 'text-muted-foreground' : 'text-white hover:opacity-90 active:scale-[0.98]'
                }`}
                style={ativo ? {} : { background: BRAND, minHeight: 32 }}>
          {ativo ? <><RotateCcw size={12} /> Em andamento</> : <>Começar <ChevronRight size={13} /></>}
        </button>
      </div>
    </div>
  );
}

// ── Sheet de reflexão (bottom sheet no mobile) ───────────────────────────────
function ReflexaoSheet({ referencia, salvando, onFechar, onSalvar }: {
  referencia: string; salvando: boolean; onFechar: () => void; onSalvar: (reflexao: string, minutos: number) => void;
}) {
  const [reflexao, setReflexao] = useState('');
  const [minutos, setMinutos] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border-t sm:border border-border shadow-2xl p-5 sm:p-6 space-y-4"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reflexão</p>
            <p className="text-base font-bold text-foreground">{referencia}</p>
          </div>
          <button onClick={onFechar} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div>
          <label htmlFor="refl" className="block text-xs font-semibold text-muted-foreground mb-1.5">O que Deus falou com você? (opcional)</label>
          <textarea id="refl" value={reflexao} onChange={e => setReflexao(e.target.value)} rows={4} autoFocus
                    placeholder="Uma frase, um aprendizado, um pedido de oração…"
                    className="w-full rounded-xl bg-background border border-border p-3 text-sm resize-none focus:outline-none focus:border-primary" />
        </div>

        <div>
          <label htmlFor="min" className="block text-xs font-semibold text-muted-foreground mb-1.5">Tempo de leitura (min, opcional)</label>
          <input id="min" value={minutos} onChange={e => setMinutos(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="ex.: 15"
                 className="w-full h-11 rounded-xl bg-background border border-border px-3 text-sm tabular-nums focus:outline-none focus:border-primary" style={{ minHeight: 44 }} />
        </div>

        <button onClick={() => onSalvar(reflexao.trim(), Number(minutos) || 0)} disabled={salvando}
                className="w-full h-12 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 inline-flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ minHeight: 44 }}>
          {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={3} />} Marcar como lido
        </button>
      </div>
    </div>
  );
}
