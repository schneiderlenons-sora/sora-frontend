'use client';

import { ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { CATEGORIAS, comandosPorCategoria } from '@/lib/sora-commands';
import { PLANO_LABEL, planoMinimo } from '@/lib/plans';

type Categoria = (typeof CATEGORIAS)[number];

export default function CategoriaCard({
  categoria,
  onClick,
}: {
  categoria: Categoria;
  onClick:   () => void;
}) {
  const { podeUsar } = useAuth();
  const bloqueada   = categoria.feature && !podeUsar(categoria.feature);
  const total       = comandosPorCategoria(categoria.id).length;
  const planoNec    = categoria.feature ? PLANO_LABEL[planoMinimo(categoria.feature)] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative text-left p-5 rounded-2xl border bg-card transition-all duration-300 overflow-hidden
        ${bloqueada
          ? 'border-border/60 hover:border-border'
          : 'border-border hover:border-primary/40 hover:-translate-y-1 hover:shadow-lg'}`}
    >
      {/* Glow no hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ background: `radial-gradient(ellipse 100% 60% at 50% 0%, ${categoria.cor}1A 0%, transparent 60%)` }}
      />

      <div className="relative">
        {/* Header: emoji + nome + badge */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-glow-sm"
            style={{ background: `linear-gradient(135deg, ${categoria.cor}, ${categoria.corDark})` }}
          >
            {categoria.emoji}
          </div>
          {bloqueada && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-muted/50 text-muted-foreground">
              <Lock size={9} /> {planoNec}
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-foreground tracking-tight">{categoria.nome}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-snug line-clamp-2">{categoria.descricao}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">
            {total} {total === 1 ? 'comando' : 'comandos'}
          </span>
          <ArrowRight
            size={14}
            className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all"
          />
        </div>
      </div>
    </button>
  );
}
