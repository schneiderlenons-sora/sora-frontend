// Esqueleto do painel Negócios enquanto a próxima tela resolve. O desenho mora
// em `components/negocios/EsqueletoNegocios.tsx` porque o PORTÃO de
// carregamento (components/ui/LoadingGate.tsx) usa o MESMO — assim o esqueleto
// da rota e o do portão caem no mesmo lugar e a troca não pisca (nov/2026).
export { default } from '@/components/negocios/EsqueletoNegocios';
