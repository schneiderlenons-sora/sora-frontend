import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';

// Diagnóstico do Open Finance de UM usuário, aberto pelo navegador.
//
// A rota do backend (`/api/open-finance/debug-celcoin/:consentId`) exige token
// Bearer da sessão — o navegador não manda isso, então abrir a URL direto dava
// "Não autenticado". Aqui o painel já sabe quem é você (checkAdmin) e a chamada
// pro backend vai server-to-server com o ADMIN_SECRET.
//
// Uso:  /api/admin/of-debug?email=cliente@exemplo.com
//       (sem email → lista as conexões pra escolher; &cru=1 traz o payload bruto)
export async function GET(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ erro: 'Falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel.' }, { status: 503 });
  }

  const email = (req.nextUrl.searchParams.get('email') || '').trim().toLowerCase();
  const consentParam = (req.nextUrl.searchParams.get('consent') || '').trim();
  const cru = req.nextUrl.searchParams.get('cru') === '1';

  let consents: string[] = consentParam ? [consentParam] : [];
  let contexto: Record<string, unknown> = {};

  if (!consents.length) {
    if (!email) {
      return NextResponse.json({
        erro: 'Informe ?email=<e-mail do cliente> (ou ?consent=<id>).',
        exemplo: '/api/admin/of-debug?email=cliente@exemplo.com',
      }, { status: 400 });
    }
    const { data: u } = await supabaseAdmin
      .from('users').select('id, name, grupo_ativo').eq('email', email).maybeSingle();
    if (!u) return NextResponse.json({ erro: `Nenhum usuário com o e-mail ${email}.` }, { status: 404 });

    const { data: cx } = await supabaseAdmin
      .from('of_conexoes')
      .select('external_id, provider, status, ultima_sync, ultimo_erro')
      .eq('grupo_id', u.grupo_ativo);

    consents = (cx || []).map((c) => String(c.external_id));
    contexto = { usuario: { nome: u.name, email }, conexoes: cx || [] };

    if (!consents.length) {
      return NextResponse.json({ ...contexto, erro: 'Esse usuário não tem conexão de Open Finance.' }, { status: 404 });
    }
  }

  // Carteiras do grupo entram no retorno pra dar pra comparar o que ESTÁ gravado
  // com o que a API responde agora — é a metade da conferência que não aparece
  // no payload do banco.
  const saida: Record<string, unknown> = { ...contexto, diagnostico: [] as unknown[] };

  for (const consent of consents) {
    try {
      const r = await fetch(
        `${base}/api/open-finance/debug-celcoin/${encodeURIComponent(consent)}${cru ? '?cru=1' : ''}`,
        { headers: { 'x-admin-secret': secret }, cache: 'no-store' },
      );
      const body = await r.json().catch(() => ({ erro: `resposta inválida (${r.status})` }));
      (saida.diagnostico as unknown[]).push({ consent, status: r.status, ...body });
    } catch (e: unknown) {
      (saida.diagnostico as unknown[]).push({ consent, erro: e instanceof Error ? e.message : 'falhou' });
    }
  }

  return NextResponse.json(saida);
}
