import { contextoSSR, backendGet, mesRefSSR } from '@/lib/ssr';
import CategoriasClient from './CategoriasClient';

export const dynamic = 'force-dynamic';

export default async function CategoriasPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <CategoriasClient />;
  const mes = mesRefSSR(0);
  const [cats, resumo, limites] = await Promise.all([
    backendGet<any>(ctx, `/api/categorias/${ctx.phone}`),
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}/resumo?mes=${mes}`),
    backendGet<any>(ctx, `/api/limites/${ctx.phone}?mes=${mes}`),
  ]);
  return <CategoriasClient phoneInicial={ctx.phone} initialData={{ cats, resumo, limites }} />;
}
