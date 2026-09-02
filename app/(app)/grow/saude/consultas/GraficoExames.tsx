'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceArea } from 'recharts';

// Isola o recharts do chunk da rota — ver a nota em saude/corpo/GraficoEvolucao.
export default function GraficoExames({ data, cor, unidade, nome, faixa }: {
  data: any[]; cor: string; unidade: string; nome: string;
  faixa?: { min: number | null; max: number | null };
}) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                   formatter={(v: any) => [`${v} ${unidade || ''}`.trim(), nome]} />
          {faixa?.min != null && faixa?.max != null && (
            <ReferenceArea y1={faixa.min} y2={faixa.max} fill="#22c55e" fillOpacity={0.08} stroke="#22c55e" strokeOpacity={0.3} />
          )}
          <Line type="monotone" dataKey="valor" stroke={cor} strokeWidth={2.5} dot={{ fill: cor, r: 5 }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
