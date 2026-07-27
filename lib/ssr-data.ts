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

// Porte fiel de GET /api/limites/:phone (routes/limites.js).
export async function limitesDireto(grupoId: string, mes: string, userId: string) {
  const [{ data: user }, { data: limites }] = await Promise.all([
    supabaseAdmin.from('users')
      .select('meta_mensal, meta_mensal_ativo, meta_mensal_alerta_ativo, meta_mensal_alerta_pct')
      .eq('id', userId).maybeSingle(),
    supabaseAdmin.from('category_limits').select('*').eq('grupo_id', grupoId).eq('mes_referencia', mes),
  ]);
  return {
    meta_mensal:              (user as any)?.meta_mensal || 0,
    meta_mensal_ativo:        (user as any)?.meta_mensal_ativo ?? true,
    meta_mensal_alerta_ativo: (user as any)?.meta_mensal_alerta_ativo ?? true,
    meta_mensal_alerta_pct:   (user as any)?.meta_mensal_alerta_pct ?? 80,
    categorias:               limites || [],
  };
}

// Porte fiel de GET /api/dividas/:phone (routes/dividas.js) — lista + resumo.
export async function dividasDireto(grupoId: string, userId: string) {
  const [{ data: user }, { data: dividas }] = await Promise.all([
    supabaseAdmin.from('users').select('lembretes_dividas').eq('id', userId).maybeSingle(),
    supabaseAdmin.from('dividas').select('*').eq('grupo_id', grupoId).order('created_at', { ascending: false }),
  ]);
  const lista: any[] = dividas || [];
  const ativas = lista.filter((d) => d.status === 'ativa' || d.status === 'em_atraso');
  const total_devido = ativas.reduce((s, d) => {
    const restantes = Math.max(0, (d.parcelas_total || 0) - (d.parcelas_pagas || 0));
    const saldo = restantes * (d.valor_parcela || 0);
    return s + (saldo || d.valor_total || 0);
  }, 0);
  const total_quitado = lista.filter((d) => d.status === 'quitada').length;

  const hoje = new Date();
  const diaHoje = hoje.getDate();
  let proxima: any = null;
  ativas.forEach((d) => {
    if (!d.dia_vencimento) return;
    const venc = new Date(hoje.getFullYear(), hoje.getMonth(), d.dia_vencimento);
    if (d.dia_vencimento < diaHoje) venc.setMonth(venc.getMonth() + 1);
    // 1ª parcela nunca vence no mês da compra (data_inicio) — pula pro seguinte.
    if (d.data_inicio) {
      const ini = new Date(d.data_inicio + 'T00:00:00');
      if (venc.getTime() <= ini.getTime()) venc.setMonth(venc.getMonth() + 1);
    }
    const dias = Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
    if (!proxima || dias < proxima.dias) {
      proxima = { divida_id: d.id, titulo: d.titulo, valor: d.valor_parcela, data: venc.toISOString().slice(0, 10), dias };
    }
  });
  const parcelas_mes_valor = ativas.reduce((s, d) => s + (d.valor_parcela || 0), 0);

  return {
    dividas: lista,
    resumo: {
      total_devido,
      total_ativas: ativas.length,
      total_quitadas: total_quitado,
      parcelas_mes_valor,
      parcelas_mes_count: ativas.filter((d) => d.dia_vencimento).length,
      proxima_parcela: proxima,
      lembretes_dividas: (user as any)?.lembretes_dividas !== false,
    },
  };
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
