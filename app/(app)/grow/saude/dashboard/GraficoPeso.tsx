'use client';

import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// ⚠️ Renderiza SÓ o ResponsiveContainer — o div de altura fica na página, que
// tem classes próprias (mt-3). Assim a extração não mexe em layout nenhum.
export default function GraficoPeso({ data, cor, min, max }: {
  data: any[]; cor: string; min: number; max: number;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="pesoGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
            <stop offset="100%" stopColor={cor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
        <YAxis domain={[min, max]} stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
          formatter={(v: any) => [`${v} kg`, 'Peso']}
        />
        <Area type="monotone" dataKey="peso" stroke={cor} strokeWidth={2.5} fill="url(#pesoGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
