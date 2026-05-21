'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  ArrowLeft, Plug, Check, Clock, Sparkles, X, Lock, ExternalLink,
  ShieldCheck, RefreshCw, Zap, Trash2, Copy, Loader2,
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
  { id: 'kiwify', nome: 'Kiwify',  categoria: 'Infoprodutos', cor: '#0066ff',
    descricao: 'Captura vendas, reembolsos e cancelamentos via webhook.',
    status: 'disponivel',
    comoConectar: [
      'Acesse o painel Kiwify → Configurações → Webhooks',
      'Crie um novo webhook com a URL gerada pela Sora no próximo passo',
      'Selecione os eventos: order_approved, order_refunded, subscription_canceled',
      'Cole o token de autenticação aqui (se a Kiwify pedir um secret, copie do painel)',
    ],
  },
  { id: 'eduzz',  nome: 'Eduzz',   categoria: 'Infoprodutos', cor: '#ff6b00',
    descricao: 'Webhook v2 — vendas, reembolsos e chargebacks em tempo real.',
    status: 'disponivel',
    comoConectar: [
      'Acesse Eduzz → Minha Conta → Configurações → Notificações',
      'Cadastre a URL gerada aqui na Sora como nova notificação',
      'Selecione todos os status (3, 9, 10, 11) para receber eventos completos',
      'Cole o token aqui',
    ],
  },

  // PAGAMENTOS
  { id: 'stripe',      nome: 'Stripe',         categoria: 'Pagamentos', cor: '#635bff',
    descricao: 'Capturamos charges, refunds, chargebacks e assinaturas via webhook.',
    status: 'disponivel',
    comoConectar: [
      'Acesse Stripe Dashboard → Developers → Webhooks → Add endpoint',
      'Cole a URL gerada pela Sora no próximo passo',
      'Selecione os eventos: charge.succeeded, charge.refunded, charge.dispute.created, invoice.payment_succeeded, customer.subscription.deleted',
      'Copie o signing secret do Stripe e cole aqui',
    ],
  },
  { id: 'mercadopago', nome: 'Mercado Pago',   categoria: 'Pagamentos', cor: '#00b1ea', descricao: 'Em breve — integração via Access Token.',         status: 'em_breve' },
  { id: 'asaas',       nome: 'Asaas',          categoria: 'Pagamentos', cor: '#1e7d8c', descricao: 'Em breve.',                                       status: 'em_breve' },
  { id: 'pagseguro',   nome: 'PagSeguro',      categoria: 'Pagamentos', cor: '#fdb022', descricao: 'Em breve.',                                       status: 'em_breve' },

  // ECOMMERCE
  { id: 'shopify',    nome: 'Shopify',     categoria: 'E-commerce', cor: '#95bf47', descricao: 'Em breve — App oficial Sora.', status: 'em_breve' },
  { id: 'woocommerce', nome: 'WooCommerce', categoria: 'E-commerce', cor: '#7f54b3', descricao: 'Em breve — plugin WordPress.', status: 'em_breve' },
];

const CATEGORIAS: Plataforma['categoria'][] = ['Infoprodutos', 'Pagamentos', 'E-commerce'];

