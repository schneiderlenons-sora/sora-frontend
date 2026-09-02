import { contextoSSR, mesRefSSR } from '@/lib/ssr';
import { categoriasDireto, resumoDireto, limitesDireto } from '@/lib/ssr-data';
import LimitesClient from './LimitesClient';

// SSR lê DIRETO do Supabase (sem o hop lento do Render).
export const dynamic = 'force-dynamic';

export default async function LimitesPage() {
  const ctx = await contextoSSR();
  if (!ctx?.grupoId) return <LimitesClient phoneInicial={ctx?.phone} />;
  const mes = mesRefSSR(0);
  let initialData: any;
  try {
    const [cats, resumo, limites] = await Promise.all([
      categoriasDireto(ctx.grupoId),
      resumoDireto(ctx.grupoId, mes),
      limitesDireto(ctx.grupoId, mes, ctx.userId),
    ]);
    initialData = { cats, resumo, limites };
  } catch {
    initialData = undefined;
  }
  return <LimitesClient phoneInicial={ctx.phone} initialData={initialData} />;
}
