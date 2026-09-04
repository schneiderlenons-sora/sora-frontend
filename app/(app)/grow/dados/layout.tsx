'use client';

import GrowGate from '@/components/grow/GrowGate';

// O Drive (aba) é do plano Básico pra cima.
//
// ⚠️ A feature é `drive_painel`, NÃO `drive`. A `drive` é Premium e vale pro
// WhatsApp (receber e buscar arquivo); a ABA sempre foi aberta a todo plano
// pago, de propósito, pra não trancar o Básico fora dos próprios documentos.
// Usar `drive` aqui seria tirar acesso de quem já guardou arquivo lá.
export default function DriveLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="drive_painel">{children}</GrowGate>;
}
