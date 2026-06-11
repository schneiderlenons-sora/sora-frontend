'use client';

import { memo, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import {
  ListChecks, Heart, CalendarDays, ChevronRight, Crown, ArrowRight,
} from 'lucide-react';

const HUMOR = ['', { e: '😔', l: 'Péssimo' }, { e: '😕', l: 'Mal' }, { e: '😐', l: 'Normal' }, { e: '🙂', l: 'Bem' }, { e: '😄', l: 'Ótimo' }] as const;
const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };

function GrowResumo({ ritmoSlot }: { ritmoSlot?: ReactNode }) {
  const { phone, temAcessoGrow, podeUsar } = useAuth();

  // SWR: só busca quando há phone E acesso ao Grow (não desperdiça request).
  const ativo = phone && temAcessoGrow;
  const { data: tarefasData } = useApi(ativo ? `grow:tarefas:${phone}` : null, () => api.grow.tarefas.listar(phone, { concluida: false }));
  const { data: humorData }   = useApi(ativo ? `grow:humor:${phone}`   : null, () => api.grow.humor.listar(phone, 1));
  const { data: eventosData } = useApi(ativo ? `grow:feed:${phone}`    : null, () => api.grow.compromissos.feed(phone));

  const tarefas = Array.isArray(tarefasData) ? tarefasData : [];
  const humor   = Array.isArray(humorData)   ? humorData   : [];
  const eventos = (eventosData?.eventos ?? []) as any[];

  const hojeStr = iso(new Date());
  const humorHoje = humor.find(r => r.data === hojeStr);

  const proximos = [...eventos]
    .filter(e => e.data >= hojeStr)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99'))
    .slice(0, 4);
  const rotuloDia = (d: string) => {
    const diff = Math.round((new Date(d + 'T12:00:00').getTime() - new Date(hojeStr + 'T12:00:00').getTime()) / 86400000);
    return diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  const basico = !podeUsar('grow_saude'); // Básico não tem Saúde/Estudos/Casa+

  if (!temAcessoGrow) return null;

  return (
    <section className="space-y-3 sm:space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>

      {/* ── FLUXO DE CAIXA + PRÓXIMOS EVENTOS ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        {ritmoSlot && <div className="lg:col-span-2">{ritmoSlot}</div>}

        {/* PRÓXIMOS EVENTOS — agenda agregada */}
        <Link href="/grow/agenda" className="card rounded-3xl p-5 sm:p-6 hover:shadow-glow-sm transition-all group flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
                <CalendarDays size={17} className="text-primary" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximos eventos</p>
            </div>
            <ChevronRight size={16} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          {proximos.length ? (
            <div className="space-y-2.5 flex-1">
              {proximos.map(e => (
                <div key={e.id} className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.cor }} />
                  <span className="text-sm text-foreground truncate flex-1">{e.titulo}</span>
                  <span className="text-[11px] font-medium text-muted-foreground flex-shrink-0 tabular-nums">{rotuloDia(e.data)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
              <p className="text-sm text-muted-foreground">Nada marcado 👌</p>
              <span className="mt-1.5 text-xs font-semibold text-primary group-hover:underline">Abrir agenda →</span>
            </div>
          )}
        </Link>
      </div>

      {/* ── TAREFAS + BEM-ESTAR ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* TAREFAS */}
        <Link href="/grow/tarefas" className="card rounded-2xl p-4 sm:p-5 hover:shadow-glow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #2563eb 14%, transparent)' }}>
              <ListChecks size={15} style={{ color: '#2563eb' }} />
            </span>
            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tarefas</p>
          <p className="text-xl font-bold text-foreground tabular-nums mt-0.5 leading-tight">
            {tarefas.length} <span className="text-xs text-muted-foreground font-medium">pendente{tarefas.length === 1 ? '' : 's'}</span>
          </p>
          <p className="text-[11px] text-muted-foreground truncate mt-1">{tarefas[0]?.titulo || 'Tudo em dia 🎉'}</p>
        </Link>

        {/* BEM-ESTAR */}
        <Link href="/grow/bem-estar" className="card rounded-2xl p-4 sm:p-5 hover:shadow-glow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #ec4899 14%, transparent)' }}>
              <Heart size={15} style={{ color: '#ec4899' }} />
            </span>
            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bem-estar</p>
          {humorHoje && HUMOR[humorHoje.humor] ? (
            <p className="text-xl font-bold text-foreground mt-0.5 leading-tight">
              {(HUMOR[humorHoje.humor] as any).e} <span className="text-xs text-muted-foreground font-medium">{(HUMOR[humorHoje.humor] as any).l}</span>
            </p>
          ) : (
            <p className="text-base font-semibold text-primary mt-1.5 leading-tight">Registrar humor →</p>
          )}
        </Link>
      </div>

      {/* ── Upsell pro Básico ───────────────────────────────────── */}
      {basico && (
        <Link href="/planos"
          className="flex items-center gap-3 rounded-2xl p-4 border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
            <Crown size={16} className="text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Desbloqueie Saúde, Estudos e Casa avançada</p>
            <p className="text-[11px] text-muted-foreground leading-snug">Nutrição, treinos, despensa, receitas e mais — no Premium.</p>
          </div>
          <ArrowRight size={16} className="text-primary flex-shrink-0" />
        </Link>
      )}
    </section>
  );
}

export default memo(GrowResumo);
