'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Orçamento do ANO — 12 meses, realizado × previsto.
//
// ⚠️ ARQUIVO SEPARADO DE PROPÓSITO: é o único ponto da aba Limites que importa
// recharts (~288 KB + d3), e a página o carrega com next/dynamic + ssr:false.
// Importar recharts direto na página traz o custo de volta pro bundle inicial.
//
// Recebe os dados PRONTOS — quem busca e formata rótulo de mês é a página.
// ─────────────────────────────────────────────────────────────────────────────

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { useFmt } from '@/lib/valores-ocultos';
import { useDinheiro, useSimboloMoeda } from '@/lib/moeda-base';

// "Previsto" é o teto: cinza-neutro, pra não competir com o dado real.
// ⚠️ Os dois NÃO se distinguem só pela cor (regra `color-not-only`): o
// realizado é sólido e o previsto tem contorno tracejado, então a leitura
// sobrevive em escala de cinza e pra daltônico. A legenda nomeia os dois.
const COR_REALIZADO = 'hsl(var(--primary))';
const COR_PREVISTO  = 'hsl(var(--muted-foreground))';

export type MesAno = { mes: string; realizado: number; previsto: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipAno({ active, payload, label }: any) {
  const fmtCru = useDinheiro();
  // ⚠️ O hook vem ANTES do early return — Regras dos Hooks. Este componente é
  // passado como `content={<TooltipAno/>}`, então é componente de verdade.
  const fmt = useFmt(fmtCru);
  if (!active || !payload?.length) return null;

  const real = Number(payload.find((p: any) => p.dataKey === 'realizado')?.value || 0);
  const prev = Number(payload.find((p: any) => p.dataKey === 'previsto')?.value || 0);
  const sobra = prev - real;

  return (
    <div className="rounded-xl p-3 shadow-xl text-sm min-w-[190px] border border-border/60"
         style={{ background: 'hsl(var(--bg-card))' }}>
      <p className="font-semibold text-foreground mb-1.5 text-xs">{label}</p>
      <p className="text-xs flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Realizado</span>
        <span className="font-bold tabular" style={{ color: COR_REALIZADO }}>{fmt(real)}</span>
      </p>
      {prev > 0 && (
        <>
          <p className="text-xs flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Previsto</span>
            <span className="font-bold tabular text-foreground">{fmt(prev)}</span>
          </p>
          <p className="text-xs flex items-center justify-between gap-3 mt-1.5 pt-1.5 border-t border-border/50">
            {/* Ícone + palavra, nunca só a cor. */}
            <span className="text-muted-foreground">{sobra >= 0 ? 'Dentro do teto' : 'Acima do teto'}</span>
            <span className={`font-bold tabular ${sobra >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {sobra >= 0 ? '' : '+'}{fmt(Math.abs(sobra))}
            </span>
          </p>
        </>
      )}
    </div>
  );
}

export default function GraficoAno({ meses, media }: { meses: MesAno[]; media?: number }) {
  const fmtCru = useDinheiro();
  const simbolo = useSimboloMoeda();
  const fmt = useFmt(fmtCru);

  // ⚠️ NO EIXO A MÁSCARA É VAZIA, não pontinhos: cinco "••••" empilhados viram
  // ruído e o gráfico continua legível pela FORMA das barras. Mesma escolha
  // documentada do dashboard e dos relatórios.
  const fmtEixo = useFmt((v: number) =>
    v >= 1000 ? `${simbolo}${(v / 1000).toFixed(0)}k` : `${simbolo}${Math.round(v)}`, '');

  return (
    <div className="w-full" style={{ height: 260 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={meses} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2}>
          {/* Grade discreta: não pode competir com o dado (`gridline-subtle`). */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.45} />
          <XAxis
            dataKey="mes" tickLine={false} axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            // Em 375px os 12 rótulos não cabem — o recharts pula sozinho em vez
            // de rotacionar (rótulo girado é ilegível no celular).
            interval="preserveStartEnd" minTickGap={4}
          />
          <YAxis
            tickLine={false} axisLine={false} width={56}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={fmtEixo}
          />
          <Tooltip content={<TooltipAno />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }} />
          <Legend
            verticalAlign="top" height={28} iconSize={10}
            wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}
          />
          {media != null && media > 0 && (
            <ReferenceLine
              y={media} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" opacity={0.7}
              label={{ value: `média ${fmt(media)}`, position: 'insideTopRight',
                fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
          )}
          <Bar dataKey="realizado" name="Realizado" fill={COR_REALIZADO} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar
            dataKey="previsto" name="Previsto (teto)"
            fill="transparent" stroke={COR_PREVISTO} strokeDasharray="3 2" strokeWidth={1.5}
            radius={[4, 4, 0, 0]} maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
