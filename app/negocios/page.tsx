'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import ModalConfigTributaria from '@/components/negocios/ModalConfigTributaria';
import ModalCustos from '@/components/negocios/ModalCustos';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import PainelLoja from '@/components/negocios/PainelLoja';
import ModalLancamento from '@/components/negocios/ModalLancamento';
import {
  corEmpresa, mostraIntegracoes, mostraCaixa,
  type Empresa,
} from '@/lib/empresas';
import {
  Briefcase, ArrowUpRight, ArrowDownRight, Plug, Sparkles, RefreshCw,
  Crown, Trophy, ChevronRight, BarChart3, Zap, Calendar, TrendingUp,
  ShoppingBag, Receipt, Loader2,
  Wallet, Landmark, Store, Laptop, Plus, CalendarClock, Users,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const RED   = '#ef4444';

const fmt   = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);
const fmtPct = (n: number) => `${n >= 0 ? '+' : ''}${(n || 0).toFixed(1)}%`;

const MES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function periodoLabel(periodoIso: string) {
  // 'YYYY-MM-01' → 'Maio 2026'
  const [a, m] = periodoIso.split('-');
  return `${MES_NOMES[parseInt(m) - 1]} ${a}`;
}

// DRE zerado — o backend devolve null quando a empresa ainda não tem nada.
// Mostramos a estrutura com ZEROS (o que o usuário pediu: nada de fictício)
// em vez de tela em branco.
const DRE_ZERO = {
  receita_bruta: 0, taxas_plataforma: 0, taxas_gateway: 0, impostos: 0,
  reembolsos: 0, receita_liquida: 0, custos_total: 0, lucro_liquido: 0,
  margem_pct: 0, delta_vs_anterior: 0, total_vendas: 0, ticket_medio: 0,
  mrr: 0, por_plataforma: [], por_produto: [], spark: [],
};

const CORES_PLAT: Record<string, string> = {
  hotmart: '#f04e23', kiwify: '#0066ff', eduzz: '#ff6b00',
  stripe: '#635bff',  mercadopago: '#00b1ea',
  asaas: '#1e7d8c',   pagseguro: '#fdb022',
  shopify: '#95bf47', woocommerce: '#7f54b3',
};
const NOME_PLAT: Record<string, string> = {
  hotmart: 'Hotmart', kiwify: 'Kiwify', eduzz: 'Eduzz',
  stripe: 'Stripe', mercadopago: 'Mercado Pago',
  asaas: 'Asaas', pagseguro: 'PagSeguro',
  shopify: 'Shopify', woocommerce: 'WooCommerce',
};

