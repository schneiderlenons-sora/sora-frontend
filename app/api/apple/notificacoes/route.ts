import { NextRequest, NextResponse } from 'next/server';
import { sincronizarApple } from '@/lib/apple-sync';
import { conferirAviso, conferirTransacao, appleConfigurado, ErroApple } from '@/lib/app-store';

export const dynamic = 'force-dynamic';

// POST { signedPayload } — App Store Server Notifications V2.
//
// URL cadastrada no App Store Connect (Informações do app → Notificações do
// servidor da App Store), a MESMA para produção e sandbox:
//   https://www.forsora.com/api/apple/notificacoes
//
// ⚠️ SEM SEGREDO NA URL, e não precisa: o aviso vem ASSINADO pela Apple e é
// conferido até a raiz dela (lib/app-store). Um aviso forjado não passa — e
// mesmo um verdadeiro só faz a Sora RELER a assinatura na Apple.
//
// Resposta ≠ 200 faz a Apple repetir o aviso (até 5 vezes, espaçadas). Por
// isso só devolvemos erro em falha TEMPORÁRIA; aviso inválido ou sem dono é 200.
export async function POST(req: NextRequest) {
  if (!appleConfigurado()) {
    console.error('[apple/notificacoes] recebido sem APPLE_IAP_* configurado');
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  const body = await req.json().catch(() => ({})) as { signedPayload?: unknown };
  if (typeof body.signedPayload !== 'string') return NextResponse.json({ ok: false, erro: 'sem signedPayload' }, { status: 400 });

  try {
    const { aviso, ambiente } = await conferirAviso(body.signedPayload);
    const tipo = `${aviso.notificationType ?? '?'}${aviso.subtype ? `/${aviso.subtype}` : ''}`;
    if (aviso.notificationType === 'TEST') {
      console.log(`[apple/notificacoes] aviso de TESTE recebido (${ambiente})`);
      return NextResponse.json({ ok: true, teste: true });
    }
    const jws = aviso.data?.signedTransactionInfo;
    if (!jws) {
      console.log(`[apple/notificacoes] ${tipo} sem transação — ignorado`);
      return NextResponse.json({ ok: true });
    }
    const { tx } = await conferirTransacao(jws);
    const id = tx.transactionId || tx.originalTransactionId;
    if (!id) return NextResponse.json({ ok: true });
    const r = await sincronizarApple(id, ambiente, null);
    console.log(`[apple/notificacoes] ${tipo} · ${ambiente} · ${r.ok ? `plano ${r.plano}` : r.motivo}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    if (e instanceof ErroApple && e.definitivo) {
      console.warn('[apple/notificacoes] aviso descartado:', msg);
      return NextResponse.json({ ok: false, erro: msg });
    }
    console.error('[apple/notificacoes] falha (a Apple vai repetir):', msg);
    return NextResponse.json({ ok: false, erro: msg }, { status: 500 });
  }
}
