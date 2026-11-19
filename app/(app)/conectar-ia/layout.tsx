'use client';

import GrowGate from '@/components/grow/GrowGate';

// Premium e Platinum (mesma lista do backend — lib/ia-conectada.ts). O nome
// `GrowGate` engana: ele recebe uma `Feature` qualquer e mostra o card de aba
// bloqueada pra quem não a tem (e esconde a venda no app de iPhone).
export default function IaConectadaLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="ia_conectada">{children}</GrowGate>;
}
