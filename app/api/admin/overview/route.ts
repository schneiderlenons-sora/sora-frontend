import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';
import { adminEmails } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// Preços mensais (estimativa de MRR). Fonte real: lib/stripe.
const PRECO = { basico: 19.9, premium: 29.9, platinum: 49.9 } as const;
// Conexão de banco avulsa (Open Finance). Cobrada POR BANCO conectado, à parte
// do plano — o vitalício não tem franquia e é quem mais contrata.
const PRECO_OF = { mensal: 6, anual: 60 } as const;

async function contar(build: (q: any) => any): Promise<number> {
  const { count } = await build(
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
  );
  return count || 0;
}

export async function GET() {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const d7  = new Date(Date.now() - 7  * 864e5).toISOString();
  const d30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [total, inativo, basico, premium, platinum, kit, novos7, novos30, pagouInativo] = await Promise.all([
    contar((q) => q),
    contar((q) => q.eq('plano', 'inativo')),
    contar((q) => q.eq('plano', 'basico')),
    contar((q) => q.eq('plano', 'premium')),
    contar((q) => q.eq('plano', 'platinum')),
    contar((q) => q.eq('plano', 'kit')),
    contar((q) => q.gte('created_at', d7)),
    contar((q) => q.gte('created_at', d30)),
    contar((q) => q.eq('plano', 'inativo').not('stripe_customer_id', 'is', null)),
  ]);

  // ── Vitalícios (pagamento único) — NÃO entram no MRR (não recorrem).
  // Tolerante à migration 060 (coluna vitalicio) e 065 (vitalicio_valor):
  // sem vitalicio_valor, cai no preço do tier (kit R$47 / premium R$97).
  const VITAL_PRECO: Record<string, number> = { kit: 47, premium: 97 };
  let vitalicios = 0, premiumVitalicio = 0, kitVitalicio = 0, receitaVitalicio = 0;
  {
    let rows: any[] = [];
    const rv = await supabaseAdmin.from('users').select('plano, vitalicio_valor').eq('vitalicio', true);
    if (rv.error) {
      const rp = await supabaseAdmin.from('users').select('plano').eq('vitalicio', true); // 065 pendente
      rows = rp.data || [];
    } else {
      rows = rv.data || [];
    }
    for (const r of rows) {
      vitalicios++;
      if (r.plano === 'premium') premiumVitalicio++;
      if (r.plano === 'kit') kitVitalicio++;
      const v = r.vitalicio_valor;
      receitaVitalicio += typeof v === 'number' ? v : (VITAL_PRECO[r.plano] ?? 97);
    }
  }

  // Bugs abertos = só os do tipo 'problema' (tolerante a pré-migration 053).
  let bugsAbertos = 0;
  try {
    const abertos = () => supabaseAdmin.from('bug_reports').select('*', { count: 'exact', head: true }).neq('status', 'resolvido');
    let { count, error } = await abertos().eq('tipo', 'problema');
    if (error) ({ count } = await abertos());
    bugsAbertos = count || 0;
  } catch { /* tabela pode não existir ainda */ }

  // Melhorias abertas (sugestões não resolvidas).
  let melhoriasAbertas = 0;
  try {
    const { count } = await supabaseAdmin
      .from('bug_reports').select('*', { count: 'exact', head: true })
      .eq('tipo', 'melhoria').neq('status', 'resolvido');
    melhoriasAbertas = count || 0;
  } catch { /* coluna tipo pode não existir ainda */ }

  // Inativos separados: quem CANCELOU (teve assinatura → plano_intervalo setado
  // num checkout concluído) vs quem NÃO CONCLUIU o pagamento (nunca assinou).
  const [cancelados, naoConcluido] = await Promise.all([
    contar((q) => q.eq('plano', 'inativo').not('plano_intervalo', 'is', null)),
    contar((q) => q.eq('plano', 'inativo').is('plano_intervalo', null)),
  ]);

  // Recuperados = paga HOJE e em algum momento passou por recuperação (abandono
  // de cadastro OU pagamento que falhou).
  let recuperados = 0;
  try {
    recuperados = await contar((q) => q.neq('plano', 'inativo')
      .or('recuperacao_signup_em.not.is.null,recuperacao_enviada_em.not.is.null'));
  } catch { recuperados = 0; }

  // Recuperação de cadastros sem pagamento (abandono no paywall).
  // semPagamento = pool elegível; recEnviadas = já cutucados; recRecuperados =
  // cutucados que viraram pagantes (proxy de conversão da recuperação).
  let semPagamento = 0, recEnviadas = 0, recEnviadas2 = 0, recRecuperados = 0;
  try {
    semPagamento  = await contar((q) => q.eq('plano', 'inativo').is('plano_intervalo', null).not('phone', 'is', null));
    recEnviadas   = await contar((q) => q.not('recuperacao_signup_em', 'is', null));
    recRecuperados = await contar((q) => q.not('recuperacao_signup_em', 'is', null).neq('plano', 'inativo'));
  } catch { /* coluna recuperacao_signup_em pode não existir ainda */ }
  try {
    recEnviadas2 = await contar((q) => q.not('recuperacao_signup2_em', 'is', null));
  } catch { /* migration 057 pode não ter rodado */ }

  // MRR = SÓ receita que RECORRE. Soma linha a linha os pagantes (básico/premium/
  // black) e DESCARTA quem não gera recorrência:
  //   • vitalício        → pagou uma vez, não renova
  //   • assinatura_cancelada → cancelou (ainda tem acesso, mas não renova)
  //   • mrr_excluir      → cortesia/acesso grátis marcado pelo admin
  //   • e-mail de admin  → a conta do próprio dono
  // Tolerante: se as colunas da migration 074 não existem, cai na conta antiga.
  const premiumRecorrente = Math.max(0, premium - premiumVitalicio);
  let mrr = basico * PRECO.basico + premiumRecorrente * PRECO.premium + platinum * PRECO.platinum;
  let mrrExcluidos = 0, anuais = 0, recorrentesMensais = 0;
  try {
    const { data: pagantes, error } = await supabaseAdmin
      .from('users')
      .select('email, plano, plano_intervalo, vitalicio, mrr_excluir, assinatura_cancelada')
      .in('plano', ['basico', 'premium', 'platinum']);
    if (error) throw error;
    const admins = adminEmails();
    let soma = 0;
    for (const u of pagantes || []) {
      const preco = PRECO[u.plano as keyof typeof PRECO];
      if (!preco) continue;
      const fora =
        u.vitalicio === true ||
        u.assinatura_cancelada === true ||
        u.mrr_excluir === true ||
        (u.email && admins.includes(String(u.email).toLowerCase()));
      if (fora) { mrrExcluidos++; continue; }
      // MRR = receita que recorre TODO MÊS. Anual é PRÉ-PAGO (paga 1×/ano),
      // então NÃO entra no MRR mensal — contamos à parte. Contar anual pelo
      // preço mensal inflava o número (era a divergência com a conta manual de
      // "pagantes mensais"). intervalo null = trata como mensal (não derruba
      // pagante legado sem o campo).
      if (u.plano_intervalo === 'anual') { anuais++; continue; }
      recorrentesMensais++;
      soma += preco;
    }
    mrr = soma;
  } catch { /* migration 074 pode não ter rodado → mantém a estimativa antiga */ }

  // ── COBRANÇA EM DUPLICIDADE: vitalício COM assinatura ativa ──────────────
  //
  // ⚠️ ISTO É DINHEIRO QUE PROVAVELMENTE VAI SER DEVOLVIDO, não receita.
  // O vitalício paga UMA vez; se ele também tem assinatura mensal correndo,
  // está sendo cobrado duas vezes pelo mesmo produto — e quando percebe, o
  // caminho normal é chargeback.
  //
  // Medido em ago/2026: 3 clientes nessa situação, R$ 79,70/mês. Um deles
  // assinou e comprou o vitalício com 17 MINUTOS de diferença — ou seja, dá
  // pra acontecer sem ninguém notar, e ficava invisível porque o MRR
  // simplesmente descarta `vitalicio === true`.
  //
  // Fora do MRR de propósito (decisão do dono): contar aqui seria inflar a
  // receita com cobrança indevida. O número existe pra ser RESOLVIDO — cancele
  // a assinatura ou estorne, e ele volta a zero sozinho.
  //
  // `stripe_subscription_id` é confiável como sinal: o webhook o zera em
  // `customer.subscription.deleted`.
  let vitalicioComAssinatura = 0;
  let vitalicioComAssinaturaEmails: string[] = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('vitalicio', true)
      .not('stripe_subscription_id', 'is', null);
    if (error) throw error;
    vitalicioComAssinatura = (data || []).length;
    vitalicioComAssinaturaEmails = (data || []).map((u) => String(u.email || '')).filter(Boolean);
  } catch { /* colunas podem não existir */ }

  // ── OPEN FINANCE ────────────────────────────────────────────────────────
  //
  // Duas coisas DIFERENTES, e misturá-las esconde problema:
  //   · CONTRATADAS (`of_conexoes_pagas`) → é a receita.
  //   · CONECTADAS  (tabela `of_conexoes`) → é o uso real.
  // Alguém pode pagar 3 e ter conectado 1 (ou ter uma conexão expirada). Quando
  // os dois números divergem, é sinal de cliente pagando por algo que não está
  // usando — vale ligar pra ele antes de virar pedido de reembolso.
  //
  // Mesma convenção do MRR do plano: ANUAL é PRÉ-PAGO, então fica FORA do MRR
  // mensal e é contado à parte.
  let ofUsuarios = 0, ofConexoesPagas = 0, ofMensais = 0, ofAnuais = 0;
  let ofMrr = 0, ofReceitaAnual = 0;
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('of_conexoes_pagas, of_assinatura_intervalo')
      .gt('of_conexoes_pagas', 0);
    if (error) throw error;
    for (const u of data || []) {
      const qtd = Number(u.of_conexoes_pagas) || 0;
      if (qtd <= 0) continue;
      ofUsuarios++;
      ofConexoesPagas += qtd;
      if (u.of_assinatura_intervalo === 'anual') {
        ofAnuais += qtd;
        ofReceitaAnual += qtd * PRECO_OF.anual;
      } else {
        // intervalo null = mensal (não derruba assinatura legada sem o campo).
        ofMensais += qtd;
        ofMrr += qtd * PRECO_OF.mensal;
      }
    }
  } catch { /* colunas of_* podem não existir ainda */ }

  // Uso real: bancos conectados hoje. `status` vem do agregador — só 'updated'
  // é conexão saudável; expirada/recusada precisa o cliente reconectar, e é aí
  // que ele acha que "a Sora parou de atualizar".
  let ofConectados = 0, ofGrupos = 0, ofComProblema = 0;
  let ofGruposFranquia = 0, ofGruposPagando = 0, ofPagandoSemUsar = 0;
  try {
    const { data, error } = await supabaseAdmin.from('of_conexoes').select('grupo_id, status');
    if (error) throw error;
    const grupos = new Set<string>();
    for (const c of data || []) {
      ofConectados++;
      if (c.grupo_id) grupos.add(String(c.grupo_id));
      if (c.status !== 'updated') ofComProblema++;
    }
    ofGrupos = grupos.size;

    // ⚠️ QUEM CONECTA NÃO É SÓ QUEM PAGA. A assinatura recorrente tem franquia
    // (Básico 1, Premium 3) e conecta de graça — medido: 9 dos 17 grupos
    // conectados são de franquia. Olhando só a receita, metade de quem USA
    // Open Finance ficava invisível no admin.
    //
    // E o cruzamento revela o caso caro: quem PAGA e NÃO conectou nada. É
    // cobrança rodando por um serviço parado — vale ligar antes de virar
    // pedido de reembolso.
    const { data: pagantes } = await supabaseAdmin
      .from('users').select('grupo_ativo, of_conexoes_pagas').gt('of_conexoes_pagas', 0);
    const gruposPagantes = new Set(
      (pagantes || []).map((u) => u.grupo_ativo).filter(Boolean).map(String));
    for (const g of grupos) {
      if (gruposPagantes.has(g)) ofGruposPagando++;
      else ofGruposFranquia++;
    }
    for (const g of gruposPagantes) if (!grupos.has(g)) ofPagandoSemUsar++;
  } catch { /* tabela of_conexoes pode não existir */ }

  return NextResponse.json({
    mrrExcluidos, cancelados, naoConcluido, recuperados,
    total, inativo, basico, premium, platinum, kit,
    ativos: total - inativo,
    premiumRecorrente, vitalicios, kitVitalicio, premiumVitalicio,
    receitaVitalicio: Math.round(receitaVitalicio * 100) / 100,
    vitalicioComAssinatura, vitalicioComAssinaturaEmails,
    novos7, novos30, pagouInativo, bugsAbertos, melhoriasAbertas,
    semPagamento, recEnviadas, recEnviadas2, recRecuperados,
    anuais, recorrentesMensais,
    mrr: Math.round(mrr * 100) / 100,
    // Open Finance avulso: receita (contratadas) + uso (conectadas).
    ofUsuarios, ofConexoesPagas, ofMensais, ofAnuais,
    ofMrr: Math.round(ofMrr * 100) / 100,
    ofReceitaAnual: Math.round(ofReceitaAnual * 100) / 100,
    ofConectados, ofGrupos, ofComProblema,
    ofGruposFranquia, ofGruposPagando, ofPagandoSemUsar,
  });
}
