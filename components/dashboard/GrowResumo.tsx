'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Sprout, Target, ListChecks, Heart, CalendarDays, ChevronRight,
  Check, Crown, ArrowRight, Stethoscope, Receipt, CreditCard, Wrench,
} from 'lucide-react';

const HUMOR = ['', { e: '😔', l: 'Péssimo' }, { e: '😕', l: 'Mal' }, { e: '😐', l: 'Normal' }, { e: '🙂', l: 'Bem' }, { e: '😄', l: 'Ótimo' }] as const;
const ICONE_SRC: Record<string, any> = {
  compromisso: CalendarDays, consulta: Stethoscope, recorrencia: Receipt,
  divida: Receipt, fatura: CreditCard, fechamento: CreditCard, manutencao: Wrench,
};
const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const diaSemBR = () => { const j = new Date().getDay(); return j === 0 ? 7 : j; };

export default function GrowResumo() {
  const { phone, temAcessoGrow, podeUsar } = useAuth();
  const [habitos, setHabitos]   = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [tarefas, setTarefas]   = useState<any[]>([]);
  const [humor, setHumor]       = useState<any[]>([]);
  const [eventos, setEventos]   = useState<any[]>([]);
  const [carregado, setCarregado] = useState(false);

  const carregar = useCallback(async () => {
    if (!phone) return;
    const [h, t, m, ev] = await Promise.allSettled([
      api.grow.habitos.listar(phone, { dias: 7 }),
      api.grow.tarefas.listar(phone, { concluida: false }),
      api.grow.humor.listar(phone, 1),
      api.grow.compromissos.feed(phone),
    ]);
    if (h.status === 'fulfilled')  { setHabitos(h.value.habitos || []); setRegistros(h.value.registros || []); }
    if (t.status === 'fulfilled')  setTarefas(Array.isArray(t.value) ? t.value : []);
    if (m.status === 'fulfilled')  setHumor(Array.isArray(m.value) ? m.value : []);
    if (ev.status === 'fulfilled') setEventos(ev.value.eventos || []);
    setCarregado(true);
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  if (!temAcessoGrow) return null;

  // ── Hábitos de hoje ──
  const hojeStr = iso(new Date());
  const diaSem = diaSemBR();
  const habitosHoje = habitos.filter(h => h.ativo && (h.dias_semana || [1, 2, 3, 4, 5, 6, 7]).includes(diaSem));
  const feitos = new Set(registros.filter(r => r.data === hojeStr && r.concluido).map(r => r.habito_id));
  const habFeitos = habitosHoje.filter(h => feitos.has(h.id)).length;
  const habPct = habitosHoje.length ? Math.round((habFeitos / habitosHoje.length) * 100) : 0;

  // ── Humor de hoje ──
  const humorHoje = humor.find(r => r.data === hojeStr);

  // ── Próximos compromissos (feed agregado) ──
  const proximos = [...eventos]
    .filter(e => e.data >= hojeStr)
    .sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99'))
    .slice(0, 3);
  const rotuloDia = (d: string) => {
    const diff = Math.round((new Date(d + 'T12:00:00').getTime() - new Date(hojeStr + 'T12:00:00').getTime()) / 86400000);
    return diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  const basico = !podeUsar('grow_saude'); // Básico não tem Saúde/Estudos/Casa+

  return (
    <section className="space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <Sprout size={15} className="text-primary" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Sora Grow</p>
            <p className="text-sm font-bold text-foreground leading-tight">Seu dia organizado</p>
          </div>
        </div>
        <Link href="/grow/habitos" className="text-xs text-primary hover:underline flex items-center gap-0.5">
          Abrir Grow <ChevronRight size={12} />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* HÁBITOS */}
        <Link href="/grow/habitos" className="card rounded-2xl p-4 hover:shadow-glow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 12%, transparent)' }}>
              <Target size={15} className="text-primary" />
            </span>
            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hábitos de hoje</p>
          <p className="text-lg font-bold text-foreground tabular mt-0.5">{habFeitos}<span className="text-muted-foreground/60 font-medium">/{habitosHoje.length}</span></p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${habPct}%` }} />
          </div>
        </Link>

        {/* TAREFAS */}
        <Link href="/grow/tarefas" className="card rounded-2xl p-4 hover:shadow-glow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #2563eb 14%, transparent)' }}>
              <ListChecks size={15} style={{ color: '#2563eb' }} />
            </span>
            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tarefas</p>
          <p className="text-lg font-bold text-foreground tabular mt-0.5">{tarefas.length} <span className="text-xs text-muted-foreground font-medium">pendente{tarefas.length === 1 ? '' : 's'}</span></p>
          <p className="text-[11px] text-muted-foreground truncate mt-1">{tarefas[0]?.titulo || 'Tudo em dia 🎉'}</p>
        </Link>

        {/* BEM-ESTAR */}
        <Link href="/grow/bem-estar" className="card rounded-2xl p-4 hover:shadow-glow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, #ec4899 14%, transparent)' }}>
              <Heart size={15} style={{ color: '#ec4899' }} />
            </span>
            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bem-estar</p>
          {humorHoje && HUMOR[humorHoje.humor] ? (
            <p className="text-lg font-bold text-foreground mt-0.5">
              {(HUMOR[humorHoje.humor] as any).e} <span className="text-xs text-muted-foreground font-medium">{(HUMOR[humorHoje.humor] as any).l}</span>
            </p>
          ) : (
            <p className="text-sm font-semibold text-primary mt-1">Registrar humor →</p>
          )}
        </Link>

        {/* AGENDA */}
        <Link href="/grow/agenda" className="card rounded-2xl p-4 hover:shadow-glow-sm transition-all group">
          <div className="flex items-center justify-between mb-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 12%, transparent)' }}>
              <CalendarDays size={15} className="text-primary" />
            </span>
            <ChevronRight size={14} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Próximos</p>
          {proximos.length ? (
            <div className="space-y-1">
              {proximos.map(e => {
                const Ic = ICONE_SRC[e.source] || CalendarDays;
                return (
                  <div key={e.id} className="flex items-center gap-1.5 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: e.cor }} />
                    <span className="text-[11px] text-foreground truncate flex-1">{e.titulo}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">{rotuloDia(e.data)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground mt-1">Nada marcado 👌</p>
          )}
        </Link>
      </div>

      {/* Upsell pro Básico */}
      {basico && (
        <Link href="/planos"
          className="flex items-center gap-3 rounded-2xl p-4 border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
            <Crown size={16} className="text-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">Desbloqueie Saúde, Estudos e Casa avançada</p>
            <p className="text-[11px] text-muted-foreground">Nutrição, treinos, despensa, receitas e mais — no Premium.</p>
          </div>
          <ArrowRight size={16} className="text-primary flex-shrink-0" />
        </Link>
      )}
    </section>
  );
}
