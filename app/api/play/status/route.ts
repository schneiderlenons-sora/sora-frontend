import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { linhaComDireito, ORDEM_PLAY, type PlanoPlay } from '@/lib/play-billing';

export const dynamic = 'force-dynamic';

// GET → a assinatura Play que vale agora pra pessoa logada (ou `ativa: false`).
//
// Usado pelo app (pra mostrar o plano atual e trocar de plano) e pelo SITE (pra
// não vender uma assinatura no Stripe a quem já paga pela Play — seriam duas
// cobranças pelo mesmo plano).
//
// ⚠️ Sem a migration 187 a tabela não existe: responde `ativa: false` com
// `indisponivel`, e o site segue vendendo como sempre.
export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('play_assinaturas')
    .select('purchase_token, product_id, plano, intervalo, estado, expira_em, auto_renova')
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ ativa: false, indisponivel: true });

  const agora = Date.now();
  const valendo = (data || [])
    .filter((l) => linhaComDireito(l, agora))
    .sort((a, b) => ORDEM_PLAY[b.plano as PlanoPlay] - ORDEM_PLAY[a.plano as PlanoPlay]);
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
    // Necessário pra TROCA de plano no app (a Play exige o comprovante antigo).
    purchaseToken: a.purchase_token,
  });
}
