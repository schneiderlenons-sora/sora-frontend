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
// ⚠️ Aba nova deste painel entra AQUI DENTRO e NÃO declara `DashboardLayout`
// nem `layout.tsx` próprio — aninhar dois shells traz o remount de volta.
// =============================================================================
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
