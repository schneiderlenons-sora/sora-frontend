'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ArrowLeft, Calendar, Loader2, Search, ChevronLeft, ChevronRight,
  X, ArrowUpRight, ArrowDownRight, AlertTriangle, CreditCard, Mail,
  User, FileText, Tag, Building2, Filter, Download,
} from 'lucide-react';

const BRAND = '#61ce70';
const RED   = '#ef4444';
const PAGE  = 25;

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

const TIPO_LABEL: Record<string, { label: string; cor: string; icon: any }> = {
  venda:                   { label: 'Venda',          cor: BRAND, icon: ArrowUpRight },
  assinatura_renovacao:    { label: 'Renovação',      cor: BRAND, icon: ArrowUpRight },
  reembolso:               { label: 'Reembolso',      cor: RED,   icon: ArrowDownRight },
  chargeback:              { label: 'Chargeback',     cor: RED,   icon: AlertTriangle },
  assinatura_cancelamento: { label: 'Cancelamento',   cor: '#fbbf24', icon: X },
  comissao_afiliado:       { label: 'Comissão',       cor: '#94a3b8', icon: ArrowDownRight },
};

const MES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const periodoLabel = (iso: string) => {
  const [a, m] = iso.split('-');
  return `${MES_NOMES[parseInt(m) - 1]} ${a}`;
};

const fmt = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);
const dataBr = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const dataHoraBr = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function VendasPage() {
  const { isBlack, phone } = useAuth();
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [tipo, setTipo]       = useState('');
  const [plataforma, setPlataforma] = useState('');
  const [busca, setBusca]     = useState('');
  const [page, setPage]       = useState(0);

  const [eventos, setEventos] = useState<any[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);

  const [detalhe, setDetalhe] = useState<any>(null);

  async function carregar() {
    if (!phone || !isBlack) return;
    setLoading(true);
    try {
      const { eventos, total } = await api.negocios.eventos.listar(phone, {
        limit: PAGE,
        offset: page * PAGE,
        tipo: tipo || undefined,
        plataforma: plataforma || undefined,
        periodo,
      });
      setEventos(eventos);
      setTotal(total);
    } catch { setEventos([]); setTotal(0); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [phone, isBlack, periodo, tipo, plataforma, page]);
  useEffect(() => { setPage(0); }, [periodo, tipo, plataforma]);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return eventos;
    const q = busca.toLowerCase();
    return eventos.filter(e =>
      e.produto_nome?.toLowerCase().includes(q) ||
      e.comprador_nome?.toLowerCase().includes(q) ||
      e.comprador_email?.toLowerCase().includes(q) ||
      e.ref_externa?.toLowerCase().includes(q)
    );
  }, [eventos, busca]);

  const opcoesPeriodo = useMemo(() => {
    const out: { v: string; label: string }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const v = d.toISOString().slice(0, 7);
      out.push({ v, label: periodoLabel(v + '-01') });
    }
    return out;
  }, []);

  const totalPages = Math.ceil(total / PAGE);

  if (!isBlack) {
    return <DashboardLayout><div className="max-w-md mx-auto pt-20 px-6 text-center">
      <p className="text-sm text-muted-foreground">Disponível no plano Black.</p>
    </div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-24 space-y-5">

        {/* HEADER */}
        <div className="animate-fade-in">
          <Link href="/negocios" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft size={13} /> Voltar para Negócios
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Vendas</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lista completa de eventos capturados das suas plataformas.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Total no período</p>
              <p className="text-lg font-bold tabular-nums">{total}</p>
            </div>
          </div>
        </div>

        {/* FILTROS */}
        <div className="rounded-2xl border border-border bg-card p-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <div className="flex flex-wrap items-center gap-2">
            {/* Período */}
            <div className="relative">
              <select value={periodo} onChange={e => setPeriodo(e.target.value)}
                      className="appearance-none cursor-pointer pl-8 pr-7 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-muted/60">
                {opcoesPeriodo.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
              <Calendar size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </div>

            {/* Tipo */}
            <select value={tipo} onChange={e => setTipo(e.target.value)}
                    className="cursor-pointer px-3 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-muted/60">
              <option value="">Todos tipos</option>
              <option value="venda">Vendas</option>
              <option value="assinatura_renovacao">Renovações</option>
              <option value="reembolso">Reembolsos</option>
              <option value="chargeback">Chargebacks</option>
              <option value="assinatura_cancelamento">Cancelamentos</option>
            </select>

            {/* Plataforma */}
            <select value={plataforma} onChange={e => setPlataforma(e.target.value)}
                    className="cursor-pointer px-3 py-2 rounded-xl text-xs font-semibold bg-card border border-border hover:bg-muted/60">
              <option value="">Todas plataformas</option>
              {Object.entries(NOME_PLAT).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
              ))}
            </select>

            {/* Busca */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Produto, comprador, email..."
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-card border border-border focus:outline-none focus:border-foreground/40"
              />
            </div>

            {(tipo || plataforma || busca) && (
              <button onClick={() => { setTipo(''); setPlataforma(''); setBusca(''); }}
                      className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Limpar filtros
              </button>
            )}
          </div>
        </div>

        {/* LISTA */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden animate-fade-in" style={{ animationDelay: '120ms' }}>
          {loading ? (
            <div className="py-20 flex justify-center">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-16 text-center px-6">
              <Filter size={20} className="text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-foreground">Nenhuma venda encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ajuste os filtros ou conecte uma plataforma em <Link href="/negocios/integracoes" className="font-bold hover:underline" style={{ color: BRAND }}>Integrações</Link>.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtrados.map(e => <LinhaEvento key={e.id} evento={e} onClick={() => setDetalhe(e)} />)}
            </ul>
          )}
        </div>

        {/* PAGINAÇÃO */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              Página {page + 1} de {totalPages} · {total} eventos
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border disabled:opacity-40 hover:bg-muted/60">
                <ChevronLeft size={12} /> Anterior
              </button>
              <button onClick={() => setPage(p => p + 1)}
                      disabled={page + 1 >= totalPages}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-card border border-border disabled:opacity-40 hover:bg-muted/60">
                Próxima <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}

      </div>

      {detalhe && <ModalDetalhe evento={detalhe} onClose={() => setDetalhe(null)} />}
    </DashboardLayout>
  );
}

