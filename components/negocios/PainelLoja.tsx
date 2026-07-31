'use client';

// =============================================================================
// Painel da LOJA FÍSICA — a primeira tela de quem toca um comércio.
//
// Hierarquia pensada na pergunta que o dono faz todo dia, nesta ordem:
//   1. "sobrou dinheiro este mês?"      → lucro, em destaque total
//   2. "de onde veio e pra onde foi?"   → receita, despesa, margem, ticket
//   3. "o que vence?"                   → a pagar / a receber, vencidos em 1º
//   4. "quanto tenho agora?"            → saldo por conta
//   5. "estou melhorando?"              → evolução de 6 meses
//
// Mobile-first: o número que decide aparece sem rolar; o resto vem depois.
// =============================================================================

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowUpRight, ArrowDownRight, TrendingUp, Wallet, Receipt, HandCoins,
  ChevronRight, ChevronLeft, Plus, Minus, AlertTriangle, Landmark, Banknote,
  CreditCard, ShoppingBag, Percent, CalendarClock,
} from 'lucide-react';
import { labelCategoria, labelForma, type IndicadoresNegocio } from '@/lib/lancamentos';

// recharts só desce quando o gráfico entra em cena (regra de performance do
// projeto). Skeleton com a MESMA altura do gráfico → sem salto de layout.
const GraficoEvolucao = dynamic(() => import('./GraficoEvolucao'), {
  ssr: false,
  loading: () => <div className="h-[260px] rounded-xl bg-muted/40 animate-pulse" />,
});

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const real = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);
const pct = (n: number) => `${n > 0 ? '+' : ''}${(n || 0).toFixed(1).replace('.', ',')}%`;
const diaCurto = (iso: string) => {
  const [, m, d] = (iso || '').split('-');
  return d && m ? `${d}/${m}` : iso;
};

const ICONE_CONTA: Record<string, any> = {
  dinheiro: Banknote, banco: Landmark, cartao: CreditCard, outro: Wallet,
};

