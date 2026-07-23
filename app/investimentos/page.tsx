import { contextoSSR, backendGet } from '@/lib/ssr';
import InvestimentosClient from './InvestimentosClient';

export const dynamic = 'force-dynamic';

export default async function InvestimentosPage() {
  const ctx = await contextoSSR();
  if (!ctx) return <InvestimentosClient />;
  // Gated (Premium): se o backend recusar, backendGet devolve undefined e o
  // client cai no gate/upsell normalmente.
  const [invs, aportes, patrimonio, reserva] = await Promise.all([
    backendGet<any>(ctx, `/api/investimentos/${ctx.phone}`),
    backendGet<any>(ctx, `/api/investimentos/${ctx.phone}/aportes`),
    backendGet<any>(ctx, `/api/investimentos/${ctx.phone}/patrimonio`),
    backendGet<any>(ctx, `/api/investimentos/reserva/${ctx.phone}`),
  ]);
  return <InvestimentosClient phoneInicial={ctx.phone} initialData={{ invs, aportes, patrimonio, reserva }} />;
}
