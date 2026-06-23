'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GrowHero from '@/components/grow/GrowHero';
import { api, type AvisosPrefs } from '@/lib/api';
import {
  Bell, BellOff, Loader2, CalendarClock, Sparkles, Wallet, Receipt,
  Target, Sunrise, Moon,
} from 'lucide-react';

const BRAND = '#61D17B';

const DEFAULTS: AvisosPrefs = {
  avisos_ativos: true, resumo_semanal: true, resumo_mensal: true,
  habito_lembrete_ativo: false, habito_lembrete_horario: '21:00',
  agenda_briefing_ativo: false, agenda_briefing_horario: '07:00',
  lembretes_ativos: true, lembretes_dividas: true,
};

export default function AvisosPage() {
  const [prefs, setPrefs] = useState<AvisosPrefs | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try { setPrefs(await api.user.avisos.get()); }
    catch { setPrefs(DEFAULTS); } // nunca trava no loading
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Atualização otimista: muda na hora, salva, reverte no erro.
  async function patch(campo: keyof AvisosPrefs, valor: boolean | string) {
    if (!prefs) return;
    const anterior = prefs;
    const novo = { ...prefs, [campo]: valor };
    setPrefs(novo);
    try { await api.user.avisos.set({ [campo]: valor } as Partial<AvisosPrefs>); }
    catch { setPrefs(anterior); }
  }

  const mestreLigado = !!prefs?.avisos_ativos;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-24 space-y-6">
        <GrowHero
          badge="Avisos"
          badgeIcon={Bell}
          titulo="Central de Avisos"
          subtitulo="Escolha o que a Sora te avisa no WhatsApp — de finanças ao Sora Grow."
        />

        {carregando || !prefs ? (
          <div className="py-16 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* Toggle mestre */}
            <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4 sm:p-5"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
              <div
                className="absolute inset-0 pointer-events-none opacity-60"
                style={{ background: `radial-gradient(circle at top right, ${BRAND}24 0%, transparent 70%)` }}
              />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                       style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)` }}>
                    {mestreLigado ? <Bell size={20} style={{ color: BRAND }} /> : <BellOff size={20} className="text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Avisos da Sora</p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {mestreLigado ? 'Ativados — a Sora te avisa pelo WhatsApp.' : 'Desligados — a Sora não envia nenhum aviso.'}
                    </p>
                  </div>
                </div>
                <Switch on={mestreLigado} onToggle={() => patch('avisos_ativos', !mestreLigado)} label="Avisos da Sora" />
              </div>
            </div>

            {/* Conteúdo (desabilita visualmente quando o mestre está off) */}
            <div className={`space-y-6 transition-opacity ${mestreLigado ? '' : 'opacity-50 pointer-events-none select-none'}`}
                 aria-disabled={!mestreLigado}>

              {/* Finanças */}
              <Secao titulo="Sora Finance" icon={Wallet}>
                <LinhaToggle
                  icon={Receipt} cor="#3b82f6"
                  titulo="Lembretes de contas"
                  desc="Vencimento de recorrências, parcelas e faturas de cartão."
                  on={prefs.lembretes_ativos} onToggle={() => patch('lembretes_ativos', !prefs.lembretes_ativos)}
                />
                <LinhaToggle
                  icon={Receipt} cor="#ef4444"
                  titulo="Lembretes de dívidas"
                  desc="Avisa antes do vencimento e quando uma dívida atrasa."
                  on={prefs.lembretes_dividas} onToggle={() => patch('lembretes_dividas', !prefs.lembretes_dividas)}
                />
                <LinhaToggle
                  icon={Sparkles} cor="#8b5cf6"
                  titulo="Resumo semanal"
                  desc="Todo domingo, um panorama dos seus gastos da semana."
                  on={prefs.resumo_semanal} onToggle={() => patch('resumo_semanal', !prefs.resumo_semanal)}
                />
                <LinhaToggle
                  icon={Sparkles} cor="#8b5cf6"
                  titulo="Fechamento mensal"
                  desc="No 1º dia do mês, o resumo do mês que passou."
                  on={prefs.resumo_mensal} onToggle={() => patch('resumo_mensal', !prefs.resumo_mensal)}
                />
              </Secao>

              {/* Grow */}
              <Secao titulo="Sora Grow" icon={Target}>
                <LinhaToggle
                  icon={Moon} cor="#7c3aed"
                  titulo="Checkup de hábitos"
                  desc="Um lembrete pra revisar e marcar seus hábitos do dia. Dica: deixe à noite."
                  on={prefs.habito_lembrete_ativo} onToggle={() => patch('habito_lembrete_ativo', !prefs.habito_lembrete_ativo)}
                  horario={prefs.habito_lembrete_horario}
                  onHorario={(h) => patch('habito_lembrete_horario', h)}
                />
                <LinhaToggle
                  icon={Sunrise} cor="#f59e0b"
                  titulo="Briefing matinal"
                  desc="De manhã, tudo que você tem pra hoje na agenda (compromissos, contas, consultas)."
                  on={prefs.agenda_briefing_ativo} onToggle={() => patch('agenda_briefing_ativo', !prefs.agenda_briefing_ativo)}
                  horario={prefs.agenda_briefing_horario}
                  onHorario={(h) => patch('agenda_briefing_horario', h)}
                />
              </Secao>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock size={12} /> As alterações valem a partir do próximo aviso.
            </p>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ── Componentes ────────────────────────────────────────────────────
function Secao({ titulo, icon: Icon, children }: { titulo: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2 px-1">
        <Icon size={14} className="text-muted-foreground" />
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{titulo}</h2>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function LinhaToggle({ icon: Icon, cor, titulo, desc, on, onToggle, horario, onHorario }: {
  icon: any; cor: string; titulo: string; desc: string; on: boolean; onToggle: () => void;
  horario?: string; onHorario?: (h: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-4"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
            <Icon size={18} style={{ color: cor }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{titulo}</p>
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</p>
          </div>
        </div>
        <Switch on={on} onToggle={onToggle} label={titulo} />
      </div>

      {/* Seletor de horário (só quando o aviso tem horário e está ligado) */}
      {horario !== undefined && on && (
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border/40 pl-[52px]">
          <span className="text-xs font-medium text-muted-foreground">Horário do aviso</span>
          <input
            type="time"
            value={horario}
            onChange={(e) => onHorario?.(e.target.value)}
            className="h-10 px-3 rounded-xl bg-background border border-border text-sm text-foreground tabular-nums focus:outline-none focus:border-primary"
            aria-label={`Horário do aviso: ${titulo}`}
          />
        </div>
      )}
    </div>
  );
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200 ${
        on ? 'bg-primary' : 'bg-muted'
      }`}
      style={{ width: 48, height: 28, minWidth: 48 }}
    >
      <span
        className="inline-block bg-white rounded-full shadow transition-transform duration-200"
        style={{ width: 22, height: 22, transform: `translateX(${on ? 23 : 3}px)` }}
      />
    </button>
  );
}
