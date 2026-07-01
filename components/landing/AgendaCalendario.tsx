'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Mic, Check } from 'lucide-react';

const BRAND = '#61ce70';

function useInView<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

const DIAS = Array.from({ length: 21 }, (_, i) => i + 1);
const HOJE = 9;
const AMANHA = 10;

// Card do lado direito da seção Agenda: mostra a Sora recebendo o compromisso
// por voz e ele "caindo" no quadradinho do dia + aparecendo na lista. Loop.
export default function AgendaCalendario() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [fase, setFase] = useState(0); // 0 vazio · 1 comando · 2 evento na célula · 3 lista

  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((res) => { timers.push(setTimeout(res, ms)); });
    (async () => {
      while (vivo) {
        setFase(0); await espera(1000); if (!vivo) return;
        setFase(1); await espera(1400); if (!vivo) return; // comando de voz
        setFase(2); await espera(900);  if (!vivo) return; // o evento "cai" na célula do dia
        setFase(3); await espera(4200); if (!vivo) return; // lista do dia + segura
      }
    })();
    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  return (
    <div ref={ref} className="relative rounded-[28px] p-5 sm:p-6 bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
      {/* header */}
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-9 h-9 rounded-xl grid place-items-center text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
          <CalendarDays size={17} />
        </span>
        <div className="leading-tight">
          <p className="font-bold text-sm text-zinc-900 dark:text-white">Minha Agenda</p>
          <p className="text-[11px] text-zinc-400 dark:text-white/40">Julho 2026</p>
        </div>
        {/* comando de voz que dispara a criação */}
        <div className={`ml-auto transition-all duration-500 ${fase >= 1 && fase < 3 ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-3'}`}>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-[#d7f8cf] text-zinc-700 dark:bg-[#075c46] dark:text-white">
            <Mic size={12} /> dentista amanhã 9h
          </span>
        </div>
      </div>

      {/* cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-[10px] font-medium text-zinc-400 dark:text-white/40 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>

      {/* grade de dias */}
      <div className="grid grid-cols-7 gap-1.5">
        {DIAS.map((d) => {
          const hoje = d === HOJE;
          const temEvento = d === AMANHA && fase >= 2;
          return (
            <div key={d}
                 className={`relative aspect-square rounded-lg grid place-items-center text-[12px] transition-all duration-300
                   ${hoje ? 'font-bold text-zinc-900 dark:text-white bg-zinc-200/70 dark:bg-white/10' : 'text-zinc-500 dark:text-white/55'}
                   ${temEvento ? 'font-bold text-zinc-900 dark:text-white scale-105' : ''}`}
                 style={temEvento ? { boxShadow: `inset 0 0 0 2px ${BRAND}`, background: 'rgba(97,206,112,0.15)' } : undefined}>
              {d}
              {temEvento && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: BRAND }} />}
            </div>
          );
        })}
      </div>

      {/* lista de eventos do amanhã */}
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-2">Amanhã · 10 Jul</p>
        <div className={`transition-all duration-500 ${fase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#1e2530] border border-zinc-100 dark:border-white/[0.06]"
               style={{ borderLeft: `3px solid ${BRAND}` }}>
            <span className="w-9 h-9 rounded-lg grid place-items-center text-lg flex-shrink-0" style={{ background: 'rgba(97,206,112,0.15)' }}>🦷</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[13px] text-zinc-900 dark:text-white">Dentista</p>
              <p className="text-[11px] text-zinc-400 dark:text-white/40">9:00 · lembrete 1h antes</p>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                  style={{ color: '#4DAE61', background: 'rgba(97,206,112,0.15)' }}>
              <Check size={11} strokeWidth={3} /> criado
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
