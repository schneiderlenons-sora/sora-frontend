import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const tipo = new URL(req.url).searchParams.get('tipo'); // 'problema' | 'melhoria' | null

  const base = () => supabaseAdmin.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(200);
  let { data, error } = tipo ? await base().eq('tipo', tipo) : await base();
  // Coluna `tipo` pode não existir ainda (pré-migration 053) → cai sem filtro.
  if (error && tipo) ({ data, error } = await base());
  if (error) return NextResponse.json({ bugs: [], erro: error.message });
  return NextResponse.json({ bugs: data || [] });
}

export async function PATCH(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const { id, status } = await req.json().catch(() => ({}));
  if (!id || !['aberto', 'em_andamento', 'resolvido'].includes(status)) {
    return NextResponse.json({ erro: 'Dados inválidos' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('bug_reports').update({ status }).eq('id', id);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // ── ENCERROU → LIMPA A CONVERSA ──────────────────────────────────────────
  //
  // Pedido do dono: chamado finalizado tem a conversa apagada. E vai junto o
  // ANEXO — print de bug quase sempre mostra saldo e extrato, e guardar isso
  // num bucket depois do problema resolvido é reter dado sensível sem motivo.
  //
  // ⚠️ O RELATO DE ABERTURA (`bug_reports.mensagem`) FICA. É ele que sustenta
  // o histórico do que já foi reportado e os contadores do admin; apagar a
  // linha inteira faria o bug desaparecer como se nunca tivesse existido.
  if (status === 'resolvido') {
    try {
      await supabaseAdmin.from('bug_mensagens').delete().eq('bug_id', id);
      // Anexos: lista a "pasta" do chamado e remove tudo de uma vez.
      const { data: arqs } = await supabaseAdmin.storage.from('bug-anexos').list(String(id));
      const caminhos = (arqs || []).map((f) => `${id}/${f.name}`);
      if (caminhos.length) await supabaseAdmin.storage.from('bug-anexos').remove(caminhos);
      await supabaseAdmin.from('bug_reports').update({ imagem_path: null }).eq('id', id);
    } catch { /* migration 143 pendente — o status já foi salvo */ }
  }

  return NextResponse.json({ ok: true });
}
