'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { CalendarRange, Plus, Trash2, Wand2, TrendingUp, TrendingDown, PiggyBank, AlertTriangle } from 'lucide-react';

// recharts sob demanda: fora do bundle inicial da página.
const GraficoSaldo = dynamic(() => import('./GraficoSaldo'), {
  ssr: false,
  loading: () => <div className="w-full h-full rounded-xl bg-muted/40 animate-pulse" role="status" aria-label="Carregando gráfico" />,
});

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const brl = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number.isFinite(v) ? v : 0);
const brlCompact = (v: number) => (Math.abs(v) >= 1000 ? `${v < 0 ? '-' : ''}${(Math.abs(v) / 1000).toFixed(1)}k` : `${v.toFixed(0)}`);

type MesPlano = { receita: number; despesa: number };
type ContaAnual = { id: string; nome: string; valor: number; mes: number };
type Plano = { meses: MesPlano[]; contas: ContaAnual[] };

const PRESETS = [
  { nome: 'IPVA', mes: 0 }, { nome: 'IPTU', mes: 1 }, { nome: 'Material escolar', mes: 1 },
  { nome: 'Seguro', mes: 5 }, { nome: 'Férias', mes: 11 }, { nome: 'Natal', mes: 11 },
];

function planoVazio(): Plano {
  return { meses: Array.from({ length: 12 }, () => ({ receita: 0, despesa: 0 })), contas: [] };
}

const inputCls = 'w-full px-3 py-2 rounded-lg bg-muted/30 border border-border focus:border-primary/60 focus:outline-none text-foreground tabular-nums text-sm transition-colors';

