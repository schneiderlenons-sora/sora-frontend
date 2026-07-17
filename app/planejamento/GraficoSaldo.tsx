'use client';

// Gráfico de saldo acumulado — separado da página pra carregar o recharts
// (~288 KB) sob demanda via next/dynamic. ⚠️ Não reimportar recharts na página.

import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts';

const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const brlCompact = (v: number) => (Math.abs(v) >= 1000 ? `${v < 0 ? '-' : ''}${(Math.abs(v) / 1000).toFixed(1)}k` : `${v.toFixed(0)}`);

export default function GraficoSaldo({ data, ano }: { data: any[]; ano: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="gPlan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={brlCompact} width={40} />
        <ReferenceLine y={0} stroke="hsl(var(--border))" />
        <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={(m) => `${m}/${ano}`}
                 contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }} />
        <Area type="monotone" dataKey="acumulado" name="Acumulado" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gPlan)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
