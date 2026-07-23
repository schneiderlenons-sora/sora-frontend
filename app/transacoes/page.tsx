import { contextoSSR, mesRefSSR } from '@/lib/ssr';
import { transacoesDireto, walletsDireto, resumoDireto } from '@/lib/ssr-data';
import TransacoesClient from './TransacoesClient';

// SSR lê DIRETO do Supabase (sem o hop lento do Render). Best-effort: falha →
// cliente busca pelo backend como antes.
export const dynamic = 'force-dynamic';

export default async function TransacoesPage() {
  const ctx = await contextoSSR();
  if (!ctx?.grupoId) return <TransacoesClient phoneInicial={ctx?.phone} />;
  const mes = mesRefSSR(0);
  let initialData: any;
  try {
    const [tx, wallets, resumo] = await Promise.all([
      transacoesDireto(ctx.grupoId, { mes, limit: 500 }),
      walletsDireto(ctx.grupoId),
      resumoDireto(ctx.grupoId, mes),
    ]);
    initialData = { tx, wallets, resumo };
  } catch {
    initialData = undefined;
  }
  return <TransacoesClient phoneInicial={ctx.phone} initialData={initialData} />;
}
