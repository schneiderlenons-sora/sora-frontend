import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';
// A varredura por CONTA (?grupo=) roda na hora e paga o cold start do Render.
// A da base inteira NÃO passa por aqui esperando: o POST só dispara (202).
export const maxDuration = 60;

// Diagnóstico financeiro (backend: services/diagnosticoFinanceiro.js).
// O painel já sabe quem é admin (checkAdmin); a chamada vai server-to-server
// com o ADMIN_SECRET — mesmo desenho do /api/admin/of-debug.
async function repassar(req: NextRequest, metodo: 'GET' | 'POST') {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ erro: 'Falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel.' }, { status: 503 });
  }
  const grupo = req.nextUrl.searchParams.get('grupo');
  const url = `${base.replace(/\/$/, '')}/api/admin/diagnostico-financeiro${grupo ? `?grupo=${encodeURIComponent(grupo)}` : ''}`;
  try {
    const r = await fetch(url, { method: metodo, headers: { 'x-admin-secret': secret }, cache: 'no-store' });
    const corpo = await r.json().catch(() => ({ erro: `Resposta inválida do servidor (${r.status}).` }));
    return NextResponse.json(corpo, { status: r.status });
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : 'Servidor indisponível.' }, { status: 502 });
  }
}

export async function GET(req: NextRequest) { return repassar(req, 'GET'); }
export async function POST(req: NextRequest) { return repassar(req, 'POST'); }
