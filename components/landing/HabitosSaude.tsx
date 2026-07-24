'use client';

import { HeartPulse } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ChatFeature from './ChatFeature';
import HabitosSaudeChat from './HabitosSaudeChat';

export default function HabitosSaude() {
  const t = useTranslations('habitosSaude');
  return (
    <ChatFeature
      accent="#61ce70"
      accentTo="#4DAE61"
      badgeIcon={HeartPulse}
      badgeText={t('badge')}
      heading={<>{t('headingL1')}<br className="hidden sm:block" /> {t('headingL2')}</>}
      paragraph={t('paragraph')}
      items={t.raw('items') as string[]}
      visual={<HabitosSaudeChat />}
    />
  );
}
