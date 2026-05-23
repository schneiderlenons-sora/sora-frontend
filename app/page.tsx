import LandingNav      from '@/components/landing/LandingNav';
import Hero            from '@/components/landing/Hero';
import Problema        from '@/components/landing/Problema';
import Solucao         from '@/components/landing/Solucao';
import ComoFunciona    from '@/components/landing/ComoFunciona';
import Features        from '@/components/landing/Features';
import TestDrive       from '@/components/landing/TestDrive';
import OpenFinance     from '@/components/landing/OpenFinance';
import Carrossel       from '@/components/landing/Carrossel';
import SoraLabs        from '@/components/landing/SoraLabs';
import SocialProof     from '@/components/landing/SocialProof';
import Pricing         from '@/components/landing/Pricing';
import Faq             from '@/components/landing/Faq';
import CtaFinal        from '@/components/landing/CtaFinal';
import Footer          from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    <main className="bg-white dark:bg-[#0a0a0a] text-zinc-950 dark:text-white antialiased overflow-x-hidden">
      <LandingNav />
      <Hero />
      <Problema />
      <Solucao />
      <ComoFunciona />
      <Features />
      <TestDrive />
      <OpenFinance />
      <Carrossel />
      <SoraLabs />
      <SocialProof />
      <Pricing />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
