// Força revalidação a cada request (evita cache CDN servir versões antigas após deploy).
// Ainda mantém SSG/SSR no build — só anula o cache de borda da Vercel.
// rev: hero-bg-overlays-v2
export const revalidate = 0;

import LandingNav      from '@/components/landing/LandingNav';
import Hero            from '@/components/landing/Hero';
import Problema        from '@/components/landing/Problema';
import Solucao         from '@/components/landing/Solucao';
import ComoFunciona    from '@/components/landing/ComoFunciona';
import FinancasChat    from '@/components/landing/FinancasChat';
import AgendaChat      from '@/components/landing/AgendaChat';
import Features        from '@/components/landing/Features';
import TestDrive       from '@/components/landing/TestDrive';
import OpenFinance     from '@/components/landing/OpenFinance';
import Showcase        from '@/components/landing/Showcase';
import ProdutividadeShowcase from '@/components/landing/ProdutividadeShowcase';
import DriveShowcase    from '@/components/landing/DriveShowcase';
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

export default function LandingPage() {
  return (
    // Landing segue o tema escolhido (toggle na nav). bg/text theme-aware;
    // as seções já têm variantes light + dark:.
    <main className="bg-white text-zinc-900 dark:bg-[#0a0a0a] dark:text-white antialiased overflow-x-clip">
      <LandingNav />
      <Hero />
      <Problema />
      <Solucao />
      <ComoFunciona />
      <FinancasChat />
      <AgendaChat />
      <CtaPlanos frase="Começar agora" />
      {/* Seções com imagens/descrição (Clareza total → Wrapped) ANTES de Recursos */}
      <Showcase />
      <WrappedShowcase />
      <CtaPlanos frase="Quero meu Wrapped também 🐳" />
      <ProdutividadeShowcase />
      <DriveShowcase />
      <Features />
      <TestDrive />
      <OpenFinance />
      <Personalizacao />
      <MobileShowcase />
      <SoraLabs />
      <SocialProof />
      <Pricing />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
