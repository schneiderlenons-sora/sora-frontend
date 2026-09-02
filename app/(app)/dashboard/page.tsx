import { contextoSSR } from '@/lib/ssr';
import { dashboardDireto } from '@/lib/ssr-data';
import DashboardClient from './DashboardClient';

// SSR: busca o dashboard no SERVIDOR e entrega o HTML já pintado. Agora lê
// DIRETO do Supabase (lib/ssr-data), sem o hop lento do Render — medido ~624ms
// (Render) × ~58ms (Supabase direto) de iad1. O loading.tsx aparece na hora
// enquanto isso roda; o cliente hidrata com o mesmo dado (fallbackData) e o SWR
// revalida pelo backend em silêncio. Best-effort: falha → renderiza SEM dado e
// o cliente busca como antes.
export const dynamic = 'force-dynamic';

// Mesma fórmula do cliente (DashboardClient) pra o mês bater com a chave do SWR.
const mesAtual    = () => new Date().toISOString().slice(0, 7);
const mesAnterior = () => new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 7);

export default async function DashboardPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <DashboardClient />;

  let data: any;
  try {
    if (ctx.grupoId) data = await dashboardDireto(ctx.grupoId, mesAtual(), mesAnterior());
  } catch {
    data = undefined;
  }
  // Só usa se veio na forma esperada; senão deixa o cliente buscar.
  return <DashboardClient phoneInicial={ctx.phone} initialData={data?.resumo ? data : undefined} />;
}
