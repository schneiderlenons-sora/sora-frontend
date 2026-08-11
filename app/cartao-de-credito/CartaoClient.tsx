'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import AdicionarCartaoModal, { bancoLogo, loadCartaoMeta, labelVencimento, CartaoMeta } from '@/components/cartoes/AdicionarCartaoModal';
import DetalhesCartaoModal from '@/components/cartoes/DetalhesCartaoModal';
import PagarFaturaModal from '@/components/cartoes/PagarFaturaModal';
import IconeMarca, { slugDaMarca, marcaDe } from '@/components/ui/IconeMarca';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import AvatarMembro from '@/components/ui/AvatarMembro';
import ExcluirContaModal from '@/components/contas/ExcluirContaModal';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { mutate as mutateGlobal } from 'swr';
import {
  competenciaAtual, competenciaVizinha, cicloPorCompetencia, pertenceAFatura, criterioDaFatura, labelCompetencia,
  type Ciclo,
} from '@/lib/ciclo-fatura';
import { offsetFaturaEmCurso } from '@/lib/fatura-em-curso';
import { somarFatura } from '@/lib/valor-fatura';
import {
  Plus, Sparkles, CreditCard, DollarSign, Eye, EyeOff, Pencil, Trash2,
  ChevronRight, ChevronLeft, BarChart3, Calendar, Loader2, ArrowRight,
} from 'lucide-react';
const BRAND = 'hsl(var(--primary))';
const MES_ABREV  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MES_NOMES  = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Wallet {
  id:     string;
  nome:   string;
  tipo:   string;
  saldo?: number;
  limite?: number;
  // Vínculo com a conta do Open Finance: quando existe, `saldo` é a dívida que
  // o BANCO informa — e não uma soma nossa.
  of_conta_id?: string | number | null;
  // Limite comprometido segundo o EMISSOR (migration 110). Inclui parcelas de
  // faturas futuras — por isso é maior que a fatura em aberto, e por isso vale
  // pra barra de limite mas NÃO pro valor da fatura.
  of_limite_usado?: number | null;
  // Metadados de cartão (migration 023) — fonte da verdade pro fechamento/vencimento
  dia_fechamento?: number | null;
  dia_vencimento?: number | null;
  bandeira?:       string | null;
  ultimos4?:       string | null;
  dono?: { id: string; name: string; phone?: string; avatar_url?: string | null; avatar_preset?: string | null; avatar_cor?: string | null } | null;
}

