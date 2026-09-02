'use client';

import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

// Anel de progresso. Renderiza só o ResponsiveContainer — o div `relative`
// que o posiciona (e o texto sobreposto) continuam na página.
export default function Anel({ pct, cor }: { pct: number; cor: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ pct }]} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="pct" fill={cor} cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
