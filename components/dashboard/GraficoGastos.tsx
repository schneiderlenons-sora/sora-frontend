'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Gráfico de gastos do dashboard (área por dia / barra por categoria).
//
// Vive num arquivo SEPARADO de propósito: é o único ponto do dashboard que
// importa recharts, e a página o carrega com next/dynamic + ssr:false. Assim o
// recharts (~288 KB) sai do bundle inicial e vira um chunk sob demanda.
// ⚠️ Não importar recharts direto na página de novo — o custo volta.
//
// Recebe os dados PRONTOS: quem sabe formatar categoria/mês é a página.
// ─────────────────────────────────────────────────────────────────────────────

import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const BRAND  = 'hsl(var(--primary))';
const BRAND2 = '#3dd68c';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtShort = (v: number) =>
  v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : v > 0 ? `R$${v}` : 'R$0';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl p-3 shadow-xl text-sm min-w-[150px] border border-border/60"
         style={{ background: 'hsl(var(--bg-card))' }}>
      <p className="font-semibold text-foreground mb-1.5 text-xs">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="text-xs flex items-center justify-between gap-3">
          <span>{p.name}</span>
          <span className="font-bold tabular">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export type BarraGasto = { name: string; gastos: number; color: string };
export type PontoDiario = { dia: string; valor: number };

interface Props {
  modo:   'area' | 'bar';
  barras: BarraGasto[];
  area:   PontoDiario[];
}

export default function GraficoGastos({ modo, barras, area }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      {modo === 'bar' ? (
        <BarChart data={barras} barSize={28}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--bg-muted))' }} />
          <Bar dataKey="gastos" name="Gastos" radius={[6, 6, 0, 0]}>
            {barras.map((b, i) => <Cell key={i} fill={b.color} />)}
          </Bar>
        </BarChart>
      ) : (
        <AreaChart data={area} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="gFluxoArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={BRAND}  stopOpacity={0.55} />
              <stop offset="60%"  stopColor={BRAND2} stopOpacity={0.18} />
              <stop offset="100%" stopColor={BRAND}  stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
                 tickFormatter={v => Number(v) % 5 === 0 ? v : ''} />
          <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} tickFormatter={fmtShort} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="valor"
            name="Gasto no dia"
            stroke={BRAND}
            fill="url(#gFluxoArea)"
            strokeWidth={2.5}
            dot={{ r: 2, fill: BRAND, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: BRAND, stroke: 'white', strokeWidth: 2 }}
          />
        </AreaChart>
      )}
    </ResponsiveContainer>
  );
}
