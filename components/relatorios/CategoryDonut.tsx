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
  compacto = false,
  espacado = false,
  legendaCentro,
  valorGrande = false,
}: {
  data: DonutSlice[];
  showList?: boolean;
  // ⚠️ Aceita PORCENTAGEM ('62%'), não só pixel. É o que deixa o donut crescer
  // junto com o container em vez de exigir um raio por breakpoint: em
  // /categorias ele ocupa quase a largura da tela no mobile e ~240px no
  // desktop, com os MESMOS valores.
  height?: number | string;
  innerRadius?: number | string;
  outerRadius?: number | string;
  // Texto do centro menor. Com o donut grande, o total em `text-lg` competia
  // com o valor do topo do card; encolher devolve o protagonismo ao gráfico.
  compacto?: boolean;
  // Fatias separadas e com as pontas totalmente arredondadas, em vez do anel
  // quase contínuo. Cada categoria vira um traço solto — lê-se como uma lista
  // em círculo, não como uma pizza. Usado no card do dashboard.
  espacado?: boolean;
  // Troca o rótulo "TOTAL" (acima, minúsculo) por uma legenda ABAIXO do valor.
  legendaCentro?: string;
  // Valor do centro como protagonista do card.
  valorGrande?: boolean;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  // Raio da fatia em DESTAQUE: um pouco maior que o normal. Precisa saber lidar
  // com os dois formatos — em pixel soma 9; em porcentagem soma 4 pontos, senão
  // `'90%' + 9` viraria a string `'90%9'` e o realce sumia.
  const raioDestaque = typeof outerRadius === 'string'
    ? `${Math.min(100, (parseFloat(outerRadius) || 0) + 4)}%`
    : outerRadius + 9;
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReduce();
  const sel = active !== null ? data[active] : null;

  return (
    <>
      <div className="relative h-full">
        <ResponsiveContainer width="100%" height={height as never}>
          <PieChart>
            {/* Base — todas as fatias; as não-selecionadas escurecem */}
            <Pie
              data={data}
              cx="50%" cy="50%"
              innerRadius={innerRadius} outerRadius={outerRadius}
              dataKey="value"
              paddingAngle={espacado ? 7 : 3}
              cornerRadius={espacado ? 999 : 4}
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
                innerRadius={innerRadius} outerRadius={raioDestaque}
                dataKey="value"
                paddingAngle={espacado ? 7 : 3}
                cornerRadius={espacado ? 999 : 4}
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
              {sel.emoji && <span className={`${valorGrande ? 'text-2xl' : 'text-lg'} leading-none mb-1`}>{sel.emoji}</span>}
              <p className={`${valorGrande ? 'text-sm max-w-[150px]' : 'text-[11px] max-w-[104px]'} font-semibold text-foreground truncate`}>{sel.name}</p>
              <p className={`${valorGrande ? 'text-xl' : 'text-[15px]'} font-bold tabular leading-tight`} style={{ color: sel.color }}>{fmt(sel.value)}</p>
              <p className={`${valorGrande ? 'text-xs' : 'text-[10px]'} text-muted-foreground tabular`}>{total ? ((sel.value / total) * 100).toFixed(0) : 0}% do total</p>
            </div>
          ) : legendaCentro ? (
            /* Valor primeiro, legenda embaixo — a leitura natural de "quanto"
               antes de "do quê". Só quando a legenda é passada; sem ela, segue
               o rótulo TOTAL acima, como Relatórios e Categorias já usam. */
            <div className="flex flex-col items-center">
              <p className={`${valorGrande ? 'text-2xl' : 'text-lg'} font-bold text-foreground tabular leading-none`}>{fmt(total)}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{legendaCentro}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <p className={`${compacto ? 'text-[9px]' : 'text-[10px]'} text-muted-foreground uppercase tracking-wider font-bold`}>Total</p>
              <p className={`${compacto ? 'text-[15px]' : 'text-lg'} font-bold text-foreground tabular`}>{fmt(total)}</p>
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
