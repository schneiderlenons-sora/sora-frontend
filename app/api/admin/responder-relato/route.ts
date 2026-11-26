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
// Agora o PAINEL é o canal: grava a resposta em `bug_mensagens` e o cliente
// a lê no painel (com o selo de resposta nova). Desde 26/11/2026 NÃO há mais
// aviso pelo WhatsApp — ver o passo 2 abaixo.
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

  // ── 2. SEM AVISO NO WHATSAPP (decisão do dono, 26/11/2026). O cliente vê a
  // resposta pela notificação do painel (selo no botão Ajuda e no "Menu" do
  // celular — lib/useChamadosNaoLidos.ts). A "campainha" pelo WhatsApp custava
  // uma mensagem paga na Meta a cada resposta e, quando falhava, mostrava ao
  // admin um aviso de erro numa resposta que tinha dado certo. A rota do
  // backend (/api/admin/responder-relato) fica lá, sem uso.
  return NextResponse.json({ ok: true, para: b.nome || b.phone || 'cliente' });
}
