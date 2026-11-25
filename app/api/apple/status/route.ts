import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { linhaComDireitoApple, ORDEM_APPLE, type PlanoApple } from '@/lib/apple-billing';

export const dynamic = 'force-dynamic';

// GET → a assinatura da Apple que vale agora pra pessoa logada (ou `ativa: false`).
//
// Usado pelo app de iPhone (plano atual, troca de plano) e pelo SITE (pra não
// vender uma assinatura no Stripe a quem já paga pela Apple — seriam duas
// cobranças pelo mesmo plano). Sem a migration 199: `ativa: false` + `indisponivel`.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('apple_assinaturas')
    .select('product_id, plano, intervalo, estado, expira_em, auto_renova, proximo_produto')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ ativa: false, indisponivel: true });

  const agora = Date.now();
  const valendo = (data || [])
    .filter((l) => linhaComDireitoApple(l, agora))
    .sort((a, b) => ORDEM_APPLE[b.plano as PlanoApple] - ORDEM_APPLE[a.plano as PlanoApple]);
  const a = valendo[0];
  if (!a) return NextResponse.json({ ativa: false });
  return NextResponse.json({
    ativa: true,
    produto: a.product_id,
    plano: a.plano,
    intervalo: a.intervalo,
    estado: a.estado,
    expiraEm: a.expira_em,
    autoRenova: a.auto_renova,
    proximoProduto: a.proximo_produto,
  });
}
