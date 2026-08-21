'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, ChevronDown,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import IconeMarca from '@/components/ui/IconeMarca';
import ValorAuto from '@/components/ui/ValorAuto';
import { api } from '@/lib/api';
import { competenciaAtual, cicloPorCompetencia, pertenceAFatura, criterioDaFatura } from '@/lib/ciclo-fatura';
import { somarFatura } from '@/lib/valor-fatura';
import {
  fatiasDeContas, saldoPorContaDe, gastoPorContaDe, acumuladoDe,
  IconesContas, BarraContas, Sparkline,
} from '@/components/dashboard/stat-visuais';

// =============================================================================
// Os stat cards abaixo do card de hábitos.
//
// ⚠️ DESKTOP E MOBILE MOSTRAM CONJUNTOS DIFERENTES — de propósito:
//
//   mobile  → Receitas · Cartões          (Saldo e Gastos já estão no HERO,
//                                          em `HeroStatsMobile`, com ícones,
//                                          barra e gráfico)
//   desktop → Saldo em contas · Receitas · Gastos do mês · Cartões
//
// O desktop não tem o `HeroStatsMobile` (ele é `md:hidden`), então é aqui que
// os cards ricos aparecem — e são os MESMOS visuais, vindos de
// `stat-visuais.tsx`. Repetir Saldo/Gastos no mobile daria dois cards para o
// mesmo número na mesma tela, que foi exatamente o que esta mudança tirou.
// Por isso os dois são `hidden lg:flex`, não componentes separados: um só
// lugar decide o que cada stat mostra.
// =============================================================================

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
  wallets, txsMes, resumo, saldoTotal, varReceitas, varGastos, phone,
  dadosDiarios = [], monthName = '',
}: {
  wallets: any[];
  txsMes: any[];
  resumo: any;
  saldoTotal: number;
  varReceitas: number;
  varGastos: number;
  phone?: string;
  /** Gasto por dia do mês — vira o mini gráfico do card "Gastos do mês". */
  dadosDiarios?: { dia: string; valor: number }[];
  monthName?: string;
}) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const toggle = (k: Exclude<Aberto, null>) => setAberto(a => (a === k ? null : k));

  const contas = useMemo(
    () => wallets.filter(w => w.tipo !== 'Crédito'),
    [wallets],
  );

  // Restante canônico por cartão (endpoint em lote — mesma fonte do painel de
  // cartões, do WhatsApp e dos crons). Busca DEPOIS de pintar: o card já
  // aparece com o valor local e é corrigido quando isto chega, então não
  // competimos com o LCP.
  const [restanteApi, setRestanteApi] = useState<Record<string, number>>({});
  // Fatura do emissor por cartão (mesma resposta do restante — sem chamada nova).
  const [billApi, setBillApi] = useState<Record<string, string | null>>({});
  useEffect(() => {
    if (!phone || !wallets.some(w => w.tipo === 'Crédito')) return;
    let vivo = true;
    api.wallets.faturas(phone)
      .then((r) => {
        if (!vivo) return;
        const acc: Record<string, number> = {};
        for (const f of r.faturas || []) {
          // ⚠️ FATURA FECHADA E QUITADA: o número vivo é o da SEGUINTE. Sem
          // isto o card mostrava R$ 0,00 num cartão com compras novas — e a
          // aba de cartões, que já pulava sozinha (CartaoClient `pulaUma`),
          // mostrava outro valor pro MESMO cartão no MESMO dia. Caso real:
          // EQI BLACK em 19/08, R$ 0,00 aqui e R$ 2.083,92 lá.
          // `proxima` vem pronta do endpoint em lote, então as duas telas
          // passam a ler o mesmo campo em vez de cada uma decidir a sua.
          const f2 = f as typeof f & { fechada?: boolean; quitada?: boolean; proxima?: { restante: number } | null };
          acc[f.cartao_id] = (f2.fechada && f2.quitada && f2.proxima)
            ? f2.proxima.restante
            : f.restante;
        }
        const bills: Record<string, string | null> = {};
        for (const f of r.faturas || []) bills[f.cartao_id] = (f as any).of_bill_id || null;
        setBillApi(bills);
        setRestanteApi(acc);
      })
      .catch(() => { /* mantém o cálculo local */ });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, wallets.length]);

  // Fatura por cartão: OF → −saldo (o banco manda); manual → soma dos Gasto do
  // CICLO REAL de fechamento. O valor local é aproximado quando o ciclo começa
  // no mês anterior (`txsMes` só tem o mês corrente); o `restanteApi` corrige
  // pro número canônico assim que responde.
  const cartoes = useMemo(() => {
    return wallets
      .filter(w => w.tipo === 'Crédito')
      .map(w => {
        const ciclo = cicloPorCompetencia(w, competenciaAtual(w));
        // Saldo ZERO num cartão do OF não é "fatura zerada": é o banco não ter
        // publicado o total do ciclo em aberto — aí soma as transações, igual manual.
        const minhas = txsMes.filter(t => mesmaCarteira(t, w));
        // Critério UMA vez por fatura — decidir por transação somava a fatura
        // vinculada junto com o ciclo novo.
        const billId = billApi[w.id] || null;
        const criterio = criterioDaFatura(minhas, w, true, ciclo, billId);
        // Soma ASSINADA (lib/valor-fatura.ts): estorno/crédito ABATE a fatura.
        const local = (w.of_conta_id && typeof w.saldo === 'number' && w.saldo < 0)
          ? -(w.saldo as number)
          : somarFatura(minhas.filter(t => pertenceAFatura(t, w, ciclo, true, criterio, billId)));
        const fatura = restanteApi[w.id] ?? local;
        const limite = w.limite || 0;
        return { id: w.id, nome: w.nome, fatura, limite, disponivel: Math.max(limite - fatura, 0) };
      })
      .sort((a, b) => b.fatura - a.fatura);
  }, [wallets, txsMes, restanteApi, billApi]);

  const cartaoTop = cartoes[0] || null;

  // Contas: composição da barra (só positivas) e a lista completa do detalhe
  // (com as zeradas e as negativas — esconder conta no vermelho é esconder
  // justamente o que o usuário precisa ver).
  const listaContas = useMemo(
    () => contas.map(w => ({ nome: w.nome, saldo: w.saldo || 0 })),
    [contas],
  );
  const fatias = useMemo(() => fatiasDeContas(listaContas), [listaContas]);
  const saldoPorConta = useMemo(() => saldoPorContaDe(listaContas), [listaContas]);
  const gastoPorConta = useMemo(() => gastoPorContaDe(txsMes), [txsMes]);
  const acumulado = useMemo(() => acumuladoDe(dadosDiarios), [dadosDiarios]);

  // Conteúdo do painel de detalhe (um por vez).
  const painelContent = (
    <>
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
    </>
  );

  const nContas = listaContas.length;

  return (
    // O painel de detalhe vive DENTRO do grid como item full-width (col-span).
    // Via `order` ele cai logo depois da LINHA do card tocado: no mobile só
    // sobram 2 cards (uma linha), então `order-3`; no desktop a fileira é única
    // de 4 e o `lg:order-last` mantém ele sempre abaixo de todos.
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* ── Saldo em contas — SÓ DESKTOP (no mobile vive no hero) ──
          Ícones das contas em cima + barra de composição, igual ao mobile. */}
      <StatCard
        className="hidden lg:flex lg:order-1"
        label="Saldo em contas" value={fmt(saldoTotal)} valueColor={BRAND}
        icon={Wallet} iconColor={BRAND}
        topo={<IconesContas contas={listaContas} />}
        barraSlot={<BarraContas fatias={fatias} className="mt-2.5" />}
        sub={nContas === 0 ? 'Nenhuma conta ainda' : `${nContas} conta${nContas === 1 ? '' : 's'}`}
        aberto={aberto === 'saldo'} onToggle={() => toggle('saldo')} delay={0}
      />

      {/* ── Receitas (simples) — nas duas telas ── */}
      <StatCard
        className="order-1 lg:order-2"
        label="Receitas" value={fmt(resumo?.receitas || 0)}
        icon={TrendingUp} iconColor={BRAND}
        badge={<VarBadge val={varReceitas} />} delay={50}
      />

      {/* ── Gastos do mês — SÓ DESKTOP (no mobile vive no hero) ──
          Mini gráfico do acumulado em cima, igual ao mobile. */}
      <StatCard
        className="hidden lg:flex lg:order-3"
        label="Gastos do mês" value={fmt(resumo?.gastos || 0)} valueColor="#ef4444"
        icon={TrendingDown} iconColor="#ef4444"
        topo={<span className="block h-8"><Sparkline valores={acumulado} /></span>}
        badge={<VarBadge val={varGastos} invert />}
        aberto={aberto === 'gastos'} onToggle={() => toggle('gastos')} delay={100}
      />

      {/* ── Cartões — nas duas telas ── */}
      <StatCard
        className="order-2 lg:order-4"
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

      {/* Painel de detalhe — full-width, sempre depois da linha dos cards. */}
      {aberto && (
        <div className="col-span-2 lg:col-span-4 card rounded-2xl p-4 sm:p-5 animate-fade-in order-3 lg:order-last">
          {painelContent}
        </div>
      )}
    </div>
  );
}

