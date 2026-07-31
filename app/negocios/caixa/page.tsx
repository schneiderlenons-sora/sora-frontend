'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import SectionSkeleton from '@/components/ui/SectionSkeleton';
import ModalLancamento from '@/components/negocios/ModalLancamento';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import { corEmpresa, type Empresa } from '@/lib/empresas';
import ModalContas, { iconeConta } from '@/components/negocios/ModalContas';
import ModalCentrosCusto from '@/components/negocios/ModalCentrosCusto';
import {
  fmtCent, labelCategoria, labelForma, porDia, totais, saldoPorConta,
  type Lancamento, type TipoLancamento, type ContaNegocio,
} from '@/lib/lancamentos';
import {
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Plus, Minus,
  Wallet, CalendarClock, ArrowLeft, Inbox, Settings2, Layers,
} from 'lucide-react';

const hojeIso = () => new Date().toISOString().slice(0, 10);
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Recortes do fluxo de caixa. Todos terminam HOJE, menos "mês", que navega.
type PeriodoCaixa = 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano';
const PERIODOS: { v: PeriodoCaixa; label: string }[] = [
  { v: 'hoje',      label: 'Hoje' },
  { v: 'semana',    label: 'Semana' },
  { v: 'mes',       label: 'Mês' },
  { v: 'trimestre', label: 'Trimestre' },
  { v: 'ano',       label: 'Ano' },
];

