'use client';

import { useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Plug, Check, Clock, Sparkles, X, Lock, ExternalLink,
  ShieldCheck, RefreshCw, Zap,
} from 'lucide-react';

const BRAND = '#61ce70';

type Status = 'disponivel' | 'em_breve' | 'conectada';
type Plataforma = {
  id: string;
  nome: string;
  categoria: 'Infoprodutos' | 'Pagamentos' | 'E-commerce';
  cor: string;
  descricao: string;
  status: Status;
  destaque?: boolean;
  comoConectar?: string[];
};

const PLATAFORMAS: Plataforma[] = [
  // INFOPRODUTOS — Hotmart é o destaque (primeira integração)
  {
    id: 'hotmart',
    nome: 'Hotmart',
    categoria: 'Infoprodutos',
    cor: '#f04e23',
    descricao: 'Captura vendas, reembolsos, comissões e assinaturas em tempo real.',
    status: 'disponivel',
    destaque: true,
    comoConectar: [
      'Acesse o painel Hotmart → Ferramentas → Webhooks',
      'Crie um novo webhook apontando para a URL da Sora (copiamos pra você no próximo passo)',
      'Cole o token de autenticação aqui',
      'Sincronizamos seus últimos 90 dias automaticamente',
    ],
  },
  { id: 'kiwify', nome: 'Kiwify',  categoria: 'Infoprodutos', cor: '#0066ff', descricao: 'Em breve — integração via API Key.', status: 'em_breve' },
  { id: 'eduzz',  nome: 'Eduzz',   categoria: 'Infoprodutos', cor: '#ff6b00', descricao: 'Em breve — integração via OAuth.', status: 'em_breve' },

  // PAGAMENTOS
  { id: 'stripe',      nome: 'Stripe',         categoria: 'Pagamentos', cor: '#635bff', descricao: 'Em breve — integração via OAuth Stripe Connect.', status: 'em_breve' },
  { id: 'mercadopago', nome: 'Mercado Pago',   categoria: 'Pagamentos', cor: '#00b1ea', descricao: 'Em breve — integração via Access Token.',         status: 'em_breve' },
  { id: 'asaas',       nome: 'Asaas',          categoria: 'Pagamentos', cor: '#1e7d8c', descricao: 'Em breve.',                                       status: 'em_breve' },
  { id: 'pagseguro',   nome: 'PagSeguro',      categoria: 'Pagamentos', cor: '#fdb022', descricao: 'Em breve.',                                       status: 'em_breve' },

  // ECOMMERCE
  { id: 'shopify',    nome: 'Shopify',     categoria: 'E-commerce', cor: '#95bf47', descricao: 'Em breve — App oficial Sora.', status: 'em_breve' },
  { id: 'woocommerce', nome: 'WooCommerce', categoria: 'E-commerce', cor: '#7f54b3', descricao: 'Em breve — plugin WordPress.', status: 'em_breve' },
];

const CATEGORIAS: Plataforma['categoria'][] = ['Infoprodutos', 'Pagamentos', 'E-commerce'];

export default function IntegracoesPage() {
  const { isBlack } = useAuth();
  const [modal, setModal] = useState<Plataforma | null>(null);

  if (!isBlack) return <DashboardLayout><BloqueioBlack /></DashboardLayout>;

  const conectadas = PLATAFORMAS.filter(p => p.status === 'conectada').length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-24 space-y-6">

        {/* HEADER */}
        <div className="animate-fade-in">
          <Link href="/negocios" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-3">
            <ArrowLeft size={13} /> Voltar para Negócios
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Integrações</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conecte suas plataformas e a Sora monta seu DRE automaticamente.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border">
              <div className="w-2 h-2 rounded-full" style={{ background: conectadas > 0 ? BRAND : '#94a3b8' }} />
              <span className="text-xs font-semibold tabular-nums">
                {conectadas} de {PLATAFORMAS.length} conectadas
              </span>
            </div>
          </div>
        </div>

        {/* GARANTIAS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: '60ms' }}>
          <Garantia icon={ShieldCheck} titulo="Credenciais criptografadas"  desc="Tokens nunca expostos no navegador." />
          <Garantia icon={RefreshCw}   titulo="Sincronização contínua"      desc="Webhooks em tempo real + cron a cada 15min." />
          <Garantia icon={Zap}         titulo="Histórico inicial completo"   desc="Importamos seus últimos 90 dias na conexão." />
        </div>

        {/* GRID POR CATEGORIA */}
        {CATEGORIAS.map((cat, idx) => {
          const grupo = PLATAFORMAS.filter(p => p.categoria === cat);
          return (
            <section key={cat} className="space-y-3 animate-fade-in" style={{ animationDelay: `${120 + idx * 60}ms` }}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{cat}</h2>
                <span className="text-[10px] text-muted-foreground tabular-nums">{grupo.length} plataformas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grupo.map(p => (
                  <CardPlataforma key={p.id} p={p} onClick={() => setModal(p)} />
                ))}
              </div>
            </section>
          );
        })}

      </div>

      {modal && <ModalConectar plataforma={modal} onClose={() => setModal(null)} />}
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function CardPlataforma({ p, onClick }: { p: Plataforma; onClick: () => void }) {
  const disponivel = p.status === 'disponivel';
  const conectada  = p.status === 'conectada';

  return (
    <button
      onClick={onClick}
      disabled={p.status === 'em_breve'}
      className={`
        relative text-left rounded-2xl border bg-card p-4 transition-all
        ${disponivel ? 'border-border hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''}
        ${conectada ? 'border-green-500/40' : ''}
        ${p.status === 'em_breve' ? 'border-dashed border-border opacity-60 cursor-not-allowed' : ''}
        ${p.destaque ? 'ring-1 ring-offset-2 ring-offset-background' : ''}
      `}
      style={p.destaque ? { '--tw-ring-color': BRAND } as any : undefined}
    >
      {/* Destaque badge */}
      {p.destaque && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ background: BRAND }}>
          Recomendado
        </span>
      )}

      <div className="flex items-start gap-3 mb-3">
        {/* "Logo" sintético — círculo com inicial colorida (até termos SVGs oficiais) */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-base shadow-sm"
             style={{ background: `linear-gradient(135deg, ${p.cor} 0%, ${escurecer(p.cor)} 100%)` }}>
          {p.nome.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground tracking-tight">{p.nome}</h3>
          <StatusPill status={p.status} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed min-h-[2.5em]">{p.descricao}</p>

      {disponivel && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold transition-colors" style={{ color: BRAND }}>
          <Plug size={11} /> Conectar
        </div>
      )}
      {conectada && (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-600">
          <Check size={11} /> Conectada
        </div>
      )}
    </button>
  );
}

