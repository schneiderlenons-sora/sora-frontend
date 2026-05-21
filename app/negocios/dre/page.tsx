'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ArrowLeft, ChevronRight, Calendar, Loader2, Download, RefreshCw,
} from 'lucide-react';

const BRAND = '#61ce70';
const RED   = '#ef4444';

const NOME_PLAT: Record<string, string> = {
  hotmart: 'Hotmart', kiwify: 'Kiwify', eduzz: 'Eduzz',
  stripe: 'Stripe', mercadopago: 'Mercado Pago',
  asaas: 'Asaas', pagseguro: 'PagSeguro',
  shopify: 'Shopify', woocommerce: 'WooCommerce',
};
const CORES_PLAT: Record<string, string> = {
  hotmart: '#f04e23', kiwify: '#0066ff', eduzz: '#ff6b00',
  stripe: '#635bff', mercadopago: '#00b1ea',
  asaas: '#1e7d8c', pagseguro: '#fdb022',
  shopify: '#95bf47', woocommerce: '#7f54b3',
};
const CAT_LABEL: Record<string, { label: string; emoji: string }> = {
  trafego_pago: { label: 'Tráfego pago', emoji: '📣' },
  ferramentas:  { label: 'Ferramentas',  emoji: '🛠️' },
  equipe:       { label: 'Equipe',       emoji: '👥' },
  assinaturas:  { label: 'Assinaturas',  emoji: '🔁' },
  mentoria:     { label: 'Mentoria',     emoji: '🎓' },
  infra:        { label: 'Infraestrutura', emoji: '🖥️' },
  operacional:  { label: 'Operacional',  emoji: '📦' },
  outros:       { label: 'Outros',       emoji: '✨' },
};

const MES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const periodoLabel = (iso: string) => {
  const [a, m] = iso.split('-');
  return `${MES_NOMES[parseInt(m) - 1]} ${a}`;
};

const fmt = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);

type Tipo = 'positivo' | 'negativo' | 'neutro' | 'total';

