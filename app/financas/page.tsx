// Landing de TESTE focada em conversão (não mexe na / oficial). Uma promessa
// só: finanças no WhatsApp, pra autônomo desorganizado e casal. Enxuta — corta
// as seções de "tudo num lugar só" que diluem a mensagem; test drive cedo.
export const revalidate = 0;

import LandingNav     from '@/components/landing/LandingNav';
import HeroFinancas   from '@/components/landing/HeroFinancas';
import Problema       from '@/components/landing/Problema';
import ComoFunciona   from '@/components/landing/ComoFunciona';
import TestDrive      from '@/components/landing/TestDrive';
import Showcase       from '@/components/landing/Showcase';
import OpenFinance    from '@/components/landing/OpenFinance';
import SocialProof    from '@/components/landing/SocialProof';
import Pricing        from '@/components/landing/Pricing';
import CtaPlanos      from '@/components/landing/CtaPlanos';
import Faq            from '@/components/landing/Faq';
import CtaFinal       from '@/components/landing/CtaFinal';
import Footer         from '@/components/landing/Footer';

export default function FinancasPage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-[#0a0a0a] dark:text-white antialiased overflow-x-clip">
      <LandingNav />
      <HeroFinancas />
      <Problema />
      <ComoFunciona />
      {/* Test drive cedo: deixa a pessoa SENTIR antes de pedir a venda */}
      <TestDrive />
      <Showcase />
      <CtaPlanos frase="Quero organizar minhas finanças" />
      <OpenFinance />
      <SocialProof />
      <Pricing />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
