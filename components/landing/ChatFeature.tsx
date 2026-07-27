'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, type LucideIcon } from 'lucide-react';
import { ChatMessages, type Msg } from './chatbits';

export type { Msg };

export type ChatFeatureProps = {
  accent: string;            // cor do badge/checks/glow da seção
  accentTo: string;          // fim do gradiente do badge
  badgeIcon: LucideIcon;
  badgeText: string;
  heading: React.ReactNode;  // pode conter <br/>
  paragraph: string;
  items: string[];
  roteiro?: Msg[];           // conversa do loop (termina numa resposta da Sora)
  visual?: React.ReactNode;  // se fornecido, substitui o card de chat (ex.: calendário)
};

// Dispara `inView` uma vez quando o elemento entra na tela.
function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Dispara quando o usuário CHEGA na seção. threshold:0 + rootMargin negativo
    // no rodapé faz o gatilho depender da POSIÇÃO da seção na tela (não de quantos
    // % dela cabem na viewport) — funciona mesmo quando a seção é mais alta que a
    // tela (tablet retrato), que era o que prendia o conteúdo em opacity-0.
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0, rootMargin: '0px 0px -20% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

export default function ChatFeature({ accent, accentTo, badgeIcon: BadgeIcon, badgeText, heading, paragraph, items, roteiro, visual }: ChatFeatureProps) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);

  // Loop contínuo: vazio → mensagens (com "digitando") → resposta → segura →
  // limpa → recomeça. À prova de leak (flag + clearTimeout).
  useEffect(() => {
    if (!inView || !roteiro) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((res) => { timers.push(setTimeout(res, ms)); });

    (async () => {
      while (vivo) {
        setMsgs([]); setTyping(false);
        await espera(1500); if (!vivo) return;

        for (const m of roteiro) {
          if (m.who === 'sora') {
            setTyping(true);
            await espera(1400); if (!vivo) return;
            setTyping(false);
          }
          setMsgs((prev) => [...prev, m]);
          await espera(m.who === 'user' ? 800 : 1100); if (!vivo) return;
        }

        await espera(3200); if (!vivo) return;
      }
    })();

    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView, roteiro]);

  return (
    <section className="relative py-20 lg:py-28 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[700px] h-[500px] opacity-40 dark:opacity-25"
             style={{ background: `radial-gradient(ellipse, ${accent}24 0%, transparent 65%)` }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* ESQUERDA — conteúdo */}
        <div>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentTo} 100%)` }}>
            <BadgeIcon size={16} /> {badgeText}
          </span>

          <h2 className="mt-6 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-zinc-900 dark:text-white">
            {heading}
          </h2>

          <p className="mt-5 text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-md">
            {paragraph}
          </p>

          <ul className="mt-8 space-y-3">
            {items.map((t, i) => (
              <li key={t}
                  className="flex items-center gap-3 w-fit pl-2 pr-5 py-2 rounded-full bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.08] animate-[slide-up_500ms_ease-out_both]"
                  style={{ animationDelay: `${i * 90}ms` }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentTo} 100%)` }}>
                  <Check size={14} className="text-white" strokeWidth={3} />
                </span>
                <span className="text-[15px] font-medium text-zinc-800 dark:text-zinc-200">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* DIREITA — visual customizado (ex.: calendário) OU card de chat animado */}
        <div ref={ref}
             className={`relative mx-auto w-full max-w-md transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {visual ?? (
            <div className="relative rounded-[28px] p-4 sm:p-5 bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
              <div className="h-[460px]">
                <ChatMessages msgs={msgs} typing={typing} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
