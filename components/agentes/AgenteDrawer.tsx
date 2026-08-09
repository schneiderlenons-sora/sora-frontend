'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Lock, MessageSquareQuote } from 'lucide-react';
import type { Agente, AvisoAgente } from '@/lib/agentes';

// =============================================================================
// Detalhe do agente — quem ele é, como fala e QUAIS avisos ele manda.
//
// ⚠️ VIA PORTAL, sempre. Os cards do painel usam `backdrop-blur`, e um ancestral
// com backdrop-filter vira o containing block de `position: fixed` — o painel
// ficaria preso dentro do card e apareceria ATRÁS do conteúdo. z-index não
// resolve. (Regra do CLAUDE.md, bug real do PagarFaturaModal.)
//
// Cada aviso mostra um EXEMPLO da mensagem na voz do agente. É o que transforma
// "Resumo semanal ☑" numa coisa que dá vontade de deixar ligada.
// =============================================================================

interface Props {
  agente: Agente;
  prefs: Record<string, any>;
  onToggle: (chave: string, valor: boolean) => void;
  onHorario: (chave: string, valor: string) => void;
  onClose: () => void;
}

export default function AgenteDrawer({ agente, prefs, onToggle, onHorario, onClose }: Props) {
  const [montado, setMontado] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMontado(true), []);

  // Escape fecha + trava o scroll do fundo + foco vai pro botão fechar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fecharRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  if (!montado) return null;   // SSR não tem document

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
      {/* Scrim forte o bastante pra isolar o conteúdo (40–60% é o padrão) */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fade-in_200ms_ease-out]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agente-nome"
        className="relative w-full sm:max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl
                   border border-border/60 shadow-2xl animate-[slide-up_280ms_ease-out]"
        style={{ background: 'hsl(var(--bg-card))' }}
      >
        {/* Capa com o vídeo do agente */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {/* Fundo de identidade sob o vídeo — ver AgenteCard. */}
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ background: `linear-gradient(150deg, ${agente.cor} 0%, color-mix(in srgb, ${agente.cor} 35%, #0b1220) 100%)` }}
          >
            <span className="text-6xl font-black text-white/20 select-none">{agente.nome.charAt(0)}</span>
          </div>
          <video
            src={agente.video}
            poster={agente.imagem}
            muted loop playsInline autoPlay
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--bg-card))] via-transparent to-transparent" />

          {/* Puxador do bottom-sheet (só mobile) */}
          <div className="absolute inset-x-0 top-2 flex justify-center sm:hidden">
            <span className="h-1 w-10 rounded-full bg-white/50" />
          </div>

          <button
            ref={fecharRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/50
                       text-white backdrop-blur-md transition-colors hover:bg-black/70
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 pb-8 space-y-5">
          <header>
            <h2 id="agente-nome" className="text-xl font-bold text-foreground">{agente.nome}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{agente.tagline}</p>
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-border/50 bg-muted/40 p-3
                          text-[12px] leading-relaxed text-muted-foreground">
              <MessageSquareQuote size={14} className="mt-0.5 flex-shrink-0" style={{ color: agente.cor }} />
              <span><span className="font-semibold text-foreground">Como ele fala:</span> {agente.voz}</span>
            </p>
          </header>

          <section className="space-y-2.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {agente.emBreve ? 'O que ele vai avisar' : 'O que ele te avisa'}
            </h3>

            {agente.avisos.map((aviso) => (
              <LinhaAviso
                key={aviso.id}
                aviso={aviso}
                cor={agente.cor}
                bloqueado={!!agente.emBreve}
                ligado={!aviso.chave || prefs[aviso.chave] !== false}
                horario={aviso.chaveHorario ? prefs[aviso.chaveHorario] : undefined}
                onToggle={(v) => aviso.chave && onToggle(aviso.chave, v)}
                onHorario={(h) => aviso.chaveHorario && onHorario(aviso.chaveHorario, h)}
              />
            ))}
          </section>

          {agente.emBreve && (
            <p className="rounded-xl border p-3 text-[12px] leading-relaxed"
               style={{ borderColor: `color-mix(in srgb, ${agente.cor} 35%, transparent)`,
                        background: `color-mix(in srgb, ${agente.cor} 8%, transparent)` }}>
              <span className="font-semibold text-foreground">{agente.nome} ainda está sendo treinado.</span>{' '}
              <span className="text-muted-foreground">
                Quando ficar pronto, ele aparece aqui já ligado — você não precisa fazer nada.
              </span>
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Uma linha de aviso: título, exemplo da mensagem e o interruptor ─────────
function LinhaAviso({
  aviso, cor, ligado, bloqueado, horario, onToggle, onHorario,
}: {
  aviso: AvisoAgente; cor: string; ligado: boolean; bloqueado: boolean;
  horario?: string; onToggle: (v: boolean) => void; onHorario: (h: string) => void;
}) {
  const semControle = !aviso.chave;
  const desabilitado = bloqueado || semControle;

  return (
    <div className="rounded-2xl border border-border/50 p-3.5" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">{aviso.titulo}</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{aviso.desc}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
            <Clock size={10} /> {aviso.cadencia}
          </p>
        </div>

        {desabilitado ? (
          <span
            className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1
                       text-[10px] font-semibold text-muted-foreground"
            title={bloqueado ? 'Ainda em construção' : 'Este aviso ainda não pode ser desligado'}
          >
            <Lock size={10} /> {bloqueado ? 'Em breve' : 'Sempre'}
          </span>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={ligado}
            aria-label={aviso.titulo}
            onClick={() => onToggle(!ligado)}
            className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                       focus-visible:ring-offset-background"
            style={{
              background: ligado ? cor : 'hsl(var(--fg-muted) / .3)',
              ['--tw-ring-color' as string]: cor,
            }}
          >
            <span
              className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
              style={{ transform: ligado ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        )}
      </div>

      {/* Exemplo da mensagem — é o que dá vontade de manter ligado */}
      <p className="mt-3 rounded-xl border-l-2 py-2 pl-3 pr-2 text-[11.5px] italic leading-relaxed text-muted-foreground"
         style={{ borderColor: cor, background: `color-mix(in srgb, ${cor} 6%, transparent)` }}>
        “{aviso.exemplo}”
      </p>

      {/* Horário (só os dois avisos que têm) */}
      {aviso.chaveHorario && !desabilitado && ligado && (
        <label className="mt-3 flex items-center justify-between gap-3 border-t border-border/40 pt-3">
          <span className="text-[11.5px] font-medium text-muted-foreground">Horário do aviso</span>
          <input
            type="time"
            value={(horario || '').slice(0, 5)}
            onChange={(e) => onHorario(e.target.value)}
            className="h-11 rounded-xl border border-border/60 bg-background px-3 text-[13px] tabular text-foreground
                       focus-visible:outline-none focus-visible:ring-2"
            style={{ ['--tw-ring-color' as string]: cor }}
          />
        </label>
      )}
    </div>
  );
}
