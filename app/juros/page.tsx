'use client';

import { useMemo, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { Percent, TrendingUp, CreditCard, Sparkles, ArrowUpRight, Info } from 'lucide-react';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toFixed(1).replace('.', ',')}%`;

const inputCls =
  'w-full px-3.5 py-3 rounded-xl bg-muted/30 border border-border focus:border-primary/60 focus:outline-none text-foreground tabular-nums text-base transition-colors';

function Campo({ label, sufixo, value, onChange, step = '1', min = '0' }: {
  label: string; sufixo?: string; value: number; onChange: (v: number) => void; step?: string; min?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</span>
      <div className="relative">
        <input type="number" inputMode="decimal" step={step} min={min}
               value={Number.isFinite(value) ? value : ''} onChange={(e) => onChange(parseFloat(e.target.value))}
               className={inputCls + (sufixo ? ' pr-12' : '')} />
        {sufixo && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{sufixo}</span>}
      </div>
    </label>
  );
}

function Resultado({ label, valor, destaque, sub, subCor }: {
  label: string; valor: string; destaque?: boolean; sub?: string; subCor?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 ${destaque ? 'border-primary/40 bg-primary/[0.06]' : 'border-border/60 bg-muted/20'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-lg sm:text-xl font-bold tabular-nums mt-1 leading-tight break-words ${destaque ? 'text-primary' : 'text-foreground'}`}>{valor}</p>
      {sub && <p className="text-xs mt-1.5 tabular-nums" style={{ color: subCor }}>{sub}</p>}
    </div>
  );
}

