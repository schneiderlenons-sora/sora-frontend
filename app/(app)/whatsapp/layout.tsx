'use client';

import GrowGate from '@/components/grow/GrowGate';

// ⚠️ FORA: 'gratis' e 'kit'. São exatamente os dois planos que o WhatsApp da
// Sora NÃO atende (o mesmo mapa de bloqueio do `webhook.js`). Mostrar a porta
// a quem bate e não é atendido seria pior do que não mostrar nada.
//
// ⚠️ O nome `GrowGate` engana: ele não tem nada de Grow — recebe uma `Feature`
// e mostra o card de aba bloqueada pra quem não a tem. Reusado aqui de
// propósito, em vez de um guard novo com a mesma lógica.
export default function WhatsappLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="whatsapp_sora">{children}</GrowGate>;
}