function rotuloDia(iso: string) {
  const h = hojeIso();
  if (iso === h) return 'Hoje';
  const d = new Date(iso + 'T12:00:00');
  const ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
  if (iso === ontem.toISOString().slice(0, 10)) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

export default function CaixaPage() {
  const { empresa, carregando, recarregar, phone, isPremium } = useEmpresa();
  const [modalLanc, setModalLanc] = useState<{ tipo: TipoLancamento; item?: Lancamento } | null>(null);
  const [modalContas, setModalContas] = useState(false);
  const [modalCentros, setModalCentros] = useState(false);

  // Período visualizado. "mês" mantém o navegador de mês a mês; os outros são
  // recortes fixos terminando HOJE (o backend calcula no fuso de SP — em UTC,
  // às 21h no Brasil "hoje" já virou amanhã e o caixa do dia apareceria vazio).
  const [periodo, setPeriodo] = useState<PeriodoCaixa>('mes');

  // Mês visualizado (0 = atual). Livre pra frente e pra trás — igual transações.
  const [mesIndex, setMesIndex] = useState(0);
  const ref = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + mesIndex, 1);
  }, [mesIndex]);
  const mes = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;
  const mesLabel = `${MESES[ref.getMonth()]} ${ref.getFullYear()}`;

  const { data: lancData, mutate: mLanc } = useApi(
    (phone && empresa) ? `neg:lanc:${empresa.id}:${periodo === 'mes' ? mes : periodo}` : null,
    () => api.negocios.lancamentos.listar(phone, periodo === 'mes'
      ? { empresa_id: empresa!.id, mes }
      : { empresa_id: empresa!.id, periodo }),
  );
  const lancamentos: Lancamento[] = Array.isArray(lancData) ? lancData : [];
  const carregandoLanc = !!empresa && lancData === undefined;

  // Contas do negócio (caixas) — pra mostrar saldo por conta. Migration 095.
  const { data: contasData, mutate: mContas } = useApi(
    (phone && empresa) ? `neg:contas:${empresa.id}` : null,
    () => api.negocios.contas.listar(phone, empresa!.id),
  );
  const contas: ContaNegocio[] = Array.isArray(contasData) ? contasData : [];
  const saldosConta = useMemo(() => saldoPorConta(lancamentos, contas), [lancamentos, contas]);

  const doMes = useMemo(() => totais(lancamentos), [lancamentos]);
  const deHoje = useMemo(
    () => totais(lancamentos.filter(l => l.data === hojeIso())),
    [lancamentos],
  );
  const dias = useMemo(() => porDia(lancamentos), [lancamentos]);

  const cor = corEmpresa(empresa);

  if (!isPremium) {
    return (
      <>
        <div className="pb-20">
          <p className="text-sm text-muted-foreground">O Caixa faz parte do plano Premium.</p>
        </div>
      </>
    );
  }

  if (carregando) return <><SectionSkeleton /></>;

  if (!empresa) {
    return (
      <>
        <div className="pb-20 space-y-6">
          <VoltarNegocios />
          <div className="rounded-3xl border border-border/40 p-8 text-center"
               style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            <p className="text-sm text-muted-foreground">
              Cadastre uma empresa em <Link href="/negocios" className="font-semibold underline">Negócios</Link> pra abrir o caixa.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pb-20 space-y-6">

        <VoltarNegocios />

        {/* HEADER */}
        <header className="relative z-30 flex items-start justify-between flex-wrap gap-4 animate-fade-in">
          {/* O seletor de empresa vive na SIDEBAR (contexto de todo o
              painel). Aqui fica só o nome da tela — dois seletores na mesma
              página deixavam dúvida sobre qual valia. */}
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{empresa?.nome || "Negócios"}</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Fluxo de caixa</h1>
            <p className="text-sm text-muted-foreground mt-1">Entradas e saídas do dia a dia</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalLanc({ tipo: 'entrada' })}
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
              style={{ background: '#16a34a' }}>
              <Plus size={16} /> Entrada
            </button>
            <button
              onClick={() => setModalLanc({ tipo: 'saida' })}
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-sm font-bold border transition-colors hover:bg-muted/60"
              style={{ borderColor: '#ef4444', color: '#ef4444' }}>
              <Minus size={16} /> Saída
            </button>
          </div>
        </header>

        {/* HERO — o caixa de HOJE (o número que importa no balcão) */}
        <section className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 animate-fade-in"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: `radial-gradient(circle at top right, ${cor}20 0%, transparent 70%)` }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full mb-3"
                 style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
              <Wallet size={12} style={{ color: cor }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: cor }}>
                Caixa de hoje
              </span>
            </div>

            <p className="text-4xl sm:text-5xl font-bold tracking-tight tabular leading-none"
               style={{ color: deHoje.saldo >= 0 ? 'hsl(var(--foreground))' : '#ef4444' }}>
              {fmtCent(deHoje.saldo)}
            </p>
            <p className="text-xs text-muted-foreground mt-1.5">Saldo do dia</p>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4">
              <span className="inline-flex items-center gap-1.5 text-sm">
                <ArrowUpRight size={15} className="text-green-600 dark:text-green-500" />
                <span className="tabular font-semibold text-foreground">{fmtCent(deHoje.entradas)}</span>
                <span className="text-muted-foreground text-xs">entradas</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <ArrowDownRight size={15} className="text-red-600 dark:text-red-500" />
                <span className="tabular font-semibold text-foreground">{fmtCent(deHoje.saidas)}</span>
                <span className="text-muted-foreground text-xs">saídas</span>
              </span>
            </div>
          </div>
        </section>

        {/* Recorte do período. Scroll horizontal no mobile pra caber sem
            quebrar linha; o chip ativo tem estado de FORMA (fundo + peso), não
            só cor. */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
             role="tablist" aria-label="Período">
          {PERIODOS.map(p => {
            const on = periodo === p.v;
            return (
              <button key={p.v} onClick={() => setPeriodo(p.v)}
                role="tab" aria-selected={on}
                className={`h-10 px-3.5 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors border ${
                  on ? 'text-white' : 'text-muted-foreground hover:text-foreground border-border'}`}
                style={{ minHeight: 40, ...(on ? { background: cor, borderColor: cor } : undefined) }}>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* RESUMO DO MÊS + navegação */}
        <section className="rounded-3xl border border-border/40 overflow-hidden"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border/40">
            {/* O navegador mês-a-mês só faz sentido no recorte "mês" — nos
                outros o período é fixo e termina hoje. */}
            <div className="inline-flex items-center gap-1" hidden={periodo !== 'mes'}>
              <button onClick={() => setMesIndex(i => i - 1)} aria-label="Mês anterior"
                      className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                <ChevronLeft className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
              </button>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 min-w-[110px] text-center" style={{ color: cor }}>
                {mesLabel}
              </span>
              <button onClick={() => setMesIndex(i => Math.min(i + 1, 12))} disabled={mesIndex >= 12}
                      aria-label="Próximo mês"
                      className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30">
                <ChevronRight className="w-[18px] h-[18px] sm:w-4 sm:h-4" />
              </button>
              {mesIndex !== 0 && (
                <button onClick={() => setMesIndex(0)}
                        className="h-11 sm:h-8 px-3 ml-1 rounded-full text-[11px] font-semibold uppercase tracking-wider hover:bg-muted transition-colors"
                        style={{ color: cor }}>
                  Hoje
                </button>
              )}
            </div>

            {/* Fora do recorte "mês" o navegador some — sem um rótulo aqui, o
                usuário veria três números sem saber de que período são. */}
            {periodo !== 'mes' && (
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2" style={{ color: cor }}>
                {periodo === 'hoje'      ? 'Hoje'
                 : periodo === 'semana'   ? 'Esta semana'
                 : periodo === 'trimestre'? 'Este trimestre'
                 :                          'Este ano'}
              </span>
            )}
          </div>

          {/* Totais do mês */}
          <div className="grid grid-cols-3 divide-x divide-border/40 border-b border-border/40">
            <Total rotulo="Entradas" valor={doMes.entradas} cor="#16a34a" Icon={ArrowUpRight} />
            <Total rotulo="Saídas"   valor={doMes.saidas}   cor="#ef4444" Icon={ArrowDownRight} />
            <Total rotulo="Saldo"    valor={doMes.saldo}    cor={doMes.saldo >= 0 ? '#16a34a' : '#ef4444'} Icon={Wallet} />
          </div>

          {doMes.aPagar > 0 && (
            <Link href="/negocios/contas"
                  className="flex items-center gap-2.5 px-4 sm:px-5 py-3 min-h-[52px] border-b border-border/40 hover:bg-muted/40 transition-colors">
              <CalendarClock size={15} className="text-amber-600 dark:text-amber-500 flex-shrink-0" />
              <span className="text-sm text-foreground flex-1 min-w-0">
                <span className="font-semibold tabular">{fmtCent(doMes.aPagar)}</span>
                <span className="text-muted-foreground"> em contas ainda não pagas</span>
              </span>
              <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />
            </Link>
          )}

          {/* Saldo por conta (dinheiro, banco, maquininha…) — migration 095 */}
          <div className="px-4 sm:px-5 py-3 border-b border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Saldo por conta</span>
              <span className="inline-flex items-center gap-3">
                <button onClick={() => setModalCentros(true)} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: cor }}>
                  <Layers size={12} /> Centros de custo
                </button>
                <button onClick={() => setModalContas(true)} className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: cor }}>
                  <Settings2 size={12} /> Gerenciar
                </button>
              </span>
            </div>
            {saldosConta.length === 0 ? (
              <button onClick={() => setModalContas(true)}
                      className="w-full h-11 rounded-xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2">
                <Plus size={15} /> Criar contas (Dinheiro, Banco, Maquininha…)
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {saldosConta.map((s, i) => {
                  const Icon = iconeConta(s.conta?.tipo);
                  const neg = s.saldo < 0;
                  return (
                    <div key={s.conta?.id || `sem-${i}`} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/60 bg-muted/20">
                      <Icon size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-xs font-medium text-foreground">{s.conta?.nome || 'Sem conta'}</span>
                      <span className="text-sm font-bold tabular" style={{ color: neg ? '#ef4444' : '#16a34a' }}>{fmtCent(s.saldo)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Movimentações agrupadas por dia */}
          {carregandoLanc ? (
            <div className="p-5"><SectionSkeleton /></div>
          ) : dias.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-muted/50">
                <Inbox size={20} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhum lançamento em {mesLabel.toLowerCase()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Registre a primeira entrada do balcão ou uma despesa da loja.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {dias.map(({ dia, itens }) => {
                const t = totais(itens);
                return (
                  <div key={dia}>
                    <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-2 bg-muted/30">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        {rotuloDia(dia)}
                      </span>
                      <span className="text-[11px] font-semibold tabular"
                            style={{ color: t.saldo >= 0 ? '#16a34a' : '#ef4444' }}>
                        {t.saldo >= 0 ? '+' : ''}{fmtCent(t.saldo)}
                      </span>
                    </div>
                    {itens.map((l, i) => (
                      <LinhaLancamento key={l.id} l={l} onClick={() => setModalLanc({ tipo: l.tipo, item: l })} delay={i * 25} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
      {modalLanc && empresa && (
        <ModalLancamento
          empresaId={empresa.id}
          cor={cor}
          tipoInicial={modalLanc.tipo}
          lancamento={modalLanc.item}
          onClose={() => setModalLanc(null)}
          onSalvo={() => { mLanc(); mContas(); }}
          onExcluido={() => { mLanc(); mContas(); }}
        />
      )}
      {modalContas && empresa && (
        <ModalContas
          empresaId={empresa.id}
          cor={cor}
          onClose={() => setModalContas(false)}
          onChanged={() => mContas()}
        />
      )}
      {modalCentros && empresa && (
        <ModalCentrosCusto
          empresaId={empresa.id}
          cor={cor}
          onClose={() => setModalCentros(false)}
          onChanged={() => mLanc()}
        />
      )}
    </>
  );
}

function VoltarNegocios() {
  return (
    <Link href="/negocios"
          className="inline-flex items-center gap-1.5 h-11 -ml-2 px-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
      <ArrowLeft size={16} /> Negócios
    </Link>
  );
}

function Total({ rotulo, valor, cor, Icon }: { rotulo: string; valor: number; cor: string; Icon: any }) {
  return (
    <div className="px-3 sm:px-5 py-4 text-center">
      <Icon size={14} style={{ color: cor }} className="mx-auto" />
      <p className="text-base sm:text-lg font-bold tabular mt-1.5 text-foreground truncate">{fmtCent(valor)}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{rotulo}</p>
    </div>
  );
}

function LinhaLancamento({ l, onClick, delay }: { l: Lancamento; onClick: () => void; delay: number }) {
  const entrada = l.tipo === 'entrada';
  const pendente = l.status === 'pendente';
  const cor = entrada ? '#16a34a' : '#ef4444';
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 min-h-[60px] hover:bg-muted/40 transition-colors text-left animate-fade-in"
      style={{ animationDelay: `${Math.min(delay, 300)}ms`, contentVisibility: 'auto', containIntrinsicSize: 'auto 60px' }}
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)` }}>
        {entrada ? <ArrowUpRight size={16} style={{ color: cor }} /> : <ArrowDownRight size={16} style={{ color: cor }} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground truncate">{l.descricao}</span>
        <span className="block text-[11px] text-muted-foreground truncate">
          {labelCategoria(l.tipo, l.categoria)}
          {l.forma_pagamento ? ` · ${labelForma(l.forma_pagamento)}` : ''}
          {l.contraparte ? ` · ${l.contraparte}` : ''}
        </span>
      </span>
      <span className="text-right flex-shrink-0">
        <span className="block text-sm font-bold tabular" style={{ color: pendente ? 'hsl(var(--muted-foreground))' : cor }}>
          {entrada ? '+' : '−'}{fmtCent(l.valor)}
        </span>
        {pendente && (
          // Status com ÍCONE + rótulo, nunca só cor (acessibilidade).
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-500 mt-0.5">
            <CalendarClock size={10} /> Em aberto
          </span>
        )}
      </span>
    </button>
  );
}
