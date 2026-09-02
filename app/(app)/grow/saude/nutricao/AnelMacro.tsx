'use client';

import { ResponsiveContainer, RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

// Anel de macro. Só o ResponsiveContainer — o div `relative` fica na página.
export default function AnelMacro({ pct, cor }: { pct: number; cor: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ pct: Math.min(100, pct) }]} startAngle={90} endAngle={-270}>
        <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
        <RadialBar dataKey="pct" fill={cor} cornerRadius={8} background={{ fill: 'hsl(var(--muted))' }} />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