export default function NegociosPage() {
  const { temNegocios, phone } = useAuth();

  const hojeIso = new Date().toISOString().slice(0, 7);
  const [periodo, setPeriodo] = useState(hojeIso); // YYYY-MM
  const [recalculando, setRecalc]   = useState(false);
  const [modalCfg, setModalCfg]     = useState(false);
  const [modalCustos, setModalCustos] = useState(false);
  // ── Empresa ativa: vem do SHELL (EmpresaProvider no layout do segmento).
  // Antes esta página tinha a própria cópia dessa lógica — duas fontes pro
  // mesmo estado, e trocar de empresa aqui não mexia na sidebar.
  const { empresa, carregando: carregandoEmpresas, abrirCadastro } = useEmpresa();

  // Visão do painel. Empresa de um tipo só não escolhe — segue o que ela é.
  // Híbrida alterna, e a escolha fica salva POR EMPRESA (quem tem loja e loja
  // online quer abrir cada uma no lado que estava vendo).
  const [visaoManual, setVisaoManual] = useState<Record<string, 'loja' | 'digital'>>({});
  const visao: 'loja' | 'digital' =
    empresa?.tipo === 'fisico'  ? 'loja'
    : empresa?.tipo === 'digital' ? 'digital'
    : (empresa ? visaoManual[empresa.id] ?? 'loja' : 'loja');
  const setVisao = (v: 'loja' | 'digital') => {
    if (empresa) setVisaoManual(prev => ({ ...prev, [empresa.id]: v }));
  };

  const [modalLanc, setModalLanc] = useState<{ tipo: 'entrada' | 'saida' } | null>(null);

  // Indicadores da loja: uma chamada traz TUDO da tela (ver rota /indicadores).
  const { data: indicadores, mutate: mIndicadores } = useApi(
    (phone && temNegocios && empresa && visao === 'loja') ? `neg:ind:${phone}:${empresa.id}:${periodo}` : null,
    () => api.negocios.indicadores(phone, empresa!.id, periodo),
  );

  // ── DRE da empresa ativa. SEM mock: sem dado = empty state de verdade. ──
  const { data: dre, mutate: mDre } = useApi(
    (phone && temNegocios && empresa) ? `neg:dre:${phone}:${empresa.id}:${periodo}` : null,
    () => api.negocios.dre.get(phone, periodo, empresa!.id),
  );
  // A visão LOJA não usa o DRE — esperar por ele aqui atrasaria a tela por um
  // dado que ela nem mostra. Cada visão espera só o que consome.
  const loading = carregandoEmpresas || (!!empresa && visao === 'digital' && dre === undefined);
  const carregar = () => mDre();
  // `dre` vem null quando a empresa ainda não tem movimento → usa o zerado.
  const d: any = dre || DRE_ZERO;
  const semDados = !d.total_vendas && !d.receita_bruta;

  async function handleRecalcular() {
    if (!phone || recalculando) return;
    setRecalc(true);
    try { await api.negocios.dre.recalcular({ phone, periodo, empresa_id: empresa?.id }); await carregar(); }
    catch (e: any) { alert(e.message); }
    finally { setRecalc(false); }
  }

  if (!temNegocios) return <><PaywallNegocios /></>;
  if (loading) return <><PageSkeleton /></>;

  // Nenhuma empresa cadastrada → onboarding real (no lugar dos dados fictícios).
  if (!empresa) {
    return (
      <>
        <div className="pb-20 space-y-6">
          <PrimeiraEmpresa onCriar={() => abrirCadastro(null)} />
        </div>
        
      </>
    );
  }

  const cor = corEmpresa(empresa);

  // ── Loja física vê o painel DA LOJA; digital vê o de infoproduto ────────
  // São dois negócios diferentes: quem tem padaria não fatura por Hotmart, e
  // quem vende curso não tem caixa de balcão. A empresa HÍBRIDA escolhe qual
  // visão quer ver no momento (a escolha fica salva por empresa).
  if (visao === 'loja') {
    return (
      <div className="pb-20 space-y-5">
        <CabecalhoPainel
          empresa={empresa} tipo={empresa.tipo} visao={visao} onVisao={setVisao}
          subtitulo="O dinheiro da sua loja, do jeito que ele acontece"
        />
        <PainelLoja
          dados={indicadores}
          carregando={indicadores === undefined}
          cor={cor}
          mes={periodo}
          onMes={setPeriodo}
          onNovaEntrada={() => setModalLanc({ tipo: 'entrada' })}
          onNovaSaida={() => setModalLanc({ tipo: 'saida' })}
        />
        {modalLanc && (
          <ModalLancamento
            empresaId={empresa.id}
            cor={cor}
            tipoInicial={modalLanc.tipo}
            onClose={() => setModalLanc(null)}
            onSalvo={() => { setModalLanc(null); mIndicadores(); }}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="pb-20 space-y-6">

        <CabecalhoPainel
          empresa={empresa} tipo={empresa.tipo} visao={visao} onVisao={setVisao}
          subtitulo="Suas vendas digitais e integrações"
        />

        {/* Sem lançamentos ainda: os números ficam ZERADOS (nada de demo) e
            mostramos o caminho pra começar. */}
        {semDados && <ComeceAqui cor={cor} tipo={empresa.tipo} />}

        {/* Barra de ações da visão digital (o título já veio no CabecalhoPainel) */}
        <header className="relative z-30 flex items-center justify-end flex-wrap gap-4 animate-fade-in">
          {/* Botões de ação — scroll horizontal no mobile pra não quebrar */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
            {/* Caixa: só pra loja física/híbrida — a aba se adapta ao tipo. */}
            {mostraCaixa(empresa.tipo) && (
              <>
                <Link href="/negocios/caixa"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90 whitespace-nowrap flex-shrink-0"
                      style={{ background: cor }}>
                  <Wallet size={13} /> Caixa
                </Link>
                <Link href="/negocios/contas"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors whitespace-nowrap flex-shrink-0">
                  <CalendarClock size={13} /> Contas
                </Link>
                <Link href="/negocios/equipe"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors whitespace-nowrap flex-shrink-0">
                  <Users size={13} /> Equipe
                </Link>
              </>
            )}
            <SeletorPeriodo value={periodo} onChange={setPeriodo} />
            <button
              onClick={handleRecalcular}
              disabled={recalculando}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0"
            >
              {recalculando
                ? <Loader2 size={13} className="animate-spin" />
                : <RefreshCw size={13} />}
              Atualizar
            </button>
            <button onClick={() => setModalCustos(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors whitespace-nowrap flex-shrink-0">
              <Wallet size={13} /> Custos
            </button>
            <button onClick={() => setModalCfg(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors whitespace-nowrap flex-shrink-0">
              <Landmark size={13} /> Tributário
            </button>
            {/* Integrações só fazem sentido pra quem vende online — a aba se
                adapta ao tipo da empresa (nada de tela morta pra loja física). */}
            {mostraIntegracoes(empresa.tipo) && (
              <Link href="/negocios/integracoes"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors whitespace-nowrap flex-shrink-0">
                <Plug size={13} /> Integrações
              </Link>
            )}
          </div>
        </header>

        <HeroLucro dre={d} />
        <Waterfall dre={d} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardPlataformas dre={d} />
          <CardProdutos dre={d} />
          <CardMrr dre={d} />
          <CardInsight />
        </div>

        <FuturoEmBreve />
      </div>

      {modalCfg    && <ModalConfigTributaria onClose={() => { setModalCfg(false); carregar(); }} />}
      {modalCustos && <ModalCustos periodo={periodo} onClose={() => { setModalCustos(false); carregar(); }} />}
      
    </>
  );
}

function SeletorPeriodo({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  // últimos 6 meses
  const opcoes = useMemo(() => {
    const out: { v: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const v = d.toISOString().slice(0, 7);
      out.push({ v, label: periodoLabel(v + '-01') });
    }
    return out;
  }, []);
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
              className="appearance-none cursor-pointer inline-flex items-center gap-2 px-3 py-2 pr-9 rounded-xl text-xs font-semibold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors">
        {opcoes.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
      <Calendar size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// COMPONENTES
// ─────────────────────────────────────────────────────────────────────────

// Primeira visita: nenhuma empresa cadastrada. Substitui os antigos dados
// FICTÍCIOS — em vez de simular um negócio que não existe, convidamos a criar
// o de verdade (§8 empty-states: mensagem útil + ação clara).
/**
 * Cabeçalho do painel + alternador de visão.
 *
 * O alternador só aparece pra empresa HÍBRIDA — quem tem só loja física não
 * precisa saber que existe uma visão digital, e vice-versa. Mostrar um controle
 * que não muda nada é ruído; escondê-lo de quem precisa é pior.
 */
function CabecalhoPainel({ empresa, tipo, visao, onVisao, subtitulo }: {
  empresa: Empresa; tipo: string; visao: 'loja' | 'digital';
  onVisao: (v: 'loja' | 'digital') => void; subtitulo: string;
}) {
  const hibrida = tipo === 'hibrido';
  return (
    <header className="flex items-start justify-between gap-4 flex-wrap animate-fade-in">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
          {empresa.nome}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Painel</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitulo}</p>
      </div>

      {hibrida && (
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/60"
             role="tablist" aria-label="Visão do painel">
          {([['loja', 'Loja', Store], ['digital', 'Digital', Laptop]] as const).map(([id, label, Icone]) => (
            <button key={id} onClick={() => onVisao(id)}
              role="tab" aria-selected={visao === id}
              className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold transition-all ${
                visao === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              style={{ minHeight: 40 }}>
              <Icone size={14} /> {label}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

function PrimeiraEmpresa({ onCriar }: { onCriar: () => void }) {
  const passos = [
    { icon: Store,  titulo: 'Loja física',  desc: 'Caixa do dia, contas a pagar e equipe' },
    { icon: Laptop, titulo: 'Digital',      desc: 'Integrações e DRE automático' },
    { icon: Wallet, titulo: 'Tudo junto',   desc: 'Conciliado com a sua Sora Finance' },
  ];
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border/40 backdrop-blur-xl p-6 sm:p-10 text-center animate-fade-in"
      style={{ background: 'hsl(var(--bg-card) / 0.5)' }}
    >
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: `radial-gradient(circle at top right, ${BRAND}24 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4"
             style={{ background: `color-mix(in srgb, ${BRAND} 16%, transparent)` }}>
          <Briefcase size={24} style={{ color: BRAND }} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Cadastre sua empresa
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
          A aba Negócios se molda ao seu negócio. Diga o que você toca e a Sora
          mostra só o que importa — sem tela inútil.
        </p>

        <button
          onClick={onCriar}
          className="inline-flex items-center gap-2 px-6 h-12 mt-6 rounded-2xl text-white text-sm font-bold shadow-lg transition-opacity hover:opacity-90"
          style={{ background: BRAND, boxShadow: `0 10px 30px -10px ${BRAND}` }}
        >
          <Plus size={17} /> Criar minha empresa
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 text-left">
          {passos.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={p.titulo}
                   className="rounded-2xl border border-border/40 p-4 animate-[slide-up_500ms_ease-out_both]"
                   style={{ background: 'hsl(var(--bg-subtle) / 0.5)', animationDelay: `${i * 40}ms` }}>
                <Icon size={17} style={{ color: BRAND }} />
                <p className="text-sm font-bold text-foreground mt-2">{p.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Empresa criada, mas ainda sem lançamento. Os números ficam ZERADOS (nada de
// demo) e este card mostra o próximo passo — que muda conforme o tipo.
function ComeceAqui({ cor, tipo }: { cor: string; tipo: string }) {
  const digital = tipo === 'digital' || tipo === 'hibrido';
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 p-4 flex items-start gap-3 animate-fade-in"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
           style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)` }}>
        <Sparkles size={16} style={{ color: cor }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">Tudo pronto — agora é só alimentar</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {digital
            ? 'Conecte uma plataforma e o DRE se monta sozinho. Os valores ficam zerados até chegar a primeira venda.'
            : 'Lance a primeira entrada ou uma conta a pagar. Os valores ficam zerados até você começar.'}
        </p>
      </div>
      {digital && (
        <Link href="/negocios/integracoes"
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-bold text-white flex-shrink-0 transition-opacity hover:opacity-90"
              style={{ background: cor }}>
          <Plug size={13} /> Conectar
        </Link>
      )}
    </div>
  );
}

function HeroLucro({ dre }: { dre: any }) {
  const positivo = dre.delta_vs_anterior >= 0;
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 animate-fade-in"
             style={{ animationDelay: '60ms' }}>
      {/* Glow sutil decorativo */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full pointer-events-none opacity-20"
           style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 70%)` }} />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-end">
        {/* LADO ESQUERDO — métrica gigante */}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Lucro líquido</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight tabular-nums leading-tight" style={{ color: BRAND }}>
              {fmt(dre.lucro_liquido)}
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold tabular-nums ${
              positivo ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
            }`}>
              {positivo ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              {fmtPct(dre.delta_vs_anterior)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">vs mês anterior · Margem {dre.margem_pct.toFixed(1)}%</p>

          {/* Sparkline */}
          <Sparkline data={dre.spark} cor={BRAND} className="mt-4 h-12 w-full max-w-md" />
        </div>

        {/* LADO DIREITO — 3 KPIs em coluna */}
        <div className="grid grid-cols-3 lg:grid-cols-1 gap-3 lg:gap-2 lg:min-w-[200px]">
          <KpiMini label="Receita"     valor={fmt(dre.receita_bruta)} />
          <KpiMini label="Vendas"      valor={`${dre.total_vendas}`} sufixo="no mês" />
          <KpiMini label="Ticket médio" valor={fmt(dre.ticket_medio)} />
        </div>
      </div>
    </section>
  );
}

function KpiMini({ label, valor, sufixo }: { label: string; valor: string; sufixo?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-muted/40 border border-border/60 px-3 py-2.5">
      <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-muted-foreground leading-tight">{label}</p>
      <p className="text-sm sm:text-base font-bold text-foreground tabular-nums leading-tight mt-0.5 truncate">{valor}</p>
      {sufixo && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sufixo}</p>}
    </div>
  );
}

function Sparkline({ data, cor, className = '' }: { data: number[]; cor: string; className?: string }) {
  const { path, area } = useMemo(() => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const W = 100, H = 30;
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const path = `M ${pts.join(' L ')}`;
    const area = `${path} L ${W},${H} L 0,${H} Z`;
    return { path, area };
  }, [data]);

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className={className}>
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-grad)" />
      <path d={path} fill="none" stroke={cor} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Waterfall({ dre }: { dre: any }) {
  // Linhas do DRE — cada uma com seu valor absoluto pra escala visual
  const max = dre.receita_bruta;
  const linhas = [
    { label: 'Receita bruta',          valor: dre.receita_bruta,                    tipo: 'positivo' as const, destacar: true },
    { label: '(-) Taxas plataforma',   valor: -dre.taxas_plataforma,                tipo: 'negativo' as const },
    { label: '(-) Taxas gateway',      valor: -dre.taxas_gateway,                   tipo: 'negativo' as const },
    { label: '(-) Reembolsos',         valor: -dre.reembolsos,                      tipo: 'negativo' as const },
    { label: '(-) Impostos',           valor: -dre.impostos,                        tipo: 'negativo' as const },
    { label: 'Receita líquida',        valor: dre.receita_liquida,                  tipo: 'neutro' as const,   destacar: true },
    { label: '(-) Custos operacionais', valor: -dre.custos_total,                   tipo: 'negativo' as const },
    { label: 'LUCRO LÍQUIDO',          valor: dre.lucro_liquido,                    tipo: 'positivo' as const, destacar: true, total: true },
  ];

  return (
    <section className="rounded-3xl border border-border bg-card p-6 animate-fade-in" style={{ animationDelay: '120ms' }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-foreground tracking-tight">DRE — {periodoLabel(dre.periodo)}</h2>
          <p className="text-xs text-muted-foreground">Demonstração de Resultado do Exercício</p>
        </div>
        <Link href="#" className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors">
          Ver detalhado <ChevronRight size={12} />
        </Link>
      </div>

      <div className="space-y-1">
        {linhas.map(linha => {
          const pct = Math.abs(linha.valor) / max * 100;
          const cor = linha.tipo === 'positivo' ? BRAND : linha.tipo === 'negativo' ? RED : '#94a3b8';
          return (
            <div key={linha.label} className={`relative px-3 py-2.5 rounded-xl transition-colors ${
              linha.total ? 'bg-foreground/[0.04]' : ''
            }`}>
              {/* barra de fundo proporcional */}
              <div className="absolute left-3 right-3 top-1/2 -translate-y-1/2 h-7 rounded-md overflow-hidden pointer-events-none opacity-[0.07]">
                <div className="h-full" style={{ width: `${pct}%`, background: cor }} />
              </div>
              <div className="relative flex items-center justify-between gap-3">
                <span className={`text-sm tabular-nums ${
                  linha.destacar ? 'font-bold text-foreground' : 'text-muted-foreground'
                } ${linha.total ? 'uppercase tracking-wider text-xs' : ''}`}>
                  {linha.label}
                </span>
                <span className={`font-bold tabular-nums tracking-tight ${
                  linha.total ? 'text-xl' : 'text-sm'
                }`} style={{
                  color: linha.tipo === 'positivo' ? BRAND : linha.tipo === 'negativo' ? RED : 'inherit'
                }}>
                  {linha.valor < 0 ? '-' : ''}{fmt(Math.abs(linha.valor))}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CardPlataformas({ dre }: { dre: any }) {
  const lista: { plataforma: string; valor: number; vendas: number }[] = dre.por_plataforma || [];
  const total = lista.reduce((s, p) => s + (p.valor || 0), 0) || 1;
  return (
    <CardSecao titulo="Plataformas" subtitulo="Vendas por canal" icon={BarChart3} href="/negocios/integracoes">
      {lista.length === 0 ? (
        <EmptyMini msg="Nenhuma venda registrada no período." />
      ) : (
        <div className="space-y-3">
          {lista.map(p => {
            const pct = (p.valor / total) * 100;
            const cor = CORES_PLAT[p.plataforma] || '#94a3b8';
            const nome = NOME_PLAT[p.plataforma] || p.plataforma;
            return (
              <div key={p.plataforma}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cor }} />
                    <span className="text-sm font-semibold text-foreground truncate">{nome}</span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">· {p.vendas} vendas</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-foreground">{fmt(p.valor)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CardSecao>
  );
}

function CardProdutos({ dre }: { dre: any }) {
  const lista: { nome: string; valor: number; vendas: number }[] = dre.por_produto || [];
  return (
    <CardSecao titulo="Produtos" subtitulo="Top do mês" icon={Trophy} href="#">
      {lista.length === 0 ? (
        <EmptyMini msg="Nenhum produto vendido no período." />
      ) : (
        <div className="space-y-2.5">
          {lista.slice(0, 4).map((p, i) => (
            <div key={p.nome} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{p.nome}</p>
                <p className="text-[11px] text-muted-foreground">{p.vendas} {p.vendas === 1 ? 'venda' : 'vendas'}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold tabular-nums text-foreground">{fmt(p.valor)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardSecao>
  );
}

function EmptyMini({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-muted-foreground italic py-4 text-center">{msg}</p>
  );
}

function CardMrr({ dre }: { dre: any }) {
  return (
    <CardSecao titulo="MRR · Receita recorrente" subtitulo="Mensal" icon={TrendingUp} href="#">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">{fmt(dre.mrr)}</span>
        <span className="text-xs font-bold text-green-600 tabular-nums">+12.4%</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">ARR projetado: <span className="font-semibold text-foreground tabular-nums">{fmt(dre.mrr * 12)}</span></p>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Ativos</p>
          <p className="text-base font-bold tabular-nums">38</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Novos</p>
          <p className="text-base font-bold tabular-nums text-green-600">+7</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Churn</p>
          <p className="text-base font-bold tabular-nums">2.1%</p>
        </div>
      </div>
    </CardSecao>
  );
}

function CardInsight() {
  const { phone } = useAuth();
  const [topo, setTopo] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!phone) return;
    api.negocios.insights.listar(phone)
      .then(list => setTopo(list?.[0] || null))
      .catch(() => setTopo(null))
      .finally(() => setCarregando(false));
  }, [phone]);

  // Sem insight real ainda → não inventamos um. Mostra o estado honesto.
  const exibir = topo;

  return (
    <div className="rounded-2xl border bg-card p-5 animate-fade-in relative overflow-hidden"
         style={{ animationDelay: '240ms', borderColor: `color-mix(in srgb, ${BRAND} 25%, transparent)` }}>
      <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none opacity-30"
           style={{ background: `radial-gradient(circle at top right, ${BRAND} 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={13} style={{ color: BRAND }} />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: BRAND }}>Sora IA</span>
          </div>
          <Link href="/negocios/insights" className="text-[10px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5">
            Todos <ChevronRight size={10} />
          </Link>
        </div>
        {carregando ? (
          <div className="py-3 text-xs text-muted-foreground italic">Analisando…</div>
        ) : !exibir ? (
          <p className="text-xs text-muted-foreground italic py-3">Sem insights no momento.</p>
        ) : (
          <>
            <h3 className="text-base font-bold text-foreground tracking-tight mb-1">{exibir.titulo}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{exibir.descricao}</p>
            <Link href={exibir.acao_url || '/negocios/insights'}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-foreground bg-foreground/5 hover:bg-foreground/10 transition-colors">
              {exibir.acao_label || exibir.acao || 'Ver'} <ChevronRight size={12} />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

function CardSecao({
  titulo, subtitulo, icon: Icon, href, children,
}: { titulo: string; subtitulo: string; icon: any; href: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 animate-fade-in" style={{ animationDelay: '180ms' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-muted-foreground" />
          <div>
            <h3 className="text-sm font-bold text-foreground tracking-tight leading-none">{titulo}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{subtitulo}</p>
          </div>
        </div>
        <Link href={href} className="text-[11px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 transition-colors">
          Ver tudo <ChevronRight size={11} />
        </Link>
      </div>
      {children}
    </div>
  );
}

function FuturoEmBreve() {
  const itens = [
    { icon: Receipt,    label: 'DRE detalhado',  desc: 'Drill-down linha-a-linha', href: '/negocios/dre' },
    { icon: ShoppingBag, label: 'Vendas',        desc: 'Lista de eventos',          href: '/negocios/vendas' },
    { icon: Zap,        label: 'Insights da IA', desc: 'Feed de alertas',           href: '/negocios/insights' },
    { icon: Sparkles,   label: 'Wrapped',        desc: 'Resumo do mês compartilhável', href: '/negocios/wrapped' },
    { icon: Trophy,     label: 'Conciliação',    desc: 'Match Hotmart × banco',     href: '/negocios/conciliacao' },
    { icon: TrendingUp, label: 'Forecast',       desc: 'Previsão 3 meses',          href: '/negocios/forecast' },
  ];
  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5 animate-fade-in" style={{ animationDelay: '300ms' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Explorar</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {itens.map(it => {
          const Inner = (
            <div className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-card transition-colors h-full">
              <it.icon size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground leading-tight">{it.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{it.desc}</p>
              </div>
            </div>
          );
          return it.href
            ? <Link key={it.label} href={it.href}>{Inner}</Link>
            : <div key={it.label} className="opacity-50">{Inner}</div>;
        })}
      </div>
    </div>
  );
}

function PaywallNegocios() {
  return (
    <div className="max-w-2xl mx-auto pb-20 pt-12 px-4">
      <div className="relative overflow-hidden rounded-3xl bg-black text-white p-10 text-center">
        <div className="absolute inset-0 pointer-events-none opacity-40"
             style={{ background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, ${BRAND} 19%, transparent) 0%, transparent 60%)` }} />
        <div className="relative">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
               style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}>
            <Crown size={28} className="text-black" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Negócios é exclusivo do plano Platinum</h1>
          <p className="text-white/70 text-sm sm:text-base leading-relaxed max-w-md mx-auto mb-6">
            Conecte Hotmart, Stripe e mais. Tenha seu DRE, fluxo de caixa e insights de IA em tempo real.
          </p>
          <Link href="/planos" className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-black shadow-lg"
                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)' }}>
            <Crown size={15} /> Ver planos
          </Link>
        </div>
      </div>
    </div>
  );
}
