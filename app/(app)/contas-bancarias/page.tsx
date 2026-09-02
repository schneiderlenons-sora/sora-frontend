import { contextoSSR } from '@/lib/ssr';
import { walletsDireto } from '@/lib/ssr-data';
import ContasClient from './ContasClient';

// SSR lê DIRETO do Supabase (sem o hop lento do Render).
export const dynamic = 'force-dynamic';

export default async function ContasBancariasPage() {
  const ctx = await contextoSSR();
  if (!ctx?.grupoId) return <ContasClient phoneInicial={ctx?.phone} />;
  let initialData: any;
  try {
    initialData = await walletsDireto(ctx.grupoId);
  } catch {
    initialData = undefined;
  }
  return <ContasClient phoneInicial={ctx.phone} initialData={initialData} />;
}
