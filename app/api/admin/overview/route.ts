import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';
import { adminEmails } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// Preços mensais (estimativa de MRR). Fonte real: lib/stripe.
const PRECO = { basico: 19.9, premium: 29.9, black: 79.9 } as const;

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

  const [total, inativo, basico, premium, black, kit, novos7, novos30, pagouInativo] = await Promise.all([
    contar((q) => q),
    contar((q) => q.eq('plano', 'inativo')),
    contar((q) => q.eq('plano', 'basico')),
    contar((q) => q.eq('plano', 'premium')),
    contar((q) => q.eq('plano', 'black')),
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
  let mrr = basico * PRECO.basico + premiumRecorrente * PRECO.premium + black * PRECO.black;
  let mrrExcluidos = 0;
  try {
    const { data: pagantes, error } = await supabaseAdmin
      .from('users')
      .select('email, plano, vitalicio, mrr_excluir, assinatura_cancelada')
      .in('plano', ['basico', 'premium', 'black']);
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
      soma += preco;
    }
    mrr = soma;
  } catch { /* migration 074 pode não ter rodado → mantém a estimativa antiga */ }

  return NextResponse.json({
    mrrExcluidos,
    total, inativo, basico, premium, black, kit,
    ativos: total - inativo,
    premiumRecorrente, vitalicios, kitVitalicio, premiumVitalicio,
    receitaVitalicio: Math.round(receitaVitalicio * 100) / 100,
    novos7, novos30, pagouInativo, bugsAbertos, melhoriasAbertas,
    semPagamento, recEnviadas, recEnviadas2, recRecuperados,
    mrr: Math.round(mrr * 100) / 100,
  });
}
