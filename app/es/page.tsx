// Landing em espanhol (es-MX). Mesma composição da raiz — o locale é resolvido
// no middleware pelo prefixo /es e injetado no header lido pelo next-intl.
// `esperaLista` porque o checkout em MXN ainda não existe: os CTAs de compra
// viram captura de interesse ("Próximamente").
export const revalidate = 0;

import LandingPage from '@/components/landing/LandingPage';

export default function Page() {
  return <LandingPage esperaLista />;
}
