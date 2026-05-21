'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ArrowLeft, Loader2, TrendingUp, TrendingDown, Minus,
  AlertCircle, ChevronRight, Info,
} from 'lucide-react';

const BRAND = '#61ce70';
const RED   = '#ef4444';
const NEUTRAL = '#94a3b8';

const MES_NOMES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const labelMes = (iso: string) => {
  const d = new Date(iso);
  return `${MES_NOMES_CURTO[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
};
const fmt = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);
const fmtCompact = (centavos: number) => {
  const v = (centavos || 0) / 100;
  if (Math.abs(v) >= 1000000) return `R$ ${(v / 1000000).toFixed(1)}M`;
  if (Math.abs(v) >= 1000)    return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toFixed(0)}`;
};

export default function ForecastPage() {
  const { isBlack, phone } = useAuth();
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metrica, setMetrica] = useState<'receita_bruta' | 'lucro_liquido'>('receita_bruta');

  useEffect(() => {
    if (!phone || !isBlack) return;
    api.negocios.forecast.get(phone).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [phone, isBlack]);

  if (!isBlack) {
    return <DashboardLayout><div className="max-w-md mx-auto pt-20 px-6 text-center">
      <p className="text-sm text-muted-foreground">Disponível no plano Black.</p>
    </div></DashboardLayout>;
  }
  if (loading) {
    return <DashboardLayout><div className="max-w-5xl mx-auto pt-20 flex justify-center">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div></DashboardLayout>;
  }

  const todos = [...(data?.historico || []), ...(data?.projecao || [])];
  const semDados = !todos.some(m => m.receita_bruta > 0);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-24 space-y-5">

        {/* HEADER */}
        <div className="animate-fade-in">
          <Link href="/negocios" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft size={13} /> Voltar para Negócios
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Forecast</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Projeção dos próximos 3 meses baseada nos últimos 6 meses de histórico.
              </p>
            </div>
            {data?.confianca && (
              <BadgeConfianca confianca={data.confianca} />
            )}
          </div>
        </div>

        {/* AVISO se dados insuficientes */}
        {data?.motivo && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3 animate-fade-in">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-foreground">Dados insuficientes</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{data.motivo}</p>
            </div>
          </div>
        )}

        {semDados ? (
          <div className="rounded-3xl border border-dashed border-border bg-muted/20 p-10 text-center animate-fade-in">
            <TrendingUp size={22} className="text-muted-foreground mx-auto mb-2 opacity-50" />
            <h2 className="text-sm font-bold text-foreground mb-1">Sem histórico ainda</h2>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed mb-4">
              Conecte uma plataforma e registre algumas vendas pra a Sora começar a aprender seus padrões.
            </p>
            <Link href="/negocios/integracoes"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              Conectar plataforma <ChevronRight size={11} />
            </Link>
          </div>
        ) : (
          <>
            {/* KPIs de tendência */}
            {data?.meta && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
                <KpiTrend label="Receita média (6m)"  valor={fmt(data.meta.receita_media_6m)} tendencia={data.meta.tendencia_receita} />
                <KpiTrend label="Lucro médio (6m)"    valor={fmt(data.meta.lucro_medio_6m)}   tendencia={data.meta.tendencia_lucro} />
                <Kpi      label="Próximo mês"          valor={fmt(data.projecao?.[0]?.[metrica] || 0)} accent={BRAND} />
                <Kpi      label="3 meses (acumulado)"  valor={fmt((data.projecao || []).reduce((s: number, p: any) => s + (p[metrica] || 0), 0))} />
              </div>
            )}

            {/* Toggle métrica */}
            <div className="inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 animate-fade-in" style={{ animationDelay: '120ms' }}>
              {([
                { v: 'receita_bruta', l: 'Receita' },
                { v: 'lucro_liquido', l: 'Lucro líquido' },
              ] as const).map(t => (
                <button key={t.v} onClick={() => setMetrica(t.v)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          metrica === t.v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                        }`}>
                  {t.l}
                </button>
              ))}
            </div>

            {/* GRÁFICO */}
            <div className="rounded-3xl border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: '180ms' }}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-bold text-foreground tracking-tight">
                    {metrica === 'receita_bruta' ? 'Receita bruta' : 'Lucro líquido'}
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    9 meses · 6 histórico + 3 projeção
                  </p>
                </div>
                <Legenda />
              </div>

              <GraficoBarras meses={todos} campo={metrica} />
            </div>

            {/* Tabela detalhada */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in" style={{ animationDelay: '240ms' }}>
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="text-left px-4 py-2.5">Mês</th>
                    <th className="text-right px-4 py-2.5">Receita</th>
                    <th className="text-right px-4 py-2.5">Lucro</th>
                    <th className="text-right px-4 py-2.5 hidden sm:table-cell">Vendas</th>
                    <th className="text-left px-4 py-2.5 hidden sm:table-cell">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {todos.map((m, i) => (
                    <tr key={i} className={`border-b border-border/40 ${m.tipo === 'projecao' ? 'bg-muted/10' : ''}`}>
                      <td className="px-4 py-2.5 font-semibold text-foreground">{labelMes(m.periodo)}</td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: m.tipo === 'projecao' ? BRAND : undefined, opacity: m.tipo === 'projecao' ? 0.85 : 1 }}>
                        {fmt(m.receita_bruta)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums" style={{ color: m.lucro_liquido < 0 ? RED : (m.tipo === 'projecao' ? BRAND : undefined), opacity: m.tipo === 'projecao' ? 0.85 : 1 }}>
                        {fmt(m.lucro_liquido)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground tabular-nums hidden sm:table-cell">
                        {m.total_vendas || 0}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {m.tipo === 'projecao' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                                style={{ background: `${BRAND}15`, color: BRAND }}>
                            Projeção
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Histórico</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Explicação do algoritmo */}
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <div className="flex items-start gap-2.5">
                <Info size={13} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Como o forecast é calculado</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Combinamos uma média móvel exponencial (peso maior nos meses recentes) com a tendência linear dos últimos 6 meses.
                    Não é mágica — é matemática aplicada nos seus próprios dados. Confiança aumenta com mais histórico.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// ─── COMPONENTES ────────────────────────────────────────────────

function GraficoBarras({ meses, campo }: { meses: any[]; campo: string }) {
  const max = useMemo(() => Math.max(1, ...meses.map(m => m[campo] || 0)), [meses, campo]);
  const min = useMemo(() => Math.min(0, ...meses.map(m => m[campo] || 0)), [meses, campo]);
  const range = max - min || 1;
  const ALTURA = 180;

  return (
    <div className="relative">
      {/* Linha do zero (se houver valores negativos) */}
      {min < 0 && (
        <div className="absolute left-0 right-0 border-t border-dashed border-border pointer-events-none"
             style={{ top: `${(max / range) * ALTURA}px` }} />
      )}

      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: ALTURA }}>
        {meses.map((m, i) => {
          const valor = m[campo] || 0;
          const positivo = valor >= 0;
          const projecao = m.tipo === 'projecao';
          const alturaBarra = (Math.abs(valor) / range) * ALTURA;
          const cor = projecao ? BRAND : positivo ? '#475569' : RED;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group cursor-default">
              <span className="text-[9px] font-bold tabular-nums opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ color: projecao ? BRAND : undefined }}>
                {fmtCompact(valor)}
              </span>
              <div className="w-full relative" style={{ height: ALTURA - 20 }}>
                <div className="absolute bottom-0 left-0 right-0 rounded-t-md transition-all"
                     style={{
                       height: `${alturaBarra}px`,
                       background: projecao
                         ? `repeating-linear-gradient(45deg, ${cor}, ${cor} 4px, ${cor}80 4px, ${cor}80 8px)`
                         : cor,
                       opacity: projecao ? 0.8 : 0.85,
                     }} />
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                {labelMes(m.periodo)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm bg-slate-600" />
        Histórico
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-sm" style={{ background: `repeating-linear-gradient(45deg, ${BRAND}, ${BRAND} 2px, ${BRAND}80 2px, ${BRAND}80 4px)` }} />
        Projeção
      </div>
    </div>
  );
}

function Kpi({ label, valor, accent }: { label: string; valor: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums tracking-tight mt-1" style={{ color: accent }}>{valor}</p>
    </div>
  );
}

function KpiTrend({ label, valor, tendencia }: { label: string; valor: string; tendencia: string }) {
  const Icon = tendencia === 'crescimento' ? TrendingUp : tendencia === 'queda' ? TrendingDown : Minus;
  const cor  = tendencia === 'crescimento' ? BRAND : tendencia === 'queda' ? RED : NEUTRAL;
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <Icon size={11} style={{ color: cor }} />
      </div>
      <p className="text-lg font-bold tabular-nums tracking-tight">{valor}</p>
    </div>
  );
}

function BadgeConfianca({ confianca }: { confianca: string }) {
  const cores = {
    alta:  { cor: BRAND,    label: 'Confiança alta',    desc: '6 meses de dados' },
    media: { cor: '#f59e0b', label: 'Confiança média',   desc: '3-5 meses' },
    baixa: { cor: NEUTRAL,  label: 'Confiança baixa',   desc: 'Pouco histórico' },
  }[confianca] || { cor: NEUTRAL, label: confianca, desc: '' };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border" style={{ borderColor: `${cores.cor}40`, background: `${cores.cor}10` }}>
      <span className="w-2 h-2 rounded-full" style={{ background: cores.cor }} />
      <div className="text-left">
        <p className="text-xs font-bold leading-none" style={{ color: cores.cor }}>{cores.label}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{cores.desc}</p>
      </div>
    </div>
  );
}
