'use client';

// Os 3 gráficos da página de investimentos (distribuição / patrimônio /
// simulação) — recharts sob demanda via next/dynamic. ⚠️ Não reimportar
// recharts na página; cada gráfico recebe os dados prontos por props.

import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, LineChart, Line,
} from 'recharts';

const BRAND = 'hsl(var(--primary))';
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);

export function GraficoDistribuicao({ data, strokePie, isDark }: { data: any[]; strokePie: string; isDark: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        {/* ⚠️ `nameKey` É OBRIGATÓRIO AQUI. O recharts assume `name` por padrão,
            e estes objetos têm `tipo`. Sem o dado, ele cai no ÍNDICE da fatia —
            e o tooltip mostrava literalmente "0 : R$ 2.642,80" em vez do nome
            da classe. */}
        <Pie data={data} dataKey="valor" nameKey="tipo" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke={strokePie} strokeWidth={2}>
          {data.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: isDark ? '#18181b' : '#fff', border: `1px solid ${isDark ? '#3f3f46' : 'hsl(var(--border))'}`, borderRadius: 12, fontSize: 12, color: isDark ? '#fff' : '#111' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function GraficoPatrimonio({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="gPat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.3} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="data" tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
          tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
        {/* `valor` = o investido, mapeado no cliente (migration 140). Antes era
            `patrimonio_total`, que soma o saldo das contas e contradizia o card
            "Patrimônio total" logo acima do gráfico.
            `dot` visível: com 2 ou 3 pontos (quem acabou de conectar o banco),
            uma linha sem marcador parece um traço solto em vez de uma série. */}
        <Area type="monotone" dataKey="valor" name="Investido" stroke={BRAND} fill="url(#gPat)"
              strokeWidth={2.5} dot={{ r: 2.5, fill: BRAND, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GraficoSimulacao({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: -16, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
        <Line type="monotone" dataKey="aportado" stroke="hsl(var(--fg-muted))" strokeWidth={1.5} dot={false} name="Aportado" />
        <Line type="monotone" dataKey="saldo" stroke={BRAND} strokeWidth={2.5} dot={false} name="Saldo" />
      </LineChart>
    </ResponsiveContainer>
  );
}
