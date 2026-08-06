// Landing de venda do "Kit de Organização Financeira" — 2 ofertas vitalícias
// (Kit R$47 sem WhatsApp · Sora Completa R$97 com WhatsApp + tudo). Decoy.
export const revalidate = 0;

import LandingNav from '@/components/landing/LandingNav';
import KitOferta  from '@/components/landing/KitOferta';
import CupomFlutuante from '@/components/landing/CupomFlutuante';
import Footer     from '@/components/landing/Footer';
import ViewContentTracker from '@/components/analytics/ViewContentTracker';

export default function KitPage() {
  // `dark` força o tema escuro em toda a /kit (nav + footer + seções embutidas),
  // independente do tema global — a página é sempre preta e sem toggle de tema.
  return (
    <main className="dark bg-[#070707] text-white antialiased overflow-x-clip">
      <ViewContentTracker name="Kit R$47" />
      <LandingNav hideThemeToggle />
      <KitOferta />
      <Footer />
      <CupomFlutuante />
    </main>
  );
}
