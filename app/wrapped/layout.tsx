'use client';

import GrowGate from '@/components/grow/GrowGate';

// O Wrapped é do plano Básico pra cima.
//
// ⚠️ Esta rota vive FORA do route group `(app)` — é tela cheia e nunca teve
// sidebar. Por isso ela também nunca teve guard de plano: o `PaywallRedirect`
// global cobria o `inativo` e mais nada. Com o modo manual isso deixou de
// bastar.
export default function WrappedLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="wrapped">{children}</GrowGate>;
}
