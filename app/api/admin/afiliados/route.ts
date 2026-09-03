import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET   /api/admin/afiliados        — fila de candidaturas (+ indicações pendentes)
// PATCH /api/admin/afiliados        — aprova/recusa uma candidatura
export async function GET(req: Request) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const status = new URL(req.url).searchParams.get('status') || 'pendente';
  const q = supabaseAdmin
    .from('afiliados_candidaturas')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(200);

  const { data: candidaturas, error } = status === 'todas' ? await q : await q.eq('status', status);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // Contagem por status, pras abas do painel não precisarem de outra chamada.
  const { data: todas } = await supabaseAdmin.from('afiliados_candidaturas').select('status');
  const contagem = (todas || []).reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1; return acc;
  }, {});

  // ⚠️ INDICAÇÕES QUE FICARAM SEM CRÉDITO aparecem aqui de propósito. Quando o
  // Stripe falha, a rota de usar código mantém a linha como 'pendente' em vez
  // de apagá-la — e sem um lugar que MOSTRE isso, o amigo ficaria sem o mês e
  // ninguém saberia.
  const { data: indicacoesPendentes } = await supabaseAdmin
    .from('indicacoes')
    .select('id, criado_em, codigo, indicador:users!indicacoes_indicador_id_fkey(name, email), indicado:users!indicacoes_indicado_id_fkey(name, email)')
    .eq('status', 'pendente')
    .order('criado_em', { ascending: false })
    .limit(50);

  return NextResponse.json({
    candidaturas: candidaturas || [],
    contagem,
    indicacoesPendentes: indicacoesPendentes || [],
  });
}

export async function PATCH(req: Request) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { id, status, observacao } = await req.json().catch(() => ({}));
  if (!id || !['aprovado', 'recusado', 'pendente'].includes(status)) {
    return NextResponse.json({ erro: 'Parâmetros inválidos.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('afiliados_candidaturas')
    .update({
      status,
      observacao: observacao ?? null,
      analisado_em: status === 'pendente' ? null : new Date().toISOString(),
    })
    .eq('id', id);

  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
