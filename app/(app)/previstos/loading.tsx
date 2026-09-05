// O boundary de Suspense desta rota. Sem ele o Next SEGURA a transição até a
// resposta chegar e o clique fica sem efeito visível — a lição já registrada
// no CLAUDE.md sobre os 35 segmentos que não tinham `loading.tsx`.
export { default } from '@/components/ui/SectionSkeleton';
