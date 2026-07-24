'use client';

import { CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ChatFeature from './ChatFeature';
import AgendaShowcase from './AgendaShowcase';

export default function AgendaChat() {
  const t = useTranslations('agendaChat');
  return (
    <ChatFeature
      accent="#61ce70"
      accentTo="#4DAE61"
      badgeIcon={CalendarDays}
      badgeText={t('badge')}
      heading={<>{t('headingL1')}<br className="hidden sm:block" /> {t('headingL2')}</>}
      paragraph={t('paragraph')}
      items={t.raw('items') as string[]}
      visual={<AgendaShowcase />}
    />
  );
}
