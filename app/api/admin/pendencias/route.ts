import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';
import { situacaoDoChamado, type MsgResumo } from '@/lib/chamados-admin';

export const dynamic = 'force-dynamic';

// =============================================================================
// O que espera o ADMIN — alimenta o selo do item "Admin" na sidebar.
//
// ⚠️ LEVE DE PROPÓSITO: a sidebar consulta a cada 2 min enquanto o painel está
// aberto (só pra quem é admin). Duas consultas pequenas, sem texto de mensagem.
//
// O número vermelho é `respostas`: chamado aberto em que o CLIENTE respondeu e
// você ainda não abriu — o pedido do dono ("quero saber quando um cliente
// respondeu"). O aviso por WhatsApp pro suporte que já existia é texto livre,
// e fora da janela de 24h a Meta não o entrega; este selo não depende disso.
// `semResposta` (chamado novo que ninguém respondeu) vai à parte, pro topo do
// admin — misturar os dois deixaria o selo aceso o tempo todo.
// =============================================================================
export async function GET() {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  try {
    const { data: abertos, error } = await supabaseAdmin.from('bug_reports')
      .select('id, status, tipo, created_at').neq('status', 'resolvido').limit(500);
    if (error) throw error;
    const ids = (abertos || []).map((b) => b.id);
    const porBug = new Map<string, MsgResumo[]>();
    if (ids.length) {
      const { data: msgs } = await supabaseAdmin.from('bug_mensagens')
        .select('bug_id, autor, lida_em, created_at').in('bug_id', ids);
      for (const m of msgs || []) porBug.set(m.bug_id, [...(porBug.get(m.bug_id) || []), m]);
    }
    let respostas = 0, semResposta = 0;
    for (const b of abertos || []) {
      const c = situacaoDoChamado(b, porBug.get(b.id) || []);
      if (c.nao_lidas > 0) respostas++;
      else if (c.situacao === 'precisa_resposta') semResposta++;
    }
    return NextResponse.json({ respostas, semResposta });
  } catch (e: unknown) {
    return NextResponse.json({ respostas: 0, semResposta: 0, erro: e instanceof Error ? e.message : 'falhou' });
  }
}
