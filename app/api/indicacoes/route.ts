import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  obterOuCriarCodigo, formatarCodigo, motivoNaoPodeIndicar,
  motivoNaoPodeUsar, MAX_INDICACOES,
} from '@/lib/indicacoes';

// GET /api/indicacoes — o estado do programa pra quem está logado.
//
// Devolve tudo o que a aba precisa numa chamada só: o código (criando na
// primeira visita), quantos amigos já assinaram, quantos meses foram creditados
// e se esta conta pode indicar / pode usar um código.
export async function GET() {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const { data: perfil } = await supabaseAdmin
      .from('users')
      .select('id, name, email, plano, vitalicio, stripe_customer_id, stripe_subscription_id, plano_intervalo, created_at, codigo_indicacao')
      .eq('id', user.id).maybeSingle();

    const bloqueioIndicar = motivoNaoPodeIndicar(perfil);

    // ⚠️ O código só é gerado pra quem PODE indicar. Criar pra todo mundo
    // ocuparia códigos de contas que nunca vão usar — e mostrar um código a
    // quem não participa é prometer o que não vai acontecer.
    const codigo = bloqueioIndicar ? null : await obterOuCriarCodigo(user.id, perfil?.name);

    const { data: feitas } = await supabaseAdmin
      .from('indicacoes')
      .select('id, status, criado_em, creditado_em, indicado:users!indicacoes_indicado_id_fkey(name)')
      .eq('indicador_id', user.id)
      .order('criado_em', { ascending: false });

    // Só quem NÃO foi indicado ainda vê o campo de colar código.
    const { data: recebida } = await supabaseAdmin
      .from('indicacoes').select('id, criado_em').eq('indicado_id', user.id).maybeSingle();

    const lista = feitas || [];
    return NextResponse.json({
      codigo,
      codigoFormatado: codigo ? formatarCodigo(codigo) : null,
      bloqueioIndicar,                       // null | 'vitalicio' | 'sem_assinatura'
      max: MAX_INDICACOES,
      total: lista.length,
      creditadas: lista.filter((i) => i.status === 'creditado').length,
      indicacoes: lista,
      jaUsouCodigo: !!recebida,
      bloqueioUsar: recebida ? null : motivoNaoPodeUsar(perfil),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
