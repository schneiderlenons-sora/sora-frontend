'use client';

import { useMemo, useState } from 'react';
import { LineChart as LineChartIcon, Grid3x3 } from 'lucide-react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// Card "Atividade — Últimos 90 dias" do dashboard de Estudos.
// Duas visualizações: GRÁFICO de área (minutos/dia, padrão) e HEATMAP estilo
// GitHub (colunas por semana). Toggle segmentado no cabeçalho.
// Dados: [{ data: 'YYYY-MM-DD', min }] já de 90 dias (o dashboard monta).
// ─────────────────────────────────────────────────────────────────────────────

const VIOLET = '#7c3aed';               // brand do Grow (estudo no geral)
const AMBER  = '#f59e0b';               // linha própria do estudo bíblico
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const fmtMin = (min: number) => {
  if (!min) return '0min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? m + 'min' : ''}` : `${m}min`;
};
const fmtDataLonga = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

// Nível 0-4 a partir dos minutos (mesma régua do heatmap antigo).
function nivelDe(min: number) {
  if (min <= 0) return 0;
  if (min < 30) return 1;
  if (min < 60) return 2;
  if (min < 120) return 3;
  return 4;
}
const corNivel = (n: number) => (n === 0 ? 'hsl(var(--muted))' : `rgba(124, 58, 237, ${0.18 + n * 0.2})`);

// `min` = total do dia (estudo geral, JÁ inclui a Bíblia); `minBiblia` = parte
// que foi estudo bíblico (linha própria).
type Dia = { data: string; min: number; minBiblia?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as Dia;
  return (
    <div className="rounded-xl px-3 py-2 shadow-xl text-xs border border-border/60"
         style={{ background: 'hsl(var(--bg-card))' }}>
      <p className="font-semibold text-foreground capitalize">{fmtDataLonga(p.data)}</p>
      <p className="text-muted-foreground mt-0.5">
        <span className="font-bold tabular-nums" style={{ color: VIOLET }}>{fmtMin(p.min)}</span> no total
      </p>
      {!!p.minBiblia && (
        <p className="text-muted-foreground">
          <span className="font-bold tabular-nums" style={{ color: AMBER }}>{fmtMin(p.minBiblia)}</span> de Bíblia
        </p>
      )}
    </div>
  );
}

