// Skeleton genérico de página — usado pelos loading.tsx das abas (aparece na
// hora enquanto o Server Component busca os dados; sem tela branca / "baleia").
export default function PageSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 pb-24 space-y-6 animate-pulse">
      <div className="h-24 rounded-3xl bg-muted/40" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted/40" />
        ))}
      </div>
      <div className="h-16 rounded-2xl bg-muted/40" />
      <div className="h-72 rounded-2xl bg-muted/40" />
    </div>
  );
}
