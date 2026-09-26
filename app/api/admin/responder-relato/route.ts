import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// Responde um chamado de suporte.
//
// ⚠️ A ORDEM SE INVERTEU (26/09/2026, decisão do dono). Antes a resposta ia
// INTEIRA pelo WhatsApp e só era gravada DEPOIS de a entrega confirmar — o
// WhatsApp era o canal, o painel era a cópia. Na prática o cliente respondia
// no WhatsApp da Sora e a mensagem nunca chegava ao dono: aquele número
// atende a assistente financeira, não o suporte.
//
// Agora o PAINEL é o canal e o WhatsApp é só a campainha:
//   1. grava a resposta em `bug_mensagens` — é ela que o cliente vai ler;
//   2. avisa no WhatsApp (sem o texto) que há resposta, com o link;
//   3. o aviso é BEST-EFFORT: falhar nele não invalida uma resposta que já
//      está no painel e já dispara a notificação na tela.
//
// ⚠️ E É ISSO QUE DESTRAVA QUEM NÃO TEM TELEFONE. Antes a rota recusava com
// 400 ("responda por e-mail") e o botão nem aparecia no admin — um cliente
// real (jr.sprega@gmail.com) ficou sem resposta possível. Sem WhatsApp a
// resposta é entregue do mesmo jeito; o que ele perde é só a campainha.
export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { bugId, texto } = (await req.json().catch(() => ({}))) as { bugId?: string; texto?: string };
  if (!bugId || !texto?.trim()) {
    return NextResponse.json({ erro: 'Informe o relato e a mensagem.' }, { status: 400 });
  }

  const { data: b } = await supabaseAdmin
    .from('bug_reports').select('phone, nome').eq('id', bugId).maybeSingle();
  if (!b) return NextResponse.json({ erro: 'Chamado não encontrado.' }, { status: 404 });

  // ── 1. A RESPOSTA. Sem isto não há o que ler, então é ela que decide se a
  // chamada deu certo. ⚠️ O `insert` do supabase-js NÃO LANÇA: ele DEVOLVE
  // `{ error }`. Não ler esse campo já deixou um chamado real com o status
  // alterado e zero mensagens — a mesma família do bug de investimentos
  // (`const { data } = await ...insert()` respondendo 200 com null).
  const { error: errGrav } = await supabaseAdmin.from('bug_mensagens').insert({
    bug_id: bugId, autor: 'suporte', texto: texto.trim(),
  });
  if (errGrav) {
    return NextResponse.json(
      { erro: `Não consegui gravar a resposta: ${errGrav.message}` },
      { status: 500 },
    );
  }

  // Respondeu = está sendo tratado. Poupa o admin de mudar o status à mão.
  await supabaseAdmin.from('bug_reports')
    .update({ status: 'em_andamento' }).eq('id', bugId).eq('status', 'aberto');

  // ── 2. A campainha (opcional).
  if (!b.phone) {
    return NextResponse.json({
      ok: true, para: b.nome || 'cliente', avisado: false,
      aviso: 'Resposta publicada no painel. Sem WhatsApp cadastrado, o cliente vê pela notificação ao abrir a Sora.',
    });
  }

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({
      ok: true, para: b.nome || b.phone, avisado: false,
      aviso: 'Resposta publicada, mas o aviso por WhatsApp não saiu (falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel).',
    });
  }

  try {
    const r = await fetch(`${base}/api/admin/responder-relato`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      // `texto` vai só pra rota recusar chamada vazia — o backend NÃO o envia.
      body: JSON.stringify({ phone: b.phone, nome: b.nome || '', texto: texto.trim() }),
    });
    const data = await r.json().catch(() => ({}));

    // ⚠️ Falha aqui NÃO é falha da resposta: ela já está no painel e a
    // notificação na tela já vai aparecer. Dizer "erro" faria o admin
    // reescrever tudo e a conversa sairia duplicada.
    if (!r.ok || data?.ok === false) {
      const motivo = data?.erro || `falha ${r.status}`;
      return NextResponse.json({
        ok: true, para: b.nome || b.phone, avisado: false,
        aviso: `Resposta publicada no painel, mas o aviso por WhatsApp não foi entregue (${motivo}). O cliente ainda vê pela notificação.`,
      });
    }

    return NextResponse.json({ ok: true, para: b.nome || b.phone, avisado: true });
  } catch (e: unknown) {
    return NextResponse.json({
      ok: true, para: b.nome || b.phone, avisado: false,
      aviso: `Resposta publicada, mas o aviso por WhatsApp falhou (${e instanceof Error ? e.message : 'erro'}).`,
    });
  }
}
