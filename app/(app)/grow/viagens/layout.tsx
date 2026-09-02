'use client';

import GrowGate from '@/components/grow/GrowGate';

// Coleções (Viagens & Lazer) são Premium+.
export default function ViagensLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="grow_colecoes">{children}</GrowGate>;
}
