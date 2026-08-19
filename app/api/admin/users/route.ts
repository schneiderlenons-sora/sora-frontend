import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').replace(/[,()*%]/g, '').trim(); // sanitiza p/ o .or
  const filter = searchParams.get('filter') || 'todos';

  // `recuperacao_pendente_em` + `vitalicio_intent` estavam de fora: a marcação de
  // pagamento recusado existia no banco desde a 047, mas nunca chegava na tela —
  // não dava pra ver (nem filtrar) quem tentou comprar e falhou.
  const BASE = 'id,name,email,phone,grupo_ativo,plano,plano_intervalo,plano_valido_ate,vitalicio,vitalicio_em,stripe_customer_id,onboarding_completed,welcomed_at,created_at,recuperacao_signup_em,recuperacao_enviada_em,recuperacao_pendente_em,vitalicio_intent';
  // Colunas da migration 074 (exclusão do MRR) — só somam se já existirem.
  const COM_MRR = `${BASE},mrr_excluir,assinatura_cancelada`;
  // Motivo da recusa é a migration 102 — pedido só quando ela já rodou.
  const COM_MOTIVO = `${COM_MRR},recuperacao_motivo`;
  // Conexão de banco avulsa (Open Finance): quantas ele paga e em que intervalo.
  // Última camada da degradação — se estas não existirem, o resto continua.
  const COM_OF = `${COM_MOTIVO},of_conexoes_pagas,of_assinatura_intervalo`;

  // `temMrr` = as colunas da 074 (mrr_excluir/assinatura_cancelada) existem.
  // O filtro "recorrentes" depende delas; sem a migration, cai numa versão
  // aproximada (só plano + não-vitalício).
  const build = (cols: string, temMrr: boolean) => {
    let query = supabaseAdmin.from('users').select(cols)
      .order('created_at', { ascending: false }).limit(300);
    if (filter === 'ativos')        query = query.neq('plano', 'inativo');
    else if (filter === 'inativos') query = query.eq('plano', 'inativo');
    else if (filter === 'pagou_inativo') query = query.eq('plano', 'inativo').not('stripe_customer_id', 'is', null);
    // Novos: cancelou (teve assinatura) x não concluiu (nunca assinou) x recuperados.
    else if (filter === 'cancelados')    query = query.eq('plano', 'inativo').not('plano_intervalo', 'is', null);
    else if (filter === 'nao_concluido') query = query.eq('plano', 'inativo').is('plano_intervalo', null);
    else if (filter === 'recuperados')   query = query.neq('plano', 'inativo')
      .or('recuperacao_signup_em.not.is.null,recuperacao_enviada_em.not.is.null');
    // Venda do vitalício que não fechou. Duas fontes, porque a marcação de
    // recusa (`recuperacao_pendente_em`) só passou a ser confiável agora:
    //   · recuperacao_pendente_em → o gateway recusou (temos o motivo);
    //   · vitalicio_intent        → chegou a montar o pagamento e não concluiu
    //     (recusa antiga não registrada, Pix não pago ou desistência).
    // Quem já virou vitalício sai: comprou depois, venda recuperada.
    else if (filter === 'pagamento_falhou') {
      query = query.not('vitalicio', 'is', true)
        .or('recuperacao_pendente_em.not.is.null,vitalicio_intent.not.is.null');
    }
    // Vitalícios: pagamento único (não recorrem).
    else if (filter === 'vitalicios')    query = query.eq('vitalicio', true);
    // Open Finance: contratou conexão de banco avulsa (R$ 6/mês por banco).
    // Não é o mesmo que "usa Open Finance" — o Básico/Premium tem franquia e
    // não aparece aqui. Este filtro é a RECEITA extra.
    else if (filter === 'open_finance') query = query.gt('of_conexoes_pagas', 0);
    // 'of_conectado' NÃO entra aqui: `of_conexoes` é por GRUPO, não por user,
    // e o Supabase não filtra por tabela irmã neste select. É aplicado depois
    // de enriquecer (ver abaixo) — o limite de 300 vale pra busca, e quem tem
    // banco conectado hoje são 17 grupos, então não há risco de cortar.
    // Anuais: assinatura anual ATIVA (pré-paga, fora do MRR mensal).
    else if (filter === 'anuais')        query = query.eq('plano_intervalo', 'anual').neq('plano', 'inativo');
    // Recorrentes: pagante ATIVO que não é vitalício e não cancelou — quem
    // sustenta o MRR. `not(..., is, true)` casa false E null.
    else if (filter === 'recorrentes') {
      query = query.in('plano', ['basico', 'premium', 'black']).not('vitalicio', 'is', true);
      if (temMrr) query = query.not('assinatura_cancelada', 'is', true).not('mrr_excluir', 'is', true);
    }
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    return query;
  };

  // Degrada por migration: OF → 102 (motivo) → 074 (MRR) → base.
  let { data, error } = await build(COM_OF, true);
  if (error) ({ data, error } = await build(COM_MOTIVO, true));
  if (error) ({ data, error } = await build(COM_MRR, true));
  if (error) ({ data, error } = await build(BASE, false));
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  // ── BANCOS CONECTADOS, por usuário ──────────────────────────────────────
  //
  // ⚠️ CONECTAR ≠ PAGAR. Quem tem assinatura recorrente conecta pela FRANQUIA
  // do plano (Básico 1, Premium 3) e não aparece em `of_conexoes_pagas` —
  // então, olhando só a receita, metade de quem usa Open Finance ficava
  // invisível no admin (medido: 9 dos 17 grupos conectados são de franquia).
  //
  // O casamento é por `grupo_ativo`, porque a conexão é do GRUPO: na gestão
  // compartilhada o casal conecta uma vez e os dois enxergam.
  let lista = (data || []) as any[];
  try {
    const grupos = [...new Set(lista.map((u) => u.grupo_ativo).filter(Boolean))];
    if (grupos.length) {
      const { data: conexoes } = await supabaseAdmin
        .from('of_conexoes').select('grupo_id, status, instituicao').in('grupo_id', grupos);
      const porGrupo: Record<string, { total: number; ok: number; bancos: string[] }> = {};
      for (const c of conexoes || []) {
        const g = String(c.grupo_id);
        porGrupo[g] ||= { total: 0, ok: 0, bancos: [] };
        porGrupo[g].total++;
        if (c.status === 'updated') porGrupo[g].ok++;
        if (c.instituicao) porGrupo[g].bancos.push(String(c.instituicao));
      }
      lista = lista.map((u) => {
        const c = u.grupo_ativo ? porGrupo[String(u.grupo_ativo)] : null;
        return {
          ...u,
          of_conectadas: c?.total || 0,
          // Fora de 'updated' = o banco parou de atualizar e o cliente precisa
          // reconectar. Ele sente como "a Sora travou" e não sabe o motivo.
          of_conectadas_ok: c?.ok || 0,
          of_bancos: c?.bancos || [],
        };
      });
    }
  } catch { /* tabela of_conexoes pode não existir — a lista segue sem o dado */ }

  if (filter === 'of_conectado') lista = lista.filter((u) => (u.of_conectadas || 0) > 0);

  return NextResponse.json({ users: lista });
}
