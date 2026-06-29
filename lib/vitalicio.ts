import { supabaseAdmin } from '@/lib/supabase-admin';

// Ativa o plano VITALÍCIO (Black pra sempre, sem expiração) pra um usuário.
// Usado pelos webhooks (Mercado Pago e Stripe). Tolerante à migration 060: se
// as colunas vitalicio* ainda não existirem, ao menos ativa o Black (fallback).
export async function ativarVitalicio(userId: string): Promise<void> {
  if (!userId) return;
  const { error } = await supabaseAdmin.from('users').update({
    plano: 'black',
    vitalicio: true,
    vitalicio_em: new Date().toISOString(),
    plano_intervalo: null,
    plano_valido_ate: null,
  }).eq('id', userId);

  if (error) {
    console.error('[vitalicio] update completo falhou (migration 060?), fallback Black:', error.message);
    await supabaseAdmin.from('users').update({
      plano: 'black',
      plano_intervalo: null,
      plano_valido_ate: null,
    }).eq('id', userId);
  }
}
