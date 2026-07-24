import LandingNav      from '@/components/landing/LandingNav';
import CupomFlutuante  from '@/components/landing/CupomFlutuante';
import Hero            from '@/components/landing/Hero';
import Problema        from '@/components/landing/Problema';
import Solucao         from '@/components/landing/Solucao';
import ComoFunciona    from '@/components/landing/ComoFunciona';
import FinancasChat    from '@/components/landing/FinancasChat';
import AgendaChat      from '@/components/landing/AgendaChat';
import HabitosSaude    from '@/components/landing/HabitosSaude';
import Showcase        from '@/components/landing/Showcase';
import ProdutividadeShowcase from '@/components/landing/ProdutividadeShowcase';
import DriveShowcase    from '@/components/landing/DriveShowcase';
import OpenFinance     from '@/components/landing/OpenFinance';
import WrappedShowcase from '@/components/landing/WrappedShowcase';
import Personalizacao  from '@/components/landing/Personalizacao';
import MobileShowcase   from '@/components/landing/MobileShowcase';
import SoraLabs        from '@/components/landing/SoraLabs';
import SocialProof     from '@/components/landing/SocialProof';
import Pricing         from '@/components/landing/Pricing';
import CtaPlanos       from '@/components/landing/CtaPlanos';
import Faq             from '@/components/landing/Faq';
import CtaFinal        from '@/components/landing/CtaFinal';
import Footer          from '@/components/landing/Footer';
import { getTranslations } from 'next-intl/server';

// Composição compartilhada da landing (forsora.com e forsora.com/es). Os textos
// vêm dos catálogos messages/{pt,es}.json via next-intl — o locale é resolvido
// no middleware pelo pathname. `esperaLista` faz os CTAs de compra virarem
// captura de interesse (usado no /es, onde o checkout MXN ainda não existe).
export default async function LandingPage({ esperaLista = false }: { esperaLista?: boolean }) {
  const t = await getTranslations('cta');

  return (
    // Landing segue o tema escolhido (toggle na nav). bg/text theme-aware;
    // as seções já têm variantes light + dark:.
    <main className="bg-white text-zinc-900 dark:bg-[#0a0a0a] dark:text-white antialiased overflow-x-clip">
      <LandingNav />
      <CupomFlutuante />
      <Hero />
      <Problema />
      <Solucao />
      <ComoFunciona />
      <FinancasChat />
      <OpenFinance />
      <AgendaChat />
      <HabitosSaude />
      <CtaPlanos frase={t('comecarAgora')} />
      {/* Seções com imagens/descrição (Clareza total → Wrapped) ANTES de Recursos */}
      <Showcase />
      <WrappedShowcase />
      <CtaPlanos frase={t('queroWrapped')} />
      <ProdutividadeShowcase />
      <DriveShowcase />
      <SocialProof />
      <CtaPlanos frase={t('queroParticipar')} />
      <Personalizacao />
      <MobileShowcase />
      <SoraLabs />
      <Pricing vitalicio={false} esperaLista={esperaLista} />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
