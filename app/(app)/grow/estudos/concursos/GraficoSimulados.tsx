'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Isola o recharts do chunk da rota — ver a nota em saude/corpo/GraficoEvolucao.
export default function GraficoSimulados({ data }: { data: any[] }) {
  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} width={28} domain={[0, 'dataMax']} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }} />
          <Line type="monotone" dataKey="nota" stroke="#ec4899" strokeWidth={2.5} dot={{ fill: '#ec4899', r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
