import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// =============================================================================
// Visão de Open Finance do admin, numa chamada só.
//
// Responde: EM QUEM ESTOU GASTANDO (Polp) E QUEM ESTÁ PAGANDO (Stripe).
//
// ⚠️ A UNIDADE É O CLIENTE DONO DA CONEXÃO (`of_conexoes.user_id`), em todas
// as telas. Antes o resumo do topo contava GRUPOS e a aba Usuários casava por
// `grupo_ativo` — medido em 10/11/2026: 73 conexões de 41 clientes, mas o
// filtro "Conectados" mostrava 34 (4 donos com o grupo ativo em outro grupo,
// 2 membros de grupo contados como se tivessem conectado, 5 cortados pelo
// limite de 300 da lista). É a mesma regra da franquia: conexão é do PLANO
// DA PESSOA, não do grupo (CLAUDE.md, "conexão de outro membro não conta").
//
// ⚠️ "Além do direito" NÃO é recalculado aqui: lê `of_excedente_desde`, que o
// JOB 1R grava a partir de `acessoOpenFinance` (a regra canônica). Recalcular
// a franquia no painel criaria uma segunda verdade sobre quem pode conectar.
// =============================================================================

type Conexao = {
  id: string; user_id: string; grupo_id: string | null; instituicao: string | null;
  status: string | null; ultima_sync: string | null; created_at: string | null;
  external_id: string | null; empresarial?: boolean | null;
};

/** 1º dia do mês corrente no fuso de SP — a Polp fatura por ciclo mensal. */
function inicioDoMesSP(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date());
  const y = p.find((x) => x.type === 'year')!.value;
  const m = p.find((x) => x.type === 'month')!.value;
  return `${y}-${m}-01T03:00:00.000Z`;   // 00:00 em SP
}

/** Último acesso de cada login. Paginado: `listUsers` devolve no máximo 1000. */
async function ultimosAcessos(): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>();
  try {
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) break;
      for (const u of data.users) mapa.set(u.id, u.last_sign_in_at || null);
      if (data.users.length < 1000) break;
    }
  } catch { /* sem o dado, a coluna fica vazia — nada mais depende dele */ }
  return mapa;
}

const maisRecente = (a: string | null, b: string | null) =>
  !a ? b : !b ? a : (Date.parse(a) >= Date.parse(b) ? a : b);

/**
 * Último USO de verdade, além do login.
 *
 * ⚠️ `last_sign_in_at` só muda quando a pessoa DIGITA A SENHA: quem fica logado
 * no app aparecia "há 68 dias" usando a Sora (caso real, nov/2026). E a última
 * transação não serve sozinha — a do Open Finance é o BANCO sincronizando.
 * Sinais (migration 194, tolerante: sem ela sobra o login):
 *   · a última renovação de SESSÃO (app aberto renova o token de hora em hora);
 *   · o último lançamento feito PELA PESSOA (painel ou WhatsApp);
 *   · `users.ultimo_acesso_em` (abriu o painel, gravado 1×/dia).
 * ⚠️ Por RPC, não por select em `transacoes`: o select parava no teto de 1.000
 * linhas do PostgREST mesmo pedindo 5.000.
 */
async function ultimosUsos(ids: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const anota = (id: string, quando?: string | null) => {
    if (!id || !quando) return;
    const atual = mapa.get(id);
    if (!atual || Date.parse(quando) > Date.parse(atual)) mapa.set(id, quando);
  };
  if (!ids.length) return mapa;
  try {
    const { data, error } = await supabaseAdmin.rpc('admin_ultimo_uso', { ids });
    if (!error) for (const r of (data || []) as any[]) { anota(r.user_id, r.ultima_sessao); anota(r.user_id, r.ultimo_lancamento); }
  } catch { /* migration 194 pendente */ }
  try {
    const { data } = await supabaseAdmin.from('users').select('id, ultimo_acesso_em').in('id', ids);
    for (const u of (data || []) as any[]) anota(u.id, u.ultimo_acesso_em);
  } catch { /* migration 194 pendente */ }
  return mapa;
}

