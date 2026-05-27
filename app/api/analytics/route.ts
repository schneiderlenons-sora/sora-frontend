import { NextRequest, NextResponse } from 'next/server';
import { sendCAPIEvent, type CAPIEvent } from '@/lib/facebook-capi';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics
 *
 * Ponte do frontend pra Conversions API. O client-side envia o evento
 * com user_data (email, cookies _fbc/_fbp) e o server encaminha pro
 * Facebook com o access token (que nunca vai pro browser).
 *
 * Body: { event_name, event_id, event_source_url, user_data, custom_data }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as CAPIEvent;

    if (!body.event_name) {
      return NextResponse.json({ error: 'event_name obrigatório' }, { status: 400 });
    }

    // Enriquece com IP e user-agent do request (o browser não consegue enviar isso)
    if (!body.user_data) body.user_data = {};
    body.user_data.client_ip_address =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    body.user_data.client_user_agent =
      req.headers.get('user-agent') || undefined;

    const result = await sendCAPIEvent(body);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
