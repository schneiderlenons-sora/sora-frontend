import { contextoSSR } from '@/lib/ssr';
import PrevistosClient from './PrevistosClient';

export const dynamic = 'force-dynamic';

/**
 * Aba Previstos — o que ainda vai entrar e sair, e como ficam os próximos meses.
 *
 * ⚠️ NÃO declara `DashboardLayout`: ele já vem do `app/(app)/layout.tsx`.
 * Aninhar dois shells traz de volta o remount que causava delay ao trocar de
 * aba (registrado no CLAUDE.md).
 *
 * O servidor entrega só o `phone`, e o resto vem por SWR no cliente. ⚠️ Esse
 * phone importa: a key do SWR depende dele, e sem ele o cliente ficaria com a
 * key `null` até a sessão hidratar — a aba abriria vazia por um instante.
 *
 * Não uso o SSR-com-leitura-direta das outras abas de propósito: ele é um porte
 * FIEL de queries do backend, e aqui seriam quatro rotas diferentes (recorrências,
 * dívidas, faturas, resumo anual) — muita superfície pra divergir, pouco ganho.
 */
export default async function PrevistosPage() {
  const ctx = await contextoSSR();
  return <PrevistosClient phoneInicial={ctx?.phone} />;
}
