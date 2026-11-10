import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin-server';
import { chamarBackendAdmin } from '@/lib/admin-backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Revoga na Polp um consentimento que a Sora não conhece mais (órfão da
// reconciliação). O backend recusa se o id ainda for uma conexão ativa nossa.
export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const { consentId } = (await req.json().catch(() => ({}))) as { consentId?: string };
  if (!consentId) return NextResponse.json({ erro: 'Falta consentId.' }, { status: 400 });
  const r = await chamarBackendAdmin('/api/admin/revogar-consentimento', {
    method: 'POST', body: { consent_id: consentId },
  });
  return NextResponse.json(r.body, { status: r.ok ? 200 : r.status });
}
