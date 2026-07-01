'use client';

import { CalendarDays } from 'lucide-react';
import ChatFeature, { type Msg } from './ChatFeature';

const ROTEIRO: Msg[] = [
  { who: 'user', node: 'Marca dentista amanhã às 9h' },
  { who: 'sora', node: <>Feito! 📅 Anotei <strong className="font-semibold text-zinc-900 dark:text-white">Dentista</strong> amanhã às 9:00. Te lembro 1h antes 🔔</> },
  { who: 'user', node: 'Quais são meus compromissos de amanhã?' },
  {
    who: 'sora',
    node: (
      <>
        Seu dia amanhã tá cheio! 🗓️
        <span className="block mt-1.5 space-y-0.5">
          <span className="block">• <strong className="font-semibold text-zinc-900 dark:text-white">Dentista</strong> às 9:00 🦷</span>
          <span className="block">• <strong className="font-semibold text-zinc-900 dark:text-white">Call de vendas</strong> às 11:00 📞</span>
          <span className="block">• <strong className="font-semibold text-zinc-900 dark:text-white">Filmagem</strong> às 14:00 🎥</span>
        </span>
        <span className="block mt-1.5">Te lembro antes de cada um 🚀</span>
      </>
    ),
  },
];

export default function AgendaChat() {
  return (
    <ChatFeature
      accent="#7c3aed"
      accentTo="#a855f7"
      badgeIcon={CalendarDays}
      badgeText="Agenda Inteligente"
      heading={<>Nunca mais esqueça<br className="hidden sm:block" /> um compromisso.</>}
      paragraph="Tenha lembretes e resumos diários. Registre compromissos no WhatsApp falando do seu jeito — a Sora entende, organiza sua rotina e te avisa na hora certa."
      items={[
        'Consulte sua agenda pelo WhatsApp',
        'Marque tarefas do dia como feitas',
        'Briefing matinal com o seu dia',
      ]}
      roteiro={ROTEIRO}
    />
  );
}
