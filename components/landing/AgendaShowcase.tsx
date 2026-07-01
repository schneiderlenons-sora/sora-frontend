'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, MessageCircle, Play, Mic } from 'lucide-react';
import { BolhaSora, BolhaUsuario, Digitando, InputBar, Caret } from './chatbits';

const BRAND = '#61ce70';
const SPEED_SORA = 22;   // ms por caractere (resposta da Sora)
const SPEED_USER = 42;   // ms por caractere (usuário digitando no input)

type Fala = { who: 'user' | 'sora'; text: string };

// Conversa da aba de chat (fase 1). Segue os prints: briefing → marcar reunião →
// consultar compromissos de amanhã.
const CONVERSA: Fala[] = [
  { who: 'sora', text: 'Bom dia! ☀️ Passando pra te lembrar do seu dia:\n\n⏰ 11:00h — Reunião com a Phillips\n\nQualquer coisa, tô por aqui! ✌️' },
  { who: 'user', text: 'Marcar reunião hoje às 14h com o time todo' },
  { who: 'sora', text: 'Prontinho! ✅ Reunião marcada pra hoje às 14:00 e já avisei o time todo 🙌' },
  { who: 'user', text: 'Quais são meus compromissos de amanhã?' },
  { who: 'sora', text: 'Seu dia amanhã tá agitado! 🗓️\n\n• Dentista às 9:00h 🦷\n• Call de vendas às 11:00h 📞\n• Filmagem de anúncios às 14:00h 🎥\n\nQualquer ajuste, é só falar! 🚀' },
];

const DIAS = Array.from({ length: 21 }, (_, i) => i + 1);
const HOJE = 9;
const AMANHA = 10;