export async function GET() {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  // ── Conexões vivas (empresarial é a 188: pedido à parte, tolerante) ───────
  let { data: conexoes, error: eCx }: { data: any[] | null; error: any } = await supabaseAdmin
    .from('of_conexoes')
    .select('id, user_id, grupo_id, instituicao, status, ultima_sync, created_at, external_id, empresarial');
  if (eCx) {
    ({ data: conexoes, error: eCx } = await supabaseAdmin
      .from('of_conexoes')
      .select('id, user_id, grupo_id, instituicao, status, ultima_sync, created_at, external_id'));
  }
  if (eCx) return NextResponse.json({ erro: `of_conexoes: ${eCx.message}` }, { status: 500 });
  const vivas = (conexoes || []) as Conexao[];

  // ── Quem importa: quem tem conexão OU quem paga por uma ───────────────────
  // ⚠️ O segundo grupo é o que revela a cobrança órfã. Buscar só quem tem
  // conexão esconderia exatamente o caso que esta tela existe pra achar.
  const idsComConexao = [...new Set(vivas.map((c) => c.user_id).filter(Boolean))];
  const COLS = 'id, email, name, plano, vitalicio, of_conexoes_pagas, of_assinatura_id, of_assinatura_intervalo, assinatura_cancelada';
  const { data: pagantes } = await supabaseAdmin.from('users').select('id').gt('of_conexoes_pagas', 0);
  const todosIds = [...new Set([...idsComConexao, ...(pagantes || []).map((u) => u.id)])];

  let usuariosRaw: any[] = [];
  if (todosIds.length) {
    // `of_excedente_desde` é a 179 — sem ela, refaz sem a coluna.
    // (`ultimo_acesso_em`, a 194, vem em consulta própria logo abaixo.)
    const r1 = await supabaseAdmin.from('users')
      .select(`${COLS}, of_excedente_desde`).in('id', todosIds);
    let data: any[] | null = r1.data;
    const error = r1.error;
    if (error) ({ data } = (await supabaseAdmin.from('users').select(COLS).in('id', todosIds)) as any);
    usuariosRaw = data || [];
  }
  const acessos = await ultimosAcessos();
  const usos = await ultimosUsos(todosIds);

  const porUser = new Map<string, Conexao[]>();
  for (const c of vivas) {
    if (!c.user_id) continue;
    porUser.set(c.user_id, [...(porUser.get(c.user_id) || []), c]);
  }

  const agora = Date.now();
  const usuarios = usuariosRaw.map((u) => {
    const cx = porUser.get(u.id) || [];
    const pagas = Number(u.of_conexoes_pagas) || 0;
    // ⚠️ O MAIS RECENTE dos sinais de uso — o login sozinho mentia (ver ultimosUsos).
    const ultimoAcesso = maisRecente(acessos.get(u.id) ?? null, usos.get(u.id) ?? null);
    const diasSemAcesso = ultimoAcesso ? Math.floor((agora - Date.parse(ultimoAcesso)) / 864e5) : null;
    // Mesmo banco 2× no mesmo cliente: quase sempre reconexão que ficou dupla
    // (cada uma é cobrada). PF + PJ do mesmo banco NÃO conta — é o caso legítimo.
    const chaves = cx.map((c) => `${(c.instituicao || '').toLowerCase()}|${c.empresarial ? 'pj' : 'pf'}`);
    const repetidas = chaves.filter((k, i) => chaves.indexOf(k) !== i).length;
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
      excedenteDesde: (u.of_excedente_desde as string | null) || null,
      ultimoAcesso,
      diasSemAcesso,
      repetidas,
      instituicoes: cx
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map((c) => ({
          id: c.id,
          nome: c.instituicao || 'Banco',
          status: c.status || '?',
          ultimaSync: c.ultima_sync,
          criadaEm: c.created_at,
          empresarial: !!c.empresarial,
        })),
    };
  }).sort((a, b) => {
    if (a.cobrancaOrfa !== b.cobrancaOrfa) return a.cobrancaOrfa ? -1 : 1;  // ação primeiro
    if (b.conexoes !== a.conexoes) return b.conexoes - a.conexoes;
    return (a.email || '').localeCompare(b.email || '');
  });

  // ── Desconexões ───────────────────────────────────────────────────────────
  // ⚠️ O "total do ciclo" antigo somava as conexões vivas com TODO o histórico
  // (e o histórico vinha cortado em 100 — eram 134). A Polp fatura por ciclo:
  // o que entra na conta deste mês são as vivas + as que morreram ESTE MÊS.
  const inicioMes = inicioDoMesSP();
  let historico: any[] = [];
  let desconectadasTotal = 0, desconectadasMes = 0;
  try {
    const [lista, total, mes] = await Promise.all([
      supabaseAdmin.from('of_conexoes_historico')
        .select('instituicao, status_final, criada_em, desconectada_em, motivo, user_id')
        .order('desconectada_em', { ascending: false }).limit(100),
      supabaseAdmin.from('of_conexoes_historico').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('of_conexoes_historico').select('id', { count: 'exact', head: true })
        .gte('desconectada_em', inicioMes),
    ]);
    historico = lista.data || [];
    desconectadasTotal = total.count || 0;
    desconectadasMes = mes.count || 0;
  } catch { /* migration 129 pendente — o resto da tela continua */ }

  const idsHist = [...new Set(historico.map((d) => d.user_id).filter(Boolean))];
  const emailPorId = new Map<string, string>();
  if (idsHist.length) {
    const { data } = await supabaseAdmin.from('users').select('id, email').in('id', idsHist);
    for (const u of data || []) emailPorId.set(u.id, u.email || '');
  }

  const porInstituicao: Record<string, number> = {};
  for (const c of vivas) {
    const k = c.instituicao || 'Banco';
    porInstituicao[k] = (porInstituicao[k] || 0) + 1;
  }
  const porStatus: Record<string, number> = {};
  for (const c of vivas) porStatus[c.status || '?'] = (porStatus[c.status || '?'] || 0) + 1;

  const totalPagas = usuarios.reduce((s, u) => s + u.pagas, 0);
  // Receita mensalizada: o anual (R$60) vira R$5/mês pra somar com o mensal.
  const receitaMes = usuarios.reduce((s, u) => s + u.pagas * (u.intervalo === 'anual' ? 5 : 6), 0);

  return NextResponse.json({
    resumo: {
      conexoesAtivas: vivas.length,
      clientesComConexao: idsComConexao.length,
      comProblema: vivas.filter((c) => c.status !== 'updated').length,
      desconectadasTotal,
      desconectadasMes,
      conexoesPagas: totalPagas,
      receitaMes,
      cobrancasOrfas: usuarios.filter((u) => u.cobrancaOrfa).length,
      alemDoDireito: usuarios.filter((u) => u.excedenteDesde && u.conexoes > 0).length,
      semAcesso30: usuarios.filter((u) => u.conexoes > 0 && (u.diasSemAcesso ?? 0) >= 30).length,
      repetidas: usuarios.reduce((s, u) => s + u.repetidas, 0),
      // O que a Polp cobra NESTE ciclo, se a conta deles for por consentimento
      // que existiu no mês: as vivas + as que saíram desde o dia 1.
      totalCicloEstimado: vivas.length + desconectadasMes,
      inicioCiclo: inicioMes,
      porStatus,
      porInstituicao,
    },
    usuarios,
    historico: historico.map((d) => ({
      instituicao: d.instituicao || 'Banco',
      statusFinal: d.status_final || null,
      criadaEm: d.criada_em,
      desconectadaEm: d.desconectada_em,
      motivo: d.motivo || null,
      email: emailPorId.get(d.user_id) || null,
    })),
  });
}