function StatusPill({ status }: { status: Status }) {
  if (status === 'conectada') {
    return (
      <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold uppercase tracking-wider text-green-600">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Ativa
      </span>
    );
  }
  if (status === 'em_breve') {
    return (
      <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <Clock size={9} /> Em breve
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold uppercase tracking-wider" style={{ color: BRAND }}>
      <Sparkles size={9} /> Disponível
    </span>
  );
}

function Garantia({ icon: Icon, titulo, desc }: { icon: any; titulo: string; desc: string }) {
  return (
    <div className="rounded-2xl bg-muted/30 border border-border/60 p-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0">
        <Icon size={14} style={{ color: BRAND }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground leading-tight">{titulo}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// MODAL DE CONEXÃO
// ─────────────────────────────────────────────────────────────────────────

function ModalConectar({ plataforma, onClose }: { plataforma: Plataforma; onClose: () => void }) {
  const [token, setToken] = useState('');
  const [enviando, setEnviando] = useState(false);
  const disponivel = plataforma.status === 'disponivel';

  async function handleConectar() {
    if (!token.trim()) return;
    setEnviando(true);
    // TODO Fase 2: await api.negocios.integracoes.conectar({ plataforma: plataforma.id, token })
    setTimeout(() => {
      setEnviando(false);
      alert('Conexão real virá na Fase 2. Schema, UI e fluxo já estão prontos.');
      onClose();
    }, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg shadow-sm"
               style={{ background: `linear-gradient(135deg, ${plataforma.cor} 0%, ${escurecer(plataforma.cor)} 100%)` }}>
            {plataforma.nome.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-foreground tracking-tight">Conectar {plataforma.nome}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{plataforma.categoria}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {!disponivel ? (
            <div className="text-center py-6">
              <Clock size={24} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">Em breve</p>
              <p className="text-xs text-muted-foreground mt-1">Estamos finalizando essa integração.</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Como conectar</p>
              <ol className="space-y-2.5 mb-5">
                {plataforma.comoConectar?.map((passo, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 text-white"
                          style={{ background: BRAND }}>{i + 1}</span>
                    <span className="text-xs text-foreground leading-relaxed">{passo}</span>
                  </li>
                ))}
              </ol>

              <a href="#" className="inline-flex items-center gap-1 text-xs font-semibold mb-5 hover:underline" style={{ color: BRAND }}>
                Abrir tutorial completo <ExternalLink size={11} />
              </a>

              <div className="space-y-1.5 mb-4">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Token Hotmart</label>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="cole o token aqui"
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm font-mono text-foreground focus:outline-none focus:border-foreground/40 transition-colors"
                />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock size={9} /> Criptografado antes de salvar.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {disponivel && (
          <div className="p-5 border-t border-border bg-muted/20 flex items-center gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleConectar}
              disabled={!token.trim() || enviando}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}
            >
              {enviando ? 'Conectando…' : 'Conectar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BloqueioBlack() {
  return (
    <div className="max-w-md mx-auto pt-20 px-6 text-center">
      <Lock size={32} className="text-muted-foreground mx-auto mb-3" />
      <h2 className="text-lg font-bold text-foreground">Disponível no plano Black</h2>
      <p className="text-sm text-muted-foreground mt-2">Faça upgrade para conectar suas plataformas.</p>
    </div>
  );
}

// Util: escurece um hex em ~15% para gradientes
function escurecer(hex: string, amt = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
