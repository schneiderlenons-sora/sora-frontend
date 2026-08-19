import { NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin-server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Reconcilia o que a POLP cobra com o que a SORA usa.
//
// ⚠️ A conta da Polp é POR CONEXÃO. O painel deles mostrou 35 consentimentos
// enquanto o nosso mostrava 24 conexões — e a diferença não é cosmética, é
// fatura. Este endpoint separa as causas:
//
//   · consentimento abandonado no meio (o usuário saiu antes do callback, então
//     nunca virou linha nossa);
//   · revogado/expirado que a Polp mantém no histórico;
//   · RECONEXÃO — cada uma cria um consent NOVO lá e o antigo continua. Este é o
//     caro: some da nossa tabela e segue sendo cobrado.
//
// Abrir no navegador logado como admin:
//   /api/admin/of-consents
export async function GET() {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;

  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return NextResponse.json(
      { erro: 'Falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel.' }, { status: 503 });
  }

  try {
    const r = await fetch(`${base}/api/open-finance/consents-reconciliar`, {
      headers: { 'x-admin-secret': secret }, cache: 'no-store',
    });
    const body = await r.json().catch(() => ({ erro: `resposta inválida (${r.status})` }));
    return NextResponse.json({
      como_ler:
        'na_polp é o que eles cobram; na_sora é o que usamos. `orfaos` são os '
        + 'consentimentos que existem só lá — candidatos a revogar. Confira o '
        + 'status antes: revogado/expirado normalmente já não é cobrado.',
      ...body,
    }, { status: r.status });
  } catch (e: unknown) {
    return NextResponse.json({
      erro: e instanceof Error ? e.message : 'falhou',
      dica: 'Se demorou e caiu, é cold start do Render. Recarregue uma vez.',
    }, { status: 502 });
  }
}
