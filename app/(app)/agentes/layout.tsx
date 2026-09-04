'use client';

import GrowGate from '@/components/grow/GrowGate';

// Os Agentes são do plano Básico pra cima.
//
// ⚠️ O nome `GrowGate` engana: ele não tem nada de Grow — recebe uma `Feature`
// e manda pro /planos quem não a tem. Reusado aqui de propósito, em vez de um
// guard novo com a mesma lógica.
export default function AgentesLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="agentes">{children}</GrowGate>;
}
