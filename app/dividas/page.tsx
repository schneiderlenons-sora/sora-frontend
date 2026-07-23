import { contextoSSR, backendGet } from '@/lib/ssr';
import DividasClient from './DividasClient';

export const dynamic = 'force-dynamic';

export default async function DividasPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <DividasClient />;
  const initialData = await backendGet<any>(ctx, `/api/dividas/${ctx.phone}`);
  return <DividasClient phoneInicial={ctx.phone} initialData={initialData} />;
}
