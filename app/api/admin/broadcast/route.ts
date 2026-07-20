import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// Comunicado em massa pelo WhatsApp OFICIAL da Sora (template lembretes_gerais).
// modo: 'contar' (só conta) | 'teste' (manda pro seu número) | 'disparar' (envia).
// O backend (credenciais da Meta) resolve os destinatários e envia; aqui só
// validamos admin, montamos o payload e passamos o secret.
export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const { modo, texto, planos, testePhone } = (await req.json().catch(() => ({}))) as {
    modo?: 'contar' | 'teste' | 'disparar';
    texto?: string;
    planos?: string[];
    testePhone?: string;
  };

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ erro: 'Envio não configurado (falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel).' }, { status: 503 });
  }

  let payload: Record<string, unknown>;
  if (modo === 'teste') {
    // Número de teste: o digitado, senão o do próprio admin (do registro).
    let phone = String(testePhone || '').replace(/\D/g, '');
    if (!phone) {
      const { data: me } = await supabaseAdmin.from('users').select('phone').eq('id', gate.user.id).maybeSingle();
      phone = String(me?.phone || '').replace(/\D/g, '');
    }
    if (!phone) return NextResponse.json({ erro: 'Sem número de teste — digite um ou vincule seu WhatsApp.' }, { status: 400 });
    payload = { texto: String(texto || '').trim(), teste: phone };
  } else if (modo === 'contar') {
    payload = { planos: planos || [], dryRun: true };
  } else if (modo === 'disparar') {
    payload = { texto: String(texto || '').trim(), planos: planos || [] };
  } else {
    return NextResponse.json({ erro: 'modo inválido' }, { status: 400 });
  }

  try {
    const r = await fetch(`${base}/api/admin/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json({ erro: data?.erro || `Falha (${r.status})` }, { status: 502 });
    if (data?.ok === false) {
      return NextResponse.json({ erro: `Não entregue: ${data.erro || 'erro'}${data.code ? ` (código ${data.code})` : ''}` }, { status: 200 });
    }
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Erro ao enviar' }, { status: 502 });
  }
}
