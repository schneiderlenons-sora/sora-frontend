import { contextoSSR, mesRefSSR } from '@/lib/ssr';
import { resumoDireto, transacoesDireto, walletsDireto, categoriasDireto } from '@/lib/ssr-data';
import RelatoriosClient from './RelatoriosClient';

// SSR lê DIRETO do Supabase (sem o hop lento do Render). Estado padrão do
// relatório: filtro de membro 'todos' (sem criado_por).
export const dynamic = 'force-dynamic';

export default async function RelatoriosPage() {
  const ctx = await contextoSSR();
  if (!ctx?.grupoId) return <RelatoriosClient phoneInicial={ctx?.phone} />;
  const mes = mesRefSSR(0);
  const mesAnt = mesRefSSR(-1);
  let initialData: any;
  try {
    const [resumo, resumoAnt, txs, wallets, cats] = await Promise.all([
      resumoDireto(ctx.grupoId, mes),
      resumoDireto(ctx.grupoId, mesAnt),
      transacoesDireto(ctx.grupoId, { mes, limit: 500 }),
      walletsDireto(ctx.grupoId),
      categoriasDireto(ctx.grupoId),
    ]);
    initialData = { resumo, resumoAnt, txs, wallets, cats };
  } catch {
    initialData = undefined;
  }
  return <RelatoriosClient phoneInicial={ctx.phone} initialData={initialData} />;
}
