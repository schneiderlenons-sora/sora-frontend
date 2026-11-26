'use client';

import { memo, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useVisivel } from '@/lib/useVisivel';
import { useEhAppIos, useIosVende } from '@/lib/useOrigem';
import { umPorEvento, rotuloCurto } from '@/lib/agenda-periodo';
import {
  ListChecks, Heart, CalendarDays, ChevronRight, Crown, ArrowRight,
} from 'lucide-react';

const HUMOR = ['', { e: '😔', l: 'Péssimo' }, { e: '😕', l: 'Mal' }, { e: '😐', l: 'Normal' }, { e: '🙂', l: 'Bem' }, { e: '😄', l: 'Ótimo' }] as const;
const iso = (d: Date) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };

function GrowResumo({ ritmoSlot, pronto = true }: { ritmoSlot?: ReactNode; pronto?: boolean }) {
  const { phone, temAcessoGrow, podeUsar } = useAuth();

  // Estas 3 chamadas saíam JUNTO com a /api/dashboard e roubavam a janela do
  // LCP (o feed sozinho leva ~1,5s) pra alimentar um bloco abaixo da dobra.
  // `pronto` = a chamada principal já respondeu; só aí observamos a
  // visibilidade (antes disso a página é skeleton, é curta, e tudo "parece"
  // visível). Sem o segundo passo, o LCP continua disputando banda.
  const { ref, visivel } = useVisivel<HTMLElement>(pronto);
  const ativo = phone && temAcessoGrow && pronto && visivel;
  // `portao: false`: este bloco fica ABAIXO da dobra e carrega sozinho — não
  // pode cobrir o dashboard inteiro com a baleia (era o que acontecia ao
  // voltar ao dashboard, medido em nov/2026). Enquanto não chega, cada parte
  // mostra um esqueleto (`carregando*` abaixo), nunca o estado vazio.
  const { data: tarefasData, error: erroTarefas } = useApi(ativo ? `grow:tarefas:${phone}` : null, () => api.grow.tarefas.listar(phone, { concluida: false }), { portao: false });
  const { data: humorData, error: erroHumor }     = useApi(ativo ? `grow:humor:${phone}`   : null, () => api.grow.humor.listar(phone, 1), { portao: false });
  const { data: eventosData, error: erroEventos } = useApi(ativo ? `grow:feed:${phone}`    : null, () => api.grow.compromissos.feed(phone), { portao: false });
  // ⚠️ Sem dado ainda ≠ "nada marcado"/"0 pendentes": mostrar o vazio antes de
  // a resposta chegar dizia à pessoa que ela não tinha nada. Com ERRO, volta o
  // estado de antes (vazio) — esqueleto eterno seria pior.
  const carregandoTarefas = tarefasData === undefined && !erroTarefas;
  const carregandoHumor   = humorData === undefined && !erroHumor;
  const carregandoEventos = eventosData === undefined && !erroEventos;

  const tarefas = Array.isArray(tarefasData) ? tarefasData : [];
  const humor   = Array.isArray(humorData)   ? humorData   : [];
  const eventos = (eventosData?.eventos ?? []) as any[];

  const hojeStr = iso(new Date());
  const humorHoje = humor.find(r => r.data === hojeStr);

  // "Próximos eventos" = agendamentos/obrigações futuras (compromissos, consultas,
  // faturas a pagar, dívidas, recorrências, manutenções). Exclui transações já
  // lançadas (source 'transacao') — elas já aconteceram, não são "próximo evento".
  // Na Agenda completa elas continuam aparecendo no calendário.
  // Evento de vários dias entra UMA vez (o 1º dia que ainda vem).
  const proximos = umPorEvento([...eventos]
    .filter(e => e.data >= hojeStr && e.source !== 'transacao')
    .sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99')))
    .slice(0, 4);
  const rotuloDia = (d: string) => {
    const diff = Math.round((new Date(d + 'T12:00:00').getTime() - new Date(hojeStr + 'T12:00:00').getTime()) / 86400000);
    return diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  };

  const basico = !podeUsar('grow_saude'); // Básico não tem Saúde/Estudos/Casa+
  // App de iPhone sem compra pela Apple: sem convite de upgrade (lib/app-ios.ts).
  const ehIos = useEhAppIos();
  const iosVende = useIosVende();
  const semVenda = ehIos && !iosVende;

  if (!temAcessoGrow) return null;

  return (
    <section ref={ref} className="space-y-3 sm:space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>

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
          {carregandoEventos ? (
            <div className="space-y-2.5 flex-1" aria-busy="true" aria-label="Carregando próximos eventos">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-4 rounded bg-muted motion-safe:animate-pulse" style={{ width: `${80 - i * 15}%` }} />
              ))}
            </div>
          ) : proximos.length ? (
            <div className="space-y-2.5 flex-1">
              {proximos.map(e => (
                <div key={e.id} className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: e.cor }} />
                  <span className="text-sm text-foreground truncate flex-1">
                    {e.titulo}
                    {rotuloCurto(e.periodo) && <span className="text-muted-foreground"> · {rotuloCurto(e.periodo)}</span>}
                  </span>
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
          {carregandoTarefas ? (
            <div aria-busy="true" aria-label="Carregando tarefas">
              <div className="h-6 w-24 rounded bg-muted motion-safe:animate-pulse mt-1" />
              <div className="h-3 w-full rounded bg-muted motion-safe:animate-pulse mt-2" />
            </div>
          ) : (
            <>
              <p className="text-xl font-bold text-foreground tabular-nums mt-0.5 leading-tight">
                {tarefas.length} <span className="text-xs text-muted-foreground font-medium">pendente{tarefas.length === 1 ? '' : 's'}</span>
              </p>
              <p className="text-[11px] text-muted-foreground truncate mt-1">{tarefas[0]?.titulo || 'Tudo em dia 🎉'}</p>
            </>
          )}
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
          {carregandoHumor ? (
            <div className="h-6 w-28 rounded bg-muted motion-safe:animate-pulse mt-1.5" aria-busy="true" aria-label="Carregando bem-estar" />
          ) : humorHoje && HUMOR[humorHoje.humor] ? (
            <p className="text-xl font-bold text-foreground mt-0.5 leading-tight">
              {(HUMOR[humorHoje.humor] as any).e} <span className="text-xs text-muted-foreground font-medium">{(HUMOR[humorHoje.humor] as any).l}</span>
            </p>
          ) : (
            <p className="text-base font-semibold text-primary mt-1.5 leading-tight">Registrar humor →</p>
          )}
        </Link>
      </div>

      {/* ── Upsell pro Básico ───────────────────────────────────── */}
      {basico && !semVenda && (
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
