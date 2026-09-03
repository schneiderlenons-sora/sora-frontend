import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  normalizarCodigo, motivoNaoPodeUsar, motivoNaoPodeIndicar,
  creditarMes, MAX_INDICACOES,
} from '@/lib/indicacoes';

// POST /api/indicacoes/usar — o amigo cola o código de quem o convidou.
//
// ⚠️ ESTA ROTA GERA DINHEIRO (um mês de assinatura pro indicador), então cada
// checagem aqui existe por um motivo e nenhuma é decorativa. A ordem também
// importa: primeiro tudo que RECUSA, e só no fim o que ESCREVE.
export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const { codigo } = await req.json().catch(() => ({ codigo: '' }));
    const cod = normalizarCodigo(codigo);
    if (cod.length < 6) return NextResponse.json({ erro: 'Código inválido.' }, { status: 400 });

    const campos = 'id, name, email, plano, vitalicio, stripe_customer_id, stripe_subscription_id, plano_intervalo, created_at';

    // ── 1. Quem está usando pode usar? ──────────────────────────────────────
    const { data: eu } = await supabaseAdmin.from('users').select(campos).eq('id', user.id).maybeSingle();
    const bloqueio = motivoNaoPodeUsar(eu);
    if (bloqueio) return NextResponse.json({ erro: bloqueio }, { status: 422 });

    // ⚠️ Uma indicação por pessoa, PARA SEMPRE. O banco também garante (índice
    // único em indicado_id), mas conferir aqui devolve mensagem em vez de 500.
    const { data: jaTem } = await supabaseAdmin
      .from('indicacoes').select('id').eq('indicado_id', user.id).maybeSingle();
    if (jaTem) return NextResponse.json({ erro: 'Você já usou um código de convite.' }, { status: 422 });

    // ── 2. O código existe e é de outra pessoa? ─────────────────────────────
    const { data: dono } = await supabaseAdmin
      .from('users').select(campos).eq('codigo_indicacao', cod).maybeSingle();
    if (!dono) return NextResponse.json({ erro: 'Não encontrei esse código. Confere com quem te convidou.' }, { status: 404 });
    if (dono.id === user.id) return NextResponse.json({ erro: 'Esse código é o seu. Manda pra um amigo 😉' }, { status: 422 });

    // ⚠️ O INDICADOR também precisa estar apto AGORA. Ele pode ter virado
    // vitalício ou cancelado depois de mandar o código — creditar um mês numa
    // assinatura que não existe mais falharia lá no Stripe, tarde demais.
    const bloqueioDono = motivoNaoPodeIndicar(dono);
    if (bloqueioDono) {
      return NextResponse.json({ erro: 'Quem te convidou não está mais participando do programa.' }, { status: 422 });
    }

    // ── 3. Ele ainda tem vaga? ──────────────────────────────────────────────
    const { count } = await supabaseAdmin
      .from('indicacoes').select('id', { count: 'exact', head: true })
      .eq('indicador_id', dono.id).in('status', ['pendente', 'creditado']);
    if ((count || 0) >= MAX_INDICACOES) {
      return NextResponse.json({ erro: `Quem te convidou já atingiu o limite de ${MAX_INDICACOES} amigos.` }, { status: 422 });
    }

    // ── 4. Registra a indicação ─────────────────────────────────────────────
    //
    // ⚠️ REGISTRA ANTES DE CREDITAR, e isso é de propósito. Se creditasse
    // primeiro e o insert falhasse (ex.: corrida entre dois cliques), o dinheiro
    // teria saído sem rastro nenhum no banco — e sem rastro não há como
    // auditar nem estornar. Na ordem certa, o pior caso é uma linha 'pendente'
    // sem crédito, que é visível e recuperável.
    const { data: criada, error: eIns } = await supabaseAdmin
      .from('indicacoes')
      .insert({ indicador_id: dono.id, indicado_id: user.id, codigo: cod })
      .select('id').single();
    if (eIns) {
      // 23505 = o índice único pegou uma corrida (dois cliques ao mesmo tempo).
      if (String(eIns.code || '').includes('23505')) {
        return NextResponse.json({ erro: 'Você já usou um código de convite.' }, { status: 422 });
      }
      return NextResponse.json({ erro: eIns.message }, { status: 500 });
    }

    // ── 5. Credita o mês no Stripe do indicador ─────────────────────────────
    const credito = await creditarMes(dono);
    if (!credito.ok) {
      // ⚠️ A indicação FICA, como 'pendente'. Não apago: o convite aconteceu de
      // verdade, e apagar esconderia do admin que alguém ficou sem o mês. O
      // /admin lista as pendentes justamente pra isso.
      console.error('[indicacoes] indicação', criada.id, 'sem crédito:', credito.erro);
      return NextResponse.json({
        ok: true,
        aviso: 'Código aceito! O mês de quem te convidou está sendo processado.',
      });
    }

    await supabaseAdmin.from('indicacoes').update({
      status: 'creditado',
      credito_stripe_id: credito.id,
      credito_valor: credito.valor,
      creditado_em: new Date().toISOString(),
    }).eq('id', criada.id);

    return NextResponse.json({ ok: true, indicador: dono.name || 'quem te convidou' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
