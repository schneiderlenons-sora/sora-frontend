'use client';

// Gráficos da página de relatórios (frequência / fluxo / comparativo / donut
// vazio) — recharts sob demanda via next/dynamic. ⚠️ Não reimportar recharts na
// página. CustomTooltip mora aqui porque é usado pelos gráficos (e ficar na
// página traria recharts junto pelo type de <Tooltip content>).

import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  ComposedChart, Line, ReferenceLine,
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

/* ═══════════════════════════════════════════════════════════════════════
   PLANEJAMENTO ANUAL

   O gráfico tem UM trabalho acima de todos: deixar claro o que é FATO e o que
   é ESTIMATIVA. Um ano inteiro desenhado com o mesmo traço convida a pessoa a
   confiar no mês de dezembro tanto quanto no de março — e foi assim que esta
   aba já mostrou uma senoide como se fosse histórico.

   ⚠️ A distinção é HACHURA, não opacidade nem cor. Barra "mais clarinha" some
   em tela clara, no dark e pra quem enxerga cores de outro jeito. A hachura
   sobrevive aos três, é reconhecível em preto e branco, e some junto com o
   dado quando ele vira real — o que faz o gráfico *contar a passagem do tempo*.
   ═══════════════════════════════════════════════════════════════════════ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TooltipPlano({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p0 = payload[0]?.payload || {};
  const rotulo = p0.estado === 'realizado' ? 'Fechado'
    : p0.estado === 'emCurso' ? 'Em curso — projeção' : 'Previsto';
  return (
    <div className="glass rounded-xl px-3.5 py-2.5 shadow-lg text-sm min-w-[190px] border border-border/60">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="font-semibold text-foreground text-[11px] uppercase tracking-wider">{label}</p>
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ background: p0.estado === 'realizado' ? 'hsl(var(--bg-muted))' : 'color-mix(in srgb, #6366f1 18%, transparent)',
                       color: p0.estado === 'realizado' ? 'hsl(var(--fg-muted))' : '#6366f1' }}>
          {rotulo}
        </span>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.filter((p: any) => p.value != null).map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground text-xs">{p.name}</span>
          </div>
          <span className="font-semibold text-foreground text-xs tabular">{fmt(p.value)}</span>
        </div>
      ))}
      {p0.sazonais > 0 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 pt-1.5 border-t border-border/50">
          inclui {fmt(p0.sazonais)} de conta sazonal
        </p>
      )}
    </div>
  );
}

export function GraficoPlanejamento({ data, mesAtual }: { data: any[]; mesAtual: number | null }) {
  return (
    <ResponsiveContainer width="100%" height={330}>
      <ComposedChart data={data} barGap={3} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          {/* Hachura diagonal — o "isto ainda não aconteceu" do gráfico. */}
          <pattern id="hachRec" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={BRAND} fillOpacity={0.18} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={BRAND} strokeWidth="3" strokeOpacity={0.75} />
          </pattern>
          <pattern id="hachDes" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
            <rect width="6" height="6" fill={RED} fillOpacity={0.18} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={RED} strokeWidth="3" strokeOpacity={0.75} />
          </pattern>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--fg-muted))' }} axisLine={false} tickLine={false}
               tickFormatter={fmtCompact} width={52} />
        <Tooltip content={<TooltipPlano />} cursor={{ fill: 'hsl(var(--bg-muted) / 0.3)' }} />

        {/* "Você está aqui". Sem esta marca, saber onde o fato vira estimativa
            exige comparar hachuras — a linha responde de relance. */}
        {mesAtual !== null && (
          <ReferenceLine x={data[mesAtual]?.name} stroke="hsl(var(--fg-muted))" strokeDasharray="4 4"
                         label={{ value: 'hoje', position: 'top', fontSize: 10, fill: 'hsl(var(--fg-muted))' }} />
        )}
        {/* Zero explícito: sem ele, saldo negativo parece só "uma barra menor". */}
        <ReferenceLine y={0} stroke="hsl(var(--border))" />

        <Bar dataKey="Receitas" radius={[5, 5, 0, 0]} maxBarSize={26}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.estado === 'realizado' ? BRAND : 'url(#hachRec)'} />
          ))}
        </Bar>
        <Bar dataKey="Despesas" radius={[5, 5, 0, 0]} maxBarSize={26}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.estado === 'realizado' ? RED : 'url(#hachDes)'} />
          ))}
        </Bar>

        {/* Acumulado em DUAS linhas: a cheia só cobre o que já fechou, a
            tracejada continua dali. Uma linha só, contínua, apagaria a
            fronteira que o resto do gráfico faz questão de mostrar. */}
        <Line type="monotone" dataKey="AcumuladoReal" name="Acumulado" stroke={BLUE} strokeWidth={2.5}
              dot={false} activeDot={{ r: 5, fill: BLUE, strokeWidth: 2, stroke: 'white' }} connectNulls />
        <Line type="monotone" dataKey="AcumuladoPrev" name="Acumulado previsto" stroke={BLUE} strokeWidth={2.5}
              strokeDasharray="6 4" dot={false} activeDot={{ r: 5, fill: BLUE, strokeWidth: 2, stroke: 'white' }} connectNulls />
      </ComposedChart>
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