function LinhaEvento({ evento, onClick }: { evento: any; onClick: () => void }) {
  const tipo = TIPO_LABEL[evento.tipo] || { label: evento.tipo, cor: '#94a3b8', icon: ArrowUpRight };
  const Icon = tipo.icon;
  const corPlat = CORES_PLAT[evento.plataforma] || '#94a3b8';
  const negativo = evento.tipo === 'reembolso' || evento.tipo === 'chargeback';

  return (
    <li>
      <button onClick={onClick}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
        {/* Ícone tipo */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: `${tipo.cor}15` }}>
          <Icon size={14} style={{ color: tipo.cor }} />
        </div>

        {/* Produto + comprador */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {evento.produto_nome || 'Produto sem nome'}
            </p>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
                  style={{ background: `${corPlat}15`, color: corPlat }}>
              <span className="w-1 h-1 rounded-full" style={{ background: corPlat }} />
              {NOME_PLAT[evento.plataforma] || evento.plataforma}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {evento.comprador_nome || 'Comprador'} · {dataHoraBr(evento.data_evento)}
          </p>
        </div>

        {/* Valor */}
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold tabular-nums" style={{ color: negativo ? RED : 'inherit' }}>
            {negativo ? '-' : ''}{fmt(Math.abs(evento.valor_liquido || evento.valor_bruto))}
          </p>
          <p className="text-[10px] text-muted-foreground">{tipo.label}</p>
        </div>

        <ChevronRight size={14} className="text-muted-foreground/50 flex-shrink-0" />
      </button>
    </li>
  );
}

