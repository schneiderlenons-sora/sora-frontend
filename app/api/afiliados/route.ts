import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { painelDoAfiliado, sincronizarAfiliado } from '@/lib/afiliados';

export const maxDuration = 60;
const RELER_APOS_MS = 60 * 60 * 1000;

/** O código e os ganhos de quem já é afiliado (null = ainda não é). */
async function dadosDoAfiliado(userId: string) {
  try {
    const { data: af, error } = await supabaseAdmin
      .from('afiliados').select('id, codigo, desconto_pct, ativo, sincronizado_em').eq('user_id', userId).maybeSingle();
    if (error || !af) return null;
    // Relê as cobranças no máximo 1× por hora; falha mostra o que já está salvo.
    if (!af.sincronizado_em || Date.now() - new Date(af.sincronizado_em).getTime() > RELER_APOS_MS) {
      await sincronizarAfiliado(af.id).catch(() => {});
    }
    const { linhas, clientes, resumo } = await painelDoAfiliado(af.id);
    return {
      codigo: af.codigo, desconto_pct: af.desconto_pct, ativo: af.ativo, clientes, resumo,
      // Sem referência nem cliente: o afiliado não vê quem comprou.
      linhas: linhas.filter((l) => l.status !== 'cancelada').slice(0, 100).map((l) => ({
        id: l.id, tipo: l.tipo, ajuste: l.ajuste_n > 0, valor_centavos: l.valor_centavos,
        status: l.status, pago_em: l.pago_em, liberada_em: l.liberada_em,
      })),
    };
  } catch (e) {
    console.error('[afiliados] painel:', e instanceof Error ? e.message : e);
    return null;
  }
}

// GET  /api/afiliados — a candidatura desta pessoa (se houver).
// POST /api/afiliados — envia a candidatura.
//
// ⚠️ A entrada é por ANÁLISE, nunca automática — é o que a tela promete
// ("A entrada é por análise de perfil"). Esta rota só REGISTRA; quem aprova é o
// /admin. Aprovar sozinho aqui viraria comissão paga sem ninguém olhar.

export async function GET() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

  const { data: perfil } = await supabaseAdmin
    .from('users').select('name, email').eq('id', user.id).maybeSingle();

  const { data: candidatura } = await supabaseAdmin
    .from('afiliados_candidaturas')
    .select('id, status, criado_em, analisado_em, observacao')
    .eq('user_id', user.id)
    .order('criado_em', { ascending: false })
    .limit(1).maybeSingle();

  return NextResponse.json({
    candidatura: candidatura || null,
    afiliado: await dadosDoAfiliado(user.id),
    // A tela mostra "vamos usar X e Y da sua conta" antes do formulário.
    nome:  perfil?.name  || user.user_metadata?.name || '',
    email: perfil?.email || user.email || '',
  });
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const whatsapp  = String(body.whatsapp  || '').replace(/\D/g, '');
    const instagram = String(body.instagram || '').trim().replace(/^@+/, '');
    const tiktok    = String(body.tiktok    || '').trim().replace(/^@+/, '');
    const como      = String(body.como_divulgar || '').trim().slice(0, 2000);

    // Os dois obrigatórios são os que permitem ANALISAR o perfil — sem eles a
    // candidatura chega ao admin sem nada pra avaliar.
    if (whatsapp.length < 10) return NextResponse.json({ erro: 'Informe um WhatsApp válido com DDD.' }, { status: 400 });
    if (!instagram)           return NextResponse.json({ erro: 'Informe seu Instagram.' }, { status: 400 });

    const { data: perfil } = await supabaseAdmin
      .from('users').select('name, email').eq('id', user.id).maybeSingle();

    // ⚠️ Nome e e-mail são COPIADOS agora, não lidos depois por join: se a
    // pessoa trocar de nome no perfil, a candidatura tem de continuar mostrando
    // o que foi enviado no dia.
    const { error } = await supabaseAdmin.from('afiliados_candidaturas').insert({
      user_id: user.id,
      nome:  perfil?.name  || user.user_metadata?.name || null,
      email: perfil?.email || user.email || null,
      whatsapp, instagram, tiktok: tiktok || null, como_divulgar: como || null,
    });

    if (error) {
      // O índice único cobre só as PENDENTES — recandidatar depois de recusa é
      // permitido de propósito.
      if (String(error.code || '').includes('23505')) {
        return NextResponse.json({ erro: 'Você já tem uma candidatura em análise.' }, { status: 422 });
      }
      // ⚠️ O texto do banco NÃO vai pro cliente: com a migration 153 pendente
      // ele recebia "Could not find the table 'public.afiliados_candidaturas'
      // in the schema cache" (relato da Tatiane, nov/2026). Detalhe no log.
      console.error('[afiliados] candidatura não gravada:', error.code, error.message);
      return NextResponse.json({ erro: 'Não consegui enviar sua candidatura agora. Tente de novo em alguns minutos.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
