'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

// Isola o recharts do chunk da rota — ver a nota em saude/corpo/GraficoEvolucao.
export default function GraficoHumor({ data, cor }: { data: any[]; cor: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <YAxis domain={[1, 5]} stroke="hsl(var(--muted-foreground))" fontSize={10} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
          <Line type="monotone" dataKey="humor" stroke={cor} strokeWidth={3} dot={{ fill: cor, r: 4 }} name="Humor" />
          {data.some((d: any) => d.energia) && (
            <Line type="monotone" dataKey="energia" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 3 }} name="Energia" />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
