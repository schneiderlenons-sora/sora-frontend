import { contextoSSR, backendGet, mesRefSSR } from '@/lib/ssr';
import TransacoesClient from './TransacoesClient';

export const dynamic = 'force-dynamic';

export default async function TransacoesPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <TransacoesClient />;
  const mes = mesRefSSR(0);
  const [tx, wallets, resumo] = await Promise.all([
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}?mes=${mes}&limit=500`),
    backendGet<any>(ctx, `/api/wallets/${ctx.phone}`),
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}/resumo?mes=${mes}`),
  ]);
  return <TransacoesClient phoneInicial={ctx.phone} initialData={{ tx, wallets, resumo }} />;
}
