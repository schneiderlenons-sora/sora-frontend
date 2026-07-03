'use client';

import { useEffect, useRef, useState } from 'react';
import { Wallet, Play } from 'lucide-react';
import ChatFeature from './ChatFeature';
import { BolhaSora, BolhaUsuario, Digitando, InputBar, Caret } from './chatbits';

const SPEED_SORA = 22;   // ms por caractere (resposta da Sora — typewriter)
const SPEED_USER = 42;   // ms por caractere (usuário digitando no input)

// Bolha de áudio (nota de voz) — só conteúdo inline (spans/svg) pra caber no
// <p> da BolhaUsuario sem quebrar HTML.
const AudioBolha = (
  <span className="inline-flex items-center gap-2.5 align-middle py-0.5">
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-black/10 dark:bg-white/15 flex-shrink-0">
      <Play size={11} fill="currentColor" className="ml-[1px]" />
    </span>
    <span className="inline-flex items-end gap-[2px] h-4">
      {[7, 11, 15, 9, 13, 6, 10, 14, 8, 12, 7, 15, 9, 11, 6].map((h, i) => (
        <span key={i} className="inline-block w-[2px] rounded-full bg-zinc-600/55 dark:bg-white/55" style={{ height: `${h}px` }} />
      ))}
    </span>
    <span className="text-[11px] opacity-70 flex-shrink-0">0:03</span>
  </span>
);

// "Foto" de um comprovante/cupom — SVG inline (phrasing content, válido no <p>).
const ComprovanteBolha = (
  <span className="inline-block align-middle w-[128px] rounded-lg overflow-hidden leading-none">
    <svg viewBox="0 0 128 100" width="128" height="100" className="block" role="img" aria-label="Foto do comprovante do mercado">
      <rect width="128" height="100" fill="#ece9e3" />
      <rect x="41" y="9" width="46" height="84" rx="2.5" fill="#ffffff" />
      <rect x="47" y="17" width="34" height="4" rx="2" fill="#c9c5be" />
      <rect x="47" y="28" width="26" height="2.5" fill="#ddd9d2" />
      <rect x="47" y="34" width="30" height="2.5" fill="#ddd9d2" />
      <rect x="47" y="40" width="22" height="2.5" fill="#ddd9d2" />
      <rect x="47" y="46" width="28" height="2.5" fill="#ddd9d2" />
      <rect x="47" y="52" width="24" height="2.5" fill="#ddd9d2" />
      <rect x="47" y="63" width="18" height="5" rx="2.5" fill="#61ce70" />
      <rect x="69" y="63" width="12" height="5" rx="2.5" fill="#61ce70" />
      <rect x="47" y="75" width="34" height="2" fill="#e6e2db" />
      <rect x="47" y="81" width="20" height="2" fill="#e6e2db" />
    </svg>
  </span>
);

type Fala = { who: 'user' | 'sora'; texto?: string; media?: React.ReactNode };

// Roteiro: texto (typewriter/input) ou media (áudio/imagem que aparece direto).
const ROTEIRO: Fala[] = [
  { who: 'user', texto: 'Gastei 82 reais no iFood' },
  { who: 'sora', texto: 'Prontinho! 🚀 Acabei de registrar sua despesa de R$ 82,00 no iFood.' },

  // Áudio: nota de voz "gastei 27 reais com uber" → a Sora ouve e lança
  { who: 'user', media: AudioBolha },
  { who: 'sora', texto: 'Prontinho! 🚀 Ouvi seu áudio e registrei R$ 27,00 no Uber 🚗' },

  // Imagem: foto do comprovante do mercado → a Sora lê e lança (OCR)
  { who: 'user', media: ComprovanteBolha },
  { who: 'sora', texto: '🧾 Comprovante lido! Lancei R$ 68,90 em Mercado — compras da semana ✅' },

  { who: 'user', texto: 'Sora, quanto eu gastei com iFood essa semana?' },
  { who: 'sora', texto: 'Essa semana foram R$ 227,00 no iFood 🍔 Já virou sua categoria que mais pesa.' },
];

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

