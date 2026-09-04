import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// Responde um relato de bug/melhoria pelo WhatsApp OFICIAL da Sora (via template,
// então alcança mesmo fora da janela de 24h). O telefone vem do relato (bugId),
// nunca do cliente. Repassa pro backend (credenciais da Meta) com o secret.
export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { bugId, texto } = (await req.json().catch(() => ({}))) as { bugId?: string; texto?: string };
  if (!bugId || !texto?.trim()) {
    return NextResponse.json({ erro: 'Informe o relato e a mensagem.' }, { status: 400 });
  }

  const { data: b } = await supabaseAdmin.from('bug_reports').select('phone, nome').eq('id', bugId).maybeSingle();
  if (!b?.phone) {
    return NextResponse.json({ erro: 'Esse relato não tem WhatsApp — responda por e-mail.' }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ erro: 'Envio não configurado (falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel).' }, { status: 503 });
  }

  try {
    const r = await fetch(`${base}/api/admin/responder-relato`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ phone: b.phone, nome: b.nome || '', texto: texto.trim() }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ erro: data?.erro || `Falha (${r.status})` }, { status: 502 });
    if (data?.ok === false) {
      return NextResponse.json({ erro: `Não entregue: ${data.erro || 'erro'}${data.code ? ` (código ${data.code})` : ''}` }, { status: 200 });
    }

    // ⚠️ SÓ GRAVA DEPOIS DE O WHATSAPP CONFIRMAR. Gravar antes deixaria a
    // resposta visível no painel do cliente sem ela ter sido entregue —
    // e o histórico do chamado passaria a mentir sobre o que foi respondido.
    //
    // A conversa também precisa existir aqui porque o WhatsApp some no meio de
    // outras mensagens: o painel é onde o cliente reencontra o que foi dito.
    // Tolerante: sem a migration 143 a resposta ainda é entregue por WhatsApp.
    // ⚠️ O `insert` do supabase-js NÃO LANÇA: ele DEVOLVE `{ error }`. Sem ler
    // esse campo, uma gravação que falhou seguia adiante em silêncio, o status
    // virava "em andamento" logo abaixo e o painel dizia "Resposta enviada ✓"
    // — com a conversa em lugar nenhum. Foi o que aconteceu num chamado real:
    // status alterado, zero mensagens. Mesma família do bug de investimentos
    // (`const { data } = await ...insert()` respondendo 200 com null).
    let gravou = true;
    let falhaGrav = '';
    try {
      const { error } = await supabaseAdmin.from('bug_mensagens').insert({
        bug_id: bugId, autor: 'suporte', texto: texto.trim(),
      });
      if (error) { gravou = false; falhaGrav = error.message; }
      // Respondeu = está sendo tratado. Poupa o admin de mudar o status à mão
      // (e é o que faz o chamado sair da fila de "aberto" na visão dele).
      await supabaseAdmin.from('bug_reports')
        .update({ status: 'em_andamento' }).eq('id', bugId).eq('status', 'aberto');
    } catch (e: unknown) {
      gravou = false;
      falhaGrav = e instanceof Error ? e.message : 'erro desconhecido';
    }

    // A entrega ACONTECEU — por isso `ok: true` e nunca um erro que sugira
    // reenviar (mandaria a mesma mensagem duas vezes pro cliente). Mas o admin
    // precisa saber que o histórico não guardou, senão ele confia numa thread
    // que não existe.
    if (!gravou) {
      return NextResponse.json({
        ok: true, para: b.nome || b.phone,
        aviso: `Entregue no WhatsApp, mas NÃO gravei no histórico do chamado (${falhaGrav}). A conversa vai aparecer vazia.`,
      });
    }

    return NextResponse.json({ ok: true, para: b.nome || b.phone });
  } catch (e: unknown) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro ao enviar' }, { status: 502 });
  }
}
