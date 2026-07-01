'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, MessageCircle } from 'lucide-react';
import { ChatMessages, type Msg } from './chatbits';

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

// Conversa da fase 1 (chat): registra o compromisso falando.
const CHAT: Msg[] = [
  { who: 'user', node: 'Marca dentista amanhã às 9h' },
  { who: 'sora', node: <>Feito! 📅 Anotei <strong className="font-semibold text-zinc-900 dark:text-white">Dentista</strong> amanhã às 9:00. Te lembro 1h antes 🔔</> },
];

const DIAS = Array.from({ length: 21 }, (_, i) => i + 1);
const HOJE = 9;
const AMANHA = 10;

// Fase 2 do card: o mesmo compromisso "caindo" no calendário da Sora.
function CalendarView({ fase }: { fase: number }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2.5 mb-5">
        <span className="w-9 h-9 rounded-xl grid place-items-center text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
          <CalendarDays size={17} />
        </span>
        <div className="leading-tight">
          <p className="font-bold text-sm text-zinc-900 dark:text-white">Minha Agenda</p>
          <p className="text-[11px] text-zinc-400 dark:text-white/40">Julho 2026</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 dark:text-white/40">
          <MessageCircle size={12} /> via WhatsApp
        </span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-[10px] font-medium text-zinc-400 dark:text-white/40 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>

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

// Card da direita da seção Agenda. UM card que faz a SEQUÊNCIA (igual ao modelo):
// chat (vazio "+" → mensagens + digitando → resposta) → fecha (cross-fade) →
// abre o calendário com o compromisso caindo no dia → segura → recomeça.
export default function AgendaShowcase() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [modo, setModo] = useState<'chat' | 'cal'>('chat');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [fase, setFase] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((res) => { timers.push(setTimeout(res, ms)); });

    (async () => {
      while (vivo) {
        // FASE 1 — CHAT (card fechado com "+" → conversa)
        setModo('chat'); setMsgs([]); setTyping(false); setFase(0);
        await espera(1300); if (!vivo) return;
        for (const m of CHAT) {
          if (m.who === 'sora') { setTyping(true); await espera(1300); if (!vivo) return; setTyping(false); }
          setMsgs((prev) => [...prev, m]);
          await espera(m.who === 'user' ? 900 : 1900); if (!vivo) return;
        }
        // TRANSIÇÃO — fecha o chat, abre o calendário
        setModo('cal'); await espera(800); if (!vivo) return;
        setFase(1); await espera(700);  if (!vivo) return;
        setFase(2); await espera(900);  if (!vivo) return; // compromisso "cai" no dia
        setFase(3); await espera(3800); if (!vivo) return; // lista do dia + segura
      }
    })();

    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  return (
    <div ref={ref}
         className="relative rounded-[28px] h-[500px] overflow-hidden bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
      {/* Camada CHAT */}
      <div className={`absolute inset-0 p-4 sm:p-5 transition-all duration-500 ${modo === 'chat' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <ChatMessages msgs={msgs} typing={typing} />
      </div>
      {/* Camada CALENDÁRIO */}
      <div className={`absolute inset-0 p-5 sm:p-6 transition-all duration-500 ${modo === 'cal' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <CalendarView fase={fase} />
      </div>
    </div>
  );
}
