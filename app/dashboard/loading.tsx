// Skeleton mostrado NA HORA enquanto o page.tsx (Server Component) busca os
// dados no servidor. Renderiza dentro do layout do segmento → a sidebar já
// está lá; aqui só o esqueleto do conteúdo (sem tela branca, sem "baleia").
import { ALTURA_ESPACADOR, ALTURA_ESPACADOR_DESKTOP } from '@/lib/dashboard-hero';

export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 pb-24 space-y-6 animate-pulse">
      {/* Espaço do vídeo de fundo (só mobile) — precisa ser reservado aqui,
          senão o conteúdo pula ~230px quando os dados chegam (CLS). */}
      <div className="md:hidden" style={{ height: ALTURA_ESPACADOR }} />
      <div className="hidden md:block" style={{ height: ALTURA_ESPACADOR_DESKTOP }} />
      {/* Saudação / header */}
      <div className="h-24 rounded-3xl bg-muted/40" />
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-muted/40" />
        ))}
      </div>
      {/* Gráfico */}
      <div className="h-64 rounded-3xl bg-muted/40" />
      {/* Lista de transações */}
      <div className="h-72 rounded-2xl bg-muted/40" />
    </div>
  );
}
