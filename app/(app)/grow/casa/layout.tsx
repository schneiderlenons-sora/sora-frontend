'use client';

import GrowGate from '@/components/grow/GrowGate';

// Casa (Compras, Despensa, Receitas, Manutenções) é Premium+.
export default function CasaLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="grow_casa">{children}</GrowGate>;
}
