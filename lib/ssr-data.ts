import { supabaseAdmin } from '@/lib/supabase-admin';

// =============================================================================
// Leitura DIRETA no Supabase para o SSR — corta o hop lento do Render no
// primeiro paint (medido: Render ~624ms × Supabase direto ~58ms de iad1).
//
// ⚠️ FONTE CANÔNICA = o backend Express. Estas funções são PORTES FIÉIS de:
//   - sora-backend/src/routes/dashboard.js       (listarTransacoes, queries)
//   - sora-backend/src/services/resumoTransacoes.js (calcularResumo, ehTransferencia)
// Se a regra mudar lá (o que conta como gasto/transferência, joins, colunas),
// ESPELHAR aqui — senão o número do SSR diverge do que o cliente revalida pelo
// backend (pulo na tela). O cliente continua revalidando pelo backend; isto é
// só o valor inicial pintado no servidor. Ver memória project-ssr-dados-diretos.
// =============================================================================

// Primeiro dia do mês seguinte (YYYY-MM-01) — limite exclusivo seguro.
function proximoMesPrimeiroDia(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// Transferência / quitação de dívida (não é consumo nem receita).
function ehTransferencia(r: any): boolean {
  return r.transferencia === true || r.categoria === 'Fatura cartão' || r.categoria === 'Transferências';
}

// Porte fiel de services/resumoTransacoes.calcularResumo.
export async function resumoDireto(grupoId: string, mes: string, criadoPorId?: string) {
  let q = supabaseAdmin.from('transacoes')
    .select('tipo, categoria, valor, criado_por, transferencia')
    .eq('grupo_id', grupoId)
    .gte('data', `${mes}-01`).lt('data', proximoMesPrimeiroDia(mes));
  if (criadoPorId) q = q.eq('criado_por', criadoPorId);
  const { data: rows } = await q;

  let receitas = 0, gastos = 0;
  const porCategoria: Record<string, number> = {};
  const porCategoriaRec: Record<string, number> = {};
  const porMembro: Record<string, { gastos: number; receitas: number }> = {};
  const bumpMembro = (id: string | null, campo: 'gastos' | 'receitas', v: number) => {
    if (!id) return;
    if (!porMembro[id]) porMembro[id] = { gastos: 0, receitas: 0 };
    porMembro[id][campo] += v;
  };
  (rows || []).forEach((r: any) => {
    if (ehTransferencia(r)) return;
    if (r.tipo === 'Gasto') {
      gastos += r.valor;
      porCategoria[r.categoria] = (porCategoria[r.categoria] || 0) + r.valor;
      bumpMembro(r.criado_por, 'gastos', r.valor);
    } else {
      receitas += r.valor;
      porCategoriaRec[r.categoria || 'Outros'] = (porCategoriaRec[r.categoria || 'Outros'] || 0) + r.valor;
      bumpMembro(r.criado_por, 'receitas', r.valor);
    }
  });

  const ids = Object.keys(porMembro);
  const nomes: Record<string, { name: string; phone: string | null }> = {};
  if (ids.length) {
    const { data: usrs } = await supabaseAdmin.from('users').select('id, name, phone').in('id', ids);
    (usrs || []).forEach((u: any) => { nomes[u.id] = { name: u.name, phone: u.phone }; });
  }

  return {
    receitas, gastos,
    saldo: receitas - gastos,
    por_categoria: Object.entries(porCategoria)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total),
    por_categoria_receitas: Object.entries(porCategoriaRec)
      .map(([categoria, total]) => ({ categoria, total }))
      .sort((a, b) => b.total - a.total),
    por_membro: Object.entries(porMembro)
      .map(([user_id, v]) => ({
        user_id,
        name: nomes[user_id]?.name || 'Desconhecido',
        phone: nomes[user_id]?.phone,
        gastos: v.gastos,
        receitas: v.receitas,
        saldo: v.receitas - v.gastos,
        total: v.gastos,
      }))
      .sort((a, b) => b.gastos - a.gastos),
  };
}

// Porte fiel de dashboard.listarTransacoes (com o mesmo fallback de embed).
export async function transacoesDireto(
  grupoId: string,
  { mes, tipo, limit, ate }: { mes?: string; tipo?: string; limit: number; ate?: string },
) {
  const aplicar = (query: any) => {
    let q = query.eq('grupo_id', grupoId).order('data', { ascending: false }).range(0, Number(limit) - 1);
    if (mes)  q = q.gte('data', `${mes}-01`).lt('data', proximoMesPrimeiroDia(mes));
    if (ate)  q = q.lte('data', ate);
    if (tipo) q = q.eq('tipo', tipo);
    return q;
  };

  let { data, count, error } = await aplicar(
    supabaseAdmin.from('transacoes')
      .select('*, criador:users!transacoes_criado_por_fkey(id, name, phone, avatar_url, avatar_preset, avatar_cor)', { count: 'exact' }),
  );
  if (error) {
    let r = await aplicar(
      supabaseAdmin.from('transacoes')
        .select('*, criador:users!transacoes_criado_por_fkey(id, name, phone, avatar_url)', { count: 'exact' }),
    );
    if (r.error) {
      r = await aplicar(supabaseAdmin.from('transacoes').select('*', { count: 'exact' }));
    }
    data = r.data; count = r.count;
  }
  const transacoes = (data || []).map((t: any) => ({ ...t, wallet_nome: t.carteira_nome }));
  return { transacoes, total: count || 0 };
}

export async function walletsDireto(grupoId: string) {
  const { data } = await supabaseAdmin.from('wallets').select('*').eq('grupo_id', grupoId).order('nome');
  return data || [];
}

export async function categoriasDireto(grupoId: string) {
  const { data } = await supabaseAdmin
    .from('categorias').select('*, parent:parent_id(id,nome)').eq('grupo_id', grupoId).eq('ativa', true).order('nome');
  return data || [];
}

// Consolidado do dashboard — mesma forma do GET /api/dashboard/:phone.
export async function dashboardDireto(grupoId: string, mes: string, mesAnt: string) {
  const agora = new Date().toISOString();
  const [resumo, resumoAnt, wallets, txsRec, txsMes, categorias] = await Promise.all([
    resumoDireto(grupoId, mes),
    resumoDireto(grupoId, mesAnt),
    walletsDireto(grupoId),
    transacoesDireto(grupoId, { limit: 8, ate: agora }),
    transacoesDireto(grupoId, { mes, tipo: 'Gasto', limit: 500 }),
    categoriasDireto(grupoId),
  ]);
  return { resumo, resumoAnt, wallets, txsRec, txsMes, categorias };
}
