import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSupabaseServer } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/**
 * Coloca a conta no modo manual (`plano = 'gratis'`).
 *
 * ⚠️ ISTO PRECISA SER SERVIDOR. O onboarding escreve em `users` direto pelo
 * client do Supabase (nome, perfil de uso, step), então a tentação é gravar o
 * plano do mesmo jeito — e aí qualquer pessoa com o console aberto se daria
 * `platinum`. O plano é a chave de acesso do produto inteiro; ele só sobe por
 * webhook de pagamento ou por aqui.
 *
 * ⚠️ E SÓ ANDA DE `inativo` PARA `gratis`. Sem essa trava, a mesma chamada
 * REBAIXARIA um assinante que abrisse o app Android — bastaria a rota ser
 * chamada de novo depois. Quem já paga sai daqui intocado, com `ok: true`,
 * porque do ponto de vista de quem chamou não houve erro nenhum: a conta está
 * liberada, que era o objetivo.
 */
export async function POST() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const { data: linha, error: erroLeitura } = await supabaseAdmin
    .from('users')
    .select('plano')
    .eq('id', user.id)
    .maybeSingle();

  if (erroLeitura) {
    return NextResponse.json({ erro: erroLeitura.message }, { status: 500 });
  }

  // Já tem plano (pago ou já grátis) → nada a fazer.
  if (linha?.plano && linha.plano !== 'inativo') {
    return NextResponse.json({ ok: true, plano: linha.plano, mudou: false });
  }

  const { error } = await supabaseAdmin
    .from('users')
    // `plano_valido_ate: null` explicitamente: o modo manual não vence, e uma
    // data aqui faria o `exigirPlano` do backend expirar a conta sozinha pra
    // `inativo` — paywall sem cancelamento nenhum.
    .update({ plano: 'gratis', plano_valido_ate: null })
    .eq('id', user.id);

  if (error) {
    // ⚠️ O erro é LIDO e devolvido. Se a migration 156 não rodou, o
    // `users_plano_check` recusa 'gratis' e o update falha — e sem esta
    // checagem a tela seguiria como se tivesse dado certo, com a conta presa
    // em `inativo` e a pessoa batendo no paywall logo depois.
    return NextResponse.json(
      { erro: error.message, dica: 'Rode a migration 156 (users_plano_check).' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, plano: 'gratis', mudou: true });
}
