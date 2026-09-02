// =============================================================================
// Boundary de carregamento do painel INTEIRO.
//
// ⚠️ ISTO EXISTE PORQUE SEM ELE O CLIQUE NA ABA NÃO PINTA NADA.
//
// No App Router, o `loading.tsx` é o que cria o Suspense da rota. Sem um
// boundary no caminho, o Next não tem fallback pra mostrar e SEGURA a transição
// até a resposta RSC do servidor chegar — o clique fica ~1s sem efeito visível,
// e a aba só aparece inteira no fim. Com boundary, o esqueleto entra no mesmo
// frame do toque e o conteúdo faz stream por cima.
//
// Onze abas de Finanças já tinham o seu. Faltava em 35 segmentos: TODO o Grow
// (habitos, tarefas, agenda, saude, estudos…), /planos, /configuracoes,
// /open-finance, /comunidade, /reportar-bug, /agentes, /ajuda, /labs e /admin.
// Cinco deles são clique direto da sidebar.
//
// É UM arquivo e não 35 porque o boundary vale pra tudo que está ANINHADO
// abaixo dele: quem não declara o seu usa o do ancestral mais próximo. Os 11
// que já têm um específico continuam com o deles — o mais próximo sempre vence.
//
// ⚠️ Ele fica ABAIXO do `layout.tsx` do grupo, então a Sidebar, o BottomNav e o
// tema NÃO entram no Suspense: só a área de conteúdo troca. É o que faz a
// navegação parecer instantânea em vez de recarregar a tela.
// =============================================================================
export { default } from '@/components/ui/PageSkeleton';