export default function CartaoClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const { phone: authPhone, perfil, limiteDe } = useAuth();
  const phone = authPhone || phoneInicial || ''; // SSR: phone do servidor até hidratar
  const limiteCartoes = limiteDe('cartoes');
  // Em grupo compartilhado (não-Pessoal), mostra de quem é cada cartão.
  const compartilhado = !/pessoal/i.test((perfil?.grupo_ativo as any)?.nome || '');

  const [txsHistorico,   setTxsHistorico]   = useState<Record<string, any[]>>({});
  const [ocultar,        setOcultar]        = useState(false);
  const [addOpen,        setAddOpen]        = useState(false);
  const [edicao,         setEdicao]         = useState<Wallet | null>(null);
  const [detalhes,       setDetalhes]       = useState<Wallet | null>(null);
  // Navega FATURAS (ciclos), não meses: 0 = a atual (próxima a vencer), -1 = a anterior.
  const [mesIndex,       setMesIndex]       = useState(0);
  const [confirmDel,     setConfirmDel]     = useState<Wallet | null>(null);
  const hoje = new Date();

  // Referência de mês só pro rótulo de fallback (vários cartões com ciclos
  // diferentes) e pro eixo do gráfico.
  const refDate = useMemo(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + mesIndex, 1);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesIndex]);

  const mesFallbackLabel = `${MES_NOMES[refDate.getMonth()].charAt(0).toUpperCase() + MES_NOMES[refDate.getMonth()].slice(1)} de ${refDate.getFullYear()}`;

  // Dados via SWR — revisita instantânea (cache em memória).
  // Uma lista só de transações (as 1000 mais recentes): o ciclo da fatura cruza
  // meses, então filtrar por mês não serve. Antes havia um fetch extra só do mês
  // corrente — virou desnecessário quando a fatura passou a ser por ciclo.
  const { data: wRaw,     mutate: mW }  = useApi(phone ? `cart:wallets:${phone}` : null, () => api.wallets.listar(phone), { fallbackData: initialData?.wallets });
  const { data: tAllData, mutate: mTA } = useApi(phone ? `cart:txall:${phone}` : null, () => api.transacoes.listar(phone, { limit: 1000 }), { fallbackData: initialData?.txAll });

  const wallets: Wallet[] = ((wRaw as Wallet[]) ?? []).filter((w: any) => w.tipo === 'Crédito');
  const txsTodas: any[]   = (tAllData as any)?.transacoes ?? [];
  const loading = wRaw === undefined;
  const carregar = useCallback(() => Promise.all([mW(), mTA()]), [mW, mTA]);

  // Carrega os últimos meses pro gráfico de histórico. 7 (não 6) porque o ciclo
  // da fatura mais antiga começa no mês anterior a ela.
  useEffect(() => {
    if (!phone) return;
    (async () => {
      const novosHistoricos: Record<string, any[]> = {};
      for (let i = 0; i < 7; i++) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + mesIndex - i, 1);
        const ref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (txsHistorico[ref]) {
          novosHistoricos[ref] = txsHistorico[ref];
          continue;
        }
        try {
          const r = await api.transacoes.listar(phone, { mes: ref, limit: 500 });
          novosHistoricos[ref] = r.transacoes || [];
        } catch {
          novosHistoricos[ref] = [];
        }
      }
      setTxsHistorico(novosHistoricos);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, mesIndex]);

  // As transações guardam `carteira_nome` (string), não wallet_id — o
  // backend nem persiste wallet_id. Match precisa ser por nome.
  const mesmaCarteira = (t: any, w: any) =>
    t.wallet_id === w.id ||
    (t.carteira_nome || '').trim().toLowerCase() === (w.nome || '').trim().toLowerCase();

  // Ciclo da fatura exibida, por cartão. `mesIndex` navega FATURAS (não meses):
  // 0 = a EM CURSO, -1 = a anterior. Cada cartão tem o seu ciclo (dependem de
  // dia_fechamento), então a competência varia de cartão pra cartão.
  //
  // ⚠️ `offsetFaturaEmCurso` desloca o zero: no cartão de Open Finance, depois
  // do fechamento a "próxima a vencer" já não é a fatura aberta no banco — e o
  // valor que o card mostra vem do banco. Sem o deslocamento, o card exibia o
  // total da fatura nova com o período e o vencimento da velha.
  const cicloPorCartao = useMemo(() => {
    const acc: Record<string, ReturnType<typeof cicloPorCompetencia>> = {};
    wallets.forEach(w => {
      const atual = competenciaAtual(w);
      const passo = mesIndex + offsetFaturaEmCurso(w);
      const comp = passo === 0 ? atual : competenciaVizinha(w, atual, passo);
      acc[w.id] = cicloPorCompetencia(w, comp);
    });
    return acc;
  }, [wallets, mesIndex]);

  // Rótulo da fatura exibida ("Agosto de 2026") + o período do ciclo embaixo.
  // Com 1 cartão usa a competência dele; com vários (ciclos diferentes) cai no
  // mês-calendário como referência e omite o período pra não confundir.
  const umCartao = wallets.length === 1 ? wallets[0] : null;
  const refMesLabel = umCartao
    ? labelCompetencia(cicloPorCartao[umCartao.id]?.competencia || '')
    : mesFallbackLabel;
  const cicloLabel = umCartao && cicloPorCartao[umCartao.id]?.porCiclo
    ? cicloPorCartao[umCartao.id].label
    : null;

  // Fatura por cartão, somada pelo CICLO REAL (não pelo mês-calendário) — é o
  // que agrupa uma compra de 30/07 e outra de 01/08 na MESMA fatura.
  // Cartão do Open Finance na fatura atual usa o valor que o sync calculou
  // (saldo = −fatura, já sem as parcelas a vencer). Usa `txsTodas` porque o
  // ciclo cruza meses — `txsMes` (só o mês corrente) cortaria as compras.
  const faturaPorCartao = useMemo(() => {
    const acc: Record<string, number> = {};
    wallets.forEach(w => {
      // ⚠️ `saldo` zerado NÃO é "fatura zero": enquanto o ciclo não fecha, o banco
      // costuma não publicar o total (o Mercado Pago manda 0/null o mês inteiro).
      // Aí a fatura sai das transações importadas, pelo ciclo — senão o painel
      // mostrava "R$ 0,00" com 26 compras na lista logo abaixo.
      const doBanco = mesIndex === 0 && w.of_conta_id && typeof w.saldo === 'number' && w.saldo < 0;
      if (doBanco) { acc[w.id] = -(w.saldo as number); return; }
      const ciclo = cicloPorCartao[w.id];
      const minhas = txsTodas.filter(t => mesmaCarteira(t, w));
      // Critério decidido UMA vez por fatura. Decidir por transação misturava a
      // fatura vinculada com o ciclo novo e somava as duas.
      const criterio = criterioDaFatura(minhas, w, mesIndex === 0, ciclo);
      // Soma ASSINADA (lib/valor-fatura.ts): compra soma, estorno/crédito
      // ABATE, pagamento de fatura é neutro. Antes filtrava só `tipo==='Gasto'`
      // e o crédito era descartado — a fatura ficava maior que a do banco.
      acc[w.id] = somarFatura(
        minhas.filter(t => pertenceAFatura(t, w, ciclo, mesIndex === 0, criterio)));
    });
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets, txsTodas, cicloPorCartao, mesIndex]);

  // Restante pós-pagamento por cartão (reportado por cada CardCartao — é ele
  // quem sabe o status real via /fatura/status, migration 096). O header
  // "Fatura atual" soma isso, não o bruto do mês — senão continuava mostrando
  // o total cheio mesmo depois do usuário pagar uma fatura.
  const [restantePorCartao, setRestantePorCartao] = useState<Record<string, number>>({});
  const onRestanteChange = useCallback((id: string, valor: number) => {
    setRestantePorCartao(prev => (prev[id] === valor ? prev : { ...prev, [id]: valor }));
  }, []);

  // O restante só vale pra fatura ATUAL (é o que os cards reportam); navegando
  // pra uma fatura anterior, o header volta a somar o bruto daquele ciclo.
  const faturaTotal = useMemo(
    () => wallets.reduce((s, w) => {
      const bruto = faturaPorCartao[w.id] || 0;
      const usaRestante = mesIndex === 0 && restantePorCartao[w.id] !== undefined;
      return s + (usaRestante ? restantePorCartao[w.id] : bruto);
    }, 0),
    [wallets, restantePorCartao, faturaPorCartao, mesIndex]
  );

  // Limite COMPROMETIDO por cartão = fatura atual + parcelas futuras.
  // No cartão, a transação fica pago=true ao ser lançada, mas conceitualmente
  // ocupa o limite até a fatura ser paga — então contamos tudo do início do
  // ciclo atual em diante (compras do ciclo + parcelas dos próximos meses).
  const comprometidoPorCartao = useMemo(() => {
    const acc: Record<string, number> = {};
    wallets.forEach(w => {
      const inicio = cicloPorCompetencia(w, competenciaAtual(w)).ini;
      // Também assinada: estorno DEVOLVE limite. Era a queixa do cliente —
      // pedia reembolso, o banco liberava o limite e a Sora não mexia em nada.
      acc[w.id] = somarFatura(txsTodas
        .filter(t => mesmaCarteira(t, w) && (t.data || '').slice(0, 10) >= inicio));
    });
    return acc;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets, txsTodas]);

  // Dados do gráfico (6 FATURAS, mais recente à direita). Como o ciclo cruza
  // meses, junta as transações de todos os meses baixados num pote só e soma
  // por ciclo de cada cartão. Panorama de tendência — não é número contábil.
  const dadosHistorico = useMemo(() => {
    const pote = Object.values(txsHistorico).flat() as any[];
    return Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;                       // 5 = mais antiga … 0 = a exibida
      const passo = mesIndex - i;
      let total = 0;
      let rotulo = '';
      for (const w of wallets) {
        const comp = passo === 0 ? competenciaAtual(w) : competenciaVizinha(w, competenciaAtual(w), passo);
        const ciclo = cicloPorCompetencia(w, comp);
        if (!rotulo) rotulo = MES_ABREV[parseInt(comp.slice(5, 7), 10) - 1];
        total += somarFatura(pote
          .filter((t) => mesmaCarteira(t, w) && pertenceAFatura(t, w, ciclo, passo === 0)));
      }
      // Sem cartão nenhum: mantém o eixo com o rótulo do mês.
      if (!rotulo) {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() + passo, 1);
        rotulo = MES_ABREV[d.getMonth()];
      }
      return { mes: rotulo, ref: String(passo), total, atual: i === 0 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txsHistorico, wallets, mesIndex]);

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / .12) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <Sparkles size={12} style={{ color: BRAND }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
                  {wallets.length} {wallets.length === 1 ? 'cartão' : 'cartões'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Cartões de crédito
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Gerencie seus cartões e acompanhe as faturas mensais.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setOcultar(v => !v)}
                className="btn-ghost px-3 py-2 text-sm gap-2"
                title={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
              >
                {ocultar ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>

              <button
                onClick={() => {
                  if (wallets.length >= limiteCartoes) {
                    alert(`Plano atual permite ${limiteCartoes} cartões. Faça upgrade para Premium para ter cartões ilimitados.`);
                    return;
                  }
                  setEdicao(null); setAddOpen(true);
                }}
                className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm"
              >
                <Plus size={16} /> Adicionar cartão
              </button>
            </div>
          </div>
          {wallets.length >= limiteCartoes && Number.isFinite(limiteCartoes) && (
            <p className="relative mt-3 text-xs text-amber-600 dark:text-amber-400">
              Você atingiu o limite de {limiteCartoes} cartões do plano atual. <a href="/configuracoes#plano" className="underline font-semibold">Upgrade para Premium</a> para cartões ilimitados.
            </p>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            FATURA ATUAL TOTAL — branco no light, preto no dark
        ═══════════════════════════════════════════════════════ */}
        <div
          className="fatura-hero relative overflow-hidden rounded-3xl p-8 sm:p-10 animate-fade-in"
          style={{ animationDelay: '60ms' }}
        >
          {/* Halo verde único, contido no canto superior-esquerdo */}
          <div
            className="absolute -top-24 -left-24 w-72 h-72 rounded-full pointer-events-none opacity-25 dark:opacity-20"
            style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }}
          />

          <div className="relative text-center space-y-2">
            <div className="inline-flex items-center justify-center gap-1.5 text-muted-foreground text-[11px] uppercase tracking-widest font-semibold">
              <DollarSign size={12} />
              Fatura atual
            </div>
            <p className="text-4xl sm:text-6xl font-bold text-foreground tabular tracking-tight leading-none">
              {ocultar ? '••••••••' : fmt(faturaTotal)}
            </p>
            {wallets.length > 0 && (
              <p className="text-muted-foreground text-xs">
                Soma de {wallets.length} {wallets.length === 1 ? 'cartão' : 'cartões'}
              </p>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SEUS CARTÕES
        ═══════════════════════════════════════════════════════ */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
              <CreditCard size={16} className="text-foreground" />
            </div>
            <h2 className="text-base font-bold text-foreground">
              Seus cartões{' '}
              <span className="text-muted-foreground font-normal">({wallets.length})</span>
            </h2>
          </div>

          {loading && wallets.length === 0 ? (
            <div className="card rounded-3xl p-10 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : wallets.length === 0 ? (
            <div className="card rounded-3xl p-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <CreditCard size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhum cartão cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                Adicione seu primeiro cartão para acompanhar a fatura mensal e os gastos por categoria.
              </p>
              <button
                onClick={() => { setEdicao(null); setAddOpen(true); }}
                className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5"
              >
                <Plus size={14} /> Adicionar cartão
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {wallets.map((w, i) => (
                <CardCartao
                  key={w.id}
                  cartao={w}
                  fatura={faturaPorCartao[w.id] || 0}
                  comprometido={comprometidoPorCartao[w.id] || 0}
                  ocultar={ocultar}
                  competencia={cicloPorCartao[w.id]?.competencia || ''}
                  ciclo={cicloPorCartao[w.id]}
                  ehMesAtual={mesIndex === 0}
                  compartilhado={compartilhado}
                  delay={i * 50}
                  onEditar={() => { setEdicao(w); setAddOpen(true); }}
                  onExcluir={() => setConfirmDel(w)}
                  onAbrir={() => setDetalhes(w)}
                  onRestanteChange={onRestanteChange}
                  onRefresh={carregar}
                />
              ))}
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            FATURAS ANTERIORES — gráfico de barras
        ═══════════════════════════════════════════════════════ */}
        {wallets.length > 0 && (
          <div className="card rounded-3xl p-5 sm:p-6 animate-fade-in" style={{ animationDelay: '180ms' }}>
            <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                  <BarChart3 size={16} className="text-foreground" />
                </div>
                <h2 className="text-base font-bold text-foreground">Faturas</h2>
              </div>

              {/* Navegação de FATURA (por ciclo, não por mês-calendário) */}
              <div className="flex items-center bg-muted/40 rounded-xl p-1">
                <button
                  onClick={() => setMesIndex(i => i - 1)}
                  className="p-1.5 rounded-lg hover:bg-card transition-colors"
                  title="Fatura anterior"
                  aria-label="Fatura anterior"
                >
                  <ChevronLeft size={14} className="text-muted-foreground" />
                </button>
                <div className="px-3 py-1 min-w-[150px] text-center">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Calendar size={12} className="text-muted-foreground" />
                    {refMesLabel}
                  </span>
                  {/* Período do ciclo — deixa claro POR QUE o valor é esse */}
                  {cicloLabel && (
                    <span className="block text-[10px] text-muted-foreground tabular leading-tight mt-0.5">
                      {cicloLabel}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setMesIndex(i => Math.min(12, i + 1))}
                  disabled={mesIndex >= 12}
                  className="p-1.5 rounded-lg hover:bg-card transition-colors disabled:opacity-40"
                  title="Próxima fatura"
                  aria-label="Próxima fatura"
                >
                  <ChevronRight size={14} className="text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Gráfico de barras em CSS puro — sem Recharts (que disparava
                React #284 neste layout). Robusto e sempre renderiza. */}
            {(() => {
              const maxTotal = Math.max(...dadosHistorico.map(d => d.total), 1);
              return (
                <div className="flex items-end justify-between gap-2 sm:gap-3" style={{ height: 200 }}>
                  {dadosHistorico.map((d, i) => {
                    const h = Math.max((d.total / maxTotal) * 160, d.total > 0 ? 6 : 2);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group">
                        <span className={`text-[10px] tabular font-semibold transition-opacity ${d.total > 0 ? 'text-foreground opacity-0 group-hover:opacity-100' : 'opacity-0'}`}>
                          {fmt(d.total)}
                        </span>
                        <div
                          className="w-full rounded-t-lg transition-all duration-500"
                          style={{
                            height: h,
                            background: d.atual ? BRAND : 'hsl(var(--bg-muted))',
                            minHeight: 2,
                          }}
                          title={`${d.mes}: ${fmt(d.total)}`}
                        />
                        <span className={`text-[11px] font-medium ${d.atual ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {d.mes}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAIS
      ═══════════════════════════════════════════════════════ */}
      {addOpen && phone && (
        <AdicionarCartaoModal
          phone={phone}
          cartaoExistente={edicao}
          onClose={() => { setAddOpen(false); setEdicao(null); }}
          onSuccess={carregar}
        />
      )}

      {detalhes && phone && (
        <DetalhesCartaoModal
          phone={phone}
          cartao={detalhes}
          onClose={() => setDetalhes(null)}
          onRefresh={carregar}
          onExcluir={() => { setConfirmDel(detalhes); setDetalhes(null); }}
        />
      )}

      {confirmDel && (
        <ExcluirContaModal
          conta={confirmDel}
          contas={(wRaw as Wallet[]) ?? []}
          onClose={() => setConfirmDel(null)}
          onExcluida={() => {
            if (typeof window !== 'undefined') localStorage.removeItem(`sora-cartao-${confirmDel.id}`);
            carregar();
          }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE DO CARTÃO INDIVIDUAL
// ─────────────────────────────────────────────────────────────
interface CardCartaoProps {
  cartao:    Wallet;
  fatura:    number;
  comprometido: number;
  ocultar:   boolean;
  delay:     number;
  competencia: string;   // 'YYYY-MM' do VENCIMENTO da fatura exibida
  /** Ciclo real da fatura exibida (período + vencimento). */
  ciclo?: Ciclo;
  ehMesAtual: boolean;
  compartilhado?: boolean;
  onEditar:  () => void;
  onExcluir: () => void;
  onAbrir:   () => void;
  onRefresh: () => void;
  /** Reporta o RESTANTE (pós-pagamento) pro pai somar no header "Fatura atual"
   *  — sem isso o header ficava com a soma bruta do mês, sem descontar pagamento. */
  onRestanteChange?: (cartaoId: string, restante: number) => void;
}

function CardCartao({ cartao, fatura, comprometido, ocultar, delay, competencia, ciclo, ehMesAtual, compartilhado, onEditar, onExcluir, onAbrir, onRefresh, onRestanteChange }: CardCartaoProps) {
  const { phone } = useAuth();
  const [meta, setMeta] = useState<CartaoMeta>({});
  const [pagarOpen, setPagarOpen] = useState(false);
  // Cartão MANUAL: rastreia pago/restante/rollover (migration 096). OF fica de fora.
  const ehManual = !cartao.of_conta_id;
  const [status, setStatus] = useState<{ fatura: number; pago: number; restante: number; rollover?: any } | null>(null);
  const [rolando, setRolando] = useState(false);

  useEffect(() => {
    setMeta(loadCartaoMeta(cartao.id));
  }, [cartao.id]);

  // Busca status da fatura (pago/restante/rollover) — só cartão manual.
  const recarregarStatus = useCallback(() => {
    if (!phone || !ehManual) { setStatus(null); return; }
    api.wallets.faturaStatus(phone, cartao.id, competencia)
      .then(setStatus).catch(() => setStatus(null));
  }, [phone, cartao.id, competencia, ehManual]);
  useEffect(() => { recarregarStatus(); }, [recarregarStatus, fatura]);

  async function rolarAgora() {
    if (!status?.rollover?.id) return;
    setRolando(true);
    try { await api.wallets.rolarFatura({ rollover_id: status.rollover.id }); onRefresh(); }
    catch { /* noop */ }
    finally { setRolando(false); }
  }

  // Fonte da verdade = banco (wallets.dia_fechamento/vencimento, migration 023);
  // localStorage só como fallback. Antes lia só o `meta` em state, que não
  // recarregava após editar (deps [cartao.id] não mudam) → datas "não salvavam".
  const diaFechamento = cartao.dia_fechamento ?? meta.diaFechamento ?? null;
  const diaVencimento = cartao.dia_vencimento ?? meta.diaVencimento ?? null;

  const logo = bancoLogo(cartao.nome);
  const limite = cartao.limite || 0;
  // "Usado" do limite: no Open Finance quem sabe é o BANCO — ele informa o
  // limite comprometido, que inclui parcelas de faturas futuras. Nossa soma de
  // transações não vê essas parcelas (a Celcoin manda cada uma com a data da
  // COMPRA), então calcular aqui dava um número menor que a própria fatura —
  // era o "Usado R$ 1.870,24" embaixo de uma fatura maior.
  // Cartão manual segue no comprometido (fatura + parcelas futuras lançadas).
  const usadoBanco = typeof cartao.of_limite_usado === 'number' ? cartao.of_limite_usado : null;
  const usado = usadoBanco ?? (comprometido || fatura);
  const disponivel = Math.max(limite - usado, 0);
  const pctUsado = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0;

  const hoje = new Date();
  const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

  // Flag de pagamento. Cartão MANUAL usa o restante real (fatura − pago) do
  // status (migration 096); OF (e enquanto o status não carrega) usa o
  // localStorage legado.
  const [pagaLS, setPagaLS] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPagaLS(localStorage.getItem(`sora-fatura-${cartao.id}-${mesRef}`) === 'paga');
  }, [cartao.id, mesRef]);
  const restante = ehManual && status ? status.restante : fatura;
  const jaPago   = ehManual && status ? status.pago : 0;
  const paga     = ehManual && status ? status.restante <= 0.01 : pagaLS;

  // Reporta o restante pro pai (soma do header "Fatura atual"). Só quando é o
  // mês ATUAL — meses passados não entram na fatura "atual" do topo.
  useEffect(() => {
    if (ehMesAtual) onRestanteChange?.(cartao.id, restante);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartao.id, restante, ehMesAtual]);

  // Vencimento da fatura EXIBIDA (`ciclo.venc`), não "o próximo dia N no
  // calendário": as duas se separam depois do fechamento, e o card acabava
  // dizendo "vence 13 de ago" embaixo do valor da fatura de setembro.
  const vencimentoLabel = ciclo?.venc
    ? `${ciclo.venc.slice(8, 10)} de ${MES_ABREV[Number(ciclo.venc.slice(5, 7)) - 1].toLowerCase()}`
    : labelVencimento(diaVencimento);

  return (
    <>
    <div
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } }}
      className="card-hover rounded-2xl p-5 animate-fade-in group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Halo decorativo (canto direito) */}
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-15 pointer-events-none transition-opacity group-hover:opacity-25"
        style={{ background: `radial-gradient(circle, ${logo.bg} 0%, transparent 70%)` }}
      />

      {/* Header: logo + nome + badge */}
      <div className="flex items-start justify-between gap-3 mb-3 relative">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mesmo ícone das contas bancárias — marca conhecida usa CategoriaIcon
              (PNG circular full-bleed). Sem marca → fallback com cor + inicial. */}
          {marcaDe(cartao.nome) ? (
            <CategoriaIcon nome={cartao.nome} size={48} rounded="rounded-xl" />
          ) : (
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0"
              style={{ background: logo.bg }}
            >
              {logo.text}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{cartao.nome}</p>
            <p className="text-[11px] text-muted-foreground tabular tracking-widest">
              •••• {meta.ultimos4 || '••••'}
            </p>
            {compartilhado && cartao.dono && (
              <div className="flex items-center gap-1.5 mt-1">
                <AvatarMembro
                  name={cartao.dono.name}
                  src={cartao.dono.avatar_url}
                  preset={cartao.dono.avatar_preset}
                  cor={cartao.dono.avatar_cor}
                  size="sm"
                />
                <span className="text-[11px] text-muted-foreground">de <strong className="text-foreground font-semibold">{cartao.dono.name?.split(' ')[0]}</strong></span>
              </div>
            )}
          </div>
        </div>

        <span
          className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 flex-shrink-0 ${
            paga
              ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
          }`}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: paga ? '#16a34a' : '#d97706' }} />
          {paga ? 'Paga' : 'Em aberto'}
        </span>
      </div>

      {/* Fatura atual — mostra o VALOR QUE FALTA (já diminui com pagamentos). */}
      <div className="relative">
        <p className="text-xs text-muted-foreground">
          {ehMesAtual ? 'Fatura atual' : `Fatura de ${labelCompetencia(competencia)}`}
        </p>
        <p className="text-2xl font-bold text-foreground tabular tracking-tight mt-0.5">
          {ocultar ? '••••••' : fmt(restante)}
        </p>

        {/* Período do ciclo — explica de onde vem o valor (compras de X a Y),
            que é o ponto todo da migração pro ciclo real de fechamento. */}
        {ciclo?.porCiclo && (
          <p className="text-[11px] text-muted-foreground tabular mt-0.5">
            Compras de {ciclo.label}
          </p>
        )}

        {/* Nota discreta do que já foi pago nessa fatura. */}
        {ehManual && jaPago > 0 && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {fmt(jaPago)} já pago nesta fatura
          </p>
        )}

        {/* ⚠️ Fatura em ABERTO no Open Finance é aproximada: o banco só publica
            o total quando ela fecha, e as parcelas que entram nela chegam com a
            data da COMPRA — a soma daqui não as vê. Quando o limite usado que o
            banco informa é maior que a soma, é exatamente essa diferença. Dizer
            isso é melhor que exibir um número redondo que não bate com o app. */}
        {!ehManual && ehMesAtual && usadoBanco != null && usadoBanco > restante + 0.01 && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
            Parcial: soma as compras deste ciclo. O banco informa{' '}
            <span className="font-semibold text-foreground tabular">{fmt(usadoBanco)}</span> de limite
            usado — a diferença são parcelas que ele ainda não lançou nesta fatura.
          </p>
        )}

        {/* Banner de rollover aguardando confirmação */}
        {ehManual && status?.rollover && (
          <div onClick={(e) => e.stopPropagation()}
               className="relative z-10 mt-2 rounded-xl border border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 p-2.5">
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
              Sobrou <strong>{fmt(Number(status.rollover.valor) || 0)}</strong> da fatura anterior. Rolar pra próxima?
            </p>
            <button onClick={rolarAgora} disabled={rolando}
              className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 transition-colors disabled:opacity-60">
              {rolando ? <Loader2 size={11} className="animate-spin" /> : <ArrowRight size={11} />} Rolar pra próxima fatura
            </button>
          </div>
        )}

        {restante > 0 && !paga && (
          <button onClick={(e) => { e.stopPropagation(); setPagarOpen(true); }}
            className="relative z-10 mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary hover:text-white transition-colors">
            <CreditCard size={11} /> Pagar fatura
          </button>
        )}

        {/* Alerta de fechamento não configurado */}
        {!diaFechamento ? (
          <>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 leading-snug">
              Configure a data de fechamento do cartão para poder ver faturas mais recentes
            </p>
            <button
              onClick={(e) => { e.stopPropagation(); onEditar(); }}
              className="relative z-10 mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 hover:underline"
            >
              <Calendar size={11} /> Definir fechamento
            </button>
          </>
        ) : (
          vencimentoLabel && (
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Vence <span className="font-semibold text-foreground">{vencimentoLabel}</span>
            </p>
          )
        )}
      </div>

      {/* Barra de limite */}
      {limite > 0 && (
        <div className="mt-4 pt-4 border-t border-border/60 relative">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
              <CreditCard size={11} />
              Limite total
            </span>
            <span className="text-[11px] font-semibold text-foreground tabular">
              {ocultar ? '•••' : fmt(limite)}
            </span>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${pctUsado}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #6366f1 100%)',
              }}
            />
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${100 - pctUsado}%`,
                background: BRAND,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-1.5 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Usado</span>
              <span className="font-semibold text-foreground tabular ml-0.5">
                {ocultar ? '•••' : fmt(usado)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: BRAND }} />
              <span className="text-muted-foreground">Disponível</span>
              <span className="font-semibold text-foreground tabular ml-0.5">
                {ocultar ? '•••' : fmt(disponivel)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ações (aparecem no hover) — z-10 para ficar acima do click do card */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onEditar(); }}
          className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm border border-border hover:bg-muted transition-colors shadow-sm"
          title="Editar"
        >
          <Pencil size={13} className="text-muted-foreground" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onExcluir(); }}
          className="p-1.5 rounded-lg bg-card/80 backdrop-blur-sm border border-border hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shadow-sm"
          title="Excluir"
        >
          <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
        </button>
      </div>
    </div>
    {pagarOpen && (
      <PagarFaturaModal
        cartaoId={cartao.id}
        cartaoNome={cartao.nome}
        valorFatura={fatura}
        competencia={competencia}
        onClose={() => setPagarOpen(false)}
        onPago={() => {
          // Manual: recarrega o restante real (pagamento pode ter sido parcial).
          // OF/legado: mantém a flag localStorage.
          if (ehManual) { recarregarStatus(); }
          else { try { localStorage.setItem(`sora-fatura-${cartao.id}-${mesRef}`, 'paga'); } catch {} setPagaLS(true); }
          onRefresh();
          // Revalida TUDO (SWR global): saldo das contas, transações e dashboard
          // são caches separados — sem isso o débito e a transação não aparecem.
          mutateGlobal(() => true);
        }}
      />
    )}
    </>
  );
}
