import { NextRequest, NextResponse } from 'next/server';
import { sincronizarToken } from '@/lib/play-sync';
import { ErroPlay } from '@/lib/google-play';

export const dynamic = 'force-dynamic';

// Avisos automáticos do Google Play (Real-time developer notifications), que
// chegam pelo Google Cloud Pub/Sub em modo PUSH:
//   https://www.forsora.com/api/play/rtdn?token=<PLAY_RTDN_TOKEN>
//
// É por aqui que a Sora fica sabendo de renovação, cancelamento, cartão
// recusado, carência, suspensão e reembolso — sem isso o plano ficaria parado
// no estado do dia da compra.
//
// ⚠️ O segredo na URL é só um filtro contra ruído: o conteúdo do aviso NÃO é
// usado pra decidir nada, só o `purchaseToken`, e o estado é relido na API do
// Google (lib/play-sync). Forjar um aviso, no máximo, força uma releitura.
//
// Status de resposta importa: 2xx = "recebido, não mande de novo"; 5xx = o
// Pub/Sub reenvia mais tarde. Só devolvemos erro quando vale tentar de novo.
export async function POST(req: NextRequest) {
  const segredo = process.env.PLAY_RTDN_TOKEN;
  if (!segredo || req.nextUrl.searchParams.get('token') !== segredo) {
    return NextResponse.json({ erro: 'nao_autorizado' }, { status: 403 });
  }

  const corpo = await req.json().catch(() => null) as { message?: { data?: string } } | null;
  let aviso: {
    subscriptionNotification?: { purchaseToken?: string; notificationType?: number; subscriptionId?: string };
    voidedPurchaseNotification?: { purchaseToken?: string; productType?: number };
    testNotification?: unknown;
  } = {};
  try {
    aviso = JSON.parse(Buffer.from(corpo?.message?.data || '', 'base64').toString('utf8'));
  } catch {
    return NextResponse.json({ ignorado: 'mensagem ilegível' });   // reenviar não conserta
  }

  if (aviso.testNotification) {
    console.log('[play/rtdn] aviso de teste do Play Console recebido');
    return NextResponse.json({ ok: true, teste: true });
  }

  // Reembolso de assinatura chega como "compra anulada" (productType 1 = assinatura).
  const token = aviso.subscriptionNotification?.purchaseToken
    || (aviso.voidedPurchaseNotification?.productType === 1 ? aviso.voidedPurchaseNotification.purchaseToken : undefined);
  if (!token) return NextResponse.json({ ignorado: 'sem assinatura no aviso' });

  try {
    const r = await sincronizarToken(token, null);
    return NextResponse.json(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'erro';
    if (e instanceof ErroPlay && e.definitivo) {
      console.warn('[play/rtdn] comprovante inválido, descartado:', msg);
      return NextResponse.json({ ignorado: msg });
    }
    console.error('[play/rtdn] falhou, o Pub/Sub vai reenviar:', msg);
    return NextResponse.json({ erro: msg }, { status: 500 });
  }
}
