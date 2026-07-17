'use client';

// Gráfico de evolução do patrimônio — recharts sob demanda (next/dynamic na
// página). ⚠️ Não reimportar recharts na página.

import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);

export default function GraficoPatrimonio({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="gJuros" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(m) => `${m}m`} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)} width={42} />
        <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={(m) => `Mês ${m}`}
                 contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }} />
        <Area type="monotone" dataKey="montante" name="Patrimônio" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gJuros)" />
        <Line type="monotone" dataKey="investido" name="Investido" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
