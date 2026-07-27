'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar, BolhaSora, BolhaUsuario, Digitando, InputBar, Caret } from './chatbits';

const VERDE = '#61ce70';
const VERDE_DARK = '#4DAE61';

const SPEED_SORA = 19;   // ms por caractere (resposta da Sora)
const SPEED_USER = 40;   // ms por caractere (usuário digitando no input)

type Msg = { who: 'user' | 'sora'; texto?: string; card?: 'academia' | 'habitos' | 'macros' };

// Roteiro: autoria + chave de texto (ou card). Textos vêm do catálogo
// (habitosSaudeChat.roteiro[i]); onde é card, o texto do card também é do catálogo.
type MsgSpec = { who: 'user' | 'sora'; key?: string; card?: 'academia' | 'habitos' | 'macros' };
const ROTEIRO_SPEC: MsgSpec[] = [
  { who: 'user', key: 'm0' },
  { who: 'sora', key: 'm1' },
  { who: 'sora', card: 'academia' },
  { who: 'sora', key: 'm3' },
  { who: 'user', key: 'm4' },
  { who: 'sora', card: 'habitos' },
  { who: 'sora', key: 'm6' },
  { who: 'user', key: 'm7' },
  { who: 'sora', key: 'm8' },
  { who: 'sora', card: 'macros' },
  { who: 'sora', key: 'm10' },
  { who: 'user', key: 'm11' },
  { who: 'sora', key: 'm12' },
  { who: 'sora', key: 'm13' },
  { who: 'user', key: 'm14' },
  { who: 'sora', key: 'm15' },
  { who: 'sora', key: 'm16' },
];

function useInView<T extends HTMLElement>(threshold = 0.3) {
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

function Barra({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 rounded-full bg-zinc-200/80 dark:bg-white/10 mt-1.5 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${VERDE}, ${VERDE_DARK})` }} />
    </div>
  );
}

const LABEL = 'text-[10px] font-bold tracking-wider uppercase text-zinc-400 dark:text-white/40';

function CardAcademia() {
  const t = useTranslations('habitosSaudeChat.cardAcademia');
  return (
    <>
      <p className={LABEL}>{t('titulo')}</p>
      <p className="flex items-baseline gap-1.5 mt-1">
        <span className="text-base">🔥</span>
        <span className="text-2xl font-bold" style={{ color: VERDE_DARK }}>13</span>
        <span className="text-[13px] text-zinc-500 dark:text-white/50">{t('diasSeguidos')}</span>
      </p>
      <Barra pct={43} />
      <p className="text-[11px] text-zinc-400 dark:text-white/40 mt-1.5">{t('proximoMarco')}</p>
    </>
  );
}

function CardHabitos() {
  const t = useTranslations('habitosSaudeChat.cardHabitos');
  const nomes = t.raw('nomes') as string[];
  const habitos = [
    { i: '🏋️', d: 13, p: 90 },
    { i: '📚', d: 7, p: 52 },
    { i: '💧', d: 21, p: 100 },
    { i: '📵', d: 4, p: 30 },
  ].map((h, idx) => ({ ...h, n: nomes[idx] }));
  return (
    <>
      <p className={LABEL}>{t('total')}</p>
      <div className="space-y-2.5 mt-2.5">
        {habitos.map((h) => (
          <div key={h.n}>
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200">{h.i} {h.n}</span>
              <span className="font-bold tabular-nums" style={{ color: VERDE_DARK }}>{t('dias', { n: h.d })}</span>
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
  const t = useTranslations('habitosSaudeChat.cardMacros');
  const nomes = t.raw('itens') as string[];
  const itens: [string, string][] = [[nomes[0], '156 kcal'], [nomes[1], '180 kcal'], [nomes[2], '79 kcal']];
  return (
    <>
      <p className={LABEL}>{t('titulo')}</p>
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
      <p className="text-[11px] text-zinc-400 dark:text-white/40 mt-2.5">{t('rodape')}</p>
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
  const t = useTranslations('habitosSaudeChat.roteiro');
  const ROTEIRO: Msg[] = ROTEIRO_SPEC.map((m) => ({
    who: m.who,
    card: m.card,
    texto: m.key ? t(m.key) : undefined,
  }));
  const { ref, inView } = useInView<HTMLDivElement>();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const [typedLen, setTypedLen] = useState(0);
  const [inputText, setInputText] = useState('');
  const [dots, setDots] = useState(false);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((r) => { timers.push(setTimeout(r, ms)); });

    (async () => {
      while (vivo) {
        setVisivel(true); setMsgs([]); setTypingIdx(null); setTypedLen(0); setInputText(''); setDots(false);
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
    <div ref={ref} className="relative rounded-[28px] h-[500px] p-4 sm:p-5 bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
      <div className="relative h-full">
        {/* mensagens: fixadas no rodapé; as antigas cortam no topo (sem scroll, acompanha sozinho) */}
        <div className={`absolute inset-0 flex flex-col justify-end gap-2.5 overflow-hidden pb-[72px] transition-opacity duration-500 ${visivel ? 'opacity-100' : 'opacity-0'}`}>
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
        <div className="absolute left-0 right-0 bottom-0 transition-transform duration-[600ms] ease-out"
             style={{ transform: vazio ? 'translateY(-210px)' : 'translateY(0)' }}>
          <InputBar text={inputText || undefined} />
        </div>
      </div>
    </div>
  );
}
