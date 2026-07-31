'use client';

// =============================================================================
// Evolução de 6 meses do negócio (receita × despesa, com o lucro em linha).
//
// ⚠️ Vive em componente PRÓPRIO porque o recharts pesa ~288 KB + d3. Importar
// direto na página traria isso pro chunk inicial do painel — regra de
// performance do projeto (ver CLAUDE.md). Quem consome usa `next/dynamic` com
// `ssr:false` e um skeleton de MESMA ALTURA (senão o conteúdo salta quando o
// gráfico monta).
// =============================================================================

import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const real = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    .format((centavos || 0) / 100);

type Ponto = { mes: string; receita: number; despesa: number; lucro: number };

export default function GraficoEvolucao({ dados, cor }: { dados: Ponto[]; cor: string }) {
  const pontos = (dados || []).map(d => ({
    ...d,
    rotulo: MES_CURTO[parseInt(d.mes.slice(5, 7), 10) - 1] || d.mes,
    // O gráfico plota em REAIS; o resto do painel guarda centavos.
    receitaR: (d.receita || 0) / 100,
    despesaR: (d.despesa || 0) / 100,
    lucroR:   (d.lucro   || 0) / 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={pontos} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
        {/* Grade discreta: não pode competir com os dados. */}
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
        <XAxis dataKey="rotulo" tickLine={false} axisLine={false}
               tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tickLine={false} axisLine={false} width={64}
               tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
               tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
          contentStyle={{
            background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))',
            borderRadius: 12, fontSize: 12, boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)',
          }}
          formatter={((v: number, nome: string) => [real(v * 100), nome]) as any}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
        <Bar dataKey="receitaR" name="Receita" fill={cor} radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="despesaR" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.85} />
        {/* Lucro em linha: é derivado dos outros dois, então merece forma
            diferente — barra ao lado sugeriria que soma junto. */}
        <Line type="monotone" dataKey="lucroR" name="Lucro" stroke="#0ea5e9" strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0, fill: '#0ea5e9' }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
