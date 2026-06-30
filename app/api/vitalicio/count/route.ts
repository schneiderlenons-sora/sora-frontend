import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { VITALICIO } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// Contagem de vitalícios vendidos → usada no gatilho de escassez ("vagas de
// fundador"). Tolerante à migration 060: se a coluna não existir, vendidos = 0.
export async function GET() {
  let vendidos = 0;
  try {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('vitalicio', true);
    if (!error && typeof count === 'number') vendidos = count;
  } catch {
    /* coluna ainda não existe — vendidos fica 0 */
  }
  const vagas = VITALICIO.vagas;
  // Ocupadas = base de escassez + vendas reais (pra barra ficar quase no limite).
  const ocupadas = Math.min(vagas, VITALICIO.vagasOcupadasBase + vendidos);
  const restantes = Math.max(0, vagas - ocupadas);
  // `vendidos` no retorno = ocupadas (é o que a barra usa pra calcular o %).
  return NextResponse.json({ vendidos: ocupadas, vagas, restantes, preco: VITALICIO.preco });
}
