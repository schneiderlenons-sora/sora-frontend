'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

// Isola o recharts do chunk da rota — ver a nota em saude/corpo/GraficoEvolucao.
export default function GraficoEstudoConcurso({ data, cor, intervaloX }: {
  data: any[]; cor: string; intervaloX: number;
}) {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="concursoGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={1} />
              <stop offset="100%" stopColor={cor} stopOpacity={0.4} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} interval={intervaloX} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                   formatter={(v: any) => [`${v} min`, 'Estudo']} />
          <Bar dataKey="min" fill="url(#concursoGrad)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
