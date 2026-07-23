import { createSupabaseServer } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import DashboardClient from './DashboardClient';

// SSR: busca o dashboard no SERVIDOR (sessão via cookie → JWT → backend) e
// entrega o HTML já pintado. O loading.tsx aparece na hora enquanto isso roda
// (sem tela branca); o cliente hidrata com o mesmo dado (fallbackData) e o SWR
// revalida em silêncio. Best-effort: qualquer falha → renderiza SEM dado e o
// cliente busca como antes (comportamento atual preservado).
export const dynamic = 'force-dynamic';

const BASE = process.env.NEXT_PUBLIC_API_URL || '';
// Mesma fórmula do cliente (DashboardClient) pra o mês bater com a chave do SWR.
const mesAtual    = () => new Date().toISOString().slice(0, 7);
const mesAnterior = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);

async function carregar(): Promise<{ phone?: string; data?: any }> {
  try {
    if (!BASE) return {};
    const supabase = await createSupabaseServer();
    const [{ data: { user } }, { data: { session } }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ]);
    const token = session?.access_token;
    if (!user || !token) return {};

    const { data: perfil } = await supabaseAdmin
      .from('users').select('phone').eq('id', user.id).maybeSingle();
    const phone = perfil?.phone || user.id;

    const res = await fetch(
      `${BASE}/api/dashboard/${phone}?mes=${mesAtual()}&mesAnt=${mesAnterior()}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    );
    if (!res.ok) return { phone };
    const data = await res.json();
    // Só usa se veio na forma esperada; senão deixa o cliente buscar.
    return { phone, data: data?.resumo ? data : undefined };
  } catch {
    return {};
  }
}

export default async function DashboardPage() {
  const { phone, data } = await carregar();
  return <DashboardClient phoneInicial={phone} initialData={data} />;
}
