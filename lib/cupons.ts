// ─────────────────────────────────────────────────────────────────────────────
// Cupons de desconto do checkout VITALÍCIO (Mercado Pago).
//
// Espelham os cupons do Stripe usados nas mensagens de recuperação
// (SORA15 = 15%, SORA25 = 25%) + SORA100 (100% = acesso grátis).
//
// FONTE ÚNICA — usada no cliente (só pra UX/preview) e no servidor
// (AUTORITATIVO). O valor cobrado é SEMPRE recalculado no servidor a partir do
// código; o cliente nunca define o desconto. Cupom inválido = 0% (cobra cheio).
// ─────────────────────────────────────────────────────────────────────────────

// ⚠️ ESTE É O CATÁLOGO INTEIRO **DO VITALÍCIO**. Código que não está aqui vale
// 0% e o checkout cobra CHEIO, dizendo "cupom inválido" — foi o que aconteceu
// com o SORA20, que era divulgado mas nunca tinha sido cadastrado. Divulgou
// cupom novo? Cadastre aqui ANTES de anunciar.
//
// ⚠️ A ASSINATURA (mensal/anual) NÃO LÊ ESTE ARQUIVO. Ela usa o Checkout do
// Stripe com `allow_promotion_codes: true`, e lá o código tem de existir no
// PAINEL DO STRIPE. Um cupom só daqui aparece pro cliente como "expirado ou
// inválido" na assinatura — aconteceu com o CONVIDADO50 (set/2026).
//
// Conferido na API do Stripe (LIVE) em 02/09/2026 — os dois lados JÁ DIVERGEM:
//
//   código        vitalício (aqui)   Stripe        duração no Stripe
//   ─────────────────────────────────────────────────────────────────
//   SORA10             10%           SORA10        once
//   SORA15             15%           SORA15        once
//   SORA25             25%           SORA25        forever
//   SORA20             20%           —             (não existe)
//   SORA35             35%           —             (não existe)
//   SORA100           100%           "100sora"     forever  ← nome diferente!
//   CONVIDADO50        50%           —             (decisão: só vitalício)
//
// Ou seja: SORA20, SORA35 e SORA100 falham na assinatura. Antes de anunciar um
// cupom, decida em QUAL fluxo ele vale — e, se for nos dois, cadastre no Stripe
// também, escolhendo a duração (once = só a 1ª cobrança; forever = todas).
export const CUPONS_VITALICIO: Record<string, number> = {
  SORA10: 10,
  SORA15: 15,
  SORA20: 20,
  SORA25: 25,
  SORA35: 35, // cortesia (transtorno com recusa de pagamento — jul/2026)
  SORA100: 100,

  // Convite (set/2026). ⚠️ Sem prefixo SORA de propósito: nada no código exige
  // esse prefixo — o catálogo casa pelo código EXATO, e o caso especial de
  // acesso grátis é decidido por `pct === 100`, não pelo nome. Então um cupom
  // de 50% segue o fluxo normal do Mercado Pago, cobrando metade.
  CONVIDADO50: 50,
};

// % de desconto de um código (0 se inválido/ausente).
export function pctCupom(codigo?: string | null): number {
  if (!codigo) return 0;
  return CUPONS_VITALICIO[codigo.trim().toUpperCase()] ?? 0;
}

// Aplica o cupom a um valor. Retorna o valor final (>= 0, 2 casas), o % de
// desconto e o código normalizado (null quando inválido/sem desconto).
export function aplicarCupomVitalicio(amount: number, codigo?: string | null): {
  valor: number; pct: number; codigo: string | null;
} {
  const norm = codigo ? codigo.trim().toUpperCase() : null;
  const pct = pctCupom(norm);
  const valor = Math.max(0, Math.round(amount * (1 - pct / 100) * 100) / 100);
  return { valor, pct, codigo: pct > 0 ? norm : null };
}
