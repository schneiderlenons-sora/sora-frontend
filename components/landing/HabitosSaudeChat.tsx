'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, BolhaSora, BolhaUsuario, Digitando, InputBar, Caret } from './chatbits';

const VERDE = '#61ce70';
const VERDE_DARK = '#4DAE61';

const SPEED_SORA = 19;   // ms por caractere (resposta da Sora)
const SPEED_USER = 40;   // ms por caractere (usuário digitando no input)

type Msg = { who: 'user' | 'sora'; texto?: string; card?: 'academia' | 'habitos' | 'macros' };

// Roteiro: 5 trocas. Respostas iguais aos prints, adaptadas ao chat da Sora.
const ROTEIRO: Msg[] = [
  { who: 'user', texto: 'acabei de voltar da academia 🏋️' },
  { who: 'sora', texto: 'Aeee, foi! 🔥' },
  { who: 'sora', card: 'academia' },
  { who: 'sora', texto: '13 dias seguidos! Faltam 17 pro marco de 1 mês. Você é uma máquina 💪' },
  { who: 'user', texto: 'como estão meus hábitos?' },
  { who: 'sora', card: 'habitos' },
  { who: 'sora', texto: 'Tá voando! 21 dias de água é seu recorde 🏆' },
  { who: 'user', texto: 'comi 2 ovos, 1 pão na chapa e um café com leite' },
  { who: 'sora', texto: '🍽️ Calculei os macros da sua refeição:' },
  { who: 'sora', card: 'macros' },
  { who: 'sora', texto: 'É só me contar o que comeu — calculo caloria e macros na hora 😋' },
  { who: 'user', texto: 'minha pressão tá 12/8' },
  { who: 'sora', texto: 'Registrado: 120/80 mmHg 💗' },
  { who: 'sora', texto: 'Dentro do ideal! Sua média do mês: 122/82 — bem estável 👍' },
  { who: 'user', texto: 'estudei 2h de cálculo' },
  { who: 'sora', texto: '📄 Sessão registrada: Cálculo I — 2h. Total da semana: 9h 🎯' },
  { who: 'sora', texto: 'Faltam 6h pra bater sua meta semanal. Bom ritmo!' },
];

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

