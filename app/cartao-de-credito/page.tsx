import { contextoSSR, backendGet, mesRefSSR } from '@/lib/ssr';
import CartaoClient from './CartaoClient';

export const dynamic = 'force-dynamic';

export default async function CartaoDeCreditoPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <CartaoClient />;
  const mes = mesRefSSR(0);
  const [wallets, txMes, txAll] = await Promise.all([
    backendGet<any>(ctx, `/api/wallets/${ctx.phone}`),
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}?mes=${mes}&limit=500`),
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}?limit=1000`),
  ]);
  return <CartaoClient phoneInicial={ctx.phone} initialData={{ wallets, txMes, txAll }} />;
}