function ModalDetalhe({ evento, onClose }: { evento: any; onClose: () => void }) {
  const tipo = TIPO_LABEL[evento.tipo] || { label: evento.tipo, cor: '#94a3b8', icon: ArrowUpRight };
  const corPlat = CORES_PLAT[evento.plataforma] || '#94a3b8';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: `${tipo.cor}15` }}>
            <tipo.icon size={16} style={{ color: tipo.cor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground tracking-tight">{tipo.label}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dataHoraBr(evento.data_evento)} · ref {evento.ref_externa}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">

          {/* Valor + plataforma */}
          <div className="rounded-2xl bg-muted/30 border border-border p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Valor líquido</p>
            <p className="text-3xl font-bold tabular-nums tracking-tight" style={{ color: tipo.cor }}>
              {fmt(evento.valor_liquido || 0)}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: `${corPlat}15`, color: corPlat }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: corPlat }} />
                {NOME_PLAT[evento.plataforma] || evento.plataforma}
              </span>
              <span className="text-[10px] text-muted-foreground">· {evento.recorrencia || 'avulsa'}</span>
            </div>
          </div>

          {/* Breakdown financeiro */}
          <Secao titulo="Breakdown financeiro">
            <Item label="Valor bruto"        valor={evento.valor_bruto} />
            {evento.taxa_plataforma > 0 && <Item label="Taxa plataforma"   valor={-evento.taxa_plataforma} negativo />}
            {evento.taxa_gateway   > 0 && <Item label="Taxa gateway"        valor={-evento.taxa_gateway}    negativo />}
            {evento.imposto        > 0 && <Item label="Imposto retido"      valor={-evento.imposto}         negativo />}
            {evento.comissao_afiliado > 0 && <Item label="Comissão afiliado" valor={-evento.comissao_afiliado} negativo />}
            <Item label="Líquido" valor={evento.valor_liquido} destaque />
          </Secao>

          {/* Produto */}
          <Secao titulo="Produto">
            <Linha icon={Tag}   label="Nome"  valor={evento.produto_nome || '—'} />
            {evento.oferta && <Linha icon={FileText} label="Oferta" valor={evento.oferta} />}
            {evento.produto_id_externo && <Linha icon={FileText} label="ID externo" valor={evento.produto_id_externo} />}
          </Secao>

          {/* Comprador */}
          {(evento.comprador_nome || evento.comprador_email) && (
            <Secao titulo="Comprador">
              {evento.comprador_nome  && <Linha icon={User}  label="Nome"  valor={evento.comprador_nome} />}
              {evento.comprador_email && <Linha icon={Mail}  label="Email" valor={evento.comprador_email} />}
              {evento.comprador_doc   && <Linha icon={FileText} label="CPF/CNPJ" valor={evento.comprador_doc} />}
            </Secao>
          )}

          {/* Afiliado */}
          {evento.afiliado_nome && (
            <Secao titulo="Afiliado">
              <Linha icon={Building2} label="Nome" valor={evento.afiliado_nome} />
              {evento.comissao_afiliado > 0 && <Linha icon={CreditCard} label="Comissão" valor={fmt(evento.comissao_afiliado)} />}
            </Secao>
          )}

          {/* Status + meta */}
          <Secao titulo="Status">
            <Linha icon={FileText} label="Status" valor={evento.status} />
            {evento.assinatura_id && <Linha icon={FileText} label="Assinatura" valor={evento.assinatura_id} />}
            <Linha icon={FileText} label="Capturado em" valor={dataHoraBr(evento.data_capturada)} />
          </Secao>
        </div>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{titulo}</p>
      <div className="rounded-xl bg-muted/20 border border-border/60 divide-y divide-border/40">
        {children}
      </div>
    </div>
  );
}

function Item({ label, valor, negativo, destaque }: { label: string; valor: number; negativo?: boolean; destaque?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 ${destaque ? 'bg-foreground/[0.03]' : ''}`}>
      <span className={`text-xs ${destaque ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>{label}</span>
      <span className={`text-xs font-semibold tabular-nums ${destaque ? 'text-foreground' : ''}`}
            style={{ color: negativo ? RED : (destaque ? BRAND : undefined) }}>
        {valor < 0 ? '-' : ''}{fmt(Math.abs(valor))}
      </span>
    </div>
  );
}

function Linha({ icon: Icon, label, valor }: { icon: any; label: string; valor: string }) {
  return (
    <div className="flex items-start gap-2.5 px-3 py-2">
      <Icon size={11} className="text-muted-foreground mt-0.5 flex-shrink-0" />
      <span className="text-[10px] text-muted-foreground flex-shrink-0 w-20">{label}</span>
      <span className="text-xs text-foreground flex-1 break-words">{valor}</span>
    </div>
  );
}