export default function PlanejamentoAnualPage() {
  const { perfil } = useAuth();
  const uid = perfil?.id || 'anon';
  const [ano, setAno] = useState(new Date().getFullYear());
  const [plano, setPlano] = useState<Plano>(planoVazio);
  const [pronto, setPronto] = useState(false);

  // base pra preencher rápido
  const [baseRec, setBaseRec] = useState(0);
  const [baseDes, setBaseDes] = useState(0);
  // nova conta sazonal
  const [novaConta, setNovaConta] = useState<{ nome: string; valor: number; mes: number }>({ nome: '', valor: 0, mes: 0 });

  const chave = `sora_planejamento_${uid}_${ano}`;

  // Carrega do dispositivo ao trocar de ano/usuário
  useEffect(() => {
    setPronto(false);
    try {
      const raw = localStorage.getItem(chave);
      setPlano(raw ? JSON.parse(raw) : planoVazio());
    } catch { setPlano(planoVazio()); }
    setPronto(true);
  }, [chave]);

  // Salva no dispositivo a cada mudança
  useEffect(() => {
    if (!pronto) return;
    try { localStorage.setItem(chave, JSON.stringify(plano)); } catch { /* quota */ }
  }, [plano, chave, pronto]);

  const calc = useMemo(() => {
    const extras = Array(12).fill(0);
    for (const c of plano.contas) extras[c.mes] = (extras[c.mes] || 0) + (c.valor || 0);
    let acc = 0;
    const linhas = plano.meses.map((m, i) => {
      const saldo = (m.receita || 0) - (m.despesa || 0) - extras[i];
      acc += saldo;
      return { mes: MESES[i], i, receita: m.receita || 0, despesa: (m.despesa || 0) + extras[i], extras: extras[i], saldo, acumulado: acc };
    });
    const totalRec = linhas.reduce((s, l) => s + l.receita, 0);
    const totalDes = linhas.reduce((s, l) => s + l.despesa, 0);
    const pior = linhas.reduce((p, l) => (l.acumulado < p.acumulado ? l : p), linhas[0]);
    return { linhas, totalRec, totalDes, saldoAno: totalRec - totalDes, pior, extras };
  }, [plano]);

  function setMes(i: number, campo: keyof MesPlano, v: number) {
    setPlano((p) => ({ ...p, meses: p.meses.map((m, idx) => (idx === i ? { ...m, [campo]: Number.isFinite(v) ? v : 0 } : m)) }));
  }
  function preencherBase() {
    setPlano((p) => ({ ...p, meses: p.meses.map(() => ({ receita: baseRec || 0, despesa: baseDes || 0 })) }));
  }
  function addConta(nome: string, valor: number, mes: number) {
    if (!nome.trim() || !valor) return;
    setPlano((p) => ({ ...p, contas: [...p.contas, { id: Math.random().toString(36).slice(2), nome: nome.trim(), valor, mes }] }));
    setNovaConta({ nome: '', valor: 0, mes: 0 });
  }
  function delConta(id: string) {
    setPlano((p) => ({ ...p, contas: p.contas.filter((c) => c.id !== id) }));
  }

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-border/60 animate-fade-in"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none opacity-20"
               style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 60%)' }} />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <CalendarRange size={12} className="text-primary" />
                <span className="text-[11px] font-bold uppercase tracking-widest text-primary">Planejamento Anual</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Planeje o ano e veja onde o caixa aperta.</h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-lg">Defina receitas e despesas mês a mês, lance as contas sazonais (IPVA, Natal…) e veja o saldo acumulado antes de ser pego de surpresa.</p>
            </div>
            <div className="inline-flex items-center rounded-xl border border-border bg-card overflow-hidden">
              <button onClick={() => setAno((a) => a - 1)} className="px-3 py-2 text-muted-foreground hover:text-foreground">‹</button>
              <span className="px-3 py-2 text-sm font-bold tabular-nums text-foreground">{ano}</span>
              <button onClick={() => setAno((a) => a + 1)} className="px-3 py-2 text-muted-foreground hover:text-foreground">›</button>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><TrendingUp size={12} className="text-primary" /> Receitas</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums mt-1 text-foreground">{brl(calc.totalRec)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><TrendingDown size={12} className="text-red-500" /> Despesas</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums mt-1 text-foreground">{brl(calc.totalDes)}</p>
          </div>
          <div className={`rounded-2xl border p-4 ${calc.saldoAno >= 0 ? 'border-primary/40 bg-primary/[0.06]' : 'border-red-500/40 bg-red-500/[0.06]'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><PiggyBank size={12} className="text-primary" /> Sobra no ano</p>
            <p className={`text-lg sm:text-xl font-bold tabular-nums mt-1 ${calc.saldoAno >= 0 ? 'text-primary' : 'text-red-500'}`}>{brl(calc.saldoAno)}</p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5"><AlertTriangle size={12} className="text-amber-500" /> Mês mais apertado</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums mt-1 text-foreground">{calc.pior?.mes} <span className="text-sm font-medium text-muted-foreground">({brl(calc.pior?.acumulado || 0)})</span></p>
          </div>
        </div>

        {/* Gráfico saldo acumulado */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5">
          <p className="text-sm font-semibold text-foreground mb-3">Saldo acumulado ao longo do ano</p>
          <div className="h-56">
            <GraficoSaldo data={calc.linhas} ano={ano} />
          </div>
        </div>

        {/* Preencher rápido */}
        <div className="rounded-3xl border border-border bg-card p-5 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mr-1"><Wand2 size={15} className="text-primary" /> Preenchimento rápido</div>
          <label className="flex-1 min-w-[120px]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Receita média/mês</span>
            <input type="number" inputMode="decimal" value={baseRec || ''} onChange={(e) => setBaseRec(parseFloat(e.target.value))} className={inputCls} />
          </label>
          <label className="flex-1 min-w-[120px]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Despesa média/mês</span>
            <input type="number" inputMode="decimal" value={baseDes || ''} onChange={(e) => setBaseDes(parseFloat(e.target.value))} className={inputCls} />
          </label>
          <button onClick={preencherBase} className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm">Preencher os 12 meses</button>
        </div>

        {/* Grade dos 12 meses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {calc.linhas.map((l) => (
            <div key={l.i} className="rounded-2xl border border-border bg-card p-4 animate-[slide-up_400ms_ease-out_both]" style={{ animationDelay: `${l.i * 25}ms` }}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-foreground">{l.mes}</span>
                <span className={`text-sm font-bold tabular-nums ${l.saldo >= 0 ? 'text-primary' : 'text-red-500'}`}>{brl(l.saldo)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Receita</span>
                  <input type="number" inputMode="decimal" value={plano.meses[l.i].receita || ''} onChange={(e) => setMes(l.i, 'receita', parseFloat(e.target.value))} className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Despesa</span>
                  <input type="number" inputMode="decimal" value={plano.meses[l.i].despesa || ''} onChange={(e) => setMes(l.i, 'despesa', parseFloat(e.target.value))} className={inputCls} />
                </label>
              </div>
              {l.extras > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {plano.contas.filter((c) => c.mes === l.i).map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      {c.nome} {brl(c.valor)}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">Acumulado</span>
                <span className={`tabular-nums font-semibold ${l.acumulado >= 0 ? 'text-foreground' : 'text-red-500'}`}>{brl(l.acumulado)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Contas sazonais / anuais */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6">
          <p className="text-sm font-semibold text-foreground">Contas sazonais & anuais</p>
          <p className="text-xs text-muted-foreground mt-0.5 mb-4">Aquelas que pegam de surpresa. Lance no mês certo pra elas aparecerem no planejamento.</p>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {PRESETS.map((p) => (
              <button key={p.nome} onClick={() => setNovaConta((n) => ({ ...n, nome: p.nome, mes: p.mes }))}
                      className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                + {p.nome}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex-1 min-w-[140px]">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Nome</span>
              <input value={novaConta.nome} onChange={(e) => setNovaConta((n) => ({ ...n, nome: e.target.value }))} placeholder="Ex.: IPVA" className={inputCls} />
            </label>
            <label className="w-28">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Valor</span>
              <input type="number" inputMode="decimal" value={novaConta.valor || ''} onChange={(e) => setNovaConta((n) => ({ ...n, valor: parseFloat(e.target.value) }))} className={inputCls} />
            </label>
            <label className="w-24">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">Mês</span>
              <select value={novaConta.mes} onChange={(e) => setNovaConta((n) => ({ ...n, mes: Number(e.target.value) }))} className={inputCls}>
                {MESES.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
            </label>
            <button onClick={() => addConta(novaConta.nome, novaConta.valor, novaConta.mes)}
                    className="btn btn-primary px-4 py-2.5 text-sm gap-1.5 shadow-glow-sm"><Plus size={15} /> Lançar</button>
          </div>

          {plano.contas.length > 0 && (
            <div className="mt-5 space-y-2">
              {[...plano.contas].sort((a, b) => a.mes - b.mes).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold uppercase text-primary w-8 flex-shrink-0">{MESES[c.mes]}</span>
                    <span className="text-sm text-foreground truncate">{c.nome}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold tabular-nums text-foreground">{brl(c.valor)}</span>
                    <button onClick={() => delConta(c.id)} className="text-muted-foreground hover:text-red-500 p-1" aria-label="Remover"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">💾 Seu planejamento fica salvo neste aparelho. Sincronização na nuvem em breve.</p>
      </div>
    </>
  );
}
