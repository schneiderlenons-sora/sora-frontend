import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { sincronizarApple } from '@/lib/apple-sync';
import { conferirTransacao, appleConfigurado, ErroApple } from '@/lib/app-store';

export const dynamic = 'force-dynamic';

// POST { jws: string[] } → confirma assinaturas da Apple da pessoa logada.
//
// Chamado pelo app de iPhone logo depois da compra E na restauração (o app
// relê as assinaturas do Apple ID a cada sessão). Idempotente. O comprovante é
// conferido até a raiz da Apple e o estado vem SEMPRE da App Store
// (lib/apple-sync) — o que o app manda só diz qual assinatura olhar.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 });
  if (!appleConfigurado()) {
    return NextResponse.json({ erro: 'Assinatura pela App Store ainda não está configurada no servidor.' }, { status: 503 });
  }

  const body = await req.json().catch(() => ({})) as { jws?: unknown };
  const lista = Array.isArray(body.jws)
    ? [...new Set(body.jws.filter((t): t is string => typeof t === 'string' && t.length > 100 && t.length < 20000))].slice(0, 10)
    : [];
  if (!lista.length) return NextResponse.json({ erro: 'Nenhum comprovante de compra.' }, { status: 400 });

  const resultados = [];
  for (const jws of lista) {
    try {
      const { tx, ambiente } = await conferirTransacao(jws);
      if (!tx.originalTransactionId && !tx.transactionId) throw new ErroApple('comprovante sem transação', true);
      resultados.push(await sincronizarApple(tx.transactionId || tx.originalTransactionId!, ambiente, user.id));
    } catch (e) {
      // Falha transitória (Apple fora, banco fora): o app tenta de novo na
      // próxima abertura e o aviso automático da Apple também chega.
      const msg = e instanceof Error ? e.message : 'erro';
      console.error('[apple/verificar]', msg);
      resultados.push({ ok: false, motivo: e instanceof ErroApple && e.definitivo ? 'invalido' : 'falha', erro: msg });
    }
  }
  return NextResponse.json({ resultados });
}
