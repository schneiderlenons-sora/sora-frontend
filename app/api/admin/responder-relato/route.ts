import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// Responde um relato de bug/melhoria pelo WhatsApp OFICIAL da Sora (via template,
// então alcança mesmo fora da janela de 24h). O telefone vem do relato (bugId),
// nunca do cliente. Repassa pro backend (credenciais da Meta) com o secret.
export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { bugId, texto } = (await req.json().catch(() => ({}))) as { bugId?: string; texto?: string };
  if (!bugId || !texto?.trim()) {
    return NextResponse.json({ erro: 'Informe o relato e a mensagem.' }, { status: 400 });
  }

  const { data: b } = await supabaseAdmin.from('bug_reports').select('phone, nome').eq('id', bugId).maybeSingle();
  if (!b?.phone) {
    return NextResponse.json({ erro: 'Esse relato não tem WhatsApp — responda por e-mail.' }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ erro: 'Envio não configurado (falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel).' }, { status: 503 });
  }

  try {
    const r = await fetch(`${base}/api/admin/responder-relato`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify({ phone: b.phone, texto: texto.trim() }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ erro: data?.erro || `Falha (${r.status})` }, { status: 502 });
    if (data?.ok === false) {
      return NextResponse.json({ erro: `Não entregue: ${data.erro || 'erro'}${data.code ? ` (código ${data.code})` : ''}` }, { status: 200 });
    }
    return NextResponse.json({ ok: true, para: b.nome || b.phone });
  } catch (e: unknown) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro ao enviar' }, { status: 502 });
  }
}
