import { supabaseAdmin } from '@/lib/supabase-admin';

// Ativa um plano VITALÍCIO (sem expiração) pra um usuário. `plano` define o que
// libera: 'premium' (Sora Completa) ou 'kit' (Kit Organização, sem WhatsApp/Grow).
// Usado pelos webhooks/process (Mercado Pago). Tolerante à migration 060.
// Retorna `true` se o plano foi realmente gravado. IMPORTANTE: quem chama após
// um pagamento aprovado DEVE checar o retorno — se for `false`, o cliente pagou
// mas ficou sem acesso (ex.: constraint no banco) e precisa de alerta/suporte.
export async function ativarVitalicio(userId: string, plano: string = 'premium'): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabaseAdmin.from('users').update({
    plano,
    vitalicio: true,
    vitalicio_em: new Date().toISOString(),
    plano_intervalo: null,
    plano_valido_ate: null,
  }).eq('id', userId);
  if (!error) return true;

  // Fallback: talvez a migration 060 (colunas vitalicio) não tenha rodado ainda.
  console.error('[vitalicio] update completo falhou, tentando fallback:', error.message);
  const { error: e2 } = await supabaseAdmin.from('users').update({
    plano,
    plano_intervalo: null,
    plano_valido_ate: null,
  }).eq('id', userId);
  if (e2) {
    console.error('[vitalicio] FALHA CRÍTICA — pagamento aprovado mas plano NÃO ativado:', { userId, plano, erro: e2.message });
    return false;
  }
  return true;
}
