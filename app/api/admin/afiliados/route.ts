import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripe } from '@/lib/stripe';
import { CUPONS_VITALICIO } from '@/lib/cupons';
import { normalizarCodigoAfiliado, motivoCodigoInvalido } from '@/lib/afiliados-regras';
import { criarCupomStripe, painelDoAfiliado, sincronizarAfiliado, registrarRepasse, type Afiliado } from '@/lib/afiliados';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SEM_TABELA = 'Falta rodar a migration 209 no Supabase.';

// GET    /api/admin/afiliados  — candidaturas, afiliados ativos (+ indicações pendentes)
// PATCH  /api/admin/afiliados  — aprova (cria código e cupom) / recusa
// POST   /api/admin/afiliados  — atualizar comissões, marcar repasse, ativar/desativar
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

  // Afiliados (migration 209). Sem ela a fila de candidaturas segue funcionando.
  let afiliados: unknown[] = [];
  let afiliadosErro: string | null = null;
  const { data: lista, error: eAf } = await supabaseAdmin
    .from('afiliados').select('*, dono:users!afiliados_user_id_fkey(name, email)').order('criado_em');
  if (eAf) {
    afiliadosErro = /afiliados/.test(eAf.message) && /(not find|does not exist|schema cache)/i.test(eAf.message) ? SEM_TABELA : eAf.message;
  } else {
    afiliados = await Promise.all((lista || []).map(async (a) => {
      try { return { ...a, ...(await painelDoAfiliado(a.id)) }; }
      catch { return { ...a, linhas: [], clientes: 0, resumo: null }; }
    }));
  }

  return NextResponse.json({
    candidaturas: candidaturas || [],
    contagem,
    indicacoesPendentes: indicacoesPendentes || [],
    afiliados,
    afiliadosErro,
  });
}

export async function PATCH(req: Request) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { id, status, observacao, codigo, desconto_pct } = await req.json().catch(() => ({}));
  if (!id || !['aprovado', 'recusado', 'pendente'].includes(status)) {
    return NextResponse.json({ erro: 'Parâmetros inválidos.' }, { status: 400 });
  }

  if (status === 'aprovado') {
    const falha = await criarAfiliado(String(id), codigo, desconto_pct);
    if (falha) return NextResponse.json({ erro: falha.erro }, { status: falha.status });
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

/** Cria o código (e o cupom no Stripe) de quem está sendo aprovado. */
async function criarAfiliado(candidaturaId: string, codigoBruto: unknown, pctBruto: unknown) {
  const { data: cand, error: eC } = await supabaseAdmin
    .from('afiliados_candidaturas').select('user_id').eq('id', candidaturaId).maybeSingle();
  if (eC || !cand) return { erro: 'Candidatura não encontrada.', status: 404 };

  const { data: ja, error: eJa } = await supabaseAdmin
    .from('afiliados').select('id').eq('user_id', cand.user_id).maybeSingle();
  if (eJa) return { erro: SEM_TABELA, status: 503 };
  if (ja) return null;                                       // já tem código

  const codigo = normalizarCodigoAfiliado(String(codigoBruto || ''));
  const invalido = motivoCodigoInvalido(codigo, Object.keys(CUPONS_VITALICIO));
  if (invalido) return { erro: invalido, status: 400 };
  const pct = Number(pctBruto);
  if (!Number.isInteger(pct) || pct < 1 || pct > 50) return { erro: 'O desconto vai de 1% a 50%.', status: 400 };
  const { data: usado } = await supabaseAdmin.from('afiliados').select('id').eq('codigo', codigo).maybeSingle();
  if (usado) return { erro: 'Esse código já é de outro afiliado.', status: 409 };

  let cupom: { cupomId: string; promoId: string };
  try { cupom = await criarCupomStripe(codigo, pct); }
  catch (e) { return { erro: `O Stripe recusou o código: ${e instanceof Error ? e.message : e}`, status: 502 }; }

  const { error } = await supabaseAdmin.from('afiliados').insert({
    user_id: cand.user_id, codigo, desconto_pct: pct,
    stripe_cupom_id: cupom.cupomId, stripe_promo_id: cupom.promoId,
  });
  if (error) {
    // Código sem dono no Stripe daria desconto sem comissão: desliga.
    await stripe.promotionCodes.update(cupom.promoId, { active: false }).catch(() => {});
    return { erro: `Não consegui gravar o afiliado: ${error.message}`, status: 500 };
  }
  return null;
}

export async function POST(req: Request) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { acao, afiliado_id, total_centavos } = await req.json().catch(() => ({}));
  const { data: af } = await supabaseAdmin.from('afiliados').select('*').eq('id', afiliado_id || '').maybeSingle();
  if (!af) return NextResponse.json({ erro: 'Afiliado não encontrado.' }, { status: 404 });
  const afiliado = af as Afiliado;

  if (acao === 'sincronizar') {
    const { erros } = await sincronizarAfiliado(afiliado.id);
    return erros.length
      ? NextResponse.json({ erro: `Não consegui conferir tudo: ${erros[0]}` }, { status: 502 })
      : NextResponse.json({ ok: true });
  }

  if (acao === 'pagar') {
    const r = await registrarRepasse(afiliado.id, Number(total_centavos));
    return r.ok ? NextResponse.json(r) : NextResponse.json({ erro: r.erro }, { status: 409 });
  }

  if (acao === 'ativar' || acao === 'desativar') {
    const ativo = acao === 'ativar';
    if (afiliado.stripe_promo_id) {
      try { await stripe.promotionCodes.update(afiliado.stripe_promo_id, { active: ativo }); }
      catch (e) { return NextResponse.json({ erro: `Stripe: ${e instanceof Error ? e.message : e}` }, { status: 502 }); }
    }
    const { error } = await supabaseAdmin.from('afiliados').update({ ativo }).eq('id', afiliado.id);
    if (error) return NextResponse.json({ erro: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ erro: 'Ação inválida.' }, { status: 400 });
}
