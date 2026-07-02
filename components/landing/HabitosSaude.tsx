'use client';

import { HeartPulse } from 'lucide-react';
import ChatFeature from './ChatFeature';
import HabitosSaudeChat from './HabitosSaudeChat';

export default function HabitosSaude() {
  return (
    <ChatFeature
      accent="#61ce70"
      accentTo="#4DAE61"
      badgeIcon={HeartPulse}
      badgeText="Hábitos & Saúde"
      heading={<>Crie hábitos que duram<br className="hidden sm:block" /> e cuide da sua saúde.</>}
      paragraph="Treino, água, leitura, refeições, pressão, remédios, estudos — é só mandar no WhatsApp. A Sora acompanha suas sequências, calcula seus macros e mostra sua evolução."
      items={[
        'Crie hábitos e acompanhe suas sequências',
        'Calorias e macros na hora, só descrevendo a refeição',
        'Treino, saúde, remédios e estudos num lugar só',
      ]}
      visual={<HabitosSaudeChat />}
    />
  );
}
