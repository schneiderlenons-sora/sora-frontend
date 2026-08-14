'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import GrowHero from '@/components/grow/GrowHero';
import AgenteCard from '@/components/agentes/AgenteCard';
import AgenteDrawer from '@/components/agentes/AgenteDrawer';
import Switch from '@/components/ui/Switch';
import { useAuth } from '@/contexts/AuthContext';
import { api, type AvisosPrefs } from '@/lib/api';
import { AGENTES, agenteAtivo, contagemAtivos, type Agente } from '@/lib/agentes';
import {
  Bell, BellOff, Loader2, ChevronLeft, ChevronRight, Sparkles, Users,
} from 'lucide-react';

const BRAND = '#61D17B';

const DEFAULTS: AvisosPrefs = {
  avisos_ativos: true, resumo_semanal: true, resumo_mensal: true,
  habito_lembrete_ativo: false, habito_lembrete_horario: '21:00',
  agenda_briefing_ativo: false, agenda_briefing_horario: '07:00',
  lembretes_ativos: true, lembretes_dividas: true,
};

export default function AgentesPage() {
  const { phone } = useAuth();
  const [prefs, setPrefs] = useState<AvisosPrefs | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<Agente | null>(null);

  const carregar = useCallback(async () => {
    try { setPrefs(await api.user.avisos.get()); }
    catch { setPrefs(DEFAULTS); }              // nunca trava no loading
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  // Otimista: muda na hora, salva, reverte no erro (padrão da casa).
  const patch = useCallback(async (campo: string, valor: boolean | string) => {
    setPrefs((atual) => (atual ? { ...atual, [campo]: valor } as AvisosPrefs : atual));
    try { await api.user.avisos.set({ [campo]: valor } as Partial<AvisosPrefs>); }
    catch { carregar(); }                      // recarrega a verdade do servidor
  }, [carregar]);

  const mestreLigado = !!prefs?.avisos_ativos;

  const { meus, sugestoes } = useMemo(() => {
    const p = (prefs || {}) as Record<string, unknown>;
    return {
      meus: AGENTES.filter((a) => !a.emBreve),
      sugestoes: AGENTES.filter((a) => a.emBreve || !agenteAtivo(a, p)),
    };
  }, [prefs]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-24 space-y-6">
        <GrowHero
          badge="Agentes"
          badgeIcon={Users}
          badgeColor={BRAND}
          badgeBgClass="bg-[#61D17B]/10 dark:bg-[#61D17B]/15"
          haloRgba="color-mix(in srgb, #61D17B 12%, transparent)"
          titulo="Seus agentes"
          subtitulo="Cada um cuida de uma parte da sua vida e te avisa no WhatsApp. Toque para ver o que ele manda."
        />

        {carregando || !prefs ? (
          <FaixaSkeleton />
        ) : (
          <>
            {/* Interruptor mestre — soberano sobre todos os agentes */}
            <div className="relative overflow-hidden rounded-2xl border border-border/40 backdrop-blur-xl p-4 sm:p-5"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
              <div className="absolute inset-0 pointer-events-none opacity-60"
                   style={{ background: `radial-gradient(circle at top right, ${BRAND}24 0%, transparent 70%)` }} />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                       style={{ background: `color-mix(in srgb, ${BRAND} 14%, transparent)` }}>
                    {mestreLigado
                      ? <Bell size={20} style={{ color: BRAND }} />
                      : <BellOff size={20} className="text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">Avisos da Sora</p>
                    <p className="text-xs text-muted-foreground leading-snug">
                      {mestreLigado
                        ? 'Ativados — sua tripulação está de olho.'
                        : 'Desligados — nenhum agente vai te mandar mensagem.'}
                    </p>
                  </div>
                </div>
                <Switch
                  on={mestreLigado}
                  onToggle={() => patch('avisos_ativos', !mestreLigado)}
                  label="Avisos da Sora"
                  cor={BRAND}
                />
              </div>
            </div>

            <div className={`space-y-8 transition-opacity ${mestreLigado ? '' : 'opacity-50 pointer-events-none select-none'}`}
                 aria-disabled={!mestreLigado}>
              <Faixa titulo="Meus Agentes" icon={Users}>
                {meus.map((a, i) => {
                  const { ligados, total } = contagemAtivos(a, prefs as Record<string, unknown>);
                  return (
                    <AgenteCard
                      key={a.id} agente={a} delay={i * 40}
                      ativo={agenteAtivo(a, prefs as Record<string, unknown>)}
                      ligados={ligados} total={total}
                      onAbrir={() => setAberto(a)}
                    />
                  );
                })}
              </Faixa>

              {sugestoes.length > 0 && (
                <Faixa titulo="Sugestões" icon={Sparkles}
                       sub="Agentes que ainda não estão trabalhando pra você.">
                  {sugestoes.map((a, i) => {
                    const { ligados, total } = contagemAtivos(a, prefs as Record<string, unknown>);
                    return (
                      <AgenteCard
                        key={a.id} agente={a} delay={i * 40}
                        ativo={false} ligados={ligados} total={total}
                        onAbrir={() => setAberto(a)}
                      />
                    );
                  })}
                </Faixa>
              )}
            </div>
          </>
        )}
      </div>

      {aberto && prefs && (
        <AgenteDrawer
          agente={aberto}
          prefs={prefs as Record<string, any>}
          phone={phone || undefined}
          onToggle={(chave, valor) => patch(chave, valor)}
          onHorario={(chave, valor) => patch(chave, valor)}
          onClose={() => setAberto(null)}
        />
      )}
    </DashboardLayout>
  );
}

// ── Faixa horizontal com setas no desktop ──────────────────────────────────
// Scroll nativo com snap (o gesto que o usuário já espera no mobile); as setas
// existem só no desktop, onde não há swipe. Sem elas o carrossel some pra quem
// usa mouse — é o `gesture-alternative` da checklist.
function Faixa({
  titulo, icon: Icon, sub, children,
}: { titulo: string; icon: any; sub?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const rolar = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });

  return (
    <section>
      <div className="flex items-end justify-between gap-3 mb-3 px-0.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Icon size={16} className="text-muted-foreground" /> {titulo}
          </h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          {([-1, 1] as const).map((d) => (
            <button
              key={d} type="button" onClick={() => rolar(d)}
              aria-label={d === -1 ? `${titulo}: voltar` : `${titulo}: avançar`}
              className="grid h-11 w-11 place-items-center rounded-full border border-border/60
                         text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {d === -1 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          ))}
        </div>
      </div>

      {/* `-mx-*` + `px-*` deixam os cards sangrarem até a borda no mobile sem
          criar scroll horizontal na PÁGINA (só na faixa). */}
      <div
        ref={ref}
        className="-mx-4 sm:mx-0 flex gap-3 overflow-x-auto scroll-smooth px-4 sm:px-0.5 pb-2
                   snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}

function FaixaSkeleton() {
  return (
    <div className="space-y-8" aria-hidden="true">
      {[0, 1].map((f) => (
        <div key={f}>
          <div className="h-5 w-36 rounded-lg bg-muted animate-pulse mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="w-[190px] sm:w-[210px] flex-shrink-0">
                <div className="aspect-[3/4] rounded-2xl bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-center py-4">
        <Loader2 className="animate-spin text-muted-foreground" size={18} />
      </div>
    </div>
  );
}
