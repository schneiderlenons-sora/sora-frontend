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
//   · Vitalício completo ......... as assinaturas (pode MIGRAR), sem a Completa.
//
// ⚠️ MUDANÇA out/2026: o vitalício completo PASSOU A VER a grade de assinaturas.
// Antes via "nada a vender" — e quem quisesse trocar o vitalício por uma
// assinatura (ex.: pra ter Open Finance incluso em vez de pagar R$6/conexão)
// não tinha por onde: a tela escondia os planos e o jeito era cancelar o
// vitalício à mão antes. Agora ele vê os planos e, ao assinar, o webhook
// converte a conta (tira o vitalício) — self-service, sem remendo. A Completa
// vitalícia ele não vê (já tem). Relato: Yoshima/Davidson.
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
  /** Tem assinatura ATIVA pela Google Play (comprada no app). */
  assinaturaPlay?: boolean;
}): OfertasPlano {
  // ⚠️ No app, quem vende é a grade da Play (components/planos/PlanosPlay), não
  // esta regra — que decide só o que sai pelo Stripe/Mercado Pago.
  if (p.android) return NADA;
  // ⚠️ Quem já paga pela Play não vê nada do Stripe no site: seriam DUAS
  // cobranças pelo mesmo plano. A troca de plano dele é feita no app.
  if (p.assinaturaPlay) return NADA;
  // Kit vem antes do `vitalicio`: a conta Kit também tem a flag, e é justamente
  // a que ainda tem pra onde subir.
  if (p.plano === 'kit') return { assinaturas: false, upgradeKit: true, completaVitalicia: false };
  // Vitalício completo: vê as assinaturas (pode migrar), mas NÃO a Completa — já
  // tem o vitalício. Ao assinar, o webhook converte a conta (zera `vitalicio`).
  if (p.vitalicio) return { assinaturas: true, upgradeKit: false, completaVitalicia: false };
  const semPlanoPago = p.plano === 'inativo' || p.plano === 'gratis';
  return { assinaturas: true, upgradeKit: false, completaVitalicia: semPlanoPago };
}
