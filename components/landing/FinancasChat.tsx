'use client';

import { Wallet, Play } from 'lucide-react';
import ChatFeature, { type Msg } from './ChatFeature';

// Bolha de áudio (nota de voz) — só conteúdo inline (spans/svg) pra caber dentro
// do <p> da BolhaUsuario sem quebrar HTML/animações.
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

const ROTEIRO: Msg[] = [
  { who: 'user', node: 'Gastei 82 reais no iFood' },
  { who: 'sora', node: <>Prontinho! 🚀 Acabei de registrar sua despesa de <strong className="font-semibold text-zinc-900 dark:text-white">R$ 82,00</strong> no iFood.</> },

  // Áudio: nota de voz "gastei 27 reais com uber" → a Sora ouve e lança
  { who: 'user', node: AudioBolha },
  { who: 'sora', node: <>Prontinho! 🚀 Ouvi seu áudio e registrei <strong className="font-semibold text-zinc-900 dark:text-white">R$ 27,00</strong> no Uber 🚗</> },

  // Imagem: foto do comprovante do mercado → a Sora lê e lança (OCR)
  { who: 'user', node: ComprovanteBolha },
  { who: 'sora', node: <>🧾 Comprovante lido! Lancei <strong className="font-semibold text-zinc-900 dark:text-white">R$ 68,90</strong> em Mercado — compras da semana ✅</> },

  { who: 'user', node: 'Sora, quanto eu gastei com iFood essa semana?' },
  { who: 'sora', node: <>Essa semana foram <strong className="font-semibold text-zinc-900 dark:text-white">R$ 227,00</strong> no iFood 🍔 Já virou sua categoria que mais pesa.</> },
];

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
      roteiro={ROTEIRO}
    />
  );
}