export default function AtividadeEstudos({ dados }: { dados: Dia[] }) {
  const [view, setView] = useState<'grafico' | 'heatmap'>('grafico');

  // Total do período — dá contexto ao card ("15h no total").
  const totalMin = useMemo(() => dados.reduce((s, d) => s + d.min, 0), [dados]);
  const temBiblia = useMemo(() => dados.some(d => (d.minBiblia || 0) > 0), [dados]);

  return (
    <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-5 sm:p-6 animate-fade-in"
         style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: '120ms' }}>

      {/* Cabeçalho: título + total + toggle */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Atividade</p>
          <p className="text-base font-bold text-foreground">Últimos 90 dias</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground tabular-nums">{fmtMin(totalMin)}</span> no total
          </p>
          {temBiblia && (
            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: VIOLET }} /> Estudo</span>
              <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: AMBER }} /> Bíblia</span>
            </div>
          )}
        </div>

        {/* Toggle segmentado — Gráfico | Heatmap (role=tablist p/ leitor de tela) */}
        <div role="tablist" aria-label="Visualização da atividade"
             className="inline-flex items-center gap-0.5 p-1 rounded-xl bg-muted/50 border border-border/40 flex-shrink-0">
          {([['grafico', 'Gráfico', LineChartIcon], ['heatmap', 'Heatmap', Grid3x3]] as const).map(([id, label, Icon]) => {
            const ativo = view === id;
            return (
              <button key={id} role="tab" aria-selected={ativo} onClick={() => setView(id)}
                className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 h-8 rounded-lg text-xs font-semibold transition-all ${
                  ativo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>
                <Icon size={13} /> <span className="hidden sm:inline">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Área de conteúdo com altura reservada → sem CLS ao alternar */}
      <div style={{ minHeight: 180 }}>
        {view === 'grafico' ? <Grafico dados={dados} /> : <Heatmap dados={dados} />}
      </div>
    </div>
  );
}

// ── Gráfico de área (padrão) ─────────────────────────────────────────────────
function Grafico({ dados }: { dados: Dia[] }) {
  // Rótulos do eixo X só nas viradas de mês (evita poluir com 90 datas).
  const ticks = useMemo(() => {
    const t: string[] = [];
    let ultimoMes = -1;
    dados.forEach(d => {
      const mes = new Date(d.data + 'T12:00:00').getMonth();
      if (mes !== ultimoMes) { t.push(d.data); ultimoMes = mes; }
    });
    return t;
  }, [dados]);

  const temBiblia = dados.some(d => (d.minBiblia || 0) > 0);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={dados} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gAtividade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={VIOLET} stopOpacity={0.5} />
            <stop offset="90%" stopColor={VIOLET} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.35} vertical={false} />
        <XAxis
          dataKey="data" ticks={ticks} tickLine={false} axisLine={false}
          tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }}
          tickFormatter={(iso) => { const d = new Date(iso + 'T12:00:00'); return MESES[d.getMonth()]; }}
        />
        <YAxis
          tickLine={false} axisLine={false} width={44}
          tick={{ fontSize: 10, fill: 'hsl(var(--fg-muted))' }}
          tickFormatter={(v) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: VIOLET, strokeWidth: 1, strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="min" stroke={VIOLET} strokeWidth={2.5}
              fill="url(#gAtividade)" dot={false}
              activeDot={{ r: 4, fill: VIOLET, stroke: 'white', strokeWidth: 2 }} />
        {/* Linha própria do estudo bíblico (só quando há dados) */}
        {temBiblia && (
          <Line type="monotone" dataKey="minBiblia" stroke={AMBER} strokeWidth={2}
                dot={false} activeDot={{ r: 3.5, fill: AMBER, stroke: 'white', strokeWidth: 2 }} />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Heatmap estilo GitHub (colunas = semanas, linhas = dia da semana) ─────────
function Heatmap({ dados }: { dados: Dia[] }) {
  // Monta colunas semanais. A 1ª coluna começa no domingo da semana do dia mais
  // antigo; células antes do início ficam vazias (null).
  const { colunas, rotulosMes } = useMemo(() => {
    const primeiro = new Date(dados[0]?.data + 'T12:00:00');
    const offset = primeiro.getDay(); // 0=dom .. 6=sáb
    const celulas: (Dia | null)[] = [...Array(offset).fill(null), ...dados];
    const cols: (Dia | null)[][] = [];
    for (let i = 0; i < celulas.length; i += 7) cols.push(celulas.slice(i, i + 7));

    // Rótulo de mês por coluna (só quando o mês muda na 1ª célula real da coluna).
    const rot: { col: number; mes: string }[] = [];
    let ultimoMes = -1;
    cols.forEach((c, i) => {
      const dia = c.find(Boolean) as Dia | undefined;
      if (!dia) return;
      const m = new Date(dia.data + 'T12:00:00').getMonth();
      if (m !== ultimoMes) { rot.push({ col: i, mes: MESES[m] }); ultimoMes = m; }
    });
    return { colunas: cols, rotulosMes: rot };
  }, [dados]);

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto scrollbar-none">
        <div className="inline-flex flex-col gap-1 min-w-min">

          {/* Rótulos de mês (alinhados às colunas) */}
          <div className="flex gap-1 pl-8">
            {colunas.map((_, i) => {
              const r = rotulosMes.find(x => x.col === i);
              return (
                <div key={i} className="w-3.5 text-[9px] text-muted-foreground capitalize" style={{ minWidth: 14 }}>
                  {r ? r.mes : ''}
                </div>
              );
            })}
          </div>

          {/* Linhas de dia-da-semana + grade */}
          <div className="flex gap-1">
            {/* rótulos de dia (só ímpares: seg/qua/sex pra não poluir) */}
            <div className="flex flex-col gap-1 pr-1 w-7 flex-shrink-0">
              {DIAS_SEM.map((d, i) => (
                <div key={d} className="h-3.5 text-[9px] text-muted-foreground leading-[14px]">
                  {i % 2 === 1 ? d : ''}
                </div>
              ))}
            </div>

            {/* colunas semanais */}
            {colunas.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-1">
                {Array.from({ length: 7 }).map((_, ri) => {
                  const cel = col[ri];
                  if (!cel) return <div key={ri} className="w-3.5 h-3.5" />;
                  const n = nivelDe(cel.min);
                  return (
                    <div
                      key={ri}
                      title={`${fmtDataLonga(cel.data)} · ${fmtMin(cel.min)}`}
                      className="w-3.5 h-3.5 rounded-[4px] transition-transform hover:scale-125 hover:ring-1 hover:ring-primary cursor-default"
                      style={{ background: corNivel(n) }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[10px] text-muted-foreground">
        <span>menos</span>
        {[0, 1, 2, 3, 4].map(n => (
          <div key={n} className="w-3 h-3 rounded-[3px]" style={{ background: corNivel(n) }} />
        ))}
        <span>mais</span>
      </div>
    </div>
  );
}
