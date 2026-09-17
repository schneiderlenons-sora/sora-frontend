import { cookies } from 'next/headers';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { ValoresProvider, COOKIE_VALORES } from '@/lib/valores-ocultos';
import { MoedaBaseProvider } from '@/lib/moeda-base';
import { contextoSSR } from '@/lib/ssr';

// =============================================================================
// Shell ÚNICO das abas do painel.
//
// ⚠️ ISTO EXISTE PRA O SHELL NÃO REMONTAR A CADA TROCA DE ABA.
//
// Antes cada aba tinha o SEU `layout.tsx` montando o próprio `DashboardLayout`
// — `app/dashboard/layout.tsx`, `app/transacoes/layout.tsx`, e mais dez. No App
// Router, segmentos IRMÃOS não compartilham layout: ir de /dashboard pra
// /transacoes desmontava um layout inteiro e montava outro, destruindo e
// reconstruindo Sidebar, BottomNav e tema a cada clique.
//
// O custo não era só desenhar de novo: todo `useEffect` do shell voltava a
// rodar. O aquecimento de rotas da Sidebar, por exemplo, re-disparava ~38
// `router.prefetch()` a cada navegação — o app enfileirava a própria navegação
// atrás do próprio prefetch.
//
// Como `(app)` é um ROUTE GROUP, o nome entre parênteses NÃO entra na URL:
// /transacoes continua /transacoes. O que muda é só onde o shell vive.
//
// É o mesmo desenho já validado em `app/negocios/layout.tsx`, que passou por
// exatamente este problema e foi corrigido primeiro.
//
// Hoje o grupo cobre as 21 rotas do painel. A primeira leva trouxe as 12 abas
// de Finanças e o Grow; a segunda trouxe as que montavam o `DashboardLayout`
// DENTRO da própria página — /planos, /configuracoes, /open-finance,
// /comunidade, /reportar-bug, /agentes, /ajuda, /labs e /admin. Enquanto
// estavam de fora, sair de uma aba do grupo pra uma delas remontava o shell
// inteiro, que é o mesmo defeito, só que na fronteira do grupo.
//
// ⚠️ Aba nova deste painel entra AQUI DENTRO e NÃO declara `DashboardLayout`
// nem `layout.tsx` próprio — aninhar dois shells traz o remount de volta.
//
// ⚠️ FICAM FORA DE PROPÓSITO:
//   • `/negocios` — é painel IRMÃO, com shell próprio, e o `EmpresaProvider`
//     precisa ficar POR FORA do `DashboardLayout` (a Sidebar consome esse
//     contexto). Trazê-lo pra cá exigiria subir o provider pro shell de todo
//     mundo, fazendo o app inteiro carregar empresas.
//   • `/wrapped` — é tela cheia, nunca teve sidebar; entrar aqui GANHARIA uma.
// =============================================================================
//
// ⚠️ O COOKIE DE "OCULTAR VALORES" É LIDO AQUI, NO SERVIDOR — não no cliente.
// As telas do painel chegam com o HTML já pintado (SSR + `fallbackData`); lendo
// a preferência só depois da hidratação, os números apareceriam por um instante
// justamente pra quem pediu pra escondê-los. Lendo aqui, o primeiro paint já
// sai mascarado e não há hydration mismatch.
//
// ⚠️ Fica NESTE layout, e não no `app/layout.tsx`: ler cookie torna o segmento
// dinâmico, e as rotas do painel já são (`ƒ`). Subir isso pro layout raiz
// arrastaria a landing junto, que não usa a preferência.
//
// ⚠️ A MOEDA BASE DO GRUPO TAMBÉM É LIDA AQUI, pelo mesmo motivo: lida só no
// cliente, o primeiro paint sairia com "R$" e trocaria pro símbolo do grupo
// depois da hidratação. `contextoSSR` é `React.cache` — as abas que já o chamam
// na página dividem esta MESMA leitura, sem ida extra ao banco.
export default async function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [jar, ctx] = await Promise.all([cookies(), contextoSSR()]);
  const ocultos = jar.get(COOKIE_VALORES)?.value === '1';
  return (
    <MoedaBaseProvider moeda={ctx?.moedaBase}>
      <ValoresProvider inicial={ocultos}>
        <DashboardLayout>{children}</DashboardLayout>
      </ValoresProvider>
    </MoedaBaseProvider>
  );
}
