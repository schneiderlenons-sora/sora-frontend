import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sincronizarToken } from '@/lib/play-sync';
import { ErroPlay, playConfigurado } from '@/lib/google-play';

export const dynamic = 'force-dynamic';

// POST { tokens: string[] }  → confirma compras da Google Play da pessoa logada.
//
// Chamado pelo app logo depois de uma compra E na restauração (o app relê as
// compras do aparelho a cada sessão). Idempotente: o mesmo comprovante várias
// vezes dá o mesmo resultado. O estado vem SEMPRE do Google (lib/play-sync).
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  if (!playConfigurado()) {
    return NextResponse.json({ erro: 'Assinatura pela Google Play ainda não está configurada no servidor.' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { tokens?: unknown };
  const tokens = Array.isArray(body.tokens)
    ? [...new Set(body.tokens.filter((t): t is string => typeof t === 'string' && t.length > 10 && t.length < 4096))].slice(0, 10)
    : [];
  if (!tokens.length) return NextResponse.json({ erro: 'Nenhum comprovante de compra.' }, { status: 400 });

  const resultados = [];
  for (const t of tokens) {
    try {
      resultados.push(await sincronizarToken(t, user.id));
    } catch (e) {
      // Falha transitória (Google fora, banco fora): o app tenta de novo na
      // próxima abertura e o aviso automático do Google também chega.
      const msg = e instanceof Error ? e.message : 'erro';
      console.error('[play/verificar]', msg);
      resultados.push({ ok: false, motivo: e instanceof ErroPlay && e.definitivo ? 'invalido' : 'falha', erro: msg });
    }
  }
  return NextResponse.json({ resultados });
}