// Card de chat da Finanças: mesmo comportamento do Hábitos/Agenda — entrada,
// "digitando", typewriter letra a letra, input centralizado quando vazio,
// clip no topo e fade de saída no loop. Áudio/imagem aparecem direto.
function FinancasCard() {
  const { ref, inView } = useInView<HTMLDivElement>();
  const [msgs, setMsgs] = useState<Fala[]>([]);
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
        await espera(1200); if (!vivo) return; // card "fechado" com o input centralizado

        let count = 0;
        for (const m of ROTEIRO) {
          if (m.who === 'user') {
            if (m.media) {
              // áudio/imagem: aparece direto (bolha sobe uma vez)
              setMsgs((p) => [...p, m]); count += 1;
              await espera(800); if (!vivo) return;
            } else {
              // texto: digita no input, depois "envia"
              for (let i = 1; i <= (m.texto?.length ?? 0); i++) { if (!vivo) return; setInputText(m.texto!.slice(0, i)); await espera(SPEED_USER); }
              await espera(250); if (!vivo) return;
              setInputText('');
              setMsgs((p) => [...p, m]); count += 1;
              await espera(650); if (!vivo) return;
            }
          } else {
            // Sora: "digitando" e depois o texto letra a letra (typewriter)
            setDots(true); await espera(850); if (!vivo) return; setDots(false);
            setTypingIdx(count); setTypedLen(0);
            setMsgs((p) => [...p, m]); count += 1;
            await espera(50); if (!vivo) return;
            for (let i = 1; i <= (m.texto?.length ?? 0); i++) { if (!vivo) return; setTypedLen(i); await espera(SPEED_SORA); }
            setTypingIdx(null);
            await espera(900); if (!vivo) return;
          }
        }

        await espera(3000); if (!vivo) return;      // segura
        setVisivel(false); await espera(500); if (!vivo) return; // animação de saída
      }
    })();

    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  const vazio = msgs.length === 0 && !dots && !inputText;

  return (
    <div ref={ref} className="relative rounded-[28px] p-4 sm:p-5 bg-[#f4f2ee] dark:bg-[#111418] border border-zinc-200/60 dark:border-white/[0.06] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]">
      <div className="relative h-[460px]">
        {/* mensagens: fixadas no rodapé; as antigas cortam no topo */}
        <div className={`absolute inset-0 flex flex-col justify-end gap-2.5 overflow-hidden pb-[72px] transition-opacity duration-500 ${visivel ? 'opacity-100' : 'opacity-0'}`}>
          {(msgs.length > 0 || dots) && (
            <p className="text-center text-[11px] text-zinc-400 dark:text-white/40 mb-1">12:37</p>
          )}
          {msgs.map((m, i) => {
            if (m.who === 'user') return <BolhaUsuario key={i}>{m.media ?? m.texto}</BolhaUsuario>;
            const txt = i === typingIdx ? (m.texto ?? '').slice(0, typedLen) : m.texto;
            return <BolhaSora key={i}><span className="whitespace-pre-line">{txt}{i === typingIdx && <Caret />}</span></BolhaSora>;
          })}
          {dots && <Digitando />}
        </div>

        {/* input: centralizado quando vazio, desliza pro rodapé quando abre */}
        <div className="absolute left-0 right-0 bottom-0 transition-transform duration-[600ms] ease-out"
             style={{ transform: vazio ? 'translateY(-204px)' : 'translateY(0)' }}>
          <InputBar text={inputText || undefined} />
        </div>
      </div>
    </div>
  );
}

export default function FinancasChat() {
  return (
    <ChatFeature
      accent="#61ce70"
      accentTo="#4DAE61"
      badgeIcon={Wallet}
      badgeText="Controle Financeiro"
      heading={<>Anote seus gastos<br className="hidden sm:block" /> por áudio ou texto.</>}
      paragraph="Registre cada despesa ou receita em segundos. A Sora ouve seus áudios, entende sua fala natural e categoriza tudo automaticamente."
      items={[
        'Consulte qualquer gasto pelo WhatsApp',
        'Seus gastos já chegam categorizados',
        'Resumo do dia direto pra você',
      ]}
      visual={<FinancasCard />}
    />
  );
}
