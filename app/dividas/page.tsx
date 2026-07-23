import { contextoSSR } from '@/lib/ssr';
import { dividasDireto } from '@/lib/ssr-data';
import DividasClient from './DividasClient';

// SSR lê DIRETO do Supabase (sem o hop lento do Render).
export const dynamic = 'force-dynamic';

export default async function DividasPage() {
  const ctx = await contextoSSR();
  if (!ctx?.grupoId) return <DividasClient phoneInicial={ctx?.phone} />;
  let initialData: any;
  try {
    initialData = await dividasDireto(ctx.grupoId, ctx.userId);
  } catch {
    initialData = undefined;
  }
  return <DividasClient phoneInicial={ctx.phone} initialData={initialData} />;
}
