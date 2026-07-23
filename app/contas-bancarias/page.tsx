import { contextoSSR, backendGet } from '@/lib/ssr';
import ContasClient from './ContasClient';

export const dynamic = 'force-dynamic';

export default async function ContasBancariasPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <ContasClient />;
  const initialData = await backendGet<any>(ctx, `/api/wallets/${ctx.phone}`);
  return <ContasClient phoneInicial={ctx.phone} initialData={initialData} />;
}
