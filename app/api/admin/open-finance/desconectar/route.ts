import { NextRequest, NextResponse } from 'next/server';
import { checkAdmin } from '@/lib/admin-server';
import { chamarBackendAdmin } from '@/lib/admin-backend';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Desconecta UMA conexão de banco de um cliente, revogando o consentimento na
// Polp (é o que para a cobrança dela). O backend só apaga a linha se a Polp
// confirmar — falhou, nada muda e dá pra tentar de novo.
//
// ⚠️ NÃO mexe na assinatura do Stripe: conexão e cobrança são coisas
// separadas (a franquia do plano não tem assinatura nenhuma). Cancelar a
// cobrança é o outro botão, de propósito — juntar os dois faria um clique
// tirar o banco E a receita de quem só queria trocar de banco.
export async function POST(req: NextRequest) {
  const gate = await checkAdmin();
  if ('error' in gate) return gate.error;
  const { conexaoId } = (await req.json().catch(() => ({}))) as { conexaoId?: string };
  if (!conexaoId) return NextResponse.json({ erro: 'Falta conexaoId.' }, { status: 400 });
  const r = await chamarBackendAdmin('/api/admin/desconectar-conexao', {
    method: 'POST', body: { conexao_id: conexaoId },
  });
  return NextResponse.json(r.body, { status: r.ok ? 200 : r.status });
}
