import { contextoSSR, mesRefSSR } from '@/lib/ssr';
import { walletsDireto, transacoesDireto } from '@/lib/ssr-data';
import CartaoClient from './CartaoClient';

// SSR lê DIRETO do Supabase (sem o hop lento do Render).
export const dynamic = 'force-dynamic';

export default async function CartaoDeCreditoPage() {
  const ctx = await contextoSSR();
  if (!ctx?.grupoId) return <CartaoClient phoneInicial={ctx?.phone} />;
  const mes = mesRefSSR(0);
  let initialData: any;
  try {
    const [wallets, txMes, txAll] = await Promise.all([
      walletsDireto(ctx.grupoId),
      transacoesDireto(ctx.grupoId, { mes, limit: 500 }),
      transacoesDireto(ctx.grupoId, { limit: 1000 }),
    ]);
    initialData = { wallets, txMes, txAll };
  } catch {
    initialData = undefined;
  }
  return <CartaoClient phoneInicial={ctx.phone} initialData={initialData} />;
}
