'use client';

import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// ⚠️ ESTE ARQUIVO EXISTE SÓ PRA ISOLAR O RECHARTS.
//
// A página importava `recharts` direto, e com isso a lib (~289 KB, mais o d3)
// entrava no chunk da ROTA — baixada mesmo por quem nunca rolou até o gráfico.
// Em componente separado, carregado com `next/dynamic`, ela vira um chunk à
// parte, buscado só quando o gráfico aparece.
//
// A regra está no CLAUDE.md: recharts nunca é importado direto numa página.
// Oito páginas do Grow tinham escapado dela — o build mostrava oito chunks de
// 289 KB, um por página.
export type PontoEvolucao = { dia: string; valor: number };

export default function GraficoEvolucao({ data, cor, unidade, label }: {
  data: PontoEvolucao[];
  cor: string;
  unidade: string;
  label?: string;
}) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
          <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} width={36} />
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }}
                   formatter={(v: any) => [`${v} ${unidade}`, label]} />
          <Line type="monotone" dataKey="valor" stroke={cor} strokeWidth={2.5} dot={{ fill: cor, r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
