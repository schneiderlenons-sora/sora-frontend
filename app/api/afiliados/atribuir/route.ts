import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { atribuir } from '@/lib/afiliados';
import { COOKIE_AFILIADO } from '@/lib/afiliados-regras';

export const dynamic = 'force-dynamic';

// POST — quem chegou por um link de afiliado e entrou na conta (neste
// navegador) passa a contar pra ele, mesmo que compre depois em outro aparelho.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const codigo = req.cookies.get(COOKIE_AFILIADO)?.value;
  const ok = codigo ? await atribuir(user.id, codigo, 'link') : false;
  return NextResponse.json({ ok });
}
