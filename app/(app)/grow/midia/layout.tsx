'use client';

import GrowGate from '@/components/grow/GrowGate';

// Coleções (Filmes & Séries) são Premium+.
export default function MidiaLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="grow_colecoes">{children}</GrowGate>;
}
