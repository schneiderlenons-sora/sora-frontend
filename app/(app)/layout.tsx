import DashboardLayout from '@/components/layout/DashboardLayout';

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
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
