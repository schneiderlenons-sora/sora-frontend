import { contextoSSR, backendGet } from '@/lib/ssr';
import MetasClient from './MetasClient';

export const dynamic = 'force-dynamic';

export default async function MetasPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <MetasClient />;
  const initialMetas = await backendGet<any[]>(ctx, `/api/investimentos/${ctx.phone}/metas`);
  return <MetasClient phoneInicial={ctx.phone} initialMetas={initialMetas} />;
}
