import { supabaseAdmin } from '@/lib/supabase-admin';

// Ativa um plano VITALÍCIO (sem expiração) pra um usuário. `plano` define o que
// libera: 'black' (Sora Completa) ou 'kit' (Kit Organização, sem WhatsApp/Grow).
// Usado pelos webhooks/process (Mercado Pago). Tolerante à migration 060.
export async function ativarVitalicio(userId: string, plano: string = 'black'): Promise<void> {
  if (!userId) return;
  const { error } = await supabaseAdmin.from('users').update({
    plano,
    vitalicio: true,
    vitalicio_em: new Date().toISOString(),
    plano_intervalo: null,
    plano_valido_ate: null,
  }).eq('id', userId);

  if (error) {
    console.error('[vitalicio] update completo falhou (migration 060?), fallback:', error.message);
    await supabaseAdmin.from('users').update({
      plano,
      plano_intervalo: null,
      plano_valido_ate: null,
    }).eq('id', userId);
  }
}
