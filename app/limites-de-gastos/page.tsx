import { contextoSSR, backendGet, mesRefSSR } from '@/lib/ssr';
import LimitesClient from './LimitesClient';

export const dynamic = 'force-dynamic';

export default async function LimitesPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <LimitesClient />;
  const mes = mesRefSSR(0);
  const [cats, resumo, limites] = await Promise.all([
    backendGet<any>(ctx, `/api/categorias/${ctx.phone}`),
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}/resumo?mes=${mes}`),
    backendGet<any>(ctx, `/api/limites/${ctx.phone}?mes=${mes}`),
  ]);
  return <LimitesClient phoneInicial={ctx.phone} initialData={{ cats, resumo, limites }} />;
}
