'use client';

import GrowGate from '@/components/grow/GrowGate';

// Coleções (Leituras) são Premium+.
export default function LeiturasLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="grow_colecoes">{children}</GrowGate>;
}
