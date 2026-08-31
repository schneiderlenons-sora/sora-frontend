import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// =============================================================================
// Visão de Open Finance do admin, numa chamada só.
//
// Junta as três fontes que antes só existiam soltas (tabela, Stripe e Polp) e
// responde a pergunta que importa: EM QUEM ESTOU GASTANDO E QUEM ESTÁ PAGANDO.
//
// ⚠️ O item mais importante daqui é `cobrancaOrfa`: quem PAGA conexão e não tem
// nenhuma conectada. Isso acontece porque "Desconectar" remove o banco e NÃO
// cancela a assinatura do Stripe — medido, 2 clientes nessa situação. É a única
// lista da tela que pede AÇÃO, então vem em primeiro lugar na UI.
//
// A conta da Polp é POR CONSENTIMENTO no ciclo, não por conexão viva no fim do
// mês — por isso `desconectadas` entra na foto: uma conexão que viveu 20 dias e
// morreu ainda está na fatura daquele mês. A reconciliação fina (o que existe lá
// e não aqui) tem endpoint próprio: /api/admin/of-consents.
// =============================================================================

type Conexao = {
  user_id: string; instituicao: string | null; status: string | null;
  ultima_sync: string | null; created_at: string | null; external_id: string | null;
};

export async function GET() {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  // ── Conexões vivas ────────────────────────────────────────────────────────
  const { data: conexoes, error: eCx } = await supabaseAdmin
    .from('of_conexoes')
    .select('user_id, instituicao, status, ultima_sync, created_at, external_id');
  if (eCx) {
    return NextResponse.json({ erro: `of_conexoes: ${eCx.message}` }, { status: 500 });
  }
  const vivas = (conexoes || []) as Conexao[];

  // ── Usuários que importam: quem tem conexão OU quem paga por uma ──────────
  // ⚠️ O segundo grupo é o que revela a cobrança órfã. Buscar só quem tem
  // conexão esconderia exatamente o caso que esta tela existe pra achar.
  const idsComConexao = [...new Set(vivas.map((c) => c.user_id).filter(Boolean))];

  const { data: pagantes } = await supabaseAdmin
    .from('users')
    .select('id, email, name, plano, vitalicio, of_conexoes_pagas, of_assinatura_id, of_assinatura_intervalo, assinatura_cancelada')
    .gt('of_conexoes_pagas', 0);

  const idsPagantes = (pagantes || []).map((u) => u.id);
  const todosIds = [...new Set([...idsComConexao, ...idsPagantes])];

  let usuariosRaw: any[] = [];
  if (todosIds.length) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, email, name, plano, vitalicio, of_conexoes_pagas, of_assinatura_id, of_assinatura_intervalo, assinatura_cancelada')
      .in('id', todosIds);
    usuariosRaw = data || [];
  }

  const porUser = new Map<string, Conexao[]>();
  for (const c of vivas) {
    if (!c.user_id) continue;
    porUser.set(c.user_id, [...(porUser.get(c.user_id) || []), c]);
  }

  const usuarios = usuariosRaw.map((u) => {
    const cx = porUser.get(u.id) || [];
    const pagas = Number(u.of_conexoes_pagas) || 0;
    return {
      id: u.id,
      email: u.email as string | null,
      nome: (u.name as string | null) || null,
      plano: (u.plano as string) || 'inativo',
      vitalicio: !!u.vitalicio,
      assinaturaCancelada: !!u.assinatura_cancelada,
      conexoes: cx.length,
      pagas,
      intervalo: (u.of_assinatura_intervalo as string | null) || null,
      temAssinatura: !!u.of_assinatura_id,
      // ⚠️ A bandeira acionável: paga e não usa. Só conta quando existe
      // assinatura de verdade no Stripe — sem `of_assinatura_id` não há o que
      // cancelar, e mostrar um botão que não faz nada é pior que não mostrar.
      cobrancaOrfa: pagas > 0 && cx.length === 0 && !!u.of_assinatura_id,
      // Franquia usada além do que paga (assinante gastando o incluso no plano).
      instituicoes: cx.map((c) => ({
        nome: c.instituicao || 'Banco',
        status: c.status || '?',
        ultimaSync: c.ultima_sync,
        externalId: c.external_id,
      })),
    };
  }).sort((a, b) => {
    if (a.cobrancaOrfa !== b.cobrancaOrfa) return a.cobrancaOrfa ? -1 : 1;  // ação primeiro
    if (b.conexoes !== a.conexoes) return b.conexoes - a.conexoes;
    return (a.email || '').localeCompare(b.email || '');
  });

  // ── Desconexões (entram na fatura do ciclo em que morreram) ───────────────
  let desconectadas: any[] = [];
  try {
    const { data } = await supabaseAdmin
      .from('of_conexoes_historico')
      .select('instituicao, status_final, criada_em, desconectada_em, motivo, user_id')
      .order('desconectada_em', { ascending: false })
      .limit(100);
    desconectadas = data || [];
  } catch { /* migration 129 pendente — o resto da tela continua */ }

  // E-mail de quem desconectou, pra lista não ficar anônima.
  const idsHist = [...new Set(desconectadas.map((d) => d.user_id).filter(Boolean))];
  const emailPorId = new Map<string, string>();
  if (idsHist.length) {
    const { data } = await supabaseAdmin.from('users').select('id, email').in('id', idsHist);
    for (const u of data || []) emailPorId.set(u.id, u.email || '');
  }
  const historico = desconectadas.map((d) => ({
    instituicao: d.instituicao || 'Banco',
    statusFinal: d.status_final || null,
    criadaEm: d.criada_em,
    desconectadaEm: d.desconectada_em,
    motivo: d.motivo || null,
    email: emailPorId.get(d.user_id) || null,
  }));

  // ── Totais ────────────────────────────────────────────────────────────────
  const porStatus: Record<string, number> = {};
  for (const c of vivas) porStatus[c.status || '?'] = (porStatus[c.status || '?'] || 0) + 1;

  const porInstituicao: Record<string, number> = {};
  for (const c of vivas) {
    const k = c.instituicao || 'Banco';
    porInstituicao[k] = (porInstituicao[k] || 0) + 1;
  }

  const totalPagas = usuarios.reduce((s, u) => s + u.pagas, 0);
  // Receita mensalizada: o anual (R$60) vira R$5/mês pra somar com o mensal.
  const receitaMes = usuarios.reduce(
    (s, u) => s + u.pagas * (u.intervalo === 'anual' ? 5 : 6), 0);
  const orfas = usuarios.filter((u) => u.cobrancaOrfa);

  return NextResponse.json({
    resumo: {
      conexoesAtivas: vivas.length,
      usuariosComConexao: idsComConexao.length,
      desconectadas: historico.length,
      conexoesPagas: totalPagas,
      receitaMes,
      cobrancasOrfas: orfas.length,
      // O que a Polp cobraria se contasse tudo que existiu: vivas + mortas.
      // É o número que costuma explicar a diferença contra o painel deles.
      totalCicloEstimado: vivas.length + historico.length,
      porStatus,
      porInstituicao,
    },
    usuarios,
    historico,
  });
}