// ── Card de estatística (compacto, com expand opcional) ──
function StatCard({
  label, value, valueColor, icon: Icon, iconColor, sub, badge, barra, barraCor,
  topo, barraSlot, aberto, onToggle, delay = 0, className = '',
}: {
  label: string; value: string; valueColor?: string;
  icon: any; iconColor: string;
  sub?: string; badge?: React.ReactNode;
  barra?: number | null; barraCor?: string;
  /** Visual acima do valor (ícones das contas, mini gráfico). Altura fixa →
   *  sem CLS quando o dado chega. */
  topo?: React.ReactNode;
  /** Barra composta (várias fatias) — quando uma barra de % simples não serve. */
  barraSlot?: React.ReactNode;
  aberto?: boolean; onToggle?: () => void; delay?: number; className?: string;
}) {
  return (
    <div className={`card rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-fade-in flex flex-col ${className}`}
         style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `color-mix(in srgb, ${iconColor} 9%, transparent)` }}>
          <Icon size={15} style={{ color: iconColor }} />
        </div>
      </div>

      {topo && <div className="mb-3">{topo}</div>}

      {/* ValorAuto no lugar de `truncate`: o valor encolhe só o necessário e
          aparece INTEIRO, em vez de virar "R$ 2.5…" no card estreito. */}
      <ValorAuto max="1.5rem" className="font-bold tracking-tight leading-tight"
                 style={{ color: valueColor || 'hsl(var(--fg))' }}>
        {value}
      </ValorAuto>

      {barraSlot}

      {typeof barra === 'number' && (
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${barra}%`, background: barraCor }} />
        </div>
      )}

      {/* ⚠️ `mt-auto`: os cards da fileira têm alturas diferentes (dois com
          visual em cima, dois sem) e o grid estica todos. Sem isto o rodapé de
          cada um flutuava numa altura diferente e a linha parecia desalinhada;
          com ele, badge e botão "Detalhes" encostam na base em todos. */}
      <div className="mt-auto pt-1.5 min-h-[20px]">
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
