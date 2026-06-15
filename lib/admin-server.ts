import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { isAdminEmail } from '@/lib/admin';

type AdminGate =
  | { user: { id: string; email: string | null } }
  | { error: NextResponse };

/**
 * Guarda de admin pra rotas /api/admin/*. Valida a sessão (cookie) e o e-mail
 * contra a allowlist. Uso:
 *   const gate = await checkAdmin();
 *   if ('error' in gate) return gate.error;
 *   // ... gate.user disponível
 */
export async function checkAdmin(): Promise<AdminGate> {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ erro: 'Não autenticado' }, { status: 401 }) };
  }
  if (!isAdminEmail(user.email)) {
    return { error: NextResponse.json({ erro: 'Acesso negado' }, { status: 403 }) };
  }
  return { user: { id: user.id, email: user.email ?? null } };
}
