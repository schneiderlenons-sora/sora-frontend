// Página de oferta dedicada (teste de conversão) — ESPELHA a landing principal
// (app/page.tsx). ÚNICA diferença: a seção de preço é o vitalício (R$97 único,
// PricingVitalicio) no lugar do Pricing (assinatura). Ao mudar a principal,
// replicar aqui — mantendo só essa troca de preço.
export const revalidate = 0;

import LandingNav       from '@/components/landing/LandingNav';
import CupomFlutuante   from '@/components/landing/CupomFlutuante';
import Hero             from '@/components/landing/Hero';
import Problema         from '@/components/landing/Problema';
import Solucao          from '@/components/landing/Solucao';
import ComoFunciona     from '@/components/landing/ComoFunciona';
import FinancasChat     from '@/components/landing/FinancasChat';
import AgendaChat       from '@/components/landing/AgendaChat';
import HabitosSaude     from '@/components/landing/HabitosSaude';
import Showcase         from '@/components/landing/Showcase';
import ProdutividadeShowcase from '@/components/landing/ProdutividadeShowcase';
import DriveShowcase    from '@/components/landing/DriveShowcase';
import OpenFinance      from '@/components/landing/OpenFinance';
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
import ViewContentTracker from '@/components/analytics/ViewContentTracker';

export default function OfertaPage() {
  return (
    // Igual à principal; muda só o Pricing → PricingVitalicio.
    <main className="bg-white text-zinc-900 dark:bg-[#0a0a0a] dark:text-white antialiased overflow-x-clip">
      <ViewContentTracker name="Oferta vitalício" />
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
      <CtaPlanos frase="Começar agora" />
      <Showcase />
      <WrappedShowcase />
      <CtaPlanos frase="Quero meu Wrapped também 🐳" />
      <ProdutividadeShowcase />
      <DriveShowcase />
      <SocialProof />
      <CtaPlanos frase="Quero fazer parte" />
      <Personalizacao />
      <MobileShowcase />
      <SoraLabs />
      <PricingVitalicio />
      <Faq />
      <CtaFinal />
      <Footer />
    </main>
  );
}
