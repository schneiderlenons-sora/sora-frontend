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

export const CUPONS_VITALICIO: Record<string, number> = {
  SORA15: 15,
  SORA25: 25,
  SORA100: 100,
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
