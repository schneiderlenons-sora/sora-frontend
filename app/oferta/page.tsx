// Página de oferta dedicada (teste de conversão) — mesma landing, mas com a
// seção de preço focada SÓ no plano vitalício (Black pra sempre, R$97 único).
// CTA leva pro /signup?vitalicio=1 (cadastro → checkout do vitalício direto).
export const revalidate = 0;

import LandingNav       from '@/components/landing/LandingNav';
import Hero             from '@/components/landing/Hero';
import Problema         from '@/components/landing/Problema';
import Solucao          from '@/components/landing/Solucao';
import ComoFunciona     from '@/components/landing/ComoFunciona';
import Features         from '@/components/landing/Features';
import TestDrive        from '@/components/landing/TestDrive';
import OpenFinance      from '@/components/landing/OpenFinance';
import Showcase         from '@/components/landing/Showcase';
import SaudeShowcase    from '@/components/landing/SaudeShowcase';
import WrappedShowcase  from '@/components/landing/WrappedShowcase';
import Personalizacao   from '@/components/landing/Personalizacao';
import MobileShowcase   from '@/components/landing/MobileShowcase';
import SoraLabs         from '@/components/landing/SoraLabs';
import SocialProof      from '@/components/landing/SocialProof';
import PricingVitalicio from '@/components/landing/PricingVitalicio';
import CtaPlanos        from '@/components/landing/CtaPlanos';
import Faq              from '@/components/landing/Faq';
import CtaFinal         from '@/components/landing/CtaFinal';
import Footer           from '@/components/landing/Footer';

export default function OfertaPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-[#0a0a0a] dark:text-white antialiased overflow-x-clip">
      <LandingNav />
      <Hero />
      <Problema />
      <Solucao />
      <ComoFunciona />
      <CtaPlanos frase="Quero ser fundador 🐳" />
      <Showcase />
      <SaudeShowcase />
      <WrappedShowcase />
      <CtaPlanos frase="Garantir meu vitalício" />
      <Features />
      <TestDrive />
      <OpenFinance />
      <Personalizacao />
      <MobileShowcase />
      <SoraLabs />
      <SocialProof />
      <PricingVitalicio />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