function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 rounded-full bg-zinc-200/80 dark:bg-white/10 mt-1.5 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${VERDE}, ${VERDE_DARK})` }} />
    </div>
  );
}

const LABEL = 'text-[10px] font-bold tracking-wider uppercase text-zinc-400 dark:text-white/40';

function CardAcademia() {
  return (
    <>
      <p className={LABEL}>Academia</p>
      <p className="flex items-baseline gap-1.5 mt-1">
        <span className="text-base">🔥</span>
        <span className="text-2xl font-bold" style={{ color: VERDE_DARK }}>13</span>
        <span className="text-[13px] text-zinc-500 dark:text-white/50">dias seguidos</span>
      </p>
      <Barra pct={43} />
      <p className="text-[11px] text-zinc-400 dark:text-white/40 mt-1.5">próximo marco: 30 dias</p>
    </>
  );
}

function CardHabitos() {
  const habitos = [
    { i: '🏋️', n: 'Academia', d: 13, p: 90 },
    { i: '📚', n: 'Ler 30min', d: 7, p: 52 },
    { i: '💧', n: 'Água 2L', d: 21, p: 100 },
    { i: '📵', n: 'Sem celular 1h', d: 4, p: 30 },
  ];
  return (
    <>
      <p className={LABEL}>Total: 12/15 hoje</p>
      <div className="space-y-2.5 mt-2.5">
        {habitos.map((h) => (
          <div key={h.n}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">{h.i} {h.n}</span>
              <span className="font-bold tabular-nums" style={{ color: VERDE_DARK }}>{h.d} dias</span>
            </div>
            <Barra pct={h.p} />
          </div>
        ))}
      </div>
    </>
  );
}

function Chip({ children, cor }: { children: React.ReactNode; cor: string }) {
  return <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold text-white" style={{ background: cor }}>{children}</span>;
}

function CardMacros() {
  const itens = [['2 ovos', '156 kcal'], ['Pão na chapa', '180 kcal'], ['Café com leite', '79 kcal']];
  return (
    <>
      <p className={LABEL}>Café da manhã</p>
      <p className="mt-1"><span className="text-2xl font-bold" style={{ color: VERDE_DARK }}>415</span> <span className="text-[13px] text-zinc-500 dark:text-white/50">kcal</span></p>
      <div className="mt-2.5 space-y-1 text-[13px]">
        {itens.map(([n, v]) => (
          <div key={n} className="flex items-center justify-between">
            <span className="text-zinc-700 dark:text-zinc-200">• {n}</span>
            <span className="text-zinc-400 dark:text-white/40 tabular-nums">{v}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <Chip cor="#3b82f6">P 24g</Chip>
        <Chip cor="#d97706">C 38g</Chip>
        <Chip cor="#a855f7">G 19g</Chip>
      </div>
      <p className="text-[11px] text-zinc-400 dark:text-white/40 mt-2.5">Hoje: 415 / 2.000 kcal · 👍 24g de proteína</p>
    </>
  );
}

const CARDS = { academia: CardAcademia, habitos: CardHabitos, macros: CardMacros };

// Card da Sora com avatar ao lado (mesmo padrão da BolhaSora, mas conteúdo largo).
function BolhaSoraCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 animate-[slide-up_450ms_ease-out_both]">
      <Avatar />
      <div className="max-w-[85%] w-full rounded-2xl rounded-bl-md p-3.5 bg-white dark:bg-[#1e2530] border border-zinc-100 dark:border-white/[0.06] shadow-sm">
        {children}
      </div>
    </div>
  );
}

export default function HabitosSaudeChat() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const [typedLen, setTypedLen] = useState(0);
  const [inputText, setInputText] = useState('');
  const [dots, setDots] = useState(false);
  const [visivel, setVisivel] = useState(true);

  // acompanha sempre a última mensagem (auto-scroll pro fim)
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, typedLen, dots]);

  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((r) => { timers.push(setTimeout(r, ms)); });

    (async () => {
      while (vivo) {
        setVisivel(true); setMsgs([]); setTypingIdx(null); setTypedLen(0); setInputText(''); setDots(false);
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        await espera(1000); if (!vivo) return; // card "fechado" com o input centralizado

        let count = 0;
        for (const m of ROTEIRO) {
          if (m.who === 'user') {
            for (let i = 1; i <= (m.texto?.length ?? 0); i++) { if (!vivo) return; setInputText(m.texto!.slice(0, i)); await espera(SPEED_USER); }
            await espera(250); if (!vivo) return;
            setInputText('');
            setMsgs((p) => [...p, m]); count += 1;
            await espera(650); if (!vivo) return;
          } else if (m.texto) {
            setDots(true); await espera(800); if (!vivo) return; setDots(false);
            setTypingIdx(count); setTypedLen(0);
            setMsgs((p) => [...p, m]); count += 1;
            await espera(50); if (!vivo) return;
            for (let i = 1; i <= m.texto.length; i++) { if (!vivo) return; setTypedLen(i); await espera(SPEED_SORA); }
            setTypingIdx(null);
            await espera(750); if (!vivo) return;
          } else {
            setDots(true); await espera(700); if (!vivo) return; setDots(false);
            setMsgs((p) => [...p, m]); count += 1;
            await espera(1100); if (!vivo) return;
          }
        }

        await espera(3200); if (!vivo) return;      // segura (dá pra rolar pra cima)
        setVisivel(false); await espera(550); if (!vivo) return; // animação de saída
      }
    })();

    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  const vazio = msgs.length === 0 && !dots && !inputText;

  return (
    <div ref={ref} className="relative rounded-[28px] h-[500px] overflow-hidden p-4 sm:p-5 bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
      {/* mensagens (rolável, acompanha o fim) */}
      <div ref={scrollRef}
           className={`absolute inset-4 sm:inset-5 bottom-[68px] overflow-y-auto space-y-2.5 pr-1 transition-opacity duration-500 ${visivel ? 'opacity-100' : 'opacity-0'}`}>
        {msgs.map((m, i) => {
          if (m.who === 'user') return <BolhaUsuario key={i}>{m.texto}</BolhaUsuario>;
          if (m.card) {
            const C = CARDS[m.card];
            return <BolhaSoraCard key={i}><C /></BolhaSoraCard>;
          }
          const txt = i === typingIdx ? (m.texto ?? '').slice(0, typedLen) : m.texto;
          return <BolhaSora key={i}><span className="whitespace-pre-line">{txt}{i === typingIdx && <Caret />}</span></BolhaSora>;
        })}
        {dots && <Digitando />}
      </div>

      {/* input: centralizado quando vazio, desliza pro rodapé quando abre (igual Finanças) */}
      <div className="absolute left-4 right-4 sm:left-5 sm:right-5 bottom-4 sm:bottom-5 transition-transform duration-[600ms] ease-out"
           style={{ transform: vazio ? 'translateY(-210px)' : 'translateY(0)' }}>
        <InputBar text={inputText || undefined} />
      </div>
    </div>
  );
}
