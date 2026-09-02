'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useTheme } from 'next-themes';
import NovoInvestimentoModal from '@/components/investimentos/NovoInvestimentoModal';
import MovimentoModal from '@/components/investimentos/MovimentoModal';
import { fmtDataBR } from '@/lib/data-br';
import {
  Plus, RefreshCw, BarChart3, Briefcase, Shield, Calculator, Coins,
  Trash2, ArrowUpRight, ArrowDownRight, Search, Loader2, Crown, TrendingUp,
  PiggyBank, Landmark, ChevronRight, ChevronDown, CalendarClock, Percent,
  Archive, Layers,
} from 'lucide-react';
// recharts sob demanda: os 3 gráficos vivem em ./Graficos e saem do bundle
// inicial. Skeleton com a mesma altura do container (evita CLS).
const skel = () => <div className="w-full h-full rounded-xl bg-muted/40 animate-pulse" role="status" aria-label="Carregando gráfico" />;
const GraficoPatrimonio   = dynamic(() => import('./Graficos').then(m => m.GraficoPatrimonio),   { ssr: false, loading: skel });
// O MESMO donut da aba Categorias — fatia que destaca ao toque, leitura no
// centro, `prefers-reduced-motion` respeitado. Um conserto lá vale aqui.
const DonutClasses        = dynamic(() => import('@/components/relatorios/CategoryDonut'),        { ssr: false, loading: skel });
const GraficoSimulacao    = dynamic(() => import('./Graficos').then(m => m.GraficoSimulacao),    { ssr: false, loading: skel });

const BRAND = 'hsl(var(--primary))';

const CORES_TIPO: Record<string, string> = {
  'Ações':           '#3b82f6',
  'FIIs':            '#8b5cf6',
  'ETFs':            '#06b6d4',
  'Cripto':          '#f59e0b',
  'Tesouro Direto':  '#22c55e',
  'CDB':             '#ec4899',
  // ⚠️ Tipo NOVO precisa de cor aqui também (migration 137). Sem isso ele cai
  // no cinza do fallback — foi o que deixou o donut de um RDB de R$ 2.642,80
  // com cara de "categoria desconhecida".
  'RDB':             '#f472b6',
  'LCI':             '#d946ef',
  'LCA':             '#84cc16',
  'LC':              '#c026d3',
  'Poupança':        '#34d399',
  'Debênture':       '#0284c7',
  'CRI':             '#0891b2',
  'CRA':             '#65a30d',
  'COE':             '#7c3aed',
  // Vindos do Open Finance (Celcoin): debêntures/CRI/CRA e fundos de investimento.
  'Renda Fixa':      '#0ea5e9',
  'Fundos':          '#6366f1',
  'Previdência':     '#14b8a6',
  'Reserva':         '#10b981',
  'Imóveis':         '#f97316',
  'Negócio':         '#a855f7',
  'Caixa':           '#64748b',
};
function corTipo(t: string): string { return CORES_TIPO[t] || '#64748b'; }

// Emoji por tipo — o donut compartilhado mostra um no centro quando a fatia é
// selecionada, e sem isso toda classe apareceria com o mesmo símbolo genérico.
const EMOJI_TIPO: Record<string, string> = {
  'Ações': '📈', 'FIIs': '🏢', 'ETFs': '🌐', 'Cripto': '₿',
  'Tesouro Direto': '💵', 'CDB': '🏦', 'RDB': '🐷', 'LCI': '🏘️', 'LCA': '🌾',
  'LC': '🧾', 'Poupança': '🐖', 'Debênture': '📜', 'CRI': '🏗️', 'CRA': '🚜',
  'COE': '🎛️', 'Renda Fixa': '📄', 'Fundos': '🧺', 'Previdência': '🏖️',
  'Reserva': '🛡️', 'Imóveis': '🏠', 'Negócio': '🏪', 'Caixa': '💰',
};

/* ═════════════════════════════════════════════════════════════════════════
   CLASSES DE ATIVO

   O `tipo` é granular demais pra organizar a carteira e granular de menos pra
   descrever a posição. A CLASSE agrupa por aquilo que muda a LEITURA da linha:
   renda fixa se lê por indexador e vencimento, renda variável por quantidade e
   cotação. Misturar as duas numa tabela só foi o que produziu a tela onde um
   RDB aparecia como "190.000 unidades a R$ 0,01".
   ═════════════════════════════════════════════════════════════════════════ */
type Classe = 'fixa' | 'variavel' | 'fundos' | 'caixa';
const CLASSES: { k: Classe; label: string; desc: string; cor: string; Icone: any }[] = [
  { k: 'fixa',     label: 'Renda fixa',     desc: 'Rende por prazo e indexador', cor: '#ec4899', Icone: Landmark },
  { k: 'variavel', label: 'Renda variável', desc: 'Oscila com o mercado',        cor: '#3b82f6', Icone: TrendingUp },
  { k: 'fundos',   label: 'Fundos',         desc: 'Cotas de fundos',             cor: '#6366f1', Icone: Layers },
  { k: 'caixa',    label: 'Caixa e reserva', desc: 'Liquidez imediata',          cor: '#10b981', Icone: PiggyBank },
];
const CLASSE_DE: Record<string, Classe> = {
  'Ações': 'variavel', 'FIIs': 'variavel', 'ETFs': 'variavel', 'Cripto': 'variavel',
  'Tesouro Direto': 'fixa', 'CDB': 'fixa', 'RDB': 'fixa', 'LCI': 'fixa', 'LCA': 'fixa',
  'LC': 'fixa', 'Debênture': 'fixa', 'CRI': 'fixa', 'CRA': 'fixa', 'Renda Fixa': 'fixa',
  'Poupança': 'caixa', 'Fundos': 'fundos', 'Previdência': 'fundos',
  'Reserva': 'caixa', 'Caixa': 'caixa',
  'Imóveis': 'variavel', 'Negócio': 'variavel',
};
const classeDe = (tipo: string): Classe => CLASSE_DE[tipo] || 'fixa';
const infoClasse = (k: Classe) => CLASSES.find(c => c.k === k)!;

/** "100% do CDI", "IPCA + 5,5%" — o que de fato descreve um papel de renda fixa. */
function textoIndexador(i: any): string | null {
  const idx = i.indexador;
  const pct = i.percentual_indexador;
  const taxa = i.taxa_anual;
  if (idx && pct) return `${Number(pct).toLocaleString('pt-BR')}% do ${idx}`;
  if (idx && taxa) return `${idx} + ${Number(taxa).toLocaleString('pt-BR')}%`;
  if (idx) return String(idx);
  if (taxa) return `${Number(taxa).toLocaleString('pt-BR')}% a.a.`;
  return null;
}

