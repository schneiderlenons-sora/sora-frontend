'use client';

import GrowGate from '@/components/grow/GrowGate';

// Estudos é Premium+.
//
// ⚠️ Antes redirecionava pro /planos com um spinner; agora mostra o card de
// convite no lugar da aba. A sub-nav das seções fica em cada página
// (<EstudosNav />), não aqui.
export default function EstudosLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="grow_estudos">{children}</GrowGate>;
}
