// Força revalidação a cada request (evita cache CDN servir versões antigas após deploy).
// Ainda mantém SSG/SSR no build — só anula o cache de borda da Vercel.
// rev: hero-bg-overlays-v2
export const revalidate = 0;

import LandingNav      from '@/components/landing/LandingNav';
import Hero            from '@/components/landing/Hero';
import Problema        from '@/components/landing/Problema';
import Solucao         from '@/components/landing/Solucao';
import ComoFunciona    from '@/components/landing/ComoFunciona';
import Features        from '@/components/landing/Features';
import TestDrive       from '@/components/landing/TestDrive';
import OpenFinance     from '@/components/landing/OpenFinance';
import Showcase        from '@/components/landing/Showcase';
import SaudeShowcase   from '@/components/landing/SaudeShowcase';
import WrappedShowcase from '@/components/landing/WrappedShowcase';
import Carrossel       from '@/components/landing/Carrossel';
import SoraLabs        from '@/components/landing/SoraLabs';
import SocialProof     from '@/components/landing/SocialProof';
import Pricing         from '@/components/landing/Pricing';
import Faq             from '@/components/landing/Faq';
import CtaFinal        from '@/components/landing/CtaFinal';
import Footer          from '@/components/landing/Footer';

export default function LandingPage() {
  return (
    // Landing sempre em tema escuro (independente da preferência salva): a
    // classe `dark` no root ativa todas as variantes dark: dos filhos e o bg
    // é definido direto (não via dark:) pra não depender do <html>.
    <main className="dark bg-[#0a0a0a] text-white antialiased overflow-x-hidden">
      <LandingNav />
      <Hero />
      <Problema />
      <Solucao />
      <ComoFunciona />
      <Features />
      {/* Clareza total + Em conjunto, logo após os 8 cards; depois a Saúde */}
      <Showcase />
      <SaudeShowcase />
      <WrappedShowcase />
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
