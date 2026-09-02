import { redirect } from 'next/navigation';

// A antiga aba "Compartilhamento" do Grow virou uma SEÇÃO da Gestão
// compartilhada (`components/comunidade/PrivacidadeGrow.tsx`) — eram dois
// lugares pra resolver a mesma pergunta, "quem vê o quê".
//
// ⚠️ A ROTA CONTINUA EXISTINDO de propósito: ela está em link de WhatsApp, no
// histórico do navegador de quem já usa e possivelmente em print de suporte.
// Apagar daria 404 pra quem já sabia o caminho.
export default function GrowConfiguracoesRedirect() {
  redirect('/comunidade');
}
