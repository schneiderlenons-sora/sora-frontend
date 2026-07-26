'use client';

import { useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, ChevronDown,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import IconeMarca from '@/components/ui/IconeMarca';

const BRAND = 'hsl(var(--primary))';
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Casa uma transação a uma carteira (por id ou por nome) — mesma regra do CartaoClient.
const mesmaCarteira = (t: any, w: any) =>
  t.wallet_id === w.id ||
  (t.carteira_nome || '').trim().toLowerCase() === (w.nome || '').trim().toLowerCase();

function VarBadge({ val, invert = false }: { val: number; invert?: boolean }) {
  const isGood = invert ? val <= 0 : val >= 0;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${
      isGood ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
             : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'}`}>
      {isGood ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
      {Math.abs(val)}% vs mês ant.
    </span>
  );
}

type Aberto = 'saldo' | 'gastos' | 'cartoes' | null;

export default function ResumoCards({
  wallets, txsMes, resumo, saldoTotal, varReceitas, varGastos,
}: {
  wallets: any[];
  txsMes: any[];
  resumo: any;
  saldoTotal: number;
  varReceitas: number;
  varGastos: number;
}) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const toggle = (k: Exclude<Aberto, null>) => setAberto(a => (a === k ? null : k));

  const contas = useMemo(
    () => wallets.filter(w => w.tipo !== 'Crédito'),
    [wallets],
  );

  // Fatura por cartão (OF → -saldo; manual → soma dos Gasto do mês).
  const cartoes = useMemo(() => {
    return wallets
      .filter(w => w.tipo === 'Crédito')
      .map(w => {
        const fatura = (w.of_conta_id && typeof w.saldo === 'number')
          ? Math.max(-(w.saldo as number), 0)
          : txsMes.filter(t => mesmaCarteira(t, w) && t.tipo === 'Gasto').reduce((s, t) => s + (t.valor || 0), 0);
        const limite = w.limite || 0;
        return { id: w.id, nome: w.nome, fatura, limite, disponivel: Math.max(limite - fatura, 0) };
      })
      .sort((a, b) => b.fatura - a.fatura);
  }, [wallets, txsMes]);

  const cartaoTop = cartoes[0] || null;

  // Saldo por conta (maior primeiro).
  const saldoPorConta = useMemo(
    () => contas.map(w => ({ nome: w.nome, saldo: w.saldo || 0 })).sort((a, b) => b.saldo - a.saldo),
    [contas],
  );

  // Gasto por conta no mês (exclui transferência/pagamento de fatura — igual ao total).
  const gastoPorConta = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txsMes) {
      if (t.tipo !== 'Gasto') continue;
      if (t.transferencia || t.categoria === 'Fatura cartão' || t.categoria === 'Transferências') continue;
      const k = t.carteira_nome || 'Sem conta';
      map.set(k, (map.get(k) || 0) + (t.valor || 0));
    }
    return [...map.entries()].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  }, [txsMes]);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo Total (expansível) */}
        <StatCard
          label="Saldo Total" value={fmt(saldoTotal)} valueColor={BRAND}
          icon={Wallet} iconColor={BRAND}
          sub={`${contas.length} conta${contas.length === 1 ? '' : 's'}`}
          aberto={aberto === 'saldo'} onToggle={() => toggle('saldo')} delay={0}
        />
        {/* Receitas (simples) */}
        <StatCard
          label="Receitas" value={fmt(resumo?.receitas || 0)}
          icon={TrendingUp} iconColor={BRAND}
          badge={<VarBadge val={varReceitas} />} delay={50}
        />
        {/* Gastos (expansível) */}
        <StatCard
          label="Gastos" value={fmt(resumo?.gastos || 0)} valueColor="#ef4444"
          icon={TrendingDown} iconColor="#ef4444"
          badge={<VarBadge val={varGastos} invert />}
          aberto={aberto === 'gastos'} onToggle={() => toggle('gastos')} delay={100}
        />
        {/* Cartões (novo, expansível) — fatura mais alta + barra de limite */}
        <StatCard
          label="Cartões"
          value={cartaoTop ? fmt(cartaoTop.fatura) : 'R$ 0,00'}
          valueColor="#7c3aed"
          icon={CreditCard} iconColor="#7c3aed"
          sub={cartaoTop ? `Maior fatura · ${cartaoTop.nome}` : 'Nenhum cartão'}
          barra={cartaoTop && cartaoTop.limite > 0 ? Math.min((cartaoTop.fatura / cartaoTop.limite) * 100, 100) : null}
          barraCor="#7c3aed"
          aberto={aberto === 'cartoes'}
          onToggle={cartoes.length ? () => toggle('cartoes') : undefined}
          delay={150}
        />
      </div>

      {/* Painel de detalhe — full-width, abaixo do grid, um por vez, altura animada */}
      <div className="grid transition-[grid-template-rows] duration-200 ease-out"
           style={{ gridTemplateRows: aberto ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="mt-4 card rounded-2xl p-4 sm:p-5">
            {aberto === 'saldo' && (
              <Detalhe titulo="Saldo por conta" vazio="Sem contas cadastradas."
                linhas={saldoPorConta.map(c => ({ nome: c.nome, valor: fmt(c.saldo), cor: c.saldo < 0 ? '#ef4444' : undefined }))} />
            )}
            {aberto === 'gastos' && (
              <Detalhe titulo="Gastos por conta" vazio="Nenhum gasto neste mês."
                linhas={gastoPorConta.map(c => ({ nome: c.nome, valor: fmt(c.total), cor: '#ef4444' }))} />
            )}
            {aberto === 'cartoes' && (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Faturas por cartão</p>
                <div className="space-y-3">
                  {cartoes.map(c => {
                    const pct = c.limite > 0 ? Math.min((c.fatura / c.limite) * 100, 100) : 0;
                    return (
                      <div key={c.id}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-muted">
                              <IconeMarca nome={c.nome} size={28} className="w-full h-full" fallback={<CreditCard size={14} className="text-muted-foreground" />} />
                            </span>
                            <span className="text-sm font-semibold text-foreground truncate">{c.nome}</span>
                          </span>
                          <span className="text-sm font-bold tabular text-foreground whitespace-nowrap">{fmt(c.fatura)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: '#7c3aed' }} />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 tabular">
                          {c.limite > 0
                            ? <>Limite: usado {fmt(c.fatura)} de {fmt(c.limite)} · disponível {fmt(c.disponivel)}</>
                            : <>Sem limite cadastrado</>}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card de estatística (compacto, com expand opcional) ──
function StatCard({
  label, value, valueColor, icon: Icon, iconColor, sub, badge, barra, barraCor,
  aberto, onToggle, delay = 0,
}: {
  label: string; value: string; valueColor?: string;
  icon: any; iconColor: string;
  sub?: string; badge?: React.ReactNode;
  barra?: number | null; barraCor?: string;
  aberto?: boolean; onToggle?: () => void; delay?: number;
}) {
  return (
    <div className="card rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-fade-in flex flex-col"
         style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `color-mix(in srgb, ${iconColor} 9%, transparent)` }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
      </div>

      <p className="text-lg sm:text-2xl font-bold tabular tracking-tight truncate leading-tight"
         style={{ color: valueColor || 'hsl(var(--fg))' }}>
        {value}
      </p>

      {typeof barra === 'number' && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${barra}%`, background: barraCor }} />
        </div>
      )}

      <div className="mt-1.5 min-h-[20px]">
        {badge || (sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>)}
      </div>

      {onToggle && (
        <button
          onClick={onToggle}
          aria-expanded={!!aberto}
          aria-label={`${aberto ? 'Recolher' : 'Expandir'} ${label}`}
          className="mt-2 -mb-1 -mx-1 h-9 flex items-center justify-center gap-1 rounded-lg text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-[0.98] transition-all"
        >
          {aberto ? 'Recolher' : 'Detalhes'}
          <ChevronDown size={14} className={`transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
}

// ── Lista de detalhe genérica (nome → valor) ──
function Detalhe({ titulo, linhas, vazio }: { titulo: string; linhas: { nome: string; valor: string; cor?: string }[]; vazio: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <div className="divide-y divide-border/50">
          {linhas.map((l, i) => (
            <div key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="text-sm text-foreground truncate">{l.nome}</span>
              <span className="text-sm font-bold tabular whitespace-nowrap" style={{ color: l.cor || 'hsl(var(--fg))' }}>{l.valor}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
