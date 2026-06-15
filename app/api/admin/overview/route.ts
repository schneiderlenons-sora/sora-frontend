import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

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

  const [total, inativo, basico, premium, black, novos7, novos30, pagouInativo] = await Promise.all([
    contar((q) => q),
    contar((q) => q.eq('plano', 'inativo')),
    contar((q) => q.eq('plano', 'basico')),
    contar((q) => q.eq('plano', 'premium')),
    contar((q) => q.eq('plano', 'black')),
    contar((q) => q.gte('created_at', d7)),
    contar((q) => q.gte('created_at', d30)),
    contar((q) => q.eq('plano', 'inativo').not('stripe_customer_id', 'is', null)),
  ]);

  let bugsAbertos = 0;
  try {
    const { count } = await supabaseAdmin
      .from('bug_reports').select('*', { count: 'exact', head: true })
      .neq('status', 'resolvido');
    bugsAbertos = count || 0;
  } catch { /* tabela pode não existir ainda */ }

  const mrr = basico * PRECO.basico + premium * PRECO.premium + black * PRECO.black;

  return NextResponse.json({
    total, inativo, basico, premium, black,
    ativos: basico + premium + black,
    novos7, novos30, pagouInativo, bugsAbertos,
    mrr: Math.round(mrr * 100) / 100,
  });
}
