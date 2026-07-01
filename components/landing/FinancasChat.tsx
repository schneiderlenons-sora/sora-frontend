'use client';

import { useEffect, useRef, useState } from 'react';
import { Wallet, Check, CheckCheck, BadgeCheck, Plus, Smile, Mic } from 'lucide-react';

const BRAND = '#61ce70';

// Checklist da coluna esquerda — features reais da Sora.
const ITENS = [
  'Consulte qualquer gasto pelo WhatsApp',
  'Seus gastos já chegam categorizados',
  'Resumo do dia direto pra você',
];

type Msg = { who: 'user' | 'sora'; node: React.ReactNode };

// Roteiro da conversa (sequência do loop). Cada resposta da Sora resolve o
// "digitando" — nunca fica travado.
const ROTEIRO: Msg[] = [
  { who: 'user', node: 'Gastei 82 reais no iFood' },
  { who: 'sora', node: <>Prontinho! 🚀 Acabei de registrar sua despesa de <strong className="font-semibold text-zinc-900 dark:text-white">R$ 82,00</strong> no iFood.</> },
  { who: 'user', node: 'Sora, quanto eu gastei com iFood essa semana?' },
  { who: 'sora', node: <>Essa semana foram <strong className="font-semibold text-zinc-900 dark:text-white">R$ 227,00</strong> no iFood 🍔 Já virou sua categoria que mais pesa.</> },
];

// Dispara `inView` uma vez quando o elemento entra na tela.
function useInView<T extends HTMLElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true); },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Avatar() {
  return (
    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm"
         style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brands/sora.png" alt="Sora" className="w-5 h-5 object-contain" draggable={false} />
    </div>
  );
}

function NomeSora() {
  return (
    <span className="flex items-center gap-1 mb-0.5">
      <span className="font-bold text-[13px] text-zinc-900 dark:text-white">Sora</span>
      <BadgeCheck size={13} className="text-[#3b9eff] flex-shrink-0" fill="#3b9eff" stroke="white" />
    </span>
  );
}

function BolhaSora({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-end gap-2 animate-[slide-up_450ms_ease-out_both]">
      <Avatar />
      <div className="max-w-[78%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-white dark:bg-[#1e2530] border border-zinc-100 dark:border-white/[0.06] shadow-sm">
        <NomeSora />
        <div className="text-[13px] leading-snug text-zinc-700 dark:text-zinc-200">{children}</div>
      </div>
    </div>
  );
}

function BolhaUsuario({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end animate-[slide-up_450ms_ease-out_both]">
      <div className="max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2.5 shadow-sm bg-[#d7f8cf] text-zinc-800 dark:bg-[#075c46] dark:text-white">
        <p className="text-[13px] leading-snug">{children}</p>
        <span className="flex items-center justify-end gap-1 mt-1 text-[10px] text-zinc-500 dark:text-white/50">
          12:37 <CheckCheck size={13} className="text-[#3b9eff]" />
        </span>
      </div>
    </div>
  );
}

function Digitando() {
  return (
    <div className="flex items-end gap-2 animate-[slide-up_300ms_ease-out_both]">
      <Avatar />
      <div className="rounded-2xl rounded-bl-md px-3.5 py-3 bg-white dark:bg-[#1e2530] border border-zinc-100 dark:border-white/[0.06] shadow-sm">
        <NomeSora />
        <div className="flex items-center gap-1 pt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-white/50 animate-bounce" />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function InputBar() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-white dark:bg-[#1e2530] border border-zinc-200/70 dark:border-white/[0.06] shadow-sm">
      <Plus size={18} className="text-zinc-400 dark:text-white/40" />
      <Smile size={18} className="text-zinc-400 dark:text-white/40" />
      <span className="flex-1" />
      <Mic size={18} className="text-zinc-400 dark:text-white/40" />
    </div>
  );
}

export default function FinancasChat() {
  const { ref, inView } = useInView<HTMLDivElement>(0.35);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);

  // Loop contínuo da conversa: vazio → mensagens (com "digitando") → resposta
  // do total → segura → limpa → recomeça. À prova de leak (flag + clearTimeout).
  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((res) => { timers.push(setTimeout(res, ms)); });

    (async () => {
      while (vivo) {
        setMsgs([]); setTyping(false);
        await espera(1500); if (!vivo) return;            // estado vazio (input centralizado)

        for (const m of ROTEIRO) {
          if (m.who === 'sora') {
            setTyping(true);
            await espera(1400); if (!vivo) return;         // "digitando…"
            setTyping(false);
          }
          setMsgs((prev) => [...prev, m]);
          await espera(m.who === 'user' ? 800 : 1100); if (!vivo) return;
        }

        await espera(3200); if (!vivo) return;             // segura a resposta final
      }
    })();

    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  const vazio = msgs.length === 0 && !typing;

  return (
    <section className="relative py-20 lg:py-28 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[700px] h-[500px] opacity-40 dark:opacity-25"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.14) 0%, transparent 65%)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

        {/* ESQUERDA — conteúdo */}
        <div>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
            <Wallet size={16} /> Controle Financeiro
          </span>

          <h2 className="mt-6 text-4xl sm:text-5xl font-bold leading-[1.05] tracking-[-0.03em] text-zinc-900 dark:text-white">
            Anote seus gastos<br className="hidden sm:block" /> por áudio ou texto.
          </h2>

          <p className="mt-5 text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-md">
            Registre cada despesa ou receita em segundos. A Sora ouve seus áudios, entende
            sua fala natural e categoriza tudo automaticamente.
          </p>

          <ul className="mt-8 space-y-3">
            {ITENS.map((t, i) => (
              <li key={t}
                  className="flex items-center gap-3 w-fit pl-2 pr-5 py-2 rounded-full bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200/70 dark:border-white/[0.08] animate-[slide-up_500ms_ease-out_both]"
                  style={{ animationDelay: `${i * 90}ms` }}>
                <span className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
                  <Check size={14} className="text-white" strokeWidth={3} />
                </span>
                <span className="text-[15px] font-medium text-zinc-800 dark:text-zinc-200">{t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* DIREITA — card de chat animado (loop) */}
        <div ref={ref}
             className={`relative mx-auto w-full max-w-md transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="relative rounded-[28px] p-4 sm:p-5 bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
            <div className="relative h-[460px]">

              {/* área de mensagens (empurra pro rodapé; corta as antigas sem scroll) */}
              <div className="absolute inset-0 flex flex-col justify-end gap-2.5 overflow-hidden pb-[72px]">
                {!vazio && <p className="text-center text-[11px] text-zinc-400 dark:text-white/40 mb-1">12:37</p>}
                {msgs.map((m, i) => (
                  m.who === 'user'
                    ? <BolhaUsuario key={i}>{m.node}</BolhaUsuario>
                    : <BolhaSora key={i}>{m.node}</BolhaSora>
                ))}
                {typing && <Digitando />}
              </div>

              {/* barra de input: centralizada quando vazio, desliza pro rodapé quando abre */}
              <div className="absolute left-0 right-0 bottom-0 transition-transform duration-[600ms] ease-out"
                   style={{ transform: vazio ? 'translateY(-204px)' : 'translateY(0)' }}>
                <InputBar />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
