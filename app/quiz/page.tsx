import type { Metadata } from 'next';
import QuizExperience from '@/components/quiz/QuizExperience';

// Cópia do funil /chat com a oferta mensal (Premium R$ 29,90/mês).
// Sem cache de borda pra não servir versão antiga.
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Sora — organize sua vida financeira por um áudio no WhatsApp',
  description:
    'Não é app, nem planilha. Um áudio no WhatsApp e a Sora lança gastos, cria lembretes, define metas e te mostra pra onde vai seu dinheiro. Premium por R$ 29,90/mês, cancele quando quiser.',
};

export default function QuizPage() {
  return <QuizExperience />;
}
