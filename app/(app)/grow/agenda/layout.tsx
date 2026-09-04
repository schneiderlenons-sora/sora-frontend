'use client';

import GrowGate from '@/components/grow/GrowGate';

// A Agenda é do plano Básico pra cima.
//
// ⚠️ Ela NÃO tinha guard nenhum — o único filtro era o `temAcessoGrow` do
// layout do Grow, que o modo manual passa (ele mantém hábitos, tarefas e
// bem-estar). Sem este arquivo, `gratis` alcançaria a Agenda digitando a URL
// mesmo com o item escondido da sidebar.
export default function AgendaLayout({ children }: { children: React.ReactNode }) {
  return <GrowGate feature="grow_agenda">{children}</GrowGate>;
}
