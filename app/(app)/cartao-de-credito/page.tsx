import { contextoSSR } from '@/lib/ssr';
import { walletsDireto, transacoesDireto } from '@/lib/ssr-data';
import CartaoClient from './CartaoClient';

// SSR lê DIRETO do Supabase (sem o hop lento do Render).
export const dynamic = 'force-dynamic';

export default async function CartaoDeCreditoPage() {
  const ctx = await contextoSSR();
  if (!ctx?.grupoId) return <CartaoClient phoneInicial={ctx?.phone} />;
  let initialData: any;
  try {
    // Só as transações mais recentes (sem recorte de mês): a fatura é somada pelo
    // CICLO de fechamento, que cruza meses — um recorte mensal cortaria compras.
    const [wallets, txAll] = await Promise.all([
      walletsDireto(ctx.grupoId),
      transacoesDireto(ctx.grupoId, { limit: 1000 }),
    ]);
    initialData = { wallets, txAll };
  } catch {
    initialData = undefined;
  }
  return <CartaoClient phoneInicial={ctx.phone} initialData={initialData} />;
}
