import type { Plano } from './plans';

// ─────────────────────────────────────────────────────────────────────────────
// QUE OFERTA DE PLANO CADA CONTA VÊ — fonte única da /planos e de Configurações.
//
// ⚠️ AS DUAS TELAS DECIDIAM CADA UMA A SUA, E DIVERGIAM. Caso real (set/2026):
// cliente com o Kit via o upgrade na /planos, mas em Configurações → Plano e
// Cobrança só apareciam as assinaturas mensais — sem o upgrade, e com o hero
// dizendo "Sora Premium". Regra do usuário:
//
//   · Kit ........................ SÓ o upgrade pra Completa (+R$ 50).
//   · Assinante (mensal/anual) ... as assinaturas; a Completa vitalícia NÃO.
//   · Sem plano pago (inativo, grátis) ... as assinaturas E a Completa (R$ 97).
//   · Já vitalício completo ...... nada a vender.
//
// ⚠️ NO APP ANDROID NADA É VENDIDO. Política do Google Play: assinatura dentro
// do app exige Play Billing, e link ou texto persuasivo pra outro meio de
// pagamento é motivo de remoção (ver lib/paywall.ts e CardPlanos). As ofertas
// continuam no site.
// ─────────────────────────────────────────────────────────────────────────────

export type OfertasPlano = {
  /** Grade de assinaturas recorrentes (Básico/Premium/Platinum, mensal ou anual). */
  assinaturas: boolean;
  /** Kit → Completa pagando só a diferença. */
  upgradeKit: boolean;
  /** Completa vitalícia cheia (pagamento único). */
  completaVitalicia: boolean;
};

const NADA: OfertasPlano = { assinaturas: false, upgradeKit: false, completaVitalicia: false };

export function ofertasDoPlano(p: {
  plano: Plano;
  /** `users.vitalicio` — pagou uma vez (Kit ou Completa). */
  vitalicio: boolean;
  android: boolean;
}): OfertasPlano {
  if (p.android) return NADA;
  // Kit vem antes do `vitalicio`: a conta Kit também tem a flag, e é justamente
  // a que ainda tem pra onde subir.
  if (p.plano === 'kit') return { assinaturas: false, upgradeKit: true, completaVitalicia: false };
  if (p.vitalicio) return NADA;
  const semPlanoPago = p.plano === 'inativo' || p.plano === 'gratis';
  return { assinaturas: true, upgradeKit: false, completaVitalicia: semPlanoPago };
}