export default function CalculadoraJurosPage() {
  const [modo, setModo] = useState<'investir' | 'divida'>('investir');

  // ── Investir (juros compostos) ──
  const [inicial, setInicial]   = useState(1000);
  const [aporte, setAporte]     = useState(300);
  const [taxa, setTaxa]         = useState(1);          // %
  const [taxaUnid, setTaxaUnid] = useState<'mes' | 'ano'>('mes');
  const [periodo, setPeriodo]   = useState(5);
  const [periodoUnid, setPeriodoUnid] = useState<'meses' | 'anos'>('anos');

  const invest = useMemo(() => {
    const meses = Math.max(0, Math.round(periodoUnid === 'anos' ? periodo * 12 : periodo));
    const i = taxaUnid === 'ano' ? Math.pow(1 + (taxa || 0) / 100, 1 / 12) - 1 : (taxa || 0) / 100;
    let m = inicial || 0;
    const serie: { mes: number; montante: number; investido: number }[] = [
      { mes: 0, montante: m, investido: inicial || 0 },
    ];
    for (let k = 1; k <= meses; k++) {
      m = m * (1 + i) + (aporte || 0);
      serie.push({ mes: k, montante: m, investido: (inicial || 0) + (aporte || 0) * k });
    }
    const investido = (inicial || 0) + (aporte || 0) * meses;
    const juros = m - investido;
    // Amostra o gráfico (~48 pontos no máx) pra não pesar com períodos longos.
    const passo = Math.max(1, Math.ceil(serie.length / 48));
    const grafico = serie.filter((_, idx) => idx % passo === 0 || idx === serie.length - 1);
    return { meses, montante: m, investido, juros, rentab: investido > 0 ? (juros / investido) * 100 : 0, grafico };
  }, [inicial, aporte, taxa, taxaUnid, periodo, periodoUnid]);

  // ── Dívida (empréstimo / parcelamento — tabela Price) ──
  const [valorD, setValorD]   = useState(2000);
  const [taxaD, setTaxaD]     = useState(8);   // % ao mês
  const [parcelas, setParcelas] = useState(12);

  const divida = useMemo(() => {
    const i = (taxaD || 0) / 100;
    const n = Math.max(1, Math.round(parcelas));
    const pv = valorD || 0;
    const parcela = i === 0 ? pv / n : (pv * (i * Math.pow(1 + i, n))) / (Math.pow(1 + i, n) - 1);
    const total = parcela * n;
    const juros = total - pv;
    return { parcela, total, juros, aMais: pv > 0 ? (juros / pv) * 100 : 0, n };
  }, [valorD, taxaD, parcelas]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-border/60 animate-fade-in"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none opacity-20"
               style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
              <Percent size={12} className="text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Calculadora de Juros</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Quanto seu dinheiro rende — ou quanto os juros te custam.</h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-lg">Simule um investimento (juros compostos) ou descubra quanto você paga de juros numa dívida ou parcelamento.</p>
          </div>
        </div>

        {/* Toggle de modo */}
        <div className="inline-flex p-1 rounded-2xl bg-muted/40 border border-border/60 w-full sm:w-auto">
          {([['investir', 'Investir', TrendingUp], ['divida', 'Dívida', CreditCard]] as const).map(([id, lbl, Icon]) => (
            <button key={id} onClick={() => setModo(id)}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      modo === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
              <Icon size={15} /> {lbl}
            </button>
          ))}
        </div>

        {modo === 'investir' ? (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            {/* Inputs */}
            <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4">
              <Campo label="Valor inicial" sufixo="R$" value={inicial} onChange={setInicial} step="100" />
              <Campo label="Aporte mensal" sufixo="R$" value={aporte} onChange={setAporte} step="50" />
              <div>
                <Campo label="Taxa de juros" sufixo="%" value={taxa} onChange={setTaxa} step="0.1" />
                <div className="inline-flex p-0.5 rounded-lg bg-muted/40 border border-border/60 mt-2">
                  {(['mes', 'ano'] as const).map((u) => (
                    <button key={u} onClick={() => setTaxaUnid(u)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${taxaUnid === u ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                      ao {u === 'mes' ? 'mês' : 'ano'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Campo label="Período" value={periodo} onChange={setPeriodo} step="1" />
                <div className="inline-flex p-0.5 rounded-lg bg-muted/40 border border-border/60 mt-2">
                  {(['meses', 'anos'] as const).map((u) => (
                    <button key={u} onClick={() => setPeriodoUnid(u)}
                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${periodoUnid === u ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Resultados + gráfico */}
            <div className="lg:col-span-3 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Resultado label="Vai ter" valor={brl(invest.montante)} destaque
                           sub={`+${pct(invest.rentab)} sobre o investido`} subCor="hsl(var(--primary))" />
                <Resultado label="Você investe" valor={brl(invest.investido)} />
                <Resultado label="Em juros (rendimento)" valor={brl(invest.juros)} />
              </div>
              <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} className="text-primary" />
                  <p className="text-sm font-semibold text-foreground">Evolução do patrimônio</p>
                </div>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={invest.grafico} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
                      <defs>
                        <linearGradient id="gJuros" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(m) => `${m}m`} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)} width={42} />
                      <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={(m) => `Mês ${m}`}
                               contentStyle={{ background: 'hsl(var(--bg-card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }} />
                      <Area type="monotone" dataKey="montante" name="Patrimônio" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#gJuros)" />
                      <Line type="monotone" dataKey="investido" name="Investido" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            {/* Inputs dívida */}
            <div className="lg:col-span-2 rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-4">
              <Campo label="Valor da dívida / compra" sufixo="R$" value={valorD} onChange={setValorD} step="100" />
              <Campo label="Taxa de juros ao mês" sufixo="%" value={taxaD} onChange={setTaxaD} step="0.1" />
              <Campo label="Número de parcelas" sufixo="x" value={parcelas} onChange={setParcelas} step="1" min="1" />
              <div className="flex items-start gap-2 text-xs text-muted-foreground rounded-xl bg-muted/20 border border-border/60 p-3">
                <Info size={14} className="flex-shrink-0 mt-0.5 text-primary" />
                Cartão de crédito rotativo costuma passar de <strong className="text-foreground">12% ao mês</strong>. Veja o tamanho do estrago abaixo.
              </div>
            </div>

            {/* Resultados dívida */}
            <div className="lg:col-span-3 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <Resultado label="Parcela" valor={brl(divida.parcela)} destaque sub={`${divida.n}x`} subCor="hsl(var(--muted-foreground))" />
                <Resultado label="Total pago" valor={brl(divida.total)} />
                <Resultado label="Só de juros" valor={brl(divida.juros)} sub={`+${pct(divida.aMais)} a mais`} subCor="#ef4444" />
              </div>
              <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                <p className="text-sm font-semibold text-foreground mb-3">Pra onde vai cada real</p>
                <div className="h-7 rounded-full overflow-hidden flex border border-border/60">
                  <div className="h-full flex items-center justify-center text-[11px] font-bold text-white"
                       style={{ width: `${divida.total > 0 ? ((valorD || 0) / divida.total) * 100 : 0}%`, background: 'hsl(var(--primary))' }}>
                    valor
                  </div>
                  <div className="h-full flex items-center justify-center text-[11px] font-bold text-white"
                       style={{ width: `${divida.total > 0 ? (divida.juros / divida.total) * 100 : 0}%`, background: '#ef4444' }}>
                    juros
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> O que você comprou: {brl(valorD || 0)}</span>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} /> Juros: {brl(divida.juros)}</span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-1.5">
                  <ArrowUpRight size={14} className="text-primary" />
                  Você paga <strong className="text-foreground">{pct(divida.aMais)}</strong> a mais do que o valor original.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