export default function PainelLoja({
  dados, cor, mes, onMes, carregando, onNovaEntrada, onNovaSaida,
}: {
  dados?: IndicadoresNegocio;
  cor: string;
  mes: string;                       // YYYY-MM
  onMes: (novo: string) => void;
  carregando?: boolean;
  onNovaEntrada: () => void;
  onNovaSaida: () => void;
}) {
  const [aba, setAba] = useState<'sai' | 'entra'>('sai');

  const d = dados;
  const vazio = !carregando && d && d.lancamentos_qtd === 0 && d.a_pagar.qtd === 0 && d.a_receber.qtd === 0;

  const [ano, mesNum] = mes.split('-').map(Number);
  const rotuloMes = `${MESES[mesNum - 1]} de ${ano}`;
  const ehMesAtual = mes === new Date().toISOString().slice(0, 7);

  const passo = (n: number) => {
    const dt = new Date(Date.UTC(ano, mesNum - 1 + n, 1));
    onMes(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`);
  };

  const maiorCategoria = useMemo(
    () => Math.max(1, ...(d?.por_categoria || []).map(c => c.valor)),
    [d?.por_categoria],
  );
  const maiorForma = useMemo(
    () => Math.max(1, ...(d?.por_forma || []).map(f => f.valor)),
    [d?.por_forma],
  );

  if (carregando || !d) return <EsqueletoPainel />;

  const lucroPositivo = d.lucro >= 0;

  return (
    <div className="space-y-4 sm:space-y-5">

      {/* ── Navegador de mês + ações ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
          <button onClick={() => passo(-1)} aria-label="Mês anterior"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="px-2 text-sm font-bold text-foreground min-w-[124px] text-center tabular-nums">
            {rotuloMes}
          </span>
          <button onClick={() => passo(1)} disabled={ehMesAtual} aria-label="Próximo mês"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent">
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 sm:flex-none">
          <button onClick={onNovaEntrada}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
            style={{ background: cor, minHeight: 44 }}>
            <Plus size={16} /> Entrada
          </button>
          <button onClick={onNovaSaida}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-11 px-4 rounded-2xl text-sm font-bold transition-transform active:scale-[0.98]"
            style={{ border: '1px solid #ef4444', color: '#ef4444', minHeight: 44 }}>
            <Minus size={16} /> Saída
          </button>
        </div>
      </div>

      {vazio && <ComeceAgora cor={cor} onNovaEntrada={onNovaEntrada} />}

      {/* ── O NÚMERO: lucro do mês ───────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-5 sm:p-7">
        <div aria-hidden className="absolute -top-24 -right-16 w-72 h-72 rounded-full pointer-events-none opacity-[0.13]"
             style={{ background: `radial-gradient(circle, ${lucroPositivo ? cor : '#ef4444'} 0%, transparent 70%)` }} />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {lucroPositivo ? 'Sobrou no mês' : 'Faltou no mês'}
          </p>
          <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular-nums mt-1.5"
             style={{ color: lucroPositivo ? cor : '#ef4444' }}>
            {real(Math.abs(d.lucro))}
          </p>
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <Variacao valor={d.comparativo.lucro} bomSeSobe />
            <span className="text-xs text-muted-foreground">
              vs. {real(d.comparativo.anterior.lucro)} no mês passado
            </span>
          </div>
        </div>
      </section>

      {/* ── Os quatro que explicam o lucro ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Indicador rotulo="Entrou" valor={real(d.receita)} variacao={d.comparativo.receita} bomSeSobe
                   icone={ArrowUpRight} tom={cor}
                   sub={`${d.vendas_qtd} venda${d.vendas_qtd === 1 ? '' : 's'}`} />
        <Indicador rotulo="Saiu" valor={real(d.despesa)} variacao={d.comparativo.despesa} bomSeSobe={false}
                   icone={ArrowDownRight} tom="#ef4444" />
        <Indicador rotulo="Margem" valor={`${(d.margem || 0).toFixed(1).replace('.', ',')}%`}
                   icone={Percent} tom="#0ea5e9"
                   sub="do que entrou virou lucro" />
        <Indicador rotulo="Ticket médio" valor={real(d.ticket_medio)}
                   icone={ShoppingBag} tom="#8b5cf6"
                   sub="por venda" />
      </div>

      {/* ── O que vence ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CardPendencia titulo="A pagar" dados={d.a_pagar} tom="#ef4444" icone={Receipt} href="/negocios/contas" />
        <CardPendencia titulo="A receber" dados={d.a_receber} tom={cor} icone={HandCoins} href="/negocios/caixa" />
      </div>

      {/* ── Saldo em contas ──────────────────────────────────────── */}
      {d.contas.length > 0 && (
        <section className="rounded-3xl border border-border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <h2 className="text-sm font-bold text-foreground">Saldo em contas</h2>
            <span className="text-xl font-bold tabular-nums text-foreground">{real(d.saldo_contas)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {d.contas.map(c => {
              const Icone = ICONE_CONTA[c.tipo] || Wallet;
              const negativo = c.saldo < 0;
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/40">
                  <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
                    <Icone size={16} style={{ color: cor }} />
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{c.nome}</span>
                  <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${negativo ? 'text-red-500' : 'text-foreground'}`}>
                    {real(c.saldo)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Evolução ─────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-sm font-bold text-foreground mb-1">Últimos 6 meses</h2>
        <p className="text-xs text-muted-foreground mb-4">Receita e despesa em barras, o lucro na linha</p>
        <GraficoEvolucao dados={d.evolucao} cor={cor} />
      </section>

      {/* ── Para onde vai / de onde vem ──────────────────────────── */}
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/60 mb-4 max-w-xs">
          {([['sai', 'Para onde vai'], ['entra', 'Como entra']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setAba(id)}
              aria-pressed={aba === id}
              className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all ${
                aba === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
              style={{ minHeight: 36 }}>
              {label}
            </button>
          ))}
        </div>

        {aba === 'sai' ? (
          d.por_categoria.length ? (
            <div className="space-y-3">
              {d.por_categoria.map(c => (
                <Barra key={c.categoria} rotulo={labelCategoria('saida', c.categoria)}
                       valor={real(c.valor)} pct={(c.valor / maiorCategoria) * 100} tom="#ef4444" />
              ))}
            </div>
          ) : <Vazio texto="Nenhuma saída registrada neste mês." />
        ) : (
          d.por_forma.length ? (
            <div className="space-y-3">
              {d.por_forma.map(f => (
                <Barra key={f.forma} rotulo={labelForma(f.forma)}
                       valor={real(f.valor)} pct={(f.valor / maiorForma) * 100} tom={cor} />
              ))}
            </div>
          ) : <Vazio texto="Nenhuma entrada registrada neste mês." />
        )}
      </section>
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────── */

// Variação vs mês anterior. `bomSeSobe` separa a SEMÂNTICA da direção: despesa
// subindo é ruim, receita subindo é bom — a mesma seta não pode ter a mesma cor.
function Variacao({ valor, bomSeSobe }: { valor: number; bomSeSobe: boolean }) {
  if (!valor) return <span className="text-xs text-muted-foreground">sem mudança</span>;
  const subiu = valor > 0;
  const bom = bomSeSobe ? subiu : !subiu;
  const Icone = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${
      bom ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
          : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'}`}>
      <Icone size={12} /> {pct(valor)}
    </span>
  );
}

function Indicador({ rotulo, valor, variacao, bomSeSobe, icone: Icone, tom, sub }: {
  rotulo: string; valor: string; variacao?: number; bomSeSobe?: boolean;
  icone: any; tom: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${tom} 14%, transparent)` }}>
          <Icone size={14} style={{ color: tom }} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground truncate">{rotulo}</span>
      </div>
      <p className="text-xl sm:text-2xl font-bold text-foreground tabular-nums truncate">{valor}</p>
      {variacao !== undefined
        ? <div className="mt-1.5"><Variacao valor={variacao} bomSeSobe={bomSeSobe ?? true} /></div>
        : sub && <p className="text-[11px] text-muted-foreground mt-1.5 truncate">{sub}</p>}
    </div>
  );
}

// O que já VENCEU vem primeiro e em vermelho: é dinheiro que já devia ter
// entrado ou saído, e some no meio da lista se ficar em ordem cronológica pura.
function CardPendencia({ titulo, dados, tom, icone: Icone, href }: {
  titulo: string; dados: IndicadoresNegocio['a_pagar']; tom: string; icone: any; href: string;
}) {
  return (
    <Link href={href}
      className="group rounded-3xl border border-border bg-card p-5 block transition-colors hover:border-border/80 hover:bg-muted/20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${tom} 14%, transparent)` }}>
            <Icone size={17} style={{ color: tom }} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">{titulo}</p>
            <p className="text-[11px] text-muted-foreground">
              {dados.qtd === 0 ? 'nada em aberto' : `${dados.qtd} em aberto`}
            </p>
          </div>
        </div>
        <ChevronRight size={16} className="text-muted-foreground flex-shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
      </div>

      <p className="text-2xl font-bold text-foreground tabular-nums">{real(dados.total)}</p>

      {dados.vencido_qtd > 0 && (
        <p className="inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400">
          <AlertTriangle size={12} />
          {real(dados.vencido)} vencido{dados.vencido_qtd === 1 ? '' : 's'}
        </p>
      )}

      {dados.proximos.length > 0 && (
        <ul className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
          {dados.proximos.slice(0, 3).map((p, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <CalendarClock size={12} className={p.vencido ? 'text-red-500 flex-shrink-0' : 'text-muted-foreground flex-shrink-0'} />
              <span className="flex-1 min-w-0 truncate text-muted-foreground">{p.descricao}</span>
              <span className={`tabular-nums flex-shrink-0 ${p.vencido ? 'text-red-500 font-bold' : 'text-muted-foreground'}`}>
                {diaCurto(p.vencimento)}
              </span>
              <span className="tabular-nums font-semibold text-foreground flex-shrink-0">{real(p.valor)}</span>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

function Barra({ rotulo, valor, pct: largura, tom }: { rotulo: string; valor: string; pct: number; tom: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1">
        <span className="text-sm text-foreground truncate">{rotulo}</span>
        <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{valor}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-500"
             style={{ width: `${Math.max(largura, 3)}%`, background: tom }} />
      </div>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="text-sm text-muted-foreground text-center py-6">{texto}</p>;
}

function ComeceAgora({ cor, onNovaEntrada }: { cor: string; onNovaEntrada: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed p-5 flex items-start gap-3"
         style={{ borderColor: `color-mix(in srgb, ${cor} 40%, transparent)`, background: `color-mix(in srgb, ${cor} 6%, transparent)` }}>
      <span className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)` }}>
        <TrendingUp size={18} style={{ color: cor }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">Ainda não há movimento neste mês</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
          Registre a primeira venda e os números aparecem aqui na hora. Você também
          pode lançar pelo WhatsApp: <b className="text-foreground">&ldquo;vendi 3 bolos 90 reais&rdquo;</b>.
        </p>
        <button onClick={onNovaEntrada}
          className="mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-white text-xs font-bold"
          style={{ background: cor, minHeight: 40 }}>
          <Plus size={14} /> Registrar entrada
        </button>
      </div>
    </div>
  );
}

function EsqueletoPainel() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true">
      <div className="flex justify-between gap-3">
        <div className="h-12 w-56 rounded-2xl bg-muted" />
        <div className="h-12 w-48 rounded-2xl bg-muted" />
      </div>
      <div className="h-40 rounded-3xl bg-muted" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {[0, 1].map(i => <div key={i} className="h-44 rounded-3xl bg-muted" />)}
      </div>
      <div className="h-[360px] rounded-3xl bg-muted" />
    </div>
  );
}
