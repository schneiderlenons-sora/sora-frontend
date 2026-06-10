'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  Target, ListChecks, Heart, CalendarDays, ChevronRight,
  Check, Crown, ArrowRight, Plus,
} from 'lucide-react';

const HUMOR = ['', { e: '😔', l: 'Péssimo' }, { e: '😕', l: 'Mal' }, { e: '😐', l: 'Normal' }, { e: '🙂', l: 'Bem' }, { e: '😄', l: 'Ótimo' }] as const;
const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const diaSemBR = () => { const j = new Date().getDay(); return j === 0 ? 7 : j; };

export default function GrowResumo() {
  const { phone, temAcessoGrow, podeUsar } = useAuth();
  const [habitos, setHabitos]   = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [tarefas, setTarefas]   = useState<any[]>([]);
  const [humor, setHumor]       = useState<any[]>([]);
  const [eventos, setEventos]   = useState<any[]>([]);

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
  }, [phone]);

  useEffect(() => { carregar(); }, [carregar]);

  const hojeStr = iso(new Date());
  const diaSem = diaSemBR();
  const habitosHoje = habitos.filter(h => h.ativo && (h.dias_semana || [1, 2, 3, 4, 5, 6, 7]).includes(diaSem));
  const feitos = new Set(registros.filter(r => r.data === hojeStr && r.concluido).map(r => r.habito_id));
  const habFeitos = habitosHoje.filter(h => feitos.has(h.id)).length;
  const habPct = habitosHoje.length ? Math.round((habFeitos / habitosHoje.length) * 100) : 0;

  // Check-in otimista — atualiza UI na hora, chama API, reverte no erro.
  const toggleHabito = useCallback(async (h: any) => {
    if (!phone) return;
    const jaFeito = registros.some(r => r.habito_id === h.id && r.data === hojeStr && r.concluido);
    const snapshot = registros;
    const semHoje = registros.filter(r => !(r.habito_id === h.id && r.data === hojeStr));
    setRegistros(jaFeito ? semHoje : [...semHoje, { habito_id: h.id, data: hojeStr, concluido: true }]);
    try { await api.grow.habitos.toggle(h.id, { phone, data: hojeStr }); }
    catch { setRegistros(snapshot); }
  }, [phone, registros, hojeStr]);

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

      {/* ── HÁBITOS (interativo) + PRÓXIMOS ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">

        {/* HÁBITOS — check-in direto pelo dashboard */}
        <div className="card rounded-3xl p-5 sm:p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
                <Target size={17} className="text-primary" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground leading-none">Hábitos de hoje</p>
                <p className="text-sm font-bold text-foreground leading-tight mt-0.5">
                  {habitosHoje.length ? `${habFeitos} de ${habitosHoje.length} concluídos` : 'Sem hábitos hoje'}
                </p>
              </div>
            </div>
            <span className="text-base font-bold tabular-nums text-primary flex-shrink-0">{habPct}%</span>
          </div>

          {/* Barra de progresso */}
          {habitosHoje.length > 0 && (
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${habPct}%` }} />
            </div>
          )}

          {/* Lista com check-in */}
          {habitosHoje.length > 0 ? (
            <div className="space-y-1.5 -mx-1 max-h-[300px] overflow-y-auto pr-1">
              {habitosHoje.map((h, i) => {
                const done = feitos.has(h.id);
                const cor = h.cor || 'hsl(var(--primary))';
                return (
                  <button
                    key={h.id}
                    onClick={() => toggleHabito(h)}
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`${done ? 'Desmarcar' : 'Marcar'} ${h.nome}`}
                    className="w-full flex items-center gap-3 px-2 py-2 rounded-xl text-left transition-colors hover:bg-muted/50 active:scale-[0.99] animate-fade-in"
                    style={{ animationDelay: `${i * 40}ms`, minHeight: 44 }}
                  >
                    {/* Check */}
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all border-2"
                      style={done
                        ? { background: cor, borderColor: cor }
                        : { borderColor: 'color-mix(in srgb, var(--fg-muted, #888) 40%, transparent)' }}
                    >
                      {done && <Check size={15} className="text-white" strokeWidth={3} />}
                    </span>
                    {/* Ícone + nome */}
                    {h.icone && <span className="text-base flex-shrink-0">{h.icone}</span>}
                    <span className={`text-sm flex-1 truncate transition-colors ${done ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                      {h.nome}
                    </span>
                    {h.streak > 0 && (
                      <span className="text-[11px] font-bold tabular-nums flex-shrink-0" style={{ color: cor }}>
                        🔥 {h.streak}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                   style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 10%, transparent)' }}>
                <Target size={20} className="text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhum hábito pra hoje</p>
              <Link href="/grow/habitos" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                <Plus size={13} /> Criar hábito
              </Link>
            </div>
          )}

          {habitosHoje.length > 0 && habFeitos === habitosHoje.length && (
            <p className="text-xs font-semibold text-primary text-center mt-3 pt-3 border-t border-border/50">
              🎉 Todos os hábitos de hoje concluídos!
            </p>
          )}
        </div>

        {/* PRÓXIMOS — agenda agregada */}
        <Link href="/grow/agenda" className="card rounded-3xl p-5 sm:p-6 hover:shadow-glow-sm transition-all group flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
                <CalendarDays size={17} className="text-primary" />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximos</p>
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
