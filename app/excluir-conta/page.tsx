import ExcluirContaClient from './ExcluirContaClient';

// ⚠️ PÚBLICA DE PROPÓSITO — exigência da Play Store (Política de dados do
// usuário: "Exclusão de conta"). O Google pede uma URL que abra SEM LOGIN e
// SEM REINSTALAR o app, dizendo como pedir a exclusão, o que é apagado e o que
// fica guardado (e por quanto tempo). É esta URL que vai no Play Console →
// Conteúdo do app → Segurança dos dados → Exclusão de dados.
//
// A rota está nas allowlists de: middleware.ts (ROTAS_PUBLICAS),
// lib/paywall.ts (ROTAS_LIVRES), OnboardingRedirect e a abertura do
// app/layout.tsx. Faltando uma, quem chega aqui é desviado pro login, pro
// /planos, pro wizard ou fica atrás do vídeo de abertura.
export const metadata = {
  title: 'Excluir sua conta — Sora',
  description: 'Como pedir a exclusão da sua conta da Sora e de todos os seus dados, o que é apagado e o que fica guardado.',
};

export default function ExcluirContaPage() {
  return <ExcluirContaClient />;
}