function useInView<T extends HTMLElement>(threshold = 0.3) {
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

function Texto({ children, caret }: { children: React.ReactNode; caret?: boolean }) {
  return <span className="whitespace-pre-line">{children}{caret && <Caret />}</span>;
}

// ---- Aba do CALENDÁRIO (fase 2) ---------------------------------------------
function CalendarView({ audio, evento, lista }: { audio: boolean; evento: boolean; lista: boolean }) {
  return (
    <div className="relative h-full flex flex-col">
      {/* header */}
      <div className="flex items-center gap-2.5 mb-4">
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

      {/* notificação de áudio chegando (overlay) */}
      <div className={`absolute top-14 right-0 left-0 z-10 flex flex-col items-end gap-1 transition-all duration-500 ${audio && !evento ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'}`}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl rounded-tr-md shadow-lg bg-[#d7f8cf] dark:bg-[#075c46]">
          <span className="w-6 h-6 rounded-full bg-white/80 dark:bg-white/20 grid place-items-center flex-shrink-0">
            <Play size={11} className="text-zinc-700 dark:text-white ml-0.5" fill="currentColor" />
          </span>
          <span className="flex items-end gap-[2px] h-4">
            {[4, 7, 10, 6, 9, 5, 8, 5, 10, 6, 8, 4, 7].map((h, i) => (
              <span key={i} className="w-[2px] rounded-full bg-zinc-500/70 dark:bg-white/70" style={{ height: `${h}px` }} />
            ))}
          </span>
          <span className="text-[10px] text-zinc-600 dark:text-white/70 flex-shrink-0">0:04</span>
          <Mic size={12} className="text-zinc-500 dark:text-white/60 flex-shrink-0" />
        </div>
        <span className="text-[10px] italic text-zinc-400 dark:text-white/40 pr-1">“marca meu dentista amanhã às 9h”</span>
      </div>

      {/* dias da semana */}
      <div className="grid grid-cols-7 gap-1.5 mb-1.5 text-[10px] font-medium text-zinc-400 dark:text-white/40 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>

      {/* grade de dias */}
      <div className="grid grid-cols-7 gap-1.5">
        {DIAS.map((d) => {
          const hoje = d === HOJE;
          const temEvento = d === AMANHA && evento;
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

      {/* lista do dia */}
      <div className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40 mb-2">Amanhã · 10 Jul</p>
        <div className={`transition-all duration-500 ${lista ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
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

// ---- Card completo: chat (com typewriter) → fecha → calendário → loop --------
export default function AgendaShowcase() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [modo, setModo] = useState<'chat' | 'cal'>('chat');
  const [msgs, setMsgs] = useState<Fala[]>([]);       // mensagens já concluídas
  const [current, setCurrent] = useState<Fala | null>(null); // mensagem digitando
  const [typed, setTyped] = useState('');             // parte já digitada da current
  const [dots, setDots] = useState(false);            // "digitando…" da Sora
  const [audio, setAudio] = useState(false);
  const [evento, setEvento] = useState(false);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((res) => { timers.push(setTimeout(res, ms)); });

    // digita `text` caractere a caractere no state `typed`
    const digitar = async (text: string, speed: number) => {
      for (let i = 1; i <= text.length; i++) {
        if (!vivo) return false;
        setTyped(text.slice(0, i));
        await espera(speed);
      }
      return true;
    };

    (async () => {
      while (vivo) {
        // ---------- FASE 1: CHAT ----------
        setModo('chat'); setMsgs([]); setCurrent(null); setTyped('');
        setDots(false); setAudio(false); setEvento(false); setLista(false);
        await espera(1000); if (!vivo) return; // card "fechado" com o + centralizado

        for (const fala of CONVERSA) {
          if (fala.who === 'sora') {
            setDots(true); await espera(950); if (!vivo) return;
            setDots(false);
          }
          setCurrent(fala); setTyped('');
          const ok = await digitar(fala.text, fala.who === 'sora' ? SPEED_SORA : SPEED_USER);
          if (!ok) return;
          await espera(fala.who === 'sora' ? 550 : 250); if (!vivo) return;
          setCurrent(null); setTyped('');
          setMsgs((prev) => [...prev, fala]);
          await espera(fala.who === 'sora' ? 1100 : 650); if (!vivo) return;
        }

        await espera(1100); if (!vivo) return; // segura o chat completo

        // ---------- TRANSIÇÃO: fecha o chat, abre a agenda ----------
        setModo('cal'); await espera(850); if (!vivo) return;
        setAudio(true);  await espera(1900); if (!vivo) return; // notificação de áudio chega
        setEvento(true); await espera(900);  if (!vivo) return; // compromisso cai no dia
        setLista(true);  await espera(3600); if (!vivo) return; // lista + segura
      }
    })();

    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  const vazio = msgs.length === 0 && !current && !dots;

  return (
    <div ref={ref}
         className="relative rounded-[28px] h-[500px] overflow-hidden bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">

      {/* ---------- Camada CHAT ---------- */}
      <div className={`absolute inset-0 p-4 sm:p-5 transition-all duration-500 ${modo === 'chat' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <div className="relative h-full">
          <div className="absolute inset-0 flex flex-col justify-end gap-2.5 overflow-hidden pb-[72px]">
            {!vazio && <p className="text-center text-[11px] text-zinc-400 dark:text-white/40 mb-1">17:36</p>}
            {msgs.map((m, i) => (
              m.who === 'user'
                ? <BolhaUsuario key={i}><Texto>{m.text}</Texto></BolhaUsuario>
                : <BolhaSora key={i}><Texto>{m.text}</Texto></BolhaSora>
            ))}
            {dots && <Digitando />}
            {current?.who === 'sora' && <BolhaSora><Texto caret>{typed}</Texto></BolhaSora>}
          </div>
          <div className="absolute left-0 right-0 bottom-0 transition-transform duration-[600ms] ease-out"
               style={{ transform: vazio ? 'translateY(-204px)' : 'translateY(0)' }}>
            <InputBar text={current?.who === 'user' ? typed : undefined} />
          </div>
        </div>
      </div>

      {/* ---------- Camada CALENDÁRIO ---------- */}
      <div className={`absolute inset-0 p-5 sm:p-6 transition-all duration-500 ${modo === 'cal' ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <CalendarView audio={audio} evento={evento} lista={lista} />
      </div>
    </div>
  );
}
