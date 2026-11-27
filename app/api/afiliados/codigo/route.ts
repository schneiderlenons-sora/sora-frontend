import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { afiliadoElegivel, afiliadoPorCodigo } from '@/lib/afiliados';
import { COOKIE_AFILIADO } from '@/lib/afiliados-regras';

export const dynamic = 'force-dynamic';

// GET /api/afiliados/codigo?c=TATIANE — o código vale como desconto pra mim?
// Sem `c`, olha o link por onde a pessoa chegou (cookie). Só devolve o código
// e o percentual: o desconto de verdade é recalculado no servidor, na cobrança.
export async function GET(req: NextRequest) {
  try {
    const codigo = req.nextUrl.searchParams.get('c') || req.cookies.get(COOKIE_AFILIADO)?.value;
    if (!codigo) return NextResponse.json({ valido: false });
    const supabase = await createSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    const af = user ? await afiliadoElegivel(user.id, codigo) : await afiliadoPorCodigo(codigo);
    if (!af) return NextResponse.json({ valido: false });
    return NextResponse.json({ valido: true, codigo: af.codigo, desconto_pct: af.desconto_pct });
  } catch {
    return NextResponse.json({ valido: false });
  }
}
