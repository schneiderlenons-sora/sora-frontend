import { NextRequest, NextResponse } from 'next/server';
import { sendTikTokEvent, type TikTokEvent } from '@/lib/tiktok-events-api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/analytics/tiktok
 *
 * Ponte do frontend pra TikTok Events API. Espelha /api/analytics (Meta).
 * O client-side manda o evento com user_data (email, cookies _ttp/ttclid) e
 * o server encaminha pro TikTok com o access token (nunca vai pro browser).
 *
 * Body: { event, event_id, event_source_url, user_data, custom_data }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as TikTokEvent;

    if (!body.event) {
      return NextResponse.json({ error: 'event obrigatório' }, { status: 400 });
    }

    // Enriquece com IP e user-agent do request (o browser não consegue enviar isso)
    if (!body.user_data) body.user_data = {};
    body.user_data.client_ip_address =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      undefined;
    body.user_data.client_user_agent =
      req.headers.get('user-agent') || undefined;

    const result = await sendTikTokEvent(body);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
