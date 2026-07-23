// Skeleton de SEÇÃO — usado no lugar do spinner central ("baleia") das abas
// client + SWR (Grow, Negócios) enquanto os dados carregam na primeira visita.
// A aba "aparece" como conteúdo (cards + bloco) em vez de girar um loader.
export default function SectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/40" />
        ))}
      </div>
      <div className="h-64 rounded-3xl bg-muted/40" />
    </div>
  );
}
