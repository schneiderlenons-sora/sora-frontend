'use client';

// Mini-gráfico de progresso de UMA meta — recharts sob demanda (next/dynamic na
// página). Renderizado uma vez por meta; o gradiente é keyed por `gradId`.
// ⚠️ Não reimportar recharts na página.

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);

export default function GraficoMeta({ data, gradId, cor }: { data: any[]; gradId: string; cor: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={cor} stopOpacity={0.4} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="mesLabel" tick={{ fontSize: 9, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis hide />
        <Tooltip
          formatter={(v: any) => fmt(Number(v))}
          contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11, padding: '4px 8px' }}
          labelFormatter={(l) => l}
        />
        <Area type="monotone" dataKey="valor"    stroke={cor} fill={`url(#${gradId})`} strokeWidth={2.5} dot={false} connectNulls />
        <Area type="monotone" dataKey="projecao" stroke={cor} fill="transparent" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
      </AreaChart>
    </ResponsiveContainer>
  );
}
