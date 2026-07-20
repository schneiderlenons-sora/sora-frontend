import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// Envia uma mensagem de WhatsApp pro cliente direto do painel admin. O telefone
// é resolvido pelo userId no servidor (nunca vem do cliente). Repassa pro
// backend (que tem as credenciais da Meta) com o secret interno.
export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { userId, texto } = (await req.json().catch(() => ({}))) as { userId?: string; texto?: string };
  if (!userId || !texto?.trim()) {
    return NextResponse.json({ erro: 'Informe o usuário e a mensagem.' }, { status: 400 });
  }

  const { data: u } = await supabaseAdmin.from('users').select('phone, name').eq('id', userId).maybeSingle();
  if (!u?.phone) {
    return NextResponse.json({ erro: 'Esse usuário não tem WhatsApp vinculado.' }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ erro: 'Envio não configurado (falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel).' }, { status: 503 });
  }

  try {
    const r = await fetch(`${base}/api/admin/enviar-whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ phone: u.phone, texto: texto.trim() }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ erro: data?.erro || `Falha (${r.status})` }, { status: 502 });
    if (data?.ok === false) {
      const msg = data.foraDaJanela
        ? 'Não entregue: o cliente não fala com a Sora há mais de 24h (janela do WhatsApp). Só templates alcançam fora da janela.'
        : `Não entregue pelo WhatsApp: ${data.erro || 'erro desconhecido'}`;
      return NextResponse.json({ erro: msg }, { status: 200 }); // 200 c/ erro legível pro painel
    }
    return NextResponse.json({ ok: true, para: u.name || u.phone });
  } catch (e: unknown) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro ao enviar' }, { status: 502 });
  }
}
