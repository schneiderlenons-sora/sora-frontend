import { supabaseAdmin } from '@/lib/supabase-admin';

// Ativa um plano VITALÍCIO (sem expiração) pra um usuário. `plano` define o que
// libera: 'premium' (Sora Completa) ou 'kit' (Kit Organização, sem WhatsApp/Grow).
// Usado pelos webhooks/process (Mercado Pago). Tolerante à migration 060.
// Retorna `true` se o plano foi realmente gravado. IMPORTANTE: quem chama após
// um pagamento aprovado DEVE checar o retorno — se for `false`, o cliente pagou
// mas ficou sem acesso (ex.: constraint no banco) e precisa de alerta/suporte.
export async function ativarVitalicio(userId: string, plano: string = 'premium', valor?: number): Promise<boolean> {
  if (!userId) return false;
  const { error } = await supabaseAdmin.from('users').update({
    plano,
    vitalicio: true,
    vitalicio_em: new Date().toISOString(),
    plano_intervalo: null,
    plano_valido_ate: null,
  }).eq('id', userId);
  let ok = !error;

  if (error) {
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
    ok = true;
  }

  // Guarda o valor pago (após cupom) pra receita vitalícia no admin. Best-effort:
  // a coluna vem da migration 065 — se não existir, só loga e segue.
  if (ok && typeof valor === 'number') {
    const { error: ev } = await supabaseAdmin.from('users').update({ vitalicio_valor: valor }).eq('id', userId);
    if (ev) console.warn('[vitalicio] vitalicio_valor não gravado (rode migration 065):', ev.message);
  }

  return ok;
}
