'use client';

import GrowGate from '@/components/grow/GrowGate';

// Saúde é Premium+.
//
// ⚠️ Antes este layout redirecionava pro /planos com um spinner. Virou o mesmo
// `GrowGate` das outras abas, que mostra o card de convite NO lugar da aba —
// dizendo o nome dela e o que ela faz, em vez de largar a pessoa numa tabela
// de preços sem contexto. A sub-nav das seções não vive aqui (era sticky e
// "arrastava"): cada página renderiza <SaudeNav /> abaixo do próprio título.
export default function SaudeLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="grow_saude">{children}</GrowGate>;
}
