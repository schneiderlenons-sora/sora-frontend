// ─────────────────────────────────────────────────────────────────────────────
// Paywall: o que fazer com a conta em cada rota.
//
// ⚠️ NO APP ANDROID A SORA É GRÁTIS — inclusive pra quem se cadastrou PELO SITE.
// O plano grátis só era dado no cadastro feito DENTRO do app (`app/signup`).
// Quem já tinha conta criada no site sem pagar (`inativo`) abria o app, batia no
// paywall e caía na /planos. Caso real: conta criada no site em 13/09, foi até
// o checkout, não pagou, instalou o app em 14/09 e não conseguia entrar.
//
// ⚠️ E A /planos DENTRO DO APP É RISCO COM O GOOGLE: é a página da web, com
// preço e "Assinar" pelo Stripe. A política do Play proíbe vender fora do Play
// Billing dentro do app e proíbe levar a outro meio de pagamento — é por isso
// que o `CardPlanos` tem o modo `android` sem preço. Mandar pra lá era
// justamente o que não podia acontecer.
//
// A regra agora: conta `inativo` que abre o app vira `gratis` (a mesma rota do
// cadastro no app, `/api/plano-gratis`, que só anda de inativo → gratis) e segue
// o mesmo caminho de quem se cadastra por lá.
//
// Pura de propósito: decisão de acesso tem de ser testável sem navegador.
// ─────────────────────────────────────────────────────────────────────────────

import type { Plano } from './plans';

/** Rotas que qualquer conta abre, em qualquer lugar. */
export const ROTAS_LIVRES = ['/', '/login', '/signup', '/termos', '/privacidade', '/tour'];

/**
 * Rotas de COMPRA. Na web são livres pro `inativo` (ele vai pagar ali). No app
 * Android não: lá não se vende, então estar nelas é motivo pra liberar o
 * modo grátis — e sair delas.
 */
export const ROTAS_DE_COMPRA = ['/planos', '/oferta', '/checkout-vitalicio'];

export type AcaoPaywall = 'plano-ativo' | 'rota-livre' | 'converter-gratis' | 'planos';

const casa = (pathname: string, rotas: string[]) =>
  rotas.some((r) => pathname === r || pathname.startsWith(r + '/'));

export function decidirPaywall(p: { plano: Plano; pathname: string; android: boolean }): AcaoPaywall {
  // Só `inativo` é paywall. `gratis` é o modo manual e navega o app inteiro.
  if (p.plano !== 'inativo') return 'plano-ativo';
  if (p.pathname.startsWith('/api/')) return 'rota-livre';
  if (casa(p.pathname, ROTAS_LIVRES)) return 'rota-livre';
  if (p.android) return 'converter-gratis';
  if (casa(p.pathname, ROTAS_DE_COMPRA)) return 'rota-livre';
  return 'planos';
}

/**
 * Pra onde ir depois de liberar o modo grátis no app.
 * - Onboarding por fazer → `/tour`: a mesma entrada de quem se cadastra no app
 *   (demonstrações → card sem preço → onboarding curto).
 * - Já fez e está numa rota de compra → painel (não fica numa tela de preço).
 * - Já fez e está no app → fica onde está.
 */
export function destinoAposGratis(p: { onboardingCompleto: boolean; pathname: string }): string | null {
  if (!p.onboardingCompleto) return '/tour';
  if (casa(p.pathname, ROTAS_DE_COMPRA)) return '/dashboard';
  return null;
}
