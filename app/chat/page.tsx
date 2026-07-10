import type { Metadata } from 'next';
import ChatExperience from '@/components/chat/ChatExperience';

// Funil interativo (anúncio) — sem cache de borda pra não servir versão antiga.
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Sora — organize sua vida financeira por um áudio no WhatsApp',
  description:
    'Não é app, nem planilha. Um áudio no WhatsApp e a Sora lança gastos, cria lembretes, define metas e te mostra pra onde vai seu dinheiro. Acesso vitalício por R$97.',
};

export default function ChatPage() {
  return <ChatExperience />;
}