export default function IntegracoesPage() {
  const { isBlack, phone } = useAuth();
  const [modal, setModal] = useState<Plataforma | null>(null);
  const [conectadas, setConectadas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregar() {
    if (!phone) return;
    setLoading(true);
    try { setConectadas(await api.negocios.integracoes.listar(phone)); }
    catch { setConectadas([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [phone]);

  if (!isBlack) return <DashboardLayout><BloqueioBlack /></DashboardLayout>;

  // Marca cards como conectada quando há integração ativa daquela plataforma
  const plataformasComStatus = PLATAFORMAS.map(p => {
    const integ = conectadas.find(c => c.plataforma === p.id && c.status === 'ativa');
    return integ ? { ...p, status: 'conectada' as Status, integ } : p;
  });
  const qtdConectadas = conectadas.filter(c => c.status === 'ativa').length;

  async function handleDesconectar(integId: string) {
    if (!confirm('Desconectar essa integração? Eventos já capturados são mantidos.')) return;
    try { await api.negocios.integracoes.deletar(integId); await carregar(); }
    catch (e: any) { alert(e.message); }
  }

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
              <div className="w-2 h-2 rounded-full" style={{ background: qtdConectadas > 0 ? BRAND : '#94a3b8' }} />
              <span className="text-xs font-semibold tabular-nums">
                {qtdConectadas} de {PLATAFORMAS.length} conectadas
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
          const grupo = plataformasComStatus.filter(p => p.categoria === cat);
          return (
            <section key={cat} className="space-y-3 animate-fade-in" style={{ animationDelay: `${120 + idx * 60}ms` }}>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{cat}</h2>
                <span className="text-[10px] text-muted-foreground tabular-nums">{grupo.length} plataformas</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grupo.map((p: any) => (
                  <CardPlataforma
                    key={p.id}
                    p={p}
                    onClick={() => setModal(p)}
                    onDesconectar={p.integ ? () => handleDesconectar(p.integ.id) : undefined}
                  />
                ))}
              </div>
            </section>
          );
        })}

      </div>

      {modal && <ModalConectar plataforma={modal} onClose={() => { setModal(null); carregar(); }} />}
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function CardPlataforma({ p, onClick, onDesconectar }: { p: Plataforma; onClick: () => void; onDesconectar?: () => void }) {
  const disponivel = p.status === 'disponivel';
  const conectada  = p.status === 'conectada';

  return (
    <div
      className={`
        relative text-left rounded-2xl border bg-card p-4 transition-all
        ${disponivel ? 'border-border hover:border-foreground/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : ''}
        ${conectada ? 'border-green-500/40' : ''}
        ${p.status === 'em_breve' ? 'border-dashed border-border opacity-60' : ''}
      `}
    >
      {/* Destaque badge */}
      {p.destaque && !conectada && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-white shadow-sm"
              style={{ background: BRAND }}>
          Recomendado
        </span>
      )}

      <button onClick={onClick} disabled={p.status === 'em_breve'} className="w-full text-left disabled:cursor-not-allowed">
        <div className="flex items-start gap-3 mb-3">
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
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold" style={{ color: BRAND }}>
            <Plug size={11} /> Conectar
          </div>
        )}
        {conectada && (
          <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-green-600">
            <Check size={11} /> Conectada
          </div>
        )}
      </button>

      {conectada && onDesconectar && (
        <button
          onClick={(e) => { e.stopPropagation(); onDesconectar(); }}
          className="absolute top-2 right-2 p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
          aria-label="Desconectar"
          title="Desconectar"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
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
  const { phone } = useAuth();
  const [clientId, setClientId]   = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [apelido, setApelido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso]   = useState<{ webhookUrl: string; secret: string } | null>(null);
  const [erro, setErro] = useState('');
  // já conectada → modal vira tela de gerenciamento (mostra status + última sync)
  const jaConectada = plataforma.status === 'conectada';
  const disponivel  = plataforma.status === 'disponivel';
  const temCredenciais = clientId.trim() && clientSecret.trim();

  async function handleConectar() {
    if (!temCredenciais || !phone) return;
    setErro('');
    setEnviando(true);
    try {
      const { integracao } = await api.negocios.integracoes.conectar({
        phone,
        plataforma: plataforma.id,
        credenciais: { client_id: clientId.trim(), client_secret: clientSecret.trim() },
        apelido: apelido.trim() || undefined,
      });
      const base = typeof window !== 'undefined' ? window.location.origin.replace('3000', '3001') : '';
      // Para Hotmart, eles ainda configuram via painel deles — mostramos a URL final.
      const apiBase = process.env.NEXT_PUBLIC_API_URL || base;
      const webhookUrl = `${apiBase}/webhook/negocios/${plataforma.id}/${integracao.id}?secret=${integracao.webhook_secret}`;
      setSucesso({ webhookUrl, secret: integracao.webhook_secret });
    } catch (e: any) {
      setErro(e.message || 'Falha ao conectar.');
    } finally {
      setEnviando(false);
    }
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
        <div className="p-5 max-h-[65vh] overflow-y-auto">
          {sucesso ? (
            <TelaSucesso webhookUrl={sucesso.webhookUrl} plataforma={plataforma.nome} />
          ) : jaConectada ? (
            <TelaConectada
              plataforma={plataforma}
              integ={(plataforma as any).integ}
              onImportar={async () => {
                try {
                  await api.negocios.integracoes.importarHistorico((plataforma as any).integ.id);
                  alert('Importação iniciada! Os eventos dos últimos 90 dias chegam em instantes.');
                } catch (e: any) { alert(e.message); }
              }}
            />
          ) : !disponivel ? (
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

              <div className="space-y-1.5 mb-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Apelido (opcional)</label>
                <input
                  type="text"
                  value={apelido}
                  onChange={e => setApelido(e.target.value)}
                  placeholder="Ex: Conta principal"
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-foreground/40 transition-colors"
                />
              </div>

              <div className="rounded-xl bg-muted/20 border border-border/60 p-3 mb-4 space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Credenciais OAuth</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Acesse <strong className="text-foreground">developers.hotmart.com</strong> → Crie um app → copie Client ID e Client Secret.
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Client ID</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={e => setClientId(e.target.value)}
                      placeholder="ex: 12ab34cd-..."
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-card border border-border text-sm font-mono text-foreground focus:outline-none focus:border-foreground/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Client Secret</label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={e => setClientSecret(e.target.value)}
                      placeholder="cole o secret aqui"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-card border border-border text-sm font-mono text-foreground focus:outline-none focus:border-foreground/40 transition-colors"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock size={9} /> Credenciais salvas no servidor, nunca expostas.
                </p>
              </div>

              {erro && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-600 mb-3">
                  {erro}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {disponivel && !sucesso && !jaConectada && (
          <div className="p-5 border-t border-border bg-muted/20 flex items-center gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-foreground bg-card border border-border hover:bg-muted/60 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleConectar}
              disabled={!temCredenciais || enviando}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-bold text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all inline-flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}
            >
              {enviando ? <><Loader2 size={14} className="animate-spin" /> Conectando…</> : 'Conectar'}
            </button>
          </div>
        )}
        {sucesso && (
          <div className="p-5 border-t border-border bg-muted/20">
            <button onClick={onClose} className="w-full px-4 py-3 rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              Concluído
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TelaConectada({ plataforma, integ, onImportar }: { plataforma: Plataforma; integ: any; onImportar: () => Promise<void> }) {
  const [importando, setImportando] = useState(false);

  async function handleImportar() {
    setImportando(true);
    try { await onImportar(); }
    finally { setImportando(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
             style={{ background: `linear-gradient(135deg, ${plataforma.cor} 0%, ${escurecer(plataforma.cor)} 100%)` }}>
          {plataforma.nome.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{plataforma.nome} conectada</p>
          <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Ativa · recebendo via webhook
          </p>
        </div>
      </div>

      {integ?.ultimo_sync && (
        <p className="text-[11px] text-muted-foreground">
          Última sincronização: {new Date(integ.ultimo_sync).toLocaleString('pt-BR')}
        </p>
      )}
      {integ?.total_eventos > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {integ.total_eventos} eventos capturados
        </p>
      )}

      <div className="rounded-xl bg-muted/30 border border-border p-3">
        <p className="text-xs font-bold text-foreground mb-1">Importar histórico</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Puxa todas as vendas dos últimos 90 dias via API da {plataforma.nome}. Ideal pra fazer no primeiro acesso.
        </p>
        <button
          onClick={handleImportar}
          disabled={importando}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-sm disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}
        >
          {importando
            ? <><Loader2 size={12} className="animate-spin" /> Importando…</>
            : <><Zap size={12} /> Importar 90 dias</>}
        </button>
      </div>
    </div>
  );
}

function TelaSucesso({ webhookUrl, plataforma }: { webhookUrl: string; plataforma: string }) {
  const [copiado, setCopiado] = useState(false);
  function copiar() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BRAND}20` }}>
          <Check size={16} style={{ color: BRAND }} />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">Integração criada</p>
          <p className="text-xs text-muted-foreground">Falta 1 passo: colar essa URL no painel da {plataforma}.</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">URL do webhook</p>
        <div className="rounded-xl bg-muted/40 border border-border p-3 flex items-center gap-2">
          <code className="text-[11px] font-mono text-foreground flex-1 break-all leading-relaxed">{webhookUrl}</code>
          <button onClick={copiar} className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-white shadow-sm transition-all"
                  style={{ background: copiado ? '#22c55e' : BRAND }}>
            {copiado ? <><Check size={11} /> Copiado</> : <><Copy size={11} /> Copiar</>}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
        <ExternalLink size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
          Acesse <strong>{plataforma} → Ferramentas → Webhooks</strong>, cole essa URL e selecione os eventos: PURCHASE_APPROVED, PURCHASE_REFUNDED, PURCHASE_CHARGEBACK, SUBSCRIPTION_CANCELLATION.
        </p>
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
