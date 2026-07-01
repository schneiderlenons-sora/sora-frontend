'use client';

import { Wallet } from 'lucide-react';
import ChatFeature, { type Msg } from './ChatFeature';

const ROTEIRO: Msg[] = [
  { who: 'user', node: 'Gastei 82 reais no iFood' },
  { who: 'sora', node: <>Prontinho! 🚀 Acabei de registrar sua despesa de <strong className="font-semibold text-zinc-900 dark:text-white">R$ 82,00</strong> no iFood.</> },
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
