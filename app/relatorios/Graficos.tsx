'use client';

// Gráficos da página de relatórios (frequência / fluxo / comparativo / donut
// vazio) — recharts sob demanda via next/dynamic. ⚠️ Não reimportar recharts na
// página. CustomTooltip mora aqui porque é usado pelos gráficos (e ficar na
// página traria recharts junto pelo type de <Tooltip content>).

import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const BRAND = 'hsl(var(--primary))';
const RED   = '#ef4444';
const BLUE  = '#3b82f6';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtCompact = (v: number) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3.5 py-2.5 shadow-lg text-sm min-w-[160px] border border-border/60">
      <p className="font-semibold text-foreground mb-1.5 text-[11px] uppercase tracking-wider">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground text-xs">{p.name}</span>
          </div>
          <span className="font-semibold text-foreground text-xs tabular">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function GraficoFrequencia({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={2}>
        <defs>
          <linearGradient id="freqRec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" /><stop offset="100%" stopColor="#16a34a" />
          </linearGradient>
          <linearGradient id="freqDes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb923c" /><stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
               tickFormatter={(v) => Number(v) % 5 === 0 ? v : ''} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={45} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--bg-muted) / 0.35)', radius: 4 }} />
        <Bar dataKey="Receitas" fill="url(#freqRec)" radius={[4, 4, 0, 0]} maxBarSize={12} />
        <Bar dataKey="Despesas" fill="url(#freqDes)" radius={[4, 4, 0, 0]} maxBarSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function GraficoFluxo({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BRAND} stopOpacity={0.3}/><stop offset="95%" stopColor={BRAND} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gDes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={RED} stopOpacity={0.3}/><stop offset="95%" stopColor={RED} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="gSal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={BLUE} stopOpacity={0.4}/><stop offset="95%" stopColor={BLUE} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={55} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="Receitas" stroke={BRAND} strokeWidth={2.5} fill="url(#gRec)" activeDot={{ r: 5, fill: BRAND, strokeWidth: 2, stroke: 'white' }} />
        <Area type="monotone" dataKey="Despesas" stroke={RED} strokeWidth={2.5} fill="url(#gDes)" activeDot={{ r: 5, fill: RED, strokeWidth: 2, stroke: 'white' }} />
        <Area type="monotone" dataKey="Saldo" stroke={BLUE} strokeWidth={2.5} fill="url(#gSal)" activeDot={{ r: 5, fill: BLUE, strokeWidth: 2, stroke: 'white' }} strokeDasharray="6 4" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function GraficoComparativo({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} width={55} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--bg-muted) / 0.3)' }} />
        <Bar dataKey="Receitas" fill={BRAND} radius={[6, 6, 0, 0]} maxBarSize={28} />
        <Bar dataKey="Despesas" fill={RED}   radius={[6, 6, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutVazio() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <PieChart>
        <Pie data={[{ value: 1 }]} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
             dataKey="value" startAngle={90} endAngle={-270} strokeWidth={0}>
          <Cell fill="hsl(var(--border))" />
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
