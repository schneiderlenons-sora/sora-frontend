'use client';

// ─────────────────────────────────────────────────────────────
// Donut interativo reutilizável (Relatórios + Categorias).
//   • Passar mouse / tocar numa fatia → ela expande + brilha; as outras
//     escurecem. Centro do donut vira readout dinâmico (fatia OU total).
//   • Cada fatia usa a COR da própria categoria (data[].color) — respeita a
//     cor que o usuário definiu na aba Categorias.
//   • showList: lista de categorias abaixo, sincronizada com o donut.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { temMarcaConhecida } from '@/components/ui/IconeMarca';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export type DonutSlice = { name: string; value: number; color: string; emoji?: string };

// Respeita prefers-reduced-motion (desliga a animação de entrada do gráfico).
function useReduce() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

// Índice da fatia do evento do Recharts (a posição do arg mudou entre versões).
function idxDaFatia(d: any, i: any): number | null {
  if (typeof i === 'number') return i;
  if (typeof d?.index === 'number') return d.index;
  return null;
}

export default function CategoryDonut({
  data,
  showList = true,
  height = 196,
  innerRadius = 56,
  outerRadius = 82,
}: {
  data: DonutSlice[];
  showList?: boolean;
  height?: number;
  innerRadius?: number;
  outerRadius?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReduce();
  const sel = active !== null ? data[active] : null;

  return (
    <>
      <div className="relative">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            {/* Base — todas as fatias; as não-selecionadas escurecem */}
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={innerRadius} outerRadius={outerRadius}
              dataKey="value"
              paddingAngle={3}
              cornerRadius={4}
              strokeWidth={0}
              isAnimationActive={!reduce}
              onMouseEnter={(d: any, i: any) => { const k = idxDaFatia(d, i); if (k != null) setActive(k); }}
              onMouseLeave={() => setActive(null)}
              onClick={(d: any, i: any) => { const k = idxDaFatia(d, i); if (k != null) setActive((p) => (p === k ? null : k)); }}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color}
                      opacity={active === null || active === i ? 1 : 0.35}
                      style={{ cursor: 'pointer', transition: 'opacity 200ms' }} />
              ))}
            </Pie>
            {/* Overlay — só a fatia SELECIONADA, maior + glow (puramente visual) */}
            {active !== null && (
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={innerRadius} outerRadius={outerRadius + 9}
                dataKey="value"
                paddingAngle={3}
                cornerRadius={4}
                strokeWidth={0}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color}
                        fillOpacity={i === active ? 1 : 0}
                        style={{ pointerEvents: 'none', filter: i === active ? `drop-shadow(0 4px 10px color-mix(in srgb, ${d.color} 50%, transparent))` : undefined }} />
                ))}
              </Pie>
            )}
          </PieChart>
        </ResponsiveContainer>

        {/* Centro dinâmico: fatia selecionada OU total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-8 text-center">
          {sel ? (
            <div key={active} className="flex flex-col items-center animate-fade-in">
              {sel.emoji && <span className="text-lg leading-none mb-0.5">{sel.emoji}</span>}
              <p className="text-[11px] font-semibold text-foreground truncate max-w-[104px]">{sel.name}</p>
              <p className="text-[15px] font-bold tabular leading-tight" style={{ color: sel.color }}>{fmt(sel.value)}</p>
              <p className="text-[10px] text-muted-foreground tabular">{total ? ((sel.value / total) * 100).toFixed(0) : 0}% do total</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Total</p>
              <p className="text-lg font-bold text-foreground tabular">{fmt(total)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Lista interativa — passa o mouse/toca e a fatia correspondente destaca */}
      {showList && (
        <div className="space-y-1 mt-3 max-h-[150px] overflow-y-auto pr-1">
          {data.map((d, i) => {
            const on = active === i;
            const pct = total ? (d.value / total) * 100 : 0;
            return (
              <button
                key={i}
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive((p) => (p === i ? null : i))}
                aria-label={`${d.name}: ${fmt(d.value)}, ${pct.toFixed(0)}% do total`}
                className={`w-full flex items-center gap-2 text-xs rounded-lg px-2 py-2 text-left transition-colors ${on ? 'bg-muted/70' : 'hover:bg-muted/40'}`}
                style={on ? { boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${d.color} 45%, transparent)` } : undefined}
              >
                {d.emoji && temMarcaConhecida(d.name)
                  ? <CategoriaIcon nome={d.name} icone={d.emoji} color={d.color} size={18} />
                  : <span className="text-base flex-shrink-0">{d.emoji ?? '•'}</span>}
                <span className="flex-1 truncate text-foreground/80">{d.name}</span>
                <span className="text-[10px] font-bold tabular px-1.5 py-0.5 rounded-full"
                      style={{ background: `color-mix(in srgb, ${d.color} 15%, transparent)`, color: d.color }}>
                  {pct.toFixed(0)}%
                </span>
                <span className="font-semibold text-foreground tabular w-[68px] text-right text-[11px]">{fmt(d.value)}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