export default function DreDetalhadoPage() {
  const { isBlack, phone } = useAuth();
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [dre, setDre]         = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  async function carregar() {
    if (!phone || !isBlack) return;
    setLoading(true);
    try { setDre(await api.negocios.dre.detalhado(phone, periodo)); }
    catch { setDre(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [phone, isBlack, periodo]);

  function toggle(key: string) {
    setExpandidos(s => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

  const opcoesPeriodo = useMemo(() => {
    const out: { v: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const v = d.toISOString().slice(0, 7);
      out.push({ v, label: periodoLabel(v + '-01') });
    }
    return out;
  }, []);

  if (!isBlack) {
    return <DashboardLayout><div className="max-w-md mx-auto pt-20 px-6 text-center">
      <p className="text-sm text-muted-foreground">Disponível no plano Black.</p>
    </div></DashboardLayout>;
  }

  if (loading || !dre) {
    return <DashboardLayout><div className="max-w-7xl mx-auto pt-20 flex justify-center">
      <Loader2 size={20} className="animate-spin text-muted-foreground" />
    </div></DashboardLayout>;
  }

  // Linhas do DRE detalhado
  const linhas: Array<{
    key: string; label: string; valor: number; tipo: Tipo;
    breakdown?: { plataforma?: string; categoria?: string; valor: number; meta?: string }[];
    indent?: number;
  }> = [
    { key: 'rec_bruta', label: 'Receita bruta',         valor: dre.receita_bruta.total,    tipo: 'total',
      breakdown: dre.receita_bruta.por_plataforma },
    { key: 'taxa_plat', label: '(-) Taxas plataforma',  valor: -dre.taxas_plataforma.total, tipo: 'negativo',
      breakdown: dre.taxas_plataforma.por_plataforma },
    { key: 'taxa_gw',   label: '(-) Taxas gateway',     valor: -dre.taxas_gateway.total,    tipo: 'negativo',
      breakdown: dre.taxas_gateway.por_plataforma },
    { key: 'refund',    label: '(-) Reembolsos',        valor: -dre.reembolsos.total,       tipo: 'negativo',
      breakdown: dre.reembolsos.por_plataforma },
    { key: 'cb',        label: '(-) Chargebacks',       valor: -dre.chargebacks.total,      tipo: 'negativo',
      breakdown: dre.chargebacks.por_plataforma },
    { key: 'comissoes', label: '(-) Comissões afiliados', valor: -dre.comissoes.total,      tipo: 'negativo',
      breakdown: dre.comissoes.por_plataforma },
    { key: 'imp',       label: '(-) Impostos',          valor: -dre.impostos.total,         tipo: 'negativo',
      breakdown: [
        { categoria: 'Retido na origem',  valor: dre.impostos.retido_origem, meta: 'plataforma já reteve' },
        { categoria: `Reserva (${dre.impostos.aliquota_aplicada}% Simples)`, valor: dre.impostos.reserva_simples, meta: 'separado p/ DAS' },
      ].filter(x => x.valor > 0),
    },
    { key: 'rec_liq',   label: 'Receita líquida',       valor: dre.receita_liquida.total,   tipo: 'total',
      breakdown: dre.receita_liquida.por_plataforma },
    { key: 'custos',    label: '(-) Custos operacionais', valor: -dre.custos.total,         tipo: 'negativo',
      breakdown: dre.custos.por_categoria.map((c: any) => ({
        categoria: CAT_LABEL[c.categoria]?.label || c.categoria,
        valor: c.total,
        meta: `${c.itens.length} ${c.itens.length === 1 ? 'item' : 'itens'}`,
      })) },
    { key: 'lucro',     label: 'LUCRO LÍQUIDO',         valor: dre.lucro_liquido,           tipo: 'total' },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-24 space-y-6">

        {/* HEADER */}
        <div className="animate-fade-in">
          <Link href="/negocios" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft size={13} /> Voltar para Negócios
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DRE detalhado</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Demonstração de Resultado do Exercício · {periodoLabel(dre.periodo)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select value={periodo} onChange={e => setPeriodo(e.target.value)}
                        className="appearance-none cursor-pointer pl-9 pr-9 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-muted/60 transition-colors">
                  {opcoesPeriodo.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
                </select>
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              </div>
              <button onClick={carregar}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-muted/60">
                <RefreshCw size={13} /> Atualizar
              </button>
            </div>
          </div>
        </div>

        {/* Resumo da margem */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <KpiCard label="Receita bruta"    valor={fmt(dre.receita_bruta.total)} />
          <KpiCard label="Lucro líquido"    valor={fmt(dre.lucro_liquido)} accent={BRAND} />
          <KpiCard label="Margem"            valor={`${dre.margem_pct.toFixed(1)}%`} />
        </div>

        {/* DRE expansível */}
        <div className="rounded-3xl border border-border bg-card overflow-hidden animate-fade-in" style={{ animationDelay: '120ms' }}>
          {linhas.map(linha => {
            const exp = expandidos.has(linha.key);
            const tem = (linha.breakdown?.length || 0) > 0;
            const cor = linha.tipo === 'negativo' ? RED
                      : linha.tipo === 'total'    ? BRAND
                      : 'inherit';
            const fundoTotal = linha.tipo === 'total' ? 'bg-foreground/[0.03]' : '';

            return (
              <div key={linha.key} className={`border-b border-border/60 last:border-0 ${fundoTotal}`}>
                <button
                  onClick={() => tem && toggle(linha.key)}
                  disabled={!tem}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 transition-colors ${
                    tem ? 'hover:bg-muted/30 cursor-pointer' : 'cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {tem ? (
                      <ChevronRight size={14}
                                    className={`text-muted-foreground transition-transform ${exp ? 'rotate-90' : ''}`} />
                    ) : (
                      <span className="w-[14px]" />
                    )}
                    <span className={`text-sm tabular-nums truncate ${
                      linha.tipo === 'total' ? 'font-bold' : 'text-muted-foreground'
                    } ${linha.key === 'lucro' ? 'uppercase text-xs tracking-wider' : ''}`}>
                      {linha.label}
                    </span>
                  </div>
                  <span className={`font-bold tabular-nums tracking-tight flex-shrink-0 ${
                    linha.key === 'lucro' ? 'text-2xl' : 'text-sm'
                  }`} style={{ color: cor }}>
                    {linha.valor < 0 ? '-' : ''}{fmt(Math.abs(linha.valor))}
                  </span>
                </button>

                {exp && tem && (
                  <div className="bg-muted/20 border-t border-border/40">
                    {linha.breakdown!.map((b, i) => {
                      const nome = b.plataforma ? (NOME_PLAT[b.plataforma] || b.plataforma)
                                                : (b.categoria || 'Item');
                      const corDot = b.plataforma ? (CORES_PLAT[b.plataforma] || '#94a3b8') : '#94a3b8';
                      return (
                        <div key={i} className="flex items-center justify-between px-12 py-2 hover:bg-muted/30 transition-colors">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: corDot }} />
                            <span className="text-xs font-medium text-foreground truncate">{nome}</span>
                            {b.meta && (
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">· {b.meta}</span>
                            )}
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-foreground flex-shrink-0">
                            {linha.tipo === 'negativo' ? '-' : ''}{fmt(b.valor)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Dica */}
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 animate-fade-in" style={{ animationDelay: '180ms' }}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Como ler o DRE</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
            <li>· <strong className="text-foreground">Receita bruta</strong>: total faturado antes de qualquer dedução</li>
            <li>· <strong className="text-foreground">Receita líquida</strong>: o que sobra depois de taxas, reembolsos, chargebacks, comissões e imposto</li>
            <li>· <strong className="text-foreground">Lucro líquido</strong>: receita líquida menos custos operacionais (tráfego, ferramentas, equipe)</li>
            <li>· Clique em qualquer linha pra ver detalhamento por plataforma ou categoria</li>
          </ul>
        </div>

      </div>
    </DashboardLayout>
  );
}

function KpiCard({ label, valor, accent }: { label: string; valor: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight mt-1" style={{ color: accent }}>{valor}</p>
    </div>
  );
}
