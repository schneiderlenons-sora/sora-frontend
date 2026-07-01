'use client';

import { CalendarDays } from 'lucide-react';
import ChatFeature from './ChatFeature';
import AgendaCalendario from './AgendaCalendario';

export default function AgendaChat() {
  return (
    <ChatFeature
      accent="#61ce70"
      accentTo="#4DAE61"
      badgeIcon={CalendarDays}
      badgeText="Agenda Inteligente"
      heading={<>Nunca mais esqueça<br className="hidden sm:block" /> um compromisso.</>}
      paragraph="Tenha lembretes e resumos diários. Registre compromissos no WhatsApp falando do seu jeito — a Sora entende, organiza sua rotina e te avisa na hora certa."
      items={[
        'Consulte sua agenda pelo WhatsApp',
        'Marque tarefas do dia como feitas',
        'Briefing matinal com o seu dia',
      ]}
      visual={<AgendaCalendario />}
    />
  );
}