/** Vencimento com a distância em linguagem de gente. */
function textoVencimento(iso?: string | null): { txt: string; perto: boolean } | null {
  if (!iso) return null;
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  const data = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  if (dias < 0)   return { txt: `venceu em ${data}`, perto: true };
  if (dias === 0) return { txt: 'vence hoje', perto: true };
  if (dias <= 30) return { txt: `vence em ${dias} dia${dias > 1 ? 's' : ''}`, perto: true };
  if (dias <= 365) return { txt: `vence em ${data}`, perto: false };
  return { txt: `vence em ${data} · ${Math.floor(dias / 365)} ano${dias >= 730 ? 's' : ''}`, perto: false };
}

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v || 0).toFixed(2)}%`;

type Tab = 'resumo' | 'carteira' | 'caixinhas' | 'reserva' | 'simulador' | 'aportes';

export default function InvestimentosClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const { phone: authPhone, podeUsar } = useAuth();
  const phone = authPhone || phoneInicial || ''; // SSR: phone do servidor até hidratar
  const temAcesso = podeUsar('investimentos');

  const [tab, setTab] = useState<Tab>('resumo');
  const [atualizando,  setAtualizando]  = useState(false);
  const [novoOpen,     setNovoOpen]     = useState(false);
  // Aporte/resgate — o mesmo modal, dois sentidos.
  const [movimento,    setMovimento]    = useState<{ tipo: 'aporte' | 'resgate'; invId?: string } | null>(null);
  const [feedback,     setFeedback]     = useState('');

  // Dados via SWR — revisita instantânea (só busca com acesso ao recurso).
  const ativo = phone && temAcesso;
  const { data: invsData,    mutate: mInvs } = useApi(ativo ? `inv:lista:${phone}` : null,      () => api.investimentos.listar(phone), { fallbackData: initialData?.invs });
  const { data: aportesData, mutate: mAp }   = useApi(ativo ? `inv:aportes:${phone}` : null,    () => api.investimentos.aportes.listar(phone), { fallbackData: initialData?.aportes });
  // Movimentações que o BANCO reporta (migration 139): aportes, resgates,
  // dividendos, JCP, come-cotas. Convivem com os aportes lançados à mão.
  const { data: movData } = useApi(ativo ? `inv:movimentos:${phone}` : null, () => api.investimentos.movimentos(phone));
  const { data: patData,     mutate: mPat }  = useApi(ativo ? `inv:patrimonio:${phone}` : null, () => api.investimentos.patrimonio(phone), { fallbackData: initialData?.patrimonio });
  const { data: resData,     mutate: mRes }  = useApi(ativo ? `inv:reserva:${phone}` : null,    () => api.investimentos.reserva(phone), { fallbackData: initialData?.reserva });
  const { data: caixData,    mutate: mCaix } = useApi(ativo ? `inv:caixinhas:${phone}` : null,  () => api.investimentos.caixinhas(phone), { fallbackData: initialData?.caixinhas });

  const invs: any[]       = (invsData as any) ?? [];
  const aportesManuais: any[] = (aportesData as any) ?? [];

  /* Aportes lançados à mão + movimentações do banco, numa lista só.
     ⚠️ `neutro` FICA DE FORA: transferência de custódia é o papel mudando de
     corretora, dinheiro nenhum se move — listá-la como movimentação faria a
     pessoa procurar um depósito que nunca existiu. */
  const movimentos: any[] = useMemo(() => {
    const doBanco = ((movData as any)?.movimentos ?? [])
      .filter((m: any) => m.classe !== 'neutro')
      .map((m: any) => ({
        id: `of-${m.id}`, data: m.data, valor: Number(m.valor) || 0,
        investimento_id: m.investimento_id,
        // A classe do banco vira o `tipo` que a tela já entende, e as duas
        // classes novas (provento/imposto) passam adiante como estão.
        tipo: m.classe === 'aporte' ? 'aporte' : m.classe,
        operacao: m.operacao, origem: 'of',
        nomeInv: m.investimentos?.ticker || m.investimentos?.nome || null,
        ir: Number(m.ir) || 0,
      }));
    const manuais = aportesManuais.map((a: any) => ({ ...a, origem: 'manual' }));
    return [...doBanco, ...manuais]
      .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  }, [movData, aportesManuais]);

  // Proventos recebidos (dividendos, JCP, aluguéis, juros) — o card
  // "Dividendos" mostrava R$ 0,00 porque essa fonte nunca era lida.
  const totalProventos = (movData as any)?.totais?.provento || 0;
  const patrimonio: any[] = (patData as any) ?? [];
  const reserva: any      = (resData as any) ?? { valorAtual: 0, gastoMedioMensal: 0, mesesObjetivo: 6, valorObjetivo: 0, percentual: 0, mesesCobertos: 0 };
  // Caixinhas do Open Finance. Esse dinheiro NÃO está no saldo da conta (a
  // Celcoin exclui reservas do `available_amount`), então ele vive num total
  // próprio — nunca somado ao investido, que tem aporte e rentabilidade.
  const caixinhas: any[]    = ((caixData as any)?.caixinhas) ?? [];
  const totalCaixinhas: number = ((caixData as any)?.total) ?? 0;
  const temCaixinhas = caixinhas.length > 0;

  const carregar = useCallback(() => Promise.all([mInvs(), mAp(), mPat(), mRes(), mCaix()]), [mInvs, mAp, mPat, mRes, mCaix]);

  async function handleAtualizar() {
    if (!phone || atualizando) return;
    setAtualizando(true);
    setFeedback('');
    try {
      const r = await api.investimentos.atualizarPrecos(phone);
      setFeedback(`✓ ${r.atualizados} de ${r.total} ativos atualizados.`);
      setTimeout(() => setFeedback(''), 4000);
      carregar();
    } catch (e: any) {
      setFeedback(`Erro: ${e.message}`);
    } finally {
      setAtualizando(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este investimento?')) return;
    try { await api.investimentos.deletar(id); carregar(); } catch (e: any) { alert(e.message); }
  }

  // ─── Métricas agregadas ───────────────────────────────────────
  const totais = useMemo(() => {
    const aportado    = invs.reduce((s, i) => s + (i.valor_aportado || 0), 0);
    const atual       = invs.reduce((s, i) => s + (i.valor_atual || 0), 0);
    const dividendos  = invs.reduce((s, i) => s + (i.dividendos_acumulados || 0), 0);
    const lucro       = atual - aportado;
    const rent        = aportado > 0 ? (lucro / aportado) * 100 : 0;

    // Maior ganho/perda.
    //
    // ⚠️ SÓ ENTRA POSIÇÃO VIVA. O Open Finance devolve o produto inteiro, com
    // as aplicações já resgatadas valendo R$ 0,00 — nesta conta, 18 de 22. Como
    // todas têm rentabilidade 0, o "maior ganho" e a "maior perda" apontavam
    // sempre pra uma delas, e a tela exibia "Maior perda: RDB +0,00%", que não
    // é perda nenhuma. Sem posição viva, os cards ficam vazios em vez de
    // inventar um vencedor.
    const comPosicao = invs.filter(i => (i.valor_atual || 0) > 0.005 && (i.valor_aportado || 0) > 0);
    let maiorG: any = null, maiorP: any = null;
    comPosicao.forEach(i => {
      const r = i.rentabilidade || 0;
      if (!maiorG || r > (maiorG.rentabilidade || 0)) maiorG = i;
      if (!maiorP || r < (maiorP.rentabilidade || 0)) maiorP = i;
    });
    // Um ativo só não é "o maior ganho E a maior perda" ao mesmo tempo.
    if (comPosicao.length < 2) maiorP = null;

    // Variação ponderada do dia (peso pelo valor_atual)
    const varDia = atual > 0
      ? invs.reduce((s, i) => s + ((i.variacao_dia || 0) * (i.valor_atual || 0)), 0) / atual
      : 0;

    return { aportado, atual, dividendos, lucro, rent, maiorG, maiorP, varDia };
  }, [invs]);

  const distribuicao = useMemo(() => {
    const map: Record<string, number> = {};
    invs.forEach(i => { map[i.tipo] = (map[i.tipo] || 0) + (i.valor_atual || 0); });
    return Object.entries(map)
      .map(([tipo, valor]) => ({ tipo, valor, color: corTipo(tipo) }))
      .sort((a, b) => b.valor - a.valor);
  }, [invs]);

  // ─── PAYWALL ─────────────────────────────────────────────────
  if (!temAcesso) {
    return (
      <>
        <div className="max-w-7xl mx-auto pb-20 space-y-6">
          <Header />
          <PaywallPremium />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        <Header
          actions={
            <>
              <button
                onClick={handleAtualizar}
                disabled={atualizando}
                className="btn-outline px-3 py-2 text-sm gap-2"
              >
                {atualizando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Atualizar cotações
              </button>
              <button onClick={() => setNovoOpen(true)} className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm">
                <Plus size={16} /> Novo investimento
              </button>
            </>
          }
        />

        {feedback && (
          <div className="rounded-xl p-3 bg-primary/10 border border-primary/20 text-sm text-foreground animate-fade-in">
            {feedback}
          </div>
        )}

        {/* Tabs */}
        <div className="inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {([
            { v: 'resumo',    l: 'Resumo',     icon: BarChart3 },
            { v: 'carteira',  l: 'Carteira',   icon: Briefcase },
            // Só aparece pra quem tem caixinha no banco conectado — aba vazia
            // pra todo mundo seria ruído permanente na navegação.
            ...(temCaixinhas ? [{ v: 'caixinhas', l: 'Caixinhas', icon: PiggyBank }] : []),
            { v: 'reserva',   l: 'Reserva',    icon: Shield },
            { v: 'simulador', l: 'Simulador',  icon: Calculator },
            { v: 'aportes',   l: 'Aportes',    icon: Coins },
          ] as { v: Tab; l: string; icon: any }[]).map(({ v, l, icon: Icon }) => {
            const ativo = tab === v;
            return (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  ativo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{l}</span>
              </button>
            );
          })}
        </div>

        {/* TAB: RESUMO */}
        {tab === 'resumo' && (
          <TabResumo totais={totais} distribuicao={distribuicao} patrimonio={patrimonio}
                     totalCaixinhas={totalCaixinhas} qtdCaixinhas={caixinhas.length} proventos={totalProventos}
                     onVerCaixinhas={() => setTab('caixinhas')} />
        )}

        {/* TAB: CAIXINHAS */}
        {tab === 'caixinhas' && (
          <TabCaixinhas caixinhas={caixinhas} total={totalCaixinhas} />
        )}

        {/* TAB: CARTEIRA */}
        {tab === 'carteira' && (
          <TabCarteira invs={invs} onDelete={handleDelete} onAdd={() => setNovoOpen(true)} />
        )}

        {/* TAB: RESERVA */}
        {tab === 'reserva' && (
          <TabReserva
            reserva={reserva}
            invs={invs}
            // Marcar/desmarcar um investimento como reserva. Otimista: a lista
            // muda na hora e o servidor confirma depois — sem isso o toque
            // parece não ter feito nada até a rede responder.
            onToggleReserva={async (id: string, novo: boolean) => {
              mInvs((prev: any) => Array.isArray(prev)
                  ? prev.map((x: any) => (x.id === id ? { ...x, is_reserva_emergencia: novo } : x))
                  : prev, false);
              try { await api.investimentos.editar(id, { is_reserva_emergencia: novo }); }
              finally { mInvs(); mRes(); }   // mRes: o total da reserva é calculado no servidor
            }}
            onChangeMeses={async (n: number) => {
              if (!phone) return;
              try { await api.investimentos.atualizarReserva(phone, { meses_objetivo: n }); carregar(); } catch {}
            }}
          />
        )}

        {/* TAB: SIMULADOR */}
        {tab === 'simulador' && <TabSimulador />}

        {/* TAB: APORTES */}
        {tab === 'aportes' && (
          <TabAportes aportes={movimentos} invs={invs}
            onAportar={() => setMovimento({ tipo: 'aporte' })}
            onResgatar={() => setMovimento({ tipo: 'resgate' })} />
        )}
      </div>

      {novoOpen && phone && (
        <NovoInvestimentoModal phone={phone} onClose={() => setNovoOpen(false)} onSuccess={carregar} />
      )}

      {movimento && phone && (
        <MovimentoModal
          tipo={movimento.tipo}
          phone={phone}
          investimentos={invs}
          investimentoId={movimento.invId}
          onClose={() => setMovimento(null)}
          onSuccess={carregar}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HEADER + PAYWALL
// ─────────────────────────────────────────────────────────────
function Header({ actions }: { actions?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
         style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / .12) 0%, transparent 60%)' }} />
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
            <Crown size={12} className="text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Premium
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            Investimentos
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-md">
            Acompanhe sua carteira em tempo real.
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function PaywallPremium() {
  const features = [
    { icon: Briefcase,  l: 'Carteira completa multiclasse',    d: 'Ações, FIIs, ETFs, Cripto, Tesouro, CDB, Imóveis' },
    { icon: RefreshCw,  l: 'Atualização automática',           d: 'Yahoo Finance + CoinGecko (24h)' },
    { icon: Coins,      l: 'Dividendos rastreados',            d: 'Histórico de proventos por ativo' },
    { icon: Calculator, l: 'Simulador de juros compostos',     d: 'Pré-fixado, CDI, IPCA+, FII' },
    { icon: Shield,     l: 'Reserva de emergência inteligente', d: 'Calculada com base no seu gasto médio' },
  ];

  return (
    <div className="card rounded-3xl p-8 sm:p-10 text-center animate-fade-in" style={{ animationDelay: '60ms' }}>
      <div className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-glow"
           style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
        <TrendingUp size={42} className="text-white" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
        Central de Investimentos
      </h2>
      <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto leading-relaxed">
        Disponível no plano <strong className="text-foreground">Premium</strong>. Gerencie sua carteira com cotações em tempo real e ferramentas profissionais.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 text-left max-w-3xl mx-auto">
        {features.map(({ icon: Icon, l, d }) => (
          <div key={l} className="flex items-start gap-3 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{l}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{d}</p>
            </div>
          </div>
        ))}
      </div>

      <a href="/planos"
         className="btn w-full max-w-xs mx-auto mt-8 py-3 text-sm gap-2 text-white shadow-glow font-bold inline-flex items-center justify-center"
         style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}>
        <TrendingUp size={16} /> Ver planos
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB RESUMO
// ─────────────────────────────────────────────────────────────
function TabResumo({ totais, distribuicao, patrimonio, totalCaixinhas = 0, qtdCaixinhas = 0, proventos = 0, onVerCaixinhas }: any) {
  const [periodo, setPeriodo] = useState<'7' | '30' | '90' | '365' | 'all'>('30');
  // Tema escuro = 'black' (classe .dark). No claro o hero fica branco como os
  // demais cards; no escuro mantém o visual atual.
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'black' || resolvedTheme === 'dark';
  const fundoHero = isDark
    ? 'linear-gradient(135deg, #0a0a0a 0%, #18181b 50%, #0a0a0a 100%)'
    : 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)';

  const patFiltrado = useMemo(() => {
    if (!patrimonio?.length) return [];
    // ⚠️ DESENHA `investido`, NÃO `patrimonio_total` (migration 140). O gráfico
    // fica logo abaixo do card "Patrimônio total", que soma SÓ investimentos —
    // plotar aqui a soma com o saldo das contas faria o número grande dizer uma
    // coisa e a linha embaixo dele, outra.
    // Ponto sem `investido` (as ~90 linhas gravadas antes da 140) é DESCARTADO,
    // não zerado: um zero ali leria como "a carteira zerou naquele dia".
    const base = patrimonio
      .filter((p: any) => p.investido != null)
      .map((p: any) => ({ ...p, valor: Number(p.investido) }));
    if (periodo === 'all') return base;
    const dias = parseInt(periodo, 10);
    const corte = Date.now() - dias * 24 * 60 * 60 * 1000;
    return base.filter((p: any) => new Date(p.data).getTime() >= corte);
  }, [patrimonio, periodo]);

  return (
    <div className="space-y-5 animate-fade-in" style={{ animationDelay: '120ms' }}>
      {/* Caixinhas do banco — atalho pra aba. Fica ACIMA do hero de propósito:
          é dinheiro que o painel nunca mostrou (o banco o tira do saldo da
          conta), então precisa ser encontrado. Só aparece quando existe. */}
      {qtdCaixinhas > 0 && (
        <button type="button" onClick={onVerCaixinhas}
                className="w-full card rounded-2xl p-4 flex items-center gap-4 text-left transition-all hover:border-primary/40 active:scale-[0.995]"
                style={{ minHeight: 44 }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: `color-mix(in srgb, ${CAIXA_COR} 14%, transparent)` }}>
            <PiggyBank size={19} style={{ color: CAIXA_COR }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Guardado em caixinhas</p>
            <p className="text-xl font-bold text-foreground tabular leading-tight">{fmt(totalCaixinhas)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {qtdCaixinhas === 1 ? '1 reserva no banco' : `${qtdCaixinhas} reservas no banco`} · fora do saldo da conta
            </p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" />
        </button>
      )}

      {/* Hero total */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-border/60"
           style={{ background: fundoHero }}>
        <div className="absolute -top-16 -right-16 w-60 h-60 rounded-full pointer-events-none opacity-20"
             style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 60%)` }} />
        <div className="relative grid lg:grid-cols-5 gap-6 items-center">
          <div className="lg:col-span-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Patrimônio total</p>
            <p className="text-5xl sm:text-6xl font-bold text-foreground tabular tracking-tight leading-none">
              {fmt(totais.atual)}
            </p>
            <div className={`inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-xs font-bold tabular ${
              totais.varDia >= 0 ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'
            }`}>
              {totais.varDia >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {fmtPct(totais.varDia)} hoje
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <DarkStat label="Aportado"     value={fmt(totais.aportado)} />
              <DarkStat label="Lucro/Prej."   value={fmt(totais.lucro)} color={totais.lucro >= 0 ? '#22c55e' : '#ef4444'} />
              <DarkStat label="Proventos"    value={fmt(Math.max(totais.dividendos, proventos))} />
            </div>
          </div>
          {/* ⚠️ O MESMO DONUT DA ABA CATEGORIAS (`CategoryDonut`), não um
              gráfico próprio. Aqui havia um `<Pie>` cru: sem destaque de fatia,
              sem leitura no centro e com um tooltip que chegou a mostrar "0" no
              lugar do nome. Reaproveitar o componente traz de graça o toque que
              expande a fatia com as outras escurecendo, o valor e a % no meio,
              e o respeito a `prefers-reduced-motion` — e, mais importante,
              qualquer conserto num lugar vale nos dois. */}
          <div className="lg:col-span-2">
            <div className="w-full aspect-square max-w-[260px] mx-auto">
              {distribuicao.length > 0 ? (
                <DonutClasses
                  data={distribuicao.map((d: any) => ({
                    name: d.tipo, value: d.valor, color: d.color, emoji: EMOJI_TIPO[d.tipo] || '📊',
                  }))}
                  showList={false}
                  espacado
                  valorGrande
                  legendaCentro="investido"
                  height="100%" innerRadius="72%" outerRadius="95%"
                />
              ) : (
                <div className="w-full h-full rounded-full border-[14px] border-border flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Sem dados</span>
                </div>
              )}
            </div>
            {distribuicao.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 justify-center">
                {distribuicao.slice(0, 6).map((d: any) => (
                  <div key={d.tipo} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.tipo}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Rentabilidade total" value={fmtPct(totais.rent)} color={totais.rent >= 0 ? '#22c55e' : '#ef4444'} />
        {/* Sem posição viva o card mostra "—" e nenhum subtítulo, em vez de
            "+0,00%" numa aplicação resgatada. */}
        <Stat label="Maior ganho" value={totais.maiorG?.nome || '—'}
              sub={totais.maiorG ? fmtPct((totais.maiorG.rentabilidade || 0) * 100) : undefined} subColor="#22c55e" />
        {/* ⚠️ "Maior perda" com número POSITIVO e em vermelho é contradição na
            cara do usuário — foi o que a tela mostrou: "Maior perda · RDB ·
            +0,05%". Quando o pior ativo ainda está no lucro, não existe perda:
            o card vira "Menor ganho" e sai do vermelho. */}
        {(() => {
          const r = (totais.maiorP?.rentabilidade || 0) * 100;
          const negativo = r < 0;
          return (
            <Stat label={totais.maiorP && !negativo ? 'Menor ganho' : 'Maior perda'}
                  value={totais.maiorP?.nome || '—'}
                  sub={totais.maiorP ? fmtPct(r) : undefined}
                  subColor={negativo ? '#ef4444' : '#22c55e'} />
          );
        })()}
        <Stat label="Proventos recebidos" value={fmt(Math.max(totais.dividendos, proventos))}
              sub={proventos > 0 ? "dividendos, JCP e juros do banco" : undefined} subColor="#22c55e" />
      </div>

      {/* Evolução */}
      <div className="card rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-0.5">Evolução</p>
            <p className="text-base font-bold text-foreground">Patrimônio</p>
          </div>
          <div className="inline-flex bg-muted/40 rounded-xl p-1 gap-0.5">
            {([
              { v: '7',   l: '7d'  }, { v: '30',  l: '30d' }, { v: '90',  l: '90d' },
              { v: '365', l: '1a' }, { v: 'all', l: 'Tudo' },
            ] as const).map(({ v, l }) => (
              <button key={v} onClick={() => setPeriodo(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  periodo === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {patFiltrado.length > 1 ? (
            <GraficoPatrimonio data={patFiltrado} />
          ) : (
            /* ⚠️ O TEXTO ANTIGO ERA FALSO: dizia "histórico será gerado
               conforme você adicionar investimentos", como se dependesse de
               cadastrar mais coisa. Não depende — o histórico é uma FOTO por
               dia. Quem já tem a carteira cheia continuava lendo que precisava
               adicionar algo, e nada acontecia. */
            <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-1.5">
              <TrendingUp size={22} className="text-muted-foreground/50" />
              <p className="text-sm font-semibold text-foreground">
                {patFiltrado.length === 1 ? 'Primeiro ponto registrado' : 'Acompanhando a partir de agora'}
              </p>
              <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
                A Sora fotografa sua carteira uma vez por dia. Em alguns dias esta linha mostra a
                evolução — não precisa fazer nada.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB CARTEIRA
// ─────────────────────────────────────────────────────────────
function TabCarteira({ invs, onDelete, onAdd }: any) {
  const [busca, setBusca] = useState('');
  const [classe, setClasse] = useState<'todas' | Classe>('todas');
  const [ordem, setOrdem] = useState<'valor' | 'rent' | 'venc'>('valor');
  const [verResgatados, setVerResgatados] = useState(false);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});

  /* ⚠️ POSIÇÃO ZERADA É PAPEL RESGATADO, e some por padrão.
     O Open Finance devolve o histórico inteiro do produto, não só o que está
     vivo: nesta conta chegaram 22 RDBs e 18 deles valem R$ 0,00 — dinheiro que
     já saiu. Listados junto, enterravam as 4 posições reais e faziam a carteira
     parecer quebrada. Continuam alcançáveis num clique, com a contagem à
     mostra, porque escondê-los sem dizer seria pior. */
  const { vivos, resgatados } = useMemo(() => {
    const v: any[] = [], r: any[] = [];
    for (const i of invs) ((i.valor_atual || 0) > 0.005 ? v : r).push(i);
    return { vivos: v, resgatados: r };
  }, [invs]);

  const base = verResgatados ? invs : vivos;

  /* ⚠️ POSIÇÕES IDÊNTICAS VIRAM UMA LINHA SÓ.
     Cada aporte numa caixinha do Nubank cria um RDB próprio, com vencimento
     dois anos à frente — por isso 22 papéis com o mesmo nome, o mesmo 100% do
     CDI e datas espalhadas. Mostrar 22 linhas iguais não informa nada; o que
     a pessoa quer saber é "tenho R$ 2.642,80 em RDB a 100% do CDI". A lista
     das aplicações continua ali, a um clique. */
  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = base.filter((i: any) => {
      const okBusca = !q || (i.nome || '').toLowerCase().includes(q) || (i.ticker || '').toLowerCase().includes(q);
      const okClasse = classe === 'todas' || classeDe(i.tipo) === classe;
      return okBusca && okClasse;
    });

    const mapa = new Map<string, any>();
    for (const i of filtrados) {
      // Renda variável NUNCA agrupa: ali cada posição tem preço médio e
      // quantidade próprios, e fundir duas linhas apagaria os dois.
      const cl = classeDe(i.tipo);
      const chave = cl === 'variavel'
        ? `u:${i.id}`
        : `${i.tipo}|${i.nome}|${i.indexador || ''}|${i.percentual_indexador || ''}|${i.taxa_anual || ''}`;
      const g = mapa.get(chave) || {
        chave, classe: cl, tipo: i.tipo, nome: i.nome, ticker: i.ticker,
        indexador: i.indexador, percentual_indexador: i.percentual_indexador,
        taxa_anual: i.taxa_anual, instituicao: i.instituicao, itens: [] as any[],
        valor: 0, aportado: 0, quantidade: 0, dividendos: 0,
        ir: 0, iof: 0, bloqueado: 0,
      };
      g.itens.push(i);
      g.valor += i.valor_atual || 0;
      g.aportado += i.valor_aportado || 0;
      g.quantidade += i.quantidade || 0;
      g.dividendos += i.dividendos_acumulados || 0;
      g.ir += i.ir_provisionado || 0;
      g.iof += i.iof_provisionado || 0;
      g.bloqueado += i.saldo_bloqueado || 0;
      mapa.set(chave, g);
    }

    const lista = Array.from(mapa.values()).map(g => ({
      ...g,
      // ⚠️ Rentabilidade do GRUPO é recalculada do total, não é média das
      // partes: média simples daria o mesmo peso a um papel de R$ 1.900 e a um
      // de R$ 34, e o número não bateria com o lucro exibido.
      rent: g.aportado > 0 ? (g.valor - g.aportado) / g.aportado : 0,
      vencimentos: g.itens.map((x: any) => x.data_vencimento).filter(Boolean).sort(),
      variacaoDia: g.itens[0]?.variacao_dia || 0,
      // Carência que ainda não venceu, a mais distante do grupo: é a data em
      // que TODO o dinheiro daquele card fica livre de penalidade.
      carencia: g.itens.map((x: any) => x.carencia_ate).filter(Boolean).sort().pop() || null,
    }));

    lista.sort((a, b) => {
      if (ordem === 'rent') return b.rent - a.rent;
      if (ordem === 'venc') return String(a.vencimentos[0] || '9999').localeCompare(String(b.vencimentos[0] || '9999'));
      return b.valor - a.valor;
    });
    return lista;
  }, [base, busca, classe, ordem]);

  const total = grupos.reduce((s, g) => s + g.valor, 0);

  // Só oferece classe que a pessoa realmente tem — filtro com opção vazia
  // devolve "nenhum resultado" e parece defeito.
  const classesEmUso = useMemo(() => {
    const usadas = new Set(base.map((i: any) => classeDe(i.tipo)));
    return CLASSES.filter(c => usadas.has(c.k));
  }, [base]);

  const porClasse = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const g of grupos) (m[g.classe] = m[g.classe] || []).push(g);
    return m;
  }, [grupos]);

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      {/* ── Controles ────────────────────────────────────────────────── */}
      <div className="card rounded-2xl p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome ou ticker…"
            aria-label="Buscar investimento"
            className="w-full pl-9 pr-3 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 focus:bg-card text-sm outline-none"
            style={{ minHeight: 44 }} />
        </div>
        {classesEmUso.length > 1 && (
          <select value={classe} onChange={e => setClasse(e.target.value as any)}
            aria-label="Filtrar por classe de ativo"
            className="px-3 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 text-sm font-medium outline-none cursor-pointer"
            style={{ minHeight: 44 }}>
            <option value="todas">Todas as classes</option>
            {classesEmUso.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}
          </select>
        )}
        <select value={ordem} onChange={e => setOrdem(e.target.value as any)}
          aria-label="Ordenar carteira"
          className="px-3 rounded-xl bg-muted/40 border border-transparent focus:border-primary/40 text-sm font-medium outline-none cursor-pointer"
          style={{ minHeight: 44 }}>
          <option value="valor">Maior valor</option>
          <option value="rent">Maior rentabilidade</option>
          <option value="venc">Vence primeiro</option>
        </select>
      </div>

      {/* ── Resgatados: contagem sempre visível ──────────────────────── */}
      {resgatados.length > 0 && (
        <button onClick={() => setVerResgatados(v => !v)}
          aria-pressed={verResgatados}
          className="w-full flex items-center gap-2.5 px-4 rounded-xl bg-muted/30 hover:bg-muted/50 border border-border/60 text-left transition-colors"
          style={{ minHeight: 44 }}>
          <Archive size={14} className="text-muted-foreground flex-shrink-0" />
          <span className="text-xs text-muted-foreground flex-1">
            <strong className="text-foreground tabular">{resgatados.length}</strong>{' '}
            {resgatados.length === 1 ? 'aplicação já resgatada' : 'aplicações já resgatadas'} (R$ 0,00)
          </span>
          <span className="text-xs font-semibold text-primary">{verResgatados ? 'ocultar' : 'mostrar'}</span>
        </button>
      )}

      {grupos.length === 0 ? (
        <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-glow-sm"
               style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
            <Briefcase size={26} style={{ color: BRAND }} />
          </div>
          <p className="text-base font-bold text-foreground">
            {busca || classe !== 'todas' ? 'Nada com esse filtro' : 'Nenhum investimento'}
          </p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
            {busca || classe !== 'todas'
              ? 'Tente outro termo ou outra classe.'
              : 'Adicione seu primeiro ativo ou conecte o banco pelo Open Finance.'}
          </p>
          {!busca && classe === 'todas' && (
            <button onClick={onAdd} className="btn btn-primary px-4 py-2 text-sm gap-2 mt-5 shadow-glow-sm">
              <Plus size={14} /> Adicionar primeiro investimento
            </button>
          )}
        </div>
      ) : (
        /* ── Uma seção por CLASSE ──────────────────────────────────── */
        CLASSES.filter(c => porClasse[c.k]?.length).map((c, ci) => {
          const doGrupo = porClasse[c.k];
          const somaClasse = doGrupo.reduce((s: number, g: any) => s + g.valor, 0);
          const pct = total > 0 ? (somaClasse / total) * 100 : 0;
          return (
            <section key={c.k} className="animate-[slide-up_450ms_ease-out_both]" style={{ animationDelay: `${ci * 60}ms` }}>
              <div className="flex items-center justify-between gap-3 mb-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${c.cor} 15%, transparent)` }}>
                    <c.Icone size={14} style={{ color: c.cor }} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground leading-tight">{c.label}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{c.desc}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold tabular text-foreground">{fmt(somaClasse)}</p>
                  <p className="text-[10px] text-muted-foreground tabular">{pct.toFixed(0)}% da carteira</p>
                </div>
              </div>

              <div className="space-y-2">
                {doGrupo.map((g: any) => (
                  <CardPosicao key={g.chave} g={g} cor={c.cor}
                               expandido={!!aberto[g.chave]}
                               onExpandir={() => setAberto(a => ({ ...a, [g.chave]: !a[g.chave] }))}
                               onDelete={onDelete} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

/** Carência: livre pra sacar, ou a data em que fica. */
function ChipCarencia({ ate }: { ate: string }) {
  const d = new Date(String(ate).slice(0, 10) + 'T12:00:00');
  const hoje = new Date(); hoje.setHours(12, 0, 0, 0);
  const dias = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  const livre = dias <= 0;
  const cor = livre ? '#10b981' : '#f59e0b';
  return (
    <span className="text-[10px] font-semibold inline-flex items-center gap-1" style={{ color: cor }}
          title={livre
            ? 'Passou da carência: dá pra resgatar sem perder rendimento.'
            : `Resgatar antes de ${d.toLocaleDateString('pt-BR')} costuma custar rendimento.`}>
      <Shield size={9} />
      {livre
        ? 'livre pra resgate'
        : `carência até ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${dias}d`}
    </span>
  );
}

/* ── Card de uma posição (ou de um grupo de aplicações iguais) ───────── */
function CardPosicao({ g, cor, expandido, onExpandir, onDelete }: any) {
  const varios = g.itens.length > 1;
  const idx = textoIndexador(g);
  const rentPct = g.rent * 100;
  const lucro = g.valor - g.aportado;
  const vencPrimeiro = textoVencimento(g.vencimentos[0]);
  const vencUltimo = textoVencimento(g.vencimentos[g.vencimentos.length - 1]);
  const zerado = g.valor <= 0.005;

  return (
    <div className="card rounded-2xl overflow-hidden" style={{ opacity: zerado ? 0.6 : 1 }}>
      <div className="flex items-center gap-3 p-3.5">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0"
              style={{ background: cor }} aria-hidden>
          {(g.ticker || g.nome || '?').charAt(0).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-foreground truncate">{g.ticker || g.nome}</p>
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)`, color: cor }}>
              {g.tipo}
            </span>
            {/* Quem emitiu o papel (migration 138). Sem isto o card não tinha
                como dizer "Nubank" e todo investimento parecia vir do nada. */}
            {g.instituicao && (
              <span className="text-[10px] text-muted-foreground truncate">· {g.instituicao}</span>
            )}
            {varios && (
              <span className="text-[10px] text-muted-foreground tabular">
                · {g.itens.length} aplicações
              </span>
            )}
          </div>

          {/* ⚠️ A SUBLINHA MUDA COM A CLASSE. Renda fixa não tem "quantidade de
              cotas" que signifique algo — o sync deriva qtd = valor / R$ 0,01 e
              a tela antiga exibia "190.000 unidades a R$ 0,01", que não é
              informação. O que descreve o papel é indexador e vencimento. */}
          <div className="flex items-center gap-x-2.5 gap-y-0.5 flex-wrap mt-0.5">
            {g.classe === 'variavel' ? (
              <>
                <span className="text-[11px] text-muted-foreground tabular">
                  {(g.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 8 })} un.
                </span>
                {g.aportado > 0 && g.quantidade > 0 && (
                  <span className="text-[11px] text-muted-foreground tabular">
                    PM {fmt(g.aportado / g.quantidade)}
                  </span>
                )}
                {!!g.variacaoDia && (
                  <span className={`text-[11px] font-semibold tabular ${g.variacaoDia >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {fmtPct(g.variacaoDia)} hoje
                  </span>
                )}
              </>
            ) : (
              <>
                {idx && (
                  <span className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: cor }}>
                    <Percent size={9} /> {idx}
                  </span>
                )}
                {vencPrimeiro && (
                  <span className={`text-[11px] inline-flex items-center gap-1 ${vencPrimeiro.perto ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-muted-foreground'}`}>
                    <CalendarClock size={9} />
                    {/* Com várias aplicações, uma data só mentiria — mostra a
                        janela inteira. */}
                    {varios && g.vencimentos.length > 1 && vencUltimo && vencPrimeiro.txt !== vencUltimo.txt
                      ? `vence entre ${String(g.vencimentos[0]).slice(0, 7).split('-').reverse().join('/')} e ${String(g.vencimentos[g.vencimentos.length - 1]).slice(0, 7).split('-').reverse().join('/')}`
                      : vencPrimeiro.txt}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-bold tabular text-foreground">{fmt(g.valor)}</p>
          {g.aportado > 0 && !zerado && (
            <p className={`text-[11px] font-semibold tabular ${lucro >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
              {fmtPct(rentPct)} · {lucro >= 0 ? '+' : ''}{fmt(lucro)}
            </p>
          )}
        </div>

        {/* ── Carência e IR: o que os docs da Celcoin já mandavam ────────
            ⚠️ CARÊNCIA É A PERGUNTA Nº 1 de quem guarda em caixinha: "posso
            sacar sem perder?". O `grace_period_date` chegava em todo sync e era
            descartado. Aparece antes de tudo porque decide o saque de hoje.
            ⚠️ IR NÃO SE SUBTRAI DO VALOR — o `net_amount`, que é o nosso
            `valor_atual`, já vem líquido dele. O chip só EXPLICA o número. */}
        {varios ? (
          <button onClick={onExpandir} aria-expanded={expandido}
                  aria-label={`${expandido ? 'Ocultar' : 'Ver'} as ${g.itens.length} aplicações de ${g.nome}`}
                  className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-muted flex-shrink-0 transition-colors">
            <ChevronDown size={15} className={`text-muted-foreground transition-transform ${expandido ? 'rotate-180' : ''}`} />
          </button>
        ) : (
          <button onClick={() => onDelete(g.itens[0].id)} aria-label={`Excluir ${g.nome}`}
                  className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-red-500/10 flex-shrink-0 transition-colors">
            <Trash2 size={13} className="text-muted-foreground hover:text-red-500" />
          </button>
        )}
      </div>

      {(g.carencia || g.ir > 0.005 || g.bloqueado > 0.005) && !zerado && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 pb-3 -mt-1 pl-[4.25rem]">
          {g.carencia && <ChipCarencia ate={g.carencia} />}
          {g.ir > 0.005 && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1"
                  title="Imposto de renda já provisionado pelo emissor. O valor mostrado já está líquido dele.">
              <Landmark size={9} /> {fmt(g.ir)} de IR já descontado
            </span>
          )}
          {g.bloqueado > 0.005 && (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
              <Shield size={9} /> {fmt(g.bloqueado)} bloqueado
            </span>
          )}
        </div>
      )}

      {/* Aplicações individuais do grupo */}
      {varios && expandido && (
        <ul className="border-t border-border/60 divide-y divide-border/40 bg-muted/20">
          {[...g.itens].sort((a: any, b: any) => (b.valor_atual || 0) - (a.valor_atual || 0)).map((i: any) => {
            const v = textoVencimento(i.data_vencimento);
            const iZerado = (i.valor_atual || 0) <= 0.005;
            return (
              <li key={i.id} className="flex items-center gap-3 pl-14 pr-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className={`text-xs ${iZerado ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {v ? v.txt : 'sem vencimento informado'}
                    {iZerado && <span className="ml-1.5 text-[10px] uppercase tracking-wider font-bold text-muted-foreground">resgatado</span>}
                  </p>
                  {textoIndexador(i) && textoIndexador(i) !== textoIndexador(g) && (
                    <p className="text-[10px] text-muted-foreground">{textoIndexador(i)}</p>
                  )}
                </div>
                <span className="text-xs tabular font-semibold text-foreground flex-shrink-0">{fmt(i.valor_atual || 0)}</span>
                <button onClick={() => onDelete(i.id)} aria-label="Excluir aplicação"
                        className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-red-500/10 flex-shrink-0 transition-colors">
                  <Trash2 size={12} className="text-muted-foreground hover:text-red-500" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// CAIXINHAS / COFRINHOS (Open Finance)
// ─────────────────────────────────────────────────────────────
const CAIXA_COR = '#10b981';

/** "100% do CDI" / "15% a.a." a partir do que o banco informou. */
function textoRendimento(c: any): string | null {
  if (c.indexador && c.indexador_pct != null) {
    const per = c.periodicidade ? ` · ${String(c.periodicidade).toLowerCase()}` : '';
    return `${Number(c.indexador_pct).toFixed(2).replace(/\.?0+$/, '')}% do ${c.indexador}${per}`;
  }
  if (c.taxa_pre != null) return `${Number(c.taxa_pre).toFixed(2).replace(/\.?0+$/, '')}% pré-fixado`;
  if (c.indexador) return String(c.indexador);
  return null;
}

function TabCaixinhas({ caixinhas, total }: { caixinhas: any[]; total: number }) {
  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>

      {/* Total guardado */}
      <div className="card rounded-3xl p-6 sm:p-7 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: `radial-gradient(circle at top right, ${CAIXA_COR}24 0%, transparent 70%)` }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1.5">
            <PiggyBank size={15} style={{ color: CAIXA_COR }} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Guardado em caixinhas
            </span>
          </div>
          <p className="text-3xl sm:text-4xl font-bold text-foreground tabular tracking-tight">{fmt(total)}</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
            {caixinhas.length === 1 ? '1 reserva' : `${caixinhas.length} reservas`} no seu banco.
            {' '}Esse dinheiro <strong className="text-foreground">não entra no saldo da conta</strong> —
            o banco o separa, e por isso ele aparece aqui.
          </p>
        </div>
      </div>

      {/* Lista */}
      <div className="card rounded-2xl divide-y divide-border">
        {caixinhas.map((c, i) => {
          const rend = textoRendimento(c);
          const fatia = total > 0 ? ((c.saldo || 0) / total) * 100 : 0;
          return (
            <div key={c.id || i}
                 className="p-4 sm:p-5 flex items-center gap-4 animate-[slide-up_500ms_ease-out_both]"
                 style={{ animationDelay: `${i * 40}ms` }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                   style={{ background: `color-mix(in srgb, ${CAIXA_COR} 14%, transparent)` }}>
                <PiggyBank size={18} style={{ color: CAIXA_COR }} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">{c.nome}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {rend ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: CAIXA_COR }}>
                      <TrendingUp size={11} /> {rend}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem rendimento informado</span>
                  )}
                  <span className="text-xs text-muted-foreground tabular">{fatia.toFixed(0)}% do guardado</span>
                </div>
              </div>

              <p className="font-bold text-foreground tabular shrink-0">{fmt(c.saldo || 0)}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground flex items-start gap-1.5 px-1">
        <Landmark size={13} className="shrink-0 mt-0.5" />
        <span>
          Dados lidos direto do seu banco pelo Open Finance. Caixinhas ligadas a investimentos
          do seu CPF aparecem na aba <strong className="text-foreground">Carteira</strong>, não aqui.
        </span>
      </p>
    </div>
  );
}

// ── Uma linha do seletor da reserva ─────────────────────────────────────────
// ⚠️ O estado vem em ÍCONE + PALAVRA ("Na reserva" / "Fora"), não só na cor do
// interruptor: cor sozinha não comunica pra quem não distingue contraste.
function LinhaReserva({ inv, on = false, onToggle }: any) {
  const [salvando, setSalvando] = useState(false);
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30" style={{ minHeight: 56 }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
           style={{ background: corTipo(inv.tipo) }}>
        {on ? '🛡️' : (inv.tipo || '?').slice(0, 2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{inv.nome}</p>
        <p className="text-[11px] text-muted-foreground truncate">
          {inv.tipo}{inv.origem === 'of' ? ' · do banco' : ''}
        </p>
      </div>
      <p className="text-sm font-bold tabular flex-shrink-0">{fmt(inv.valor_atual || 0)}</p>
      <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold flex-shrink-0"
            style={{ color: on ? BRAND : 'hsl(var(--muted-foreground))' }}>
        {on ? <><Shield size={12} /> Na reserva</> : <>Fora</>}
      </span>
      <button
        role="switch"
        aria-checked={on}
        aria-label={`${on ? 'Tirar' : 'Colocar'} ${inv.nome} ${on ? 'da' : 'na'} reserva de emergência`}
        disabled={salvando}
        onClick={async () => {
          setSalvando(true);
          try { await onToggle?.(inv.id, !on); } finally { setSalvando(false); }
        }}
        className="relative rounded-full flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: on ? BRAND : 'hsl(var(--foreground) / 0.15)', minWidth: 48, minHeight: 28, width: 48, height: 28 }}
      >
        <span className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
              style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}

function TabReserva({ reserva, invs, onChangeMeses, onToggleReserva }: any) {
  const pct = reserva.percentual || 0;
  const status =
    pct >= 100 ? { label: 'Reserva completa ✓', color: '#22c55e' } :
    pct >= 70  ? { label: 'Quase lá',           color: '#22c55e' } :
    pct >= 30  ? { label: 'Em construção',      color: '#f59e0b' } :
                 { label: 'Crítico',            color: '#ef4444' };

  const reservaInvs = invs.filter((i: any) => i.is_reserva_emergencia);
  const naoReserva  = invs.filter((i: any) => !i.is_reserva_emergencia);

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="card rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
            <Shield size={20} style={{ color: BRAND }} />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Sua reserva de emergência</p>
            <p className="text-xs text-muted-foreground">Calculada a partir do seu gasto médio mensal</p>
          </div>
        </div>

        <p className="text-5xl font-bold text-foreground tabular tracking-tight leading-none">{fmt(reserva.valorAtual || 0)}</p>
        <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full" style={{ background: `color-mix(in srgb, ${status.color} 13%, transparent)` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.color }} />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: status.color }}>{status.label}</span>
        </div>

        <div className="h-6 rounded-full bg-muted mt-5 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700"
               style={{ width: `${Math.min(pct, 100)}%`, background: `linear-gradient(90deg, ${status.color}, color-mix(in srgb, ${status.color} 67%, transparent))` }} />
        </div>

        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground tabular">{(reserva.mesesCobertos || 0).toFixed(1)}</strong> meses cobertos
            {' '}/ {reserva.mesesObjetivo} meses objetivo
          </span>
          <span className="font-bold tabular" style={{ color: status.color }}>{pct.toFixed(0)}%</span>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Com seu gasto médio de <strong className="text-foreground tabular">{fmt(reserva.gastoMedioMensal || 0)}</strong>,
          sua meta é <strong className="text-foreground tabular">{fmt(reserva.valorObjetivo || 0)}</strong>.
        </p>

        <div className="mt-5 pt-5 border-t border-border/60">
          <p className="text-xs font-semibold text-foreground mb-3">Meses de cobertura objetivo</p>
          <div className="flex flex-wrap gap-2">
            {[3, 6, 9, 12].map(m => {
              const ativo = reserva.mesesObjetivo === m;
              return (
                <button key={m} onClick={() => onChangeMeses(m)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    ativo ? 'bg-primary text-primary-foreground shadow-glow-sm' : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                  }`}>{m} meses</button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══ Investimentos da reserva ═══════════════════════════════════════
          ⚠️ ISTO ERA UMA LISTA MORTA. O vazio dizia "Edite um CDB de liquidez
          diária ou Tesouro Selic" — e não existia edição de investimento em
          lugar nenhum do painel: o marcador só era gravado na CRIAÇÃO, e ainda
          assim só aparecia no modal para os tipos CDB, Caixa e Reserva.
          Resultado: quem trouxe o investimento pelo Open Finance (todos eles)
          NUNCA conseguia montar a reserva, e o card ficava R$ 0,00 em vermelho
          por cima de um fundo DI de R$ 79.836,29. Agora o marcador é o próprio
          seletor abaixo. */}
      <div className="card rounded-2xl p-5">
        <p className="text-sm font-bold text-foreground">
          Investimentos da reserva{' '}
          <span className="text-muted-foreground font-normal tabular">({reservaInvs.length})</span>
        </p>

        {reservaInvs.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Nenhum investimento marcado ainda. Marque abaixo o que você usaria numa
            emergência — o ideal é o que tem <strong className="text-foreground">liquidez diária</strong>
            {' '}(CDB liquidez diária, Tesouro Selic, fundo DI).
          </p>
        ) : (
          <div className="space-y-2 mt-3">
            {reservaInvs.map((i: any) => (
              <LinhaReserva key={i.id} inv={i} on onToggle={onToggleReserva} />
            ))}
          </div>
        )}
      </div>

      {/* Os que ainda não estão na reserva — é aqui que se resolve o problema. */}
      {naoReserva.length > 0 && (
        <div className="card rounded-2xl p-5">
          <p className="text-sm font-bold text-foreground">Adicionar à reserva</p>
          <p className="text-xs text-muted-foreground mt-0.5 mb-3 leading-relaxed">
            Só entra o que dá pra resgatar rápido. Deixe de fora ação, FII e o que
            tem carência — na emergência eles não estariam disponíveis.
          </p>
          <div className="space-y-2">
            {naoReserva.map((i: any) => (
              <LinhaReserva key={i.id} inv={i} onToggle={onToggleReserva} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB SIMULADOR — juros compostos
// ─────────────────────────────────────────────────────────────
const PRESETS = [
  { l: 'Tesouro Selic',     taxa: 11.0,  un: 'aa' },
  { l: 'CDB 100% CDI',      taxa: 11.0,  un: 'aa' },
  { l: 'CDB 110% CDI',      taxa: 12.1,  un: 'aa' },
  { l: 'FII médio',         taxa: 8.7,   un: 'aa' },
];

function TabSimulador() {
  const [inicial,    setInicial]    = useState('1000');
  const [mensal,     setMensal]     = useState('500');
  const [taxa,       setTaxa]       = useState('11');
  const [unidade,    setUnidade]    = useState<'aa' | 'am'>('aa');
  const [periodo,    setPeriodo]    = useState('5');
  const [unidadeT,   setUnidadeT]   = useState<'anos' | 'meses'>('anos');

  const sim = useMemo(() => {
    const v0 = parseFloat(inicial) || 0;
    const ap = parseFloat(mensal) || 0;
    const t  = parseFloat(taxa)   || 0;
    const n  = (parseFloat(periodo) || 0) * (unidadeT === 'anos' ? 12 : 1);
    const im = unidade === 'aa' ? Math.pow(1 + t/100, 1/12) - 1 : t/100;

    const linhas: { mes: number; saldo: number; aportado: number; juros: number }[] = [];
    let saldo = v0;
    let aportado = v0;
    for (let m = 1; m <= n; m++) {
      saldo = saldo * (1 + im) + ap;
      aportado += ap;
      linhas.push({ mes: m, saldo, aportado, juros: saldo - aportado });
    }
    return {
      linhas,
      final: saldo,
      aportado,
      juros: saldo - aportado,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial, mensal, taxa, unidade, periodo, unidadeT]);

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="card rounded-2xl p-5 space-y-4">
          <p className="text-sm font-bold text-foreground">Parâmetros</p>

          <Input label="Valor inicial (R$)" value={inicial} onChange={setInicial} />
          <Input label="Aporte mensal (R$)" value={mensal} onChange={setMensal} />

          <div className="grid grid-cols-2 gap-3">
            <Input label="Taxa (%)" value={taxa} onChange={setTaxa} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Unidade da taxa</label>
              <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
                {(['aa', 'am'] as const).map(u => (
                  <button key={u} onClick={() => setUnidade(u)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      unidade === u ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}>{u === 'aa' ? 'ao ano' : 'ao mês'}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Período" value={periodo} onChange={setPeriodo} />
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Unidade</label>
              <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
                {(['anos', 'meses'] as const).map(u => (
                  <button key={u} onClick={() => setUnidadeT(u)}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      unidadeT === u ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                    }`}>{u === 'anos' ? 'anos' : 'meses'}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <button key={p.l} onClick={() => { setTaxa(String(p.taxa)); setUnidade(p.un as any); }}
                  className="btn-outline px-2.5 py-1.5 text-xs">
                  {p.l} <span className="text-muted-foreground ml-1 tabular">{p.taxa}%</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resultados */}
        <div className="card rounded-2xl p-5">
          <p className="text-sm font-bold text-foreground mb-4">Resultado</p>
          <div className="space-y-3">
            <Linha label="Valor final"      value={fmt(sim.final)}    big />
            <Linha label="Total aportado"   value={fmt(sim.aportado)} />
            <Linha label="Total em juros"   value={fmt(sim.juros)}    color={BRAND} bold />
          </div>

          <div className="h-44 mt-5">
            {sim.linhas.length > 0 ? (
              <GraficoSimulacao data={sim.linhas} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Configure os parâmetros para ver o gráfico.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TAB APORTES
// ─────────────────────────────────────────────────────────────
/**
 * Como cada movimentação se apresenta.
 *
 * ⚠️ PROVENTO NÃO LEVA SINAL DE MENOS. Dividendo, JCP e aluguel são dinheiro
 * ENTRANDO no bolso — a posição não diminui. Já resgate e come-cotas tiram, e
 * por isso vêm com "−". Confundir os dois faria a pessoa ler um dividendo
 * recebido como perda.
 */
function estiloMovimento(tipo?: string) {
  if (tipo === 'resgate')  return { Icone: ArrowDownRight, cor: '#f97316', rotulo: 'Resgate',  sinal: '−' };
  if (tipo === 'provento') return { Icone: Coins,          cor: '#22c55e', rotulo: 'Provento', sinal: '+' };
  if (tipo === 'imposto')  return { Icone: Landmark,       cor: '#ef4444', rotulo: 'Imposto',  sinal: '−' };
  return { Icone: ArrowUpRight, cor: 'hsl(var(--fg))', rotulo: 'Aporte', sinal: '' };
}

function TabAportes({ aportes, invs, onAportar, onResgatar }: {
  aportes: any[]; invs: any[];
  onAportar: () => void; onResgatar: () => void;
}) {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  const anoAtual = String(hoje.getFullYear());

  // ⚠️ SÓ APORTE ENTRA NA SOMA DE "QUANTO EU APORTEI".
  // Resgate é saída; provento (dividendo, JCP, aluguel, juros) é dinheiro que
  // SAIU do ativo pro bolso; come-cotas é imposto. Nenhum dos três é aporte —
  // somá-los aqui infla o "aportado no ano" e, pior, faria cada dividendo
  // recebido parecer dinheiro novo colocado.
  // Antes da migration 122 nada tinha `tipo`, e aí tudo conta como aporte —
  // que é exatamente o que era antes, então não há regressão.
  const soAportes = aportes.filter((a) => !a.tipo || a.tipo === 'aporte');
  const totalMes = soAportes.filter(a => a.data?.startsWith(mesAtual)).reduce((s, a) => s + (a.valor || 0), 0);
  const totalAno = soAportes.filter(a => a.data?.startsWith(anoAtual)).reduce((s, a) => s + (a.valor || 0), 0);
  const meses = new Set(soAportes.filter(a => a.data?.startsWith(anoAtual)).map(a => a.data.slice(0, 7)));
  const aporteMedio = meses.size > 0 ? totalAno / meses.size : 0;
  const proventosAno = aportes
    .filter(a => a.tipo === 'provento' && a.data?.startsWith(anoAtual))
    .reduce((s, a) => s + (a.valor || 0), 0);
  const temInvs = invs.length > 0;

  return (
    <div className="space-y-4 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Aportado no mês" value={fmt(totalMes)} />
        <Stat label="Aportado no ano" value={fmt(totalAno)} />
        <Stat label="Média mensal"    value={fmt(aporteMedio)} />
        {/* Proventos ficam num card SEPARADO, nunca somados ao aporte: é
            dinheiro que o ativo te pagou, não dinheiro que você colocou. */}
        <Stat label="Proventos no ano" value={fmt(proventosAno)} subColor="#22c55e"
              sub={proventosAno > 0 ? 'dividendos, JCP e juros' : undefined} />
      </div>

      {/* Aporte e resgate — as duas ações que o usuário não achava no painel. */}
      <div className="flex flex-wrap gap-2">
        <button onClick={onAportar} disabled={!temInvs}
          className="inline-flex items-center gap-2 px-4 rounded-xl text-sm font-bold text-white shadow-glow-sm disabled:opacity-40 transition active:scale-[0.99]"
          style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)`, minHeight: 44 }}>
          <ArrowUpRight size={16} /> Novo aporte
        </button>
        <button onClick={onResgatar} disabled={!temInvs}
          className="inline-flex items-center gap-2 px-4 rounded-xl text-sm font-bold border border-border text-foreground hover:bg-muted/60 disabled:opacity-40 transition active:scale-[0.99]"
          style={{ minHeight: 44 }}>
          <ArrowDownRight size={16} /> Resgatar
        </button>
        {!temInvs && (
          <p className="text-[12px] text-muted-foreground self-center">
            Cadastre um investimento primeiro.
          </p>
        )}
      </div>

      {aportes.length === 0 ? (
        <div className="card rounded-3xl py-16 flex flex-col items-center text-center px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
               style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
            <Coins size={26} style={{ color: BRAND }} />
          </div>
          <p className="text-base font-bold text-foreground">Nenhuma movimentação ainda</p>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md">
            Use <strong className="text-foreground">Novo aporte</strong> pra adicionar dinheiro a um
            investimento que já existe, ou <strong className="text-foreground">Resgatar</strong> pra tirar.
            Também dá pra fazer pelo WhatsApp: <em>&ldquo;comprei 10 PETR4 a 35&rdquo;</em>.
          </p>
        </div>
      ) : (
        <div className="card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/20">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left px-4 py-3 font-bold">Data</th>
                <th className="text-left px-4 py-3 font-bold">Investimento</th>
                <th className="text-left px-4 py-3 font-bold">Descrição</th>
                <th className="text-right px-4 py-3 font-bold">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {aportes.map((a, i) => {
                const inv = invs.find(x => x.id === a.investimento_id);
                const m = estiloMovimento(a.tipo);
                return (
                  <tr key={a.id || i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground tabular">{fmtDataBR(a.data, { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {/* Ícone + rótulo, nunca só cor — a linha precisa ser
                          legível em preto e branco e por quem não distingue
                          verde de laranja. */}
                      <span className="inline-flex items-center gap-1.5">
                        <m.Icone size={13} className="shrink-0" style={{ color: m.cor }} aria-hidden="true" />
                        {a.nomeInv || a.investimentos?.nome || inv?.nome || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="font-semibold" style={{ color: m.cor }}>{m.rotulo}</span>
                      {/* O que o BANCO chamou a movimentação — "DIVIDENDOS",
                          "COME_COTAS". Explica a linha melhor que qualquer
                          rótulo nosso, e some quando é lançamento à mão. */}
                      {a.operacao && a.operacao !== 'OUTROS' && (
                        <span className="text-[10px] uppercase tracking-wider ml-1.5 opacity-70">
                          {String(a.operacao).replace(/_/g, ' ').toLowerCase()}
                        </span>
                      )}
                      {a.descricao && <> · {a.descricao}</>}
                      {/* De onde veio: sem isto, aporte do banco e aporte
                          digitado ficam indistinguíveis, e a pessoa não sabe
                          qual pode corrigir. */}
                      {a.origem === 'of' && (
                        <span className="text-[9px] uppercase tracking-wider ml-1.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          banco
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular" style={{ color: m.cor }}>
                      {m.sinal}{fmt(a.valor || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function Stat({ label, value, sub, color, subColor }: { label: string; value: string; sub?: string; color?: string; subColor?: string }) {
  return (
    <div className="card rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">{label}</p>
      <p className="text-xl font-bold tabular tracking-tight truncate" style={{ color: color || 'hsl(var(--fg))' }}>{value}</p>
      {sub && <p className="text-xs font-semibold mt-0.5 tabular" style={{ color: subColor || 'hsl(var(--fg-muted))' }}>{sub}</p>}
    </div>
  );
}

function DarkStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-base font-bold tabular mt-0.5${color ? '' : ' text-foreground'}`} style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">{label}</label>
      <input type="text" inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} className="input tabular text-right" />
    </div>
  );
}

function Linha({ label, value, big, bold, color }: { label: string; value: string; big?: boolean; bold?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`tabular ${big ? 'text-2xl' : 'text-sm'} ${bold ? 'font-bold' : 'font-semibold'}`}
            style={{ color: color || 'hsl(var(--fg))' }}>{value}</span>
    </div>
  );
}
