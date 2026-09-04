import { supabaseAdmin } from '@/lib/supabase-admin';
import { ehPagamentoFatura } from './categorizar';
import { proximoVencimento, hojeSP } from './vencimento-divida';

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
  // ⚠️ "Não considerar" (migration 146) sai das somas nos DOIS escopos —
  // 'fluxo' e 'tudo'. A diferença entre eles é só a FATURA. ESPELHA
  // `resumoTransacoes.ehTransferencia` do backend: divergir aqui faz o número
  // do SSR pular quando o cliente revalida.
  if (r.ignorar_em) return true;
  return r.transferencia === true || ehPagamentoFatura(r.categoria) || r.categoria === 'Transferências';
}

// ⚠️ ARQUIVADAS (migration 131) — sonda com cache, espelhando
// sora-backend/src/services/arquivadas.js. Filtrar por coluna que não existe
// faz o Supabase falhar o SELECT INTEIRO: a lista sumiria da tela enquanto a
// migration não rodasse. Enquanto a coluna não existir, o filtro é no-op.
// ⚠️ O "NÃO" TEM VALIDADE, O "SIM" NÃO. Cachear o negativo pra sempre foi um
// bug real no backend: o processo subiu ANTES da migration, sondou, guardou
// "não existe" e nunca mais perguntou — a transação era arquivada no banco e
// voltava a aparecer na tela. Coluna não some, então o "sim" pode ser eterno;
// o "não" é reconferido a cada minuto e o recurso liga sozinho.
const TTL_ARQ_NEGATIVO = 60 * 1000;
let _arqOk: boolean | null = null;
let _arqEm = 0;
async function arquivadasOk(): Promise<boolean> {
  if (_arqOk === true) return true;
  if (_arqOk === false && Date.now() - _arqEm < TTL_ARQ_NEGATIVO) return false;
  const { error } = await supabaseAdmin.from('transacoes').select('arquivada_por').limit(1);
  _arqOk = !error;
  _arqEm = Date.now();
  return _arqOk;
}
// Porte fiel de services/resumoTransacoes.calcularResumo.
export async function resumoDireto(grupoId: string, mes: string, criadoPorId?: string) {
  // ⚠️ `ignorar_em` (146) precisa vir: `ehTransferencia` a lê. A montagem é
  // uma função porque pode ser refeita SEM a coluna — pedir coluna inexistente
  // reprova o SELECT inteiro e o resumo do mês voltaria vazio pra toda a base
  // até a migration rodar.
  const montar = async (colunas: string) => {
    let q = supabaseAdmin.from('transacoes')
      .select(colunas)
      .eq('grupo_id', grupoId)
      .gte('data', `${mes}-01`).lt('data', proximoMesPrimeiroDia(mes));
    if (criadoPorId) q = q.eq('criado_por', criadoPorId);
    // ⚠️ Checa a flag ANTES de tocar na query. `await` no query builder do
    // Supabase EXECUTA a consulta (ele é thenable), então `q = await …`
    // trocaria o builder pelo resultado — funciona por acidente e quebra o tipo.
    if (await arquivadasOk()) q = q.is('arquivada_por', null);
    return q;
  };

  const BASE = 'tipo, categoria, valor, criado_por, transferencia';
  let { data: rows, error: errIgnorar } =
    await montar(`${BASE}, ignorar_em`) as { data: any[] | null; error: any };
  if (errIgnorar && /ignorar_em/i.test(errIgnorar.message || '')) {
    rows = (await montar(BASE) as { data: any[] | null }).data;
  }

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

// Colunas mínimas do GRÁFICO do dashboard (`txsMes`). Enumeradas UMA A UMA a
// partir dos consumidores reais, não por chute:
//   · computeDailyAmount → data, valor
//   · o filtro do gráfico → categoria, transferencia
//   · gastoPorContaDe     → tipo, carteira_nome, valor, categoria, transferencia
//   · ResumoCards         → carteira_nome
//
// ⚠️ `wallet_id` NÃO entra: o ResumoCards lê `t.wallet_id`, mas essa coluna não
// existe em `transacoes` — já é `undefined` hoje, e pedi-la ao Postgres daria
// erro. Omitir mantém exatamente o comportamento atual.
//
// ⚠️ NÃO tem o embed do `criador`: o gráfico não mostra avatar. É metade da
// economia — o join puxava 6 campos de users por linha.
//
// Medido no grupo do dono: 57,1 KB → 12,8 KB por visita (−78%).
// ⚠️ `ignorar_em` entra aqui: sem ela o GRAFICO desenharia a linha que o
// resumo do mes exclui, e o total do card nao bateria com a curva ao lado.
const COLUNAS_GRAFICO = 'id, data, valor, categoria, tipo, transferencia, carteira_nome, ignorar_em';

// Porte fiel de dashboard.listarTransacoes (com o mesmo fallback de embed).
export async function transacoesDireto(
  grupoId: string,
  { mes, tipo, limit, ate, colunas }:
    { mes?: string; tipo?: string; limit: number; ate?: string; colunas?: string },
) {
  // `async` porque a sonda da coluna é assíncrona. Quem chama já usa `await`, e
  // o builder do Supabase é thenable — então o `await` do call site resolve a
  // Promise E executa a consulta, devolvendo o resultado, que é o esperado ali.
  const aplicar = async (query: any) => {
    let q = query.eq('grupo_id', grupoId).order('data', { ascending: false }).range(0, Number(limit) - 1);
    if (mes)  q = q.gte('data', `${mes}-01`).lt('data', proximoMesPrimeiroDia(mes));
    if (ate)  q = q.lte('data', ate);
    if (tipo) q = q.eq('tipo', tipo);
    if (await arquivadasOk()) q = q.is('arquivada_por', null);
    return q;
  };

  // Caminho enxuto: quem pediu colunas específicas (o gráfico) não precisa do
  // embed do criador nem do fallback de embed — não há embed pra falhar.
  if (colunas) {
    const r = await aplicar(supabaseAdmin.from('transacoes').select(colunas, { count: 'exact' }));
    const lista = (r.data || []).map((t: any) => ({ ...t, wallet_nome: t.carteira_nome }));
    return { transacoes: lista, total: r.count || 0 };
  }

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

// ⚠️ COLUNAS EXPLÍCITAS, e sem o embed `parent:parent_id(id,nome)`.
//
// Esta era a leitura MAIS CARA do dashboard — 58,6 KB contra 57,1 KB das
// transações — porque são ~180 categorias por grupo e o `select('*')` trazia
// todas as colunas de todas elas em TODA visita (a página é `force-dynamic`).
//
// O dashboard usa `categorias` em exatamente dois pontos, os dois via
// `getCategoriaTheme(nome, categorias)`, cujo contrato (`CategoriaUserMin` em
// lib/categorias.ts) é `nome` + `icone` + `cor`. Nada é repassado a componente
// filho — conferido linha a linha antes de estreitar.
//
// `id`/`parent_id`/`tipo` ficam por segurança (custam bytes desprezíveis e são
// o que qualquer consumidor futuro pediria primeiro). O embed do pai sai: o
// dashboard nunca lê `.parent`.
//
// Medido no grupo do dono: 58,6 KB → 27,4 KB por visita (−53%).
//
// ⚠️ Isto vale SÓ pro SSR do dashboard. A aba /categorias tem query própria
// (pelo backend) e continua recebendo tudo — ela precisa.
export async function categoriasDireto(grupoId: string) {
  const { data } = await supabaseAdmin
    .from('categorias')
    .select('id, nome, icone, cor, parent_id, tipo')
    .eq('grupo_id', grupoId).eq('ativa', true).order('nome');
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

  // Data do último pagamento por dívida — é o que impede o painel de avisar de
  // uma parcela que o usuário ACABOU de pagar. `juros_atraso` fica de fora
  // (não anda parcela). Espelha o GET do backend.
  if (lista.length) {
    const { data: pgs } = await supabaseAdmin.from('divida_pagamentos')
      .select('divida_id, data_pagamento, tipo')
      .in('divida_id', lista.map((d) => d.id))
      .neq('tipo', 'juros_atraso');
    const mapa: Record<string, string> = {};
    for (const p of pgs || []) {
      const dt = String((p as any).data_pagamento || '').slice(0, 10);
      if (dt && (!mapa[(p as any).divida_id] || dt > mapa[(p as any).divida_id])) {
        mapa[(p as any).divida_id] = dt;
      }
    }
    for (const d of lista) d.ultimo_pagamento = mapa[d.id] || null;
  }

  const ativas = lista.filter((d) => d.status === 'ativa' || d.status === 'em_atraso');
  const total_devido = ativas.reduce((s, d) => {
    // Espelha routes/dividas.js: saldo do BANCO primeiro (migration 155); a
    // conta local só entra em dívida manual, que não tem o campo.
    if (d.saldo_devedor != null) return s + Number(d.saldo_devedor);
    const restantes = Math.max(0, (d.parcelas_total || 0) - (d.parcelas_pagas || 0));
    const saldo = restantes * (d.valor_parcela || 0);
    return s + (saldo || d.valor_total || 0);
  }, 0);
  const total_quitado = lista.filter((d) => d.status === 'quitada').length;

  const hojeStr = hojeSP();
  let proxima: any = null;
  ativas.forEach((d) => {
    const v = proximoVencimento(d, hojeStr);
    if (!v) return;
    if (!proxima || v.dias < proxima.dias) {
      proxima = { divida_id: d.id, titulo: d.titulo, valor: d.valor_parcela, data: v.data, dias: v.dias };
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
    // ⚠️ Só o GRÁFICO usa colunas enxutas. A lista de recentes (acima) segue
    // com `select('*')` + embed do criador, porque ela MOSTRA observação,
    // avatar de quem lançou e o resto — estreitar ali apagaria conteúdo da tela.
    transacoesDireto(grupoId, { mes, tipo: 'Gasto', limit: 500, colunas: COLUNAS_GRAFICO }),
    categoriasDireto(grupoId),
  ]);
  return { resumo, resumoAnt, wallets, txsRec, txsMes, categorias };
}
