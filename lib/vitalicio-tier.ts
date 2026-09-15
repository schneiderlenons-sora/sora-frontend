// ─────────────────────────────────────────────────────────────────────────────
// Qual tier do vitalício ESTA conta compra — fonte única da tela e do servidor.
//
// ⚠️ QUEM TEM O KIT PAGA SÓ A DIFERENÇA (R$ 50), NÃO IMPORTA POR ONDE CHEGOU.
// O upgrade existia em `?tier=upgrade`, mas só o banner do dashboard apontava
// pra ele. O botão "Fazer upgrade" do WhatsApp levava pra landing /kit, cujo
// botão abre `?tier=completa` — e aí a conta Kit pagava R$ 97. Por isso a regra
// não depende do link: conta Kit pedindo a Completa vira upgrade.
//
// E o inverso continua valendo: upgrade sem Kit cobra a Completa cheia (senão
// qualquer um pegaria a Completa por R$ 50 abrindo o link).
//
// ⚠️ É por PLANO DA CONTA, e por isso não virou cupom: cupom é um código, não
// fica preso a quem tem o Kit — quem não tem usaria e levaria a Completa por 47.
// ─────────────────────────────────────────────────────────────────────────────

export type TierVitalicio = 'kit' | 'completa' | 'upgrade';

/** O tier pedido na URL/corpo. Qualquer coisa desconhecida é a Completa. */
export function normalizarTier(raw?: string | null): TierVitalicio {
  return raw === 'kit' || raw === 'upgrade' ? raw : 'completa';
}

/** O tier que a conta de fato compra, dado o plano atual dela. */
export function tierEfetivo(pedido: string | null | undefined, plano: string | null | undefined): TierVitalicio {
  const t = normalizarTier(pedido);
  if (t === 'upgrade' && plano !== 'kit') return 'completa';
  if (t === 'completa' && plano === 'kit') return 'upgrade';
  return t;
}
