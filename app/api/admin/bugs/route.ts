import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';
import { situacaoDoChamado, ordenarChamados, type MsgResumo } from '@/lib/chamados-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  // 'problema' | 'melhoria' | 'duvida' | lista separada por vírgula | null.
  // A aba Bugs pede 'problema,duvida': a dúvida (migration 191) é atendida
  // no mesmo fluxo do relato, e sem isto ela não apareceria em aba nenhuma.
  const tipo = new URL(req.url).searchParams.get('tipo');
  const tipos = (tipo || '').split(',').map((t) => t.trim()).filter(Boolean);

  // ⚠️ ABERTOS TODOS + os 100 resolvidos mais recentes. Antes era "os 200
  // mais recentes", e com o tempo um chamado aberto antigo seria empurrado pra
  // fora da lista pelos resolvidos novos — sumindo sem ter sido atendido.
  const abertos = () => supabaseAdmin.from('bug_reports').select('*').neq('status', 'resolvido')
    .order('created_at', { ascending: false }).limit(500);
  const resolvidos = () => supabaseAdmin.from('bug_reports').select('*').eq('status', 'resolvido')
    .order('created_at', { ascending: false }).limit(100);
  const ler = async (q: () => any) => {
    let r = tipos.length ? await q().in('tipo', tipos) : await q();
    // Coluna `tipo` pode não existir ainda (pré-migration 053) → cai sem filtro.
    if (r.error && tipo) r = await q();
    return r as { data: any[] | null; error: { message: string } | null };
  };
  const [a, r] = await Promise.all([ler(abertos), ler(resolvidos)]);
  if (a.error) return NextResponse.json({ bugs: [], erro: a.error.message });
  const lista = [...(a.data || []), ...(r.data || [])];

  // Conversa resumida dos ABERTOS (resolvido teve a conversa apagada). Só os
  // campos que decidem a situação — o texto vem sob demanda, ao abrir.
  const porBug = new Map<string, MsgResumo[]>();
  const idsAbertos = (a.data || []).map((b) => b.id);
  if (idsAbertos.length) {
    try {
      const { data: msgs } = await supabaseAdmin.from('bug_mensagens')
        .select('bug_id, autor, lida_em, created_at').in('bug_id', idsAbertos);
      for (const m of msgs || []) porBug.set(m.bug_id, [...(porBug.get(m.bug_id) || []), m]);
    } catch { /* migration 143 pendente — fica sem situação de conversa */ }
  }
  const bugs = ordenarChamados(lista.map((b) => situacaoDoChamado(b, porBug.get(b.id) || [])));
  return NextResponse.json({ bugs });
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
