import LandingNav      from '@/components/landing/LandingNav';
import CupomFlutuante  from '@/components/landing/CupomFlutuante';
import Hero            from '@/components/landing/Hero';
import Problema        from '@/components/landing/Problema';
import Solucao         from '@/components/landing/Solucao';
import DashboardRelatorios from '@/components/landing/DashboardRelatorios';
import ControleCartoes  from '@/components/landing/ControleCartoes';
import FinancasChat    from '@/components/landing/FinancasChat';
import AgendaChat      from '@/components/landing/AgendaChat';
import HabitosSaude    from '@/components/landing/HabitosSaude';
import Showcase        from '@/components/landing/Showcase';
import ProdutividadeShowcase from '@/components/landing/ProdutividadeShowcase';
import DriveShowcase    from '@/components/landing/DriveShowcase';
import OpenFinance     from '@/components/landing/OpenFinance';
import PrevistosShowcase from '@/components/landing/PrevistosShowcase';
import AgentesShowcase   from '@/components/landing/AgentesShowcase';
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
import ViewContentTracker from '@/components/analytics/ViewContentTracker';
// Composição compartilhada da landing (forsora.com e forsora.com/es). Os textos
// vêm dos catálogos messages/{pt,es}.json via next-intl. Todo texto é resolvido
// em componentes CLIENT (useTranslations) contra o provider de idioma mais
// próximo — no /es é o app/es/layout.tsx (força es), então não depende do
// layout raiz (que não re-renderiza na navegação client-side).
export default function LandingPage({ esperaLista = false }: { esperaLista?: boolean }) {
  return (
    // Landing segue o tema escolhido (toggle na nav). bg/text theme-aware;
    // as seções já têm variantes light + dark:.
    <main className="bg-white text-zinc-900 dark:bg-[#0a0a0a] dark:text-white antialiased overflow-x-clip">
      <ViewContentTracker name="Landing principal" />
      <LandingNav />
      <CupomFlutuante />
      <Hero />
      <Problema />
      <Solucao />
      {/* Vindas da /kit — logo depois de "Os três pilares conversam entre si":
          a Solução apresenta o produto em abstrato e estas duas mostram a tela
          de verdade, que é o passo natural de quem acabou de entender a ideia.
          Os MESMOS componentes rodam nas duas páginas (na /kit dentro do
          wrapper `.dark`), pra não existirem duas cópias do markup. */}
      <DashboardRelatorios />
      <ControleCartoes />
      {/* Um CTA fecha a dupla, em vez de um botão dentro de cada seção: duas
          chamadas a uma rolagem de distância competem entre si. */}
      <CtaPlanos fraseKey="verPlanos" />
      <FinancasChat />
      <OpenFinance />
      <PrevistosShowcase />
      <AgendaChat />
      <HabitosSaude />
      <AgentesShowcase />
      <CtaPlanos fraseKey="comecarAgora" />
      {/* Seções com imagens/descrição (Clareza total → Wrapped) ANTES de Recursos */}
      <Showcase />
      <WrappedShowcase />
      <CtaPlanos fraseKey="queroWrapped" />
      <ProdutividadeShowcase />
      <DriveShowcase />
      <SocialProof />
      <CtaPlanos fraseKey="queroParticipar" />
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
