import { contextoSSR, backendGet, mesRefSSR } from '@/lib/ssr';
import RelatoriosClient from './RelatoriosClient';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <RelatoriosClient />;
  const mes = mesRefSSR(0);
  const mesAnt = mesRefSSR(-1);
  const [resumo, resumoAnt, txs, wallets, cats] = await Promise.all([
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}/resumo?mes=${mes}`),
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}/resumo?mes=${mesAnt}`),
    backendGet<any>(ctx, `/api/transacoes/${ctx.phone}?mes=${mes}&limit=500`),
    backendGet<any>(ctx, `/api/wallets/${ctx.phone}`),
    backendGet<any>(ctx, `/api/categorias/${ctx.phone}`),
  ]);
  return <RelatoriosClient phoneInicial={ctx.phone} initialData={{ resumo, resumoAnt, txs, wallets, cats }} />;
}
