'use client';

import { BarChart, Bar, Cell, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

// ⚠️ `corSono` é copiada da página de propósito: é função pura de um número, e
// duplicá-la evita passar função por prop só pra pintar barra. Se a escala de
// cor mudar lá, muda aqui — as duas ficam lado a lado na mesma pasta.
const corSono = (h: number) => h < 6 ? '#ef4444' : h < 7 ? '#f59e0b' : h <= 9 ? '#22c55e' : '#6366f1';

// Isola o recharts do chunk da rota — ver a nota em saude/corpo/GraficoEvolucao.
export default function GraficoSono({ data }: { data: any[] }) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} />
          <YAxis domain={[0, 12]} ticks={[0, 4, 8, 12]} stroke="hsl(var(--muted-foreground))" fontSize={9} tickLine={false} axisLine={false} />
          <ReferenceArea y1={7} y2={9} fill="#22c55e" fillOpacity={0.10} />
          <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                   contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                   formatter={(v: any) => [`${v}h`, 'Sono']} />
          <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((b: any, i: number) => <Cell key={i} fill={corSono(b.horas)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
