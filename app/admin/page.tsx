'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminEmail } from '@/lib/admin';
import {
  Shield, Search, RefreshCw, Users as UsersIcon, Bug, X, Trash2, Loader2,
  Check, Crown, Sparkles, ExternalLink, AlertTriangle, Zap, Phone, Copy, CircleDot, Lightbulb, Send,
  Infinity as InfinityIcon, Gem, Undo2, Megaphone, Repeat, XCircle, CalendarClock, Landmark,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';
const money = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const dataCurta = (s?: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—');

type Plano = 'basico' | 'premium' | 'platinum' | 'inativo' | 'kit';
type User = {
  id: string; name: string | null; email: string | null; phone: string | null;
  plano: Plano; plano_intervalo?: string | null; plano_valido_ate?: string | null;
  vitalicio?: boolean | null; vitalicio_em?: string | null;
  stripe_customer_id?: string | null; onboarding_completed?: boolean; welcomed_at?: string | null;
  mrr_excluir?: boolean | null; assinatura_cancelada?: boolean | null;
  recuperacao_signup_em?: string | null; recuperacao_enviada_em?: string | null;
  // Pagamento recusado pelo gateway: quando (047) e por quê (102).
  recuperacao_pendente_em?: string | null; recuperacao_motivo?: string | null;
  vitalicio_intent?: string | null;
  // Conexão de banco avulsa (Open Finance) — quantas ele paga e o intervalo.
  of_conexoes_pagas?: number | null; of_assinatura_intervalo?: string | null;
  // Bancos CONECTADOS (vem do enriquecimento no route, casando por grupo).
  // Diferente de of_conexoes_pagas: quem tem franquia conecta de graça.
  of_conectadas?: number; of_conectadas_ok?: number; of_bancos?: string[];
  created_at: string;
};
type Overview = {
  total: number; ativos: number; inativo: number; basico: number; premium: number; platinum: number; kit?: number;
  vitalicios?: number; kitVitalicio?: number; premiumVitalicio?: number; premiumRecorrente?: number; receitaVitalicio?: number;
  novos7: number; novos30: number; pagouInativo: number; bugsAbertos: number; melhoriasAbertas?: number; mrr: number; mrrExcluidos?: number;
  semPagamento?: number; recEnviadas?: number; recEnviadas2?: number; recRecuperados?: number;
  cancelados?: number; naoConcluido?: number; recuperados?: number;
  anuais?: number; recorrentesMensais?: number;
  // Open Finance avulso. CONTRATADAS (receita) x CONECTADAS (uso): os dois
  // divergirem é sinal de cliente pagando por algo que não está usando.
  ofUsuarios?: number; ofConexoesPagas?: number; ofMensais?: number; ofAnuais?: number;
  ofMrr?: number; ofReceitaAnual?: number;
  ofConectados?: number; ofGrupos?: number; ofComProblema?: number;
  ofGruposFranquia?: number; ofGruposPagando?: number; ofPagandoSemUsar?: number;
};
type BugReport = {
  id: string; nome: string | null; email: string | null; phone: string | null;
  mensagem: string; tem_imagem: boolean; status: 'aberto' | 'em_andamento' | 'resolvido'; created_at: string;
  tipo?: 'problema' | 'melhoria';
};

const PLANO_META: Record<Plano, { label: string; cor: string; icon?: any }> = {
  basico:  { label: 'Básico',  cor: '#71717a' },
  premium: { label: 'Premium', cor: '#10b981', icon: Sparkles },
  platinum: { label: 'Platinum', cor: '#a78bfa', icon: Crown },
  kit:     { label: 'Kit',     cor: '#8b5cf6', icon: Gem },
  inativo: { label: 'Inativo', cor: '#ef4444' },
};

// Status derivado: inativo NÃO é um bloco só. Quem cancelou (teve assinatura →
// plano_intervalo setado) fica "Inativo"; quem nunca concluiu o pagamento fica
// "Não concluído". Não mexe no campo `plano` (que controla acesso) — é só rótulo.
function metaStatus(u: { plano: Plano; plano_intervalo?: string | null }) {
  if (u.plano === 'inativo') {
    return u.plano_intervalo
      ? { label: 'Inativo', cor: '#ef4444', icon: undefined as any, title: 'Cancelou (tinha assinatura)' }
      : { label: 'Não concluído', cor: '#f59e0b', icon: AlertTriangle, title: 'Pagamento não concluído (nunca assinou)' };
  }
  const m = PLANO_META[u.plano] || PLANO_META.inativo;
  return { label: m.label, cor: m.cor, icon: m.icon, title: undefined as string | undefined };
}

// Motivos de recusa do Mercado Pago, em português — o `status_detail` cru não
// diz nada pra quem vai ligar pro cliente, e cada caso pede uma abordagem.
const MOTIVO_RECUSA: Record<string, string> = {
  cc_rejected_high_risk: 'Antifraude barrou — ofereça Pix ou outro cartão',
  cc_rejected_insufficient_amount: 'Sem limite — sugira parcelar ou Pix',
  cc_rejected_bad_filled_card_number: 'Número do cartão errado',
  cc_rejected_bad_filled_date: 'Validade errada',
  cc_rejected_bad_filled_security_code: 'CVV errado',
  cc_rejected_bad_filled_other: 'Dado do cartão errado',
  cc_rejected_call_for_authorize: 'Banco precisa autorizar — peça pra ligar no banco',
  cc_rejected_card_disabled: 'Cartão desabilitado',
  cc_rejected_duplicated_payment: 'Pagamento duplicado',
  cc_rejected_max_attempts: 'Tentativas demais — aguardar e refazer',
  cc_rejected_blacklist: 'Cartão em blacklist do MP',
  cc_rejected_other_reason: 'Recusado pelo banco emissor',
};
const textoMotivo = (m?: string | null) => (m ? MOTIVO_RECUSA[m] || m : null);

function StatusBadge({ u }: { u: Pick<User, 'plano' | 'vitalicio' | 'plano_intervalo' | 'mrr_excluir' | 'assinatura_cancelada' | 'recuperacao_signup_em' | 'recuperacao_enviada_em' | 'recuperacao_pendente_em' | 'recuperacao_motivo' | 'vitalicio_intent' | 'of_conexoes_pagas' | 'of_assinatura_intervalo' | 'of_conectadas' | 'of_conectadas_ok'> }) {
  const m = metaStatus(u);
  const Icon = m.icon;
  const recuperado = u.plano !== 'inativo' && !!(u.recuperacao_signup_em || u.recuperacao_enviada_em);
  const pago = ['basico', 'premium', 'platinum'].includes(u.plano);
  // Recorrente = pagante ATIVO que não é vitalício e não cancelou → sustenta o
  // MRR. É o que o admin quer identificar de relance.
  const recorrente = pago && !u.vitalicio && !u.assinatura_cancelada && !u.mrr_excluir;
  const anual = u.plano_intervalo === 'anual';
  const ofPagas = Number(u.of_conexoes_pagas) || 0;
  const ofAnual = u.of_assinatura_intervalo === 'anual';
  const ofConectadas = Number(u.of_conectadas) || 0;
  const ofOk = Number(u.of_conectadas_ok) || 0;
  // Paga e não conectou nada: cobrança rodando por serviço parado.
  const ofPagaSemUsar = ofPagas > 0 && ofConectadas === 0;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap justify-end">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold whitespace-nowrap"
            style={{ background: `color-mix(in srgb, ${m.cor} 14%, transparent)`, color: m.cor }} title={m.title}>
        {Icon ? <Icon size={10} /> : <CircleDot size={9} />} {m.label}
      </span>
      {recorrente && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #10b981 16%, transparent)', color: '#10b981' }}
              title="Assinatura ativa que renova — não cancelou">
          <Repeat size={10} /> Recorrente
        </span>
      )}
      {pago && anual && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #3b82f6 16%, transparent)', color: '#3b82f6' }}
              title="Assinatura ANUAL (pré-paga, paga 1×/ano) — não entra no MRR mensal">
          <CalendarClock size={10} /> Anual
        </span>
      )}
      {/* Conexão de banco avulsa. O número importa: é POR BANCO, então "OF 3"
          é o triplo da receita de "OF 1". O anual muda a cor porque é pré-pago
          e fica fora do MRR mensal — mesma convenção do badge de plano. */}
      {ofPagas > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: `color-mix(in srgb, ${ofAnual ? '#3b82f6' : '#06b6d4'} 16%, transparent)`,
                       color: ofAnual ? '#3b82f6' : '#06b6d4' }}
              title={ofAnual
                ? `${ofPagas} conexão(ões) de banco · plano ANUAL (R$ 60/ano cada, pré-pago — fora do MRR mensal)`
                : `${ofPagas} conexão(ões) de banco · R$ 6/mês cada`}>
          <Landmark size={10} /> OF {ofPagas}{ofAnual ? '/ano' : ''}
        </span>
      )}
      {/* USO — separado do pagamento de propósito. Quem tem franquia (Básico 1,
          Premium 3) conecta de graça e não tem badge de receita nenhum; sem
          este, metade de quem usa Open Finance era invisível na lista.
          Fica âmbar quando algum banco parou de atualizar: é o cliente que vai
          abrir chamado dizendo que "a Sora travou". */}
      {ofConectadas > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: `color-mix(in srgb, ${ofOk < ofConectadas ? '#f59e0b' : '#06b6d4'} 16%, transparent)`,
                       color: ofOk < ofConectadas ? '#d97706' : '#06b6d4' }}
              title={`${ofConectadas} banco(s) conectado(s)${ofOk < ofConectadas ? ` · ${ofConectadas - ofOk} precisa(m) reconectar` : ''}${ofPagas > 0 ? '' : ' · pela franquia do plano (grátis)'}`}>
          <Landmark size={10} /> {ofConectadas} banco{ofConectadas > 1 ? 's' : ''}{ofOk < ofConectadas ? ' ⚠' : ''}
        </span>
      )}
      {/* Cobrando sem entregar. O admin precisa ver isto sem procurar. */}
      {ofPagaSemUsar && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #ef4444 16%, transparent)', color: '#ef4444' }}
              title="Paga conexão de banco e não conectou nenhuma — cobrança rodando por serviço parado">
          <AlertTriangle size={10} /> paga sem usar
        </span>
      )}
      {pago && u.assinatura_cancelada && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #f59e0b 16%, transparent)', color: '#d97706' }}
              title="Cancelou na Stripe — ainda tem acesso até o fim do período, mas não renova">
          <XCircle size={10} /> Cancelou
        </span>
      )}
      {/* Venda a recuperar. "Pagamento falhou" = o gateway recusou (temos o
          motivo). "Não concluiu" = montou o pagamento e parou — recusa antiga
          sem registro, Pix não pago ou desistência; não dá pra afirmar recusa.
          Some sozinho quando ele compra (o /process limpa a marca ao aprovar). */}
      {!u.vitalicio && u.recuperacao_pendente_em && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #ef4444 16%, transparent)', color: '#ef4444' }}
              title={textoMotivo(u.recuperacao_motivo) || 'Pagamento recusado pelo gateway'}>
          <XCircle size={10} /> Pagamento falhou
        </span>
      )}
      {!u.vitalicio && !u.recuperacao_pendente_em && u.vitalicio_intent && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #f59e0b 16%, transparent)', color: '#d97706' }}
              title={`Abriu o checkout do vitalício (${u.vitalicio_intent}) e não concluiu`}>
          <AlertTriangle size={10} /> Não concluiu
        </span>
      )}
      {u.vitalicio && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #8b5cf6 16%, transparent)', color: '#8b5cf6' }}
              title="Plano vitalício (pagamento único)">
          <InfinityIcon size={10} /> Vitalício
        </span>
      )}
      {recuperado && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap"
              style={{ background: 'color-mix(in srgb, #10b981 16%, transparent)', color: '#10b981' }}
              title="Voltou a pagar depois de um lembrete de recuperação">
          <Undo2 size={10} /> Recuperado
        </span>
      )}
    </span>
  );
}

async function adminFetch(path: string, init?: RequestInit) {
  const res = await fetch(`/api/admin${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.erro || `Erro ${res.status}`);
  return data;
}

export default function AdminPage() {
  const { perfil, loading } = useAuth();
  const router = useRouter();
  const admin = isAdminEmail(perfil?.email);

  const [tab, setTab] = useState<'users' | 'bugs' | 'melhorias' | 'comunicados'>('users');
  const [ov, setOv] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [melhorias, setMelhorias] = useState<BugReport[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'todos' | 'ativos' | 'inativos' | 'pagou_inativo' | 'cancelados' | 'nao_concluido' | 'recuperados' | 'recorrentes' | 'vitalicios' | 'anuais' | 'pagamento_falhou' | 'open_finance' | 'of_conectado'>('todos');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sel, setSel] = useState<User | null>(null);
  const [msg, setMsg] = useState(''); // texto opcional pré-preenchido no link wa.me
  const [respId, setRespId] = useState<string | null>(null); // relato com compositor aberto
  const [respMsg, setRespMsg] = useState('');
  const [enviandoResp, setEnviandoResp] = useState(false);
  const [toast, setToast] = useState('');

  // Guard de UI (a segurança real é nos endpoints).
  useEffect(() => { if (!loading && perfil && !admin) router.replace('/dashboard'); }, [loading, perfil, admin, router]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };

  const carregarOverview = useCallback(() => { adminFetch('/overview').then(setOv).catch(() => {}); }, []);
  const carregarUsers = useCallback(() => {
    setLoadingUsers(true);
    const p = new URLSearchParams(); if (q) p.set('q', q); if (filter !== 'todos') p.set('filter', filter);
    adminFetch(`/users?${p}`).then((d) => setUsers(d.users || [])).catch(() => setUsers([])).finally(() => setLoadingUsers(false));
  }, [q, filter]);
  const carregarBugs = useCallback(() => { adminFetch('/bugs?tipo=problema').then((d) => setBugs(d.bugs || [])).catch(() => setBugs([])); }, []);
  const carregarMelhorias = useCallback(() => { adminFetch('/bugs?tipo=melhoria').then((d) => setMelhorias(d.bugs || [])).catch(() => setMelhorias([])); }, []);

  useEffect(() => { if (admin) { carregarOverview(); carregarBugs(); carregarMelhorias(); } }, [admin, carregarOverview, carregarBugs, carregarMelhorias]);
  useEffect(() => { if (admin) { const t = setTimeout(carregarUsers, q ? 300 : 0); return () => clearTimeout(t); } }, [admin, carregarUsers, q]);
  useEffect(() => { setMsg(''); }, [sel?.id]); // limpa o compositor ao trocar de usuário

  if (loading || !perfil) return <DashboardLayout><div className="p-10 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div></DashboardLayout>;
  if (!admin) return <DashboardLayout><div className="p-10 text-center text-muted-foreground">Acesso restrito.</div></DashboardLayout>;

  async function acao(action: string, extra: Record<string, unknown> = {}) {
    if (!sel) return;
    try {
      const d = await adminFetch(`/users/${sel.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
      flash('Feito ✓');
      carregarUsers(); carregarOverview();
      // atualiza o painel aberto com base na ação
      if (action === 'set_plano') setSel({ ...sel, plano: extra.plano as Plano });
      if (action === 'liberar_numero') setSel({ ...sel, phone: null });
      if (action === 'stripe_sync' && d.plano) setSel({ ...sel, plano: d.plano });
      if (action === 'set_phone') setSel({ ...sel, phone: String(extra.phone) });
      if (action === 'set_mrr_excluir') setSel({ ...sel, mrr_excluir: extra.excluir as boolean });
    } catch (e: any) { flash('⚠️ ' + (e?.message || 'falhou')); }
  }

  async function apagar() {
    if (!sel) return;
    if (!confirm(`Apagar ${sel.name || sel.email}? Isso remove dados + login e libera o número. Irreversível.`)) return;
    if (!confirm('Tem certeza mesmo? Não dá pra desfazer.')) return;
    try { await adminFetch(`/users/${sel.id}`, { method: 'DELETE' }); flash('Usuário apagado'); setSel(null); carregarUsers(); carregarOverview(); }
    catch (e: any) { flash('⚠️ ' + (e?.message || 'falhou')); }
  }

  async function responderRelato(bugId: string) {
    if (!respMsg.trim()) return;
    setEnviandoResp(true);
    try {
      const r = await fetch('/api/admin/responder-relato', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugId, texto: respMsg.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (d?.erro) { flash('⚠️ ' + d.erro); return; }
      flash('Resposta enviada ✓'); setRespId(null); setRespMsg('');
    } catch (e: any) { flash('⚠️ ' + (e?.message || 'falhou')); }
    finally { setEnviandoResp(false); }
  }

  async function mudarStatusBug(id: string, status: BugReport['status']) {
    setBugs((b) => b.map((x) => x.id === id ? { ...x, status } : x));
    setMelhorias((m) => m.map((x) => x.id === id ? { ...x, status } : x));
    try { await adminFetch('/bugs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) }); carregarOverview(); }
    catch { carregarBugs(); carregarMelhorias(); }
  }

  const stripeBase = 'https://dashboard.stripe.com'; // troque p/ /test/... se estiver testando

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 pb-24 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between pt-2 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
              <Shield size={18} style={{ color: BRAND }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-none">Admin</h1>
              <p className="text-xs text-muted-foreground mt-1 truncate">Operação da Sora — só você vê isso.</p>
            </div>
          </div>
          <button onClick={() => { carregarOverview(); carregarUsers(); carregarBugs(); flash('Atualizado'); }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            <RefreshCw size={13} /> Atualizar
          </button>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          <Stat label="MRR mensal" value={ov ? money(ov.mrr) : '—'}
                hint={ov
                  ? `${ov.recorrentesMensais ?? 0} mensais${ov.anuais ? ` · ${ov.anuais} anuais fora` : ''}${ov.mrrExcluidos ? ` · ${ov.mrrExcluidos} excluídos` : ''}`
                  : ''} destaque />
          <Stat label="Receita vitalícia" value={ov ? money(ov.receitaVitalicio ?? 0) : '—'}
                hint={ov ? `${ov.vitalicios ?? 0} vital. · ${ov.kitVitalicio ?? 0} Kit · ${ov.premiumVitalicio ?? 0} Compl.` : ''} destaque />
          {/* Receita das conexões de banco. Fica junto dos outros dois cards de
              dinheiro (MRR e vitalício) de propósito — é a terceira fonte, e
              separá-la faria parecer detalhe. Clicar filtra a lista. */}
          <Stat label="Open Finance" value={ov ? money(ov.ofMrr ?? 0) : '—'}
                hint={ov
                  ? `${ov.ofConexoesPagas ?? 0} conexões · ${ov.ofUsuarios ?? 0} clientes${ov.ofAnuais ? ` · ${ov.ofAnuais} anuais (${money(ov.ofReceitaAnual ?? 0)}/ano) fora` : ''}`
                  : ''}
                onClick={() => { setTab('users'); setFilter('open_finance'); }} destaque
                alerta={!!ov && (ov.ofPagandoSemUsar ?? 0) > 0} />
          {/* Uso real, separado da receita: quem PAGA nem sempre é quem está
              CONECTADO. Conexão fora de 'updated' é banco que parou de
              atualizar — o cliente sente como "a Sora travou". */}
          <Stat label="Bancos conectados" value={ov?.ofConectados ?? '—'}
                alerta={!!ov && ((ov.ofComProblema ?? 0) > 0 || (ov.ofPagandoSemUsar ?? 0) > 0)}
                hint={ov ? `${ov.ofGrupos ?? 0} contas · ${ov.ofGruposFranquia ?? 0} pela franquia · ${ov.ofGruposPagando ?? 0} pagando${ov.ofComProblema ? ` · ${ov.ofComProblema} reconectar` : ''}` : ''} />
          <Stat label="Usuários" value={ov?.total ?? '—'} hint={ov ? `${ov.novos7} nos últimos 7d` : ''} />
          <Stat label="Ativos" value={ov?.ativos ?? '—'} hint={ov ? `${ov.basico} B · ${ov.premium} P · ${ov.platinum} PL · ${ov.kit ?? 0} Kit` : ''} />
          <Stat label="Cancelaram" value={ov?.cancelados ?? '—'}
                hint={ov ? 'tinham assinatura' : ''}
                onClick={() => { setTab('users'); setFilter('cancelados'); }} />
          <Stat label="Pagamento não concluído" value={ov?.naoConcluido ?? '—'} alerta={!!ov && (ov.naoConcluido ?? 0) > 0}
                hint={ov ? 'nunca assinaram' : ''}
                onClick={() => { setTab('users'); setFilter('nao_concluido'); }} />
          <Stat label="Novos (30d)" value={ov?.novos30 ?? '—'} />
          <Stat label="Bugs abertos" value={ov?.bugsAbertos ?? '—'} alerta={!!ov && ov.bugsAbertos > 0} onClick={() => setTab('bugs')} />
          <Stat label="Melhorias propostas" value={ov?.melhoriasAbertas ?? '—'} onClick={() => setTab('melhorias')} />
          <Stat label="Premium / Platinum" value={ov ? `${ov.premium} / ${ov.platinum}` : '—'} />
          <Stat label="Cadastros sem pagamento" value={ov?.semPagamento ?? '—'}
                hint={ov ? `${ov.recEnviadas ?? 0} no 1º · ${ov.recEnviadas2 ?? 0} no 2º lembrete` : ''} alerta={!!ov && (ov.semPagamento ?? 0) > 0} />
          <Stat label="Recuperados" value={ov?.recuperados ?? ov?.recRecuperados ?? '—'}
                hint={ov ? 'voltaram a pagar após recuperação' : ''}
                onClick={() => { setTab('users'); setFilter('recuperados'); }}
                destaque />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/60 w-fit">
          {([['users', 'Usuários', UsersIcon], ['bugs', 'Bugs', Bug], ['melhorias', 'Melhorias', Lightbulb], ['comunicados', 'Comunicados', Megaphone]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
                    className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-xl text-sm font-bold transition-all ${tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon size={14} /> {label}
              {id === 'bugs' && ov && ov.bugsAbertos > 0 && (
                <span className="ml-0.5 px-1.5 rounded-full text-[10px] font-bold text-white bg-red-500">{ov.bugsAbertos}</span>
              )}
              {id === 'melhorias' && ov && (ov.melhoriasAbertas ?? 0) > 0 && (
                <span className="ml-0.5 px-1.5 rounded-full text-[10px] font-bold text-white bg-amber-500">{ov.melhoriasAbertas}</span>
              )}
            </button>
          ))}
        </div>

        {tab === 'comunicados' ? (
          <Comunicados flash={flash} />
        ) : tab === 'users' ? (
          <div className="space-y-3">
            {/* Busca + filtros */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou número…"
                       className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary" />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {([['todos', 'Todos'], ['recorrentes', 'Recorrentes'], ['anuais', 'Anuais'], ['vitalicios', 'Vitalícios'], ['of_conectado', 'Conectados'], ['open_finance', 'OF pago'], ['ativos', 'Ativos'], ['pagamento_falhou', 'Pagamento falhou'], ['recuperados', 'Recuperados'], ['cancelados', 'Cancelaram'], ['nao_concluido', 'Não concluído']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setFilter(id)}
                          className={`h-11 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${filter === id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabela */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {loadingUsers ? (
                <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
              ) : users.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">Nenhum usuário encontrado.</div>
              ) : (
                <div className="divide-y divide-border">
                  {users.map((u) => (
                    <button key={u.id} onClick={() => setSel(u)}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                           style={{ background: PLANO_META[u.plano]?.cor || '#71717a' }}>
                        {(u.name || u.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{u.name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                      <div className="hidden sm:block text-right flex-shrink-0">
                        <p className="text-xs text-muted-foreground tabular-nums">{u.phone || 'sem número'}</p>
                        <p className="text-[10px] text-muted-foreground/70">{dataCurta(u.created_at)}</p>
                      </div>
                      <StatusBadge u={u} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground text-center">Mostrando até 300. Use a busca para refinar.</p>
          </div>
        ) : (
          /* ── BUGS / MELHORIAS (mesma estrutura) ── */
          <div className="space-y-2.5">
            {(tab === 'melhorias' ? melhorias : bugs).length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground rounded-2xl border border-border bg-card">
                {tab === 'melhorias' ? 'Nenhuma melhoria proposta ainda.' : 'Nenhum relato ainda.'}
              </div>
            ) : (tab === 'melhorias' ? melhorias : bugs).map((b) => (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{b.nome || '—'} <span className="font-normal text-muted-foreground">· {b.phone || b.email || ''}</span></p>
                    <p className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString('pt-BR')}{b.tem_imagem ? ' · 📷 com print (no seu WhatsApp)' : ''}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${b.status === 'resolvido' ? 'bg-emerald-500/15 text-emerald-600' : b.status === 'em_andamento' ? 'bg-amber-500/15 text-amber-600' : 'bg-red-500/15 text-red-600'}`}>
                    {b.status === 'resolvido' ? 'Resolvido' : b.status === 'em_andamento' ? 'Em andamento' : 'Aberto'}
                  </span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{b.mensagem}</p>
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {(['aberto', 'em_andamento', 'resolvido'] as const).map((s) => (
                    <button key={s} onClick={() => mudarStatusBug(b.id, s)}
                            className={`h-8 px-2.5 rounded-lg text-[11px] font-bold transition-all border ${b.status === s ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                      {s === 'aberto' ? 'Aberto' : s === 'em_andamento' ? 'Em andamento' : 'Resolvido'}
                    </button>
                  ))}
                  {b.phone && (
                    <button onClick={() => { setRespId(respId === b.id ? null : b.id); setRespMsg(''); }}
                            className={`h-8 px-2.5 rounded-lg text-[11px] font-bold transition-all border inline-flex items-center gap-1 ${respId === b.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                      <Send size={11} /> Responder
                    </button>
                  )}
                </div>

                {/* Compositor de resposta (pelo WhatsApp da Sora, via template) */}
                {respId === b.id && (
                  <div className="pt-2 space-y-2 border-t border-border/60 mt-1">
                    <textarea
                      value={respMsg} onChange={(e) => setRespMsg(e.target.value)} rows={3} autoFocus
                      placeholder={`Resposta pra ${b.nome?.split(' ')[0] || 'o cliente'}…`}
                      className="w-full rounded-xl bg-background border border-border p-3 text-sm resize-none focus:outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-2">
                      <button onClick={() => responderRelato(b.id)} disabled={enviandoResp || !respMsg.trim()}
                              className="h-10 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 inline-flex items-center justify-center gap-2 disabled:opacity-50">
                        {enviandoResp ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar pela Sora
                      </button>
                      <button onClick={() => { setRespId(null); setRespMsg(''); }} className="h-10 px-3 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Vai pelo WhatsApp oficial da Sora (template) — alcança mesmo se o cliente não falou com a Sora nas últimas 24h. Quebras de linha viram espaço.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drawer do usuário */}
      {sel && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSel(null)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-md h-full bg-card border-l border-border shadow-2xl overflow-y-auto animate-[slide-up_300ms_ease-out] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-bold text-foreground">Usuário</h2>
              <button onClick={() => setSel(null)} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Identidade */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0" style={{ background: PLANO_META[sel.plano]?.cor }}>
                  {(sel.name || sel.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{sel.name || '—'}</p>
                  <p className="text-xs text-muted-foreground truncate">{sel.email}</p>
                </div>
              </div>

              {/* Infos */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Info label="Status"><StatusBadge u={sel} /></Info>
                <Info label="Válido até">{sel.vitalicio ? 'Vitalício ∞' : dataCurta(sel.plano_valido_ate)}</Info>
                {/* Conexão de banco avulsa: quanto ele paga por MÊS aqui. O
                    anual mostra o valor anual porque é o que foi cobrado —
                    dividir por 12 daria um número que não existe em extrato. */}
                <Info label="Open Finance">
                  {(Number(sel.of_conexoes_pagas) || 0) > 0
                    ? `${sel.of_conexoes_pagas} conexão${Number(sel.of_conexoes_pagas) > 1 ? 'ões' : ''} · ${
                        sel.of_assinatura_intervalo === 'anual'
                          ? `R$ ${(Number(sel.of_conexoes_pagas) * 60).toFixed(0)}/ano`
                          : `R$ ${(Number(sel.of_conexoes_pagas) * 6).toFixed(0)}/mês`}`
                    : 'sem conexão paga'}
                </Info>
                <Info label="WhatsApp">{sel.phone || '— sem número'}</Info>
                <Info label="Onboarding">{sel.onboarding_completed ? 'Concluído' : 'Pendente'}</Info>
                <Info label="Welcome">{sel.welcomed_at ? 'Enviado' : 'Não enviado'}</Info>
                <Info label="Criado">{dataCurta(sel.created_at)}</Info>
                <button onClick={() => { navigator.clipboard?.writeText(sel.id); flash('ID copiado'); }} className="col-span-2 flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 hover:bg-muted/40">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-[11px] text-foreground flex items-center gap-1">{sel.id.slice(0, 8)}… <Copy size={11} /></span>
                </button>
                {sel.stripe_customer_id && (
                  <a href={`${stripeBase}/customers/${sel.stripe_customer_id}`} target="_blank" rel="noreferrer" className="col-span-2 flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2 hover:bg-muted/40">
                    <span className="text-muted-foreground">Cliente Stripe</span>
                    <span className="text-[11px] text-foreground flex items-center gap-1">abrir <ExternalLink size={11} /></span>
                  </a>
                )}
                {/* Venda a recuperar: o motivo define a abordagem (antifraude
                    pede Pix; sem limite pede parcelar; CVV errado é só refazer). */}
                {!sel.vitalicio && (sel.recuperacao_pendente_em || sel.vitalicio_intent) && (
                  <div className="col-span-2 rounded-xl px-3 py-2 space-y-0.5"
                       style={sel.recuperacao_pendente_em
                         ? { background: 'color-mix(in srgb, #ef4444 8%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 24%, transparent)' }
                         : { background: 'color-mix(in srgb, #f59e0b 8%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 24%, transparent)' }}>
                    <p className="text-[11px] font-bold" style={{ color: sel.recuperacao_pendente_em ? '#ef4444' : '#d97706' }}>
                      {sel.recuperacao_pendente_em
                        ? `Pagamento recusado em ${dataCurta(sel.recuperacao_pendente_em)}`
                        : 'Abriu o checkout do vitalício e não concluiu'}
                      {sel.vitalicio_intent ? ` · tier ${sel.vitalicio_intent}` : ''}
                    </p>
                    <p className="text-[11px] text-foreground/80">
                      {sel.recuperacao_pendente_em
                        ? (textoMotivo(sel.recuperacao_motivo) || 'Motivo não registrado (tentativa anterior à migration 102).')
                        : 'Sem registro de recusa: pode ter sido recusa antiga não gravada, Pix não pago ou desistência.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Abrir conversa no SEU WhatsApp (o de suporte) — sem salvar o contato */}
              {sel.phone && (
                <Section title="Falar no WhatsApp">
                  <textarea
                    value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
                    placeholder="Mensagem já preenchida (opcional)…"
                    className="w-full rounded-xl bg-background border border-border p-3 text-sm resize-none focus:outline-none focus:border-primary"
                  />
                  <a
                    href={`https://wa.me/${sel.phone.replace(/\D/g, '')}${msg.trim() ? `?text=${encodeURIComponent(msg.trim())}` : ''}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full h-11 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-all"
                    style={{ minHeight: 44 }}
                  >
                    <Send size={15} /> Abrir no meu WhatsApp
                  </a>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Abre a conversa com o cliente no <b className="text-foreground">seu</b> WhatsApp (o que estiver logado no navegador/celular) — sem precisar salvar o número. Se escrever acima, a mensagem já vai preenchida.
                  </p>
                </Section>
              )}

              {/* Plano */}
              <Section title="Plano">
                <PlanoEditor atual={sel.plano} onAplicar={(plano, dias) => acao('set_plano', { plano, dias })} />
                <button onClick={() => acao('stripe_sync')} className="w-full h-10 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2">
                  <Zap size={14} /> Sincronizar com o Stripe
                </button>

                {/* Excluir do MRR — cortesia / acesso grátis. Só faz sentido em
                    plano pago; num inativo não conta mesmo.
                    ⚠️ A LINHA INTEIRA é UM botão. Não pode ser <label> com um
                    <button> dentro: o label reencaminha o clique pro botão
                    (button é "labelable") e o toggle disparava DUAS vezes,
                    voltando ao estado original — parecia "não funcionar". */}
                {sel.plano !== 'inativo' && (
                  <button
                    type="button" role="switch" aria-checked={!!sel.mrr_excluir}
                    onClick={() => acao('set_mrr_excluir', { excluir: !sel.mrr_excluir })}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors"
                    style={{
                      borderColor: sel.mrr_excluir ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                      background: sel.mrr_excluir ? 'hsl(var(--primary) / .08)' : 'hsl(var(--muted) / .2)',
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">Não contar no MRR</span>
                      <span className="block text-[11px] text-muted-foreground leading-snug">
                        {sel.mrr_excluir ? 'Fora do MRR (cortesia / acesso grátis).' : 'Acesso grátis / cortesia — tira da soma do MRR.'}
                      </span>
                    </span>
                    <span className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors"
                          style={{ background: sel.mrr_excluir ? 'hsl(var(--primary))' : 'hsl(var(--fg-muted) / .3)' }}>
                      <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                            style={{ transform: sel.mrr_excluir ? 'translateX(22px)' : 'translateX(2px)' }} />
                    </span>
                  </button>
                )}
                {sel.assinatura_cancelada && (
                  <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangle size={12} /> Assinatura cancelada na Stripe — já fora do MRR.
                  </p>
                )}
              </Section>

              {/* WhatsApp */}
              <Section title="WhatsApp">
                <PhoneEditor onSet={(phone) => acao('set_phone', { phone })} />
                <div className="flex gap-2">
                  <button onClick={() => acao('liberar_numero')} className="flex-1 h-10 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2">
                    <Phone size={14} /> Liberar número
                  </button>
                  <button onClick={() => acao('reset_welcome')} className="flex-1 h-10 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40">
                    Reenviar boas-vindas
                  </button>
                </div>
              </Section>

              {/* Perigo */}
              <Section title="Zona de perigo">
                <button onClick={apagar} className="w-full h-10 rounded-xl border border-red-300 dark:border-red-900/60 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center justify-center gap-2">
                  <Trash2 size={14} /> Apagar usuário (dados + login)
                </button>
              </Section>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold shadow-2xl animate-fade-in" role="status">
          {toast}
        </div>
      )}
    </DashboardLayout>
  );
}

function Stat({ label, value, hint, destaque, alerta, onClick }: { label: string; value: any; hint?: string; destaque?: boolean; alerta?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick}
            className={`text-left rounded-2xl border p-3.5 transition-all ${onClick ? 'hover:-translate-y-0.5 cursor-pointer' : 'cursor-default'} ${alerta ? 'border-red-300 dark:border-red-900/60' : 'border-border'}`}
            style={destaque ? { background: `color-mix(in srgb, ${BRAND} 6%, transparent)`, borderColor: `color-mix(in srgb, ${BRAND} 25%, transparent)` } : { background: 'hsl(var(--bg-card) / 0.5)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${alerta ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`} style={destaque ? { color: BRAND } : undefined}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="text-foreground font-medium mt-0.5">{children}</div>
    </div>
  );
}

function PlanoEditor({ atual, onAplicar }: { atual: Plano; onAplicar: (plano: Plano, dias: number) => void }) {
  const [plano, setPlano] = useState<Plano>(atual);
  const [dias, setDias] = useState(30);
  return (
    <div className="flex gap-2">
      <select value={plano} onChange={(e) => setPlano(e.target.value as Plano)} className="flex-1 h-10 rounded-xl bg-card border border-border text-sm px-2 focus:outline-none focus:border-primary">
        <option value="basico">Básico</option>
        <option value="premium">Premium</option>
        <option value="platinum">Platinum</option>
        <option value="inativo">Inativo</option>
      </select>
      {plano !== 'inativo' && (
        <input type="number" value={dias} onChange={(e) => setDias(Number(e.target.value))} className="w-16 h-10 rounded-xl bg-card border border-border text-sm text-center tabular-nums focus:outline-none focus:border-primary" title="dias de validade" />
      )}
      <button onClick={() => onAplicar(plano, dias)} className="h-10 px-4 rounded-xl text-sm font-bold text-white inline-flex items-center gap-1.5" style={{ background: BRAND }}>
        <Check size={14} /> Aplicar
      </button>
    </div>
  );
}

function PhoneEditor({ onSet }: { onSet: (phone: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="5532999167475 (com 55)" inputMode="numeric"
             className="flex-1 h-10 rounded-xl bg-card border border-border text-sm px-3 tabular-nums placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
      <button onClick={() => { if (v.replace(/\D/g, '').length >= 12) onSet(v.replace(/\D/g, '')); }}
              className="h-10 px-3 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40">Definir</button>
    </div>
  );
}

// ── Comunicado em massa (aba do painel) ──────────────────────────────────────
const PLANOS_ENVIO: { id: Plano; label: string }[] = [
  { id: 'premium', label: 'Premium' },
  { id: 'basico',  label: 'Básico' },
  { id: 'kit',     label: 'Kit' },
  { id: 'platinum', label: 'Platinum' },
  { id: 'inativo', label: 'Não pagantes' },
];

function Comunicados({ flash }: { flash: (m: string) => void }) {
  const [texto, setTexto] = useState('');
  const [planos, setPlanos] = useState<Plano[]>(['premium', 'platinum', 'basico', 'kit']);
  const [testePhone, setTestePhone] = useState('');
  const [busy, setBusy] = useState<'' | 'contar' | 'teste' | 'disparar'>('');
  const [total, setTotal] = useState<number | null>(null);
  const [soRecorrentes, setSoRecorrentes] = useState(false);

  const toggle = (p: Plano) => { setTotal(null); setPlanos((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]); };

  async function post(body: Record<string, unknown>) {
    const r = await fetch('/api/admin/broadcast', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (d?.erro) throw new Error(d.erro);
    return d;
  }

  async function contar() {
    if (planos.length === 0) { flash('⚠️ Marque ao menos um plano.'); return; }
    setBusy('contar');
    try { const d = await post({ modo: 'contar', planos, apenasRecorrentes: soRecorrentes }); setTotal(d.total ?? 0); }
    catch (e) { flash('⚠️ ' + (e instanceof Error ? e.message : 'falhou')); }
    finally { setBusy(''); }
  }

  async function enviarTeste() {
    if (!texto.trim()) { flash('⚠️ Escreva a mensagem primeiro.'); return; }
    setBusy('teste');
    try {
      const d = await post({ modo: 'teste', texto: texto.trim(), testePhone: testePhone.replace(/\D/g, '') });
      // O aviso vem quando o modelo de N parágrafos não está aprovado e o texto
      // saiu achatado. Sem mostrar, o admin dispara pra base inteira achando que
      // os parágrafos foram.
      flash(d?.aviso ? `⚠️ ${d.aviso}` : `Teste enviado ✓ — confere no seu WhatsApp${d?.nome ? ` (saiu como "Oi, ${String(d.nome).split(' ')[0]}!")` : ''}`);
    }
    catch (e) { flash('⚠️ ' + (e instanceof Error ? e.message : 'falhou')); }
    finally { setBusy(''); }
  }

  async function disparar() {
    if (!texto.trim()) { flash('⚠️ Escreva a mensagem primeiro.'); return; }
    if (planos.length === 0) { flash('⚠️ Marque ao menos um plano.'); return; }
    // Conta primeiro pra confirmar com o número real.
    setBusy('disparar');
    let n = 0;
    try { const d = await post({ modo: 'contar', planos, apenasRecorrentes: soRecorrentes }); n = d.total ?? 0; setTotal(n); }
    catch (e) { flash('⚠️ ' + (e instanceof Error ? e.message : 'falhou')); setBusy(''); return; }
    setBusy('');
    if (!n) { flash('Ninguém nesse filtro.'); return; }
    if (!confirm(`Enviar esse comunicado pra ${n} pessoa(s)?\n\nManda WhatsApp de verdade agora e NÃO dá pra desfazer.`)) return;
    if (!confirm(`Confirma mesmo? ${n} mensagens vão sair.`)) return;
    setBusy('disparar');
    try { const d = await post({ modo: 'disparar', texto: texto.trim(), planos, apenasRecorrentes: soRecorrentes }); flash(`Disparo iniciado pra ${d.total ?? n} pessoas ✓`); }
    catch (e) { flash('⚠️ ' + (e instanceof Error ? e.message : 'falhou')); }
    finally { setBusy(''); }
  }

  const chars = texto.trim().length;

  return (
    <div className="space-y-4">
      {/* Aviso */}
      <div className="rounded-2xl border p-3.5 flex items-start gap-2.5"
           style={{ background: 'color-mix(in srgb, #f59e0b 8%, transparent)', borderColor: 'color-mix(in srgb, #f59e0b 30%, transparent)' }}>
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-foreground/80 leading-relaxed">
          Envio <strong>real</strong> pelo WhatsApp oficial da Sora, pra vários números de uma vez. Sempre mande um <strong>teste pro seu número</strong> antes — depois de disparar não dá pra cancelar.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
            <Megaphone size={16} style={{ color: BRAND }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-none">Comunicado em massa</h2>
            <p className="text-[11px] text-muted-foreground mt-1">
              Template <b className="text-foreground">atualizacao_sora</b>: já abre com
              &ldquo;Oi, &lt;nome&gt;! Nova atualização no ar!&rdquo; e leva a capa.
              Separe parágrafos com <b className="text-foreground">linha em branco</b> (até 3);
              quebra simples vira espaço.
            </p>
          </div>
        </div>

        {/* Mensagem */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Mensagem</label>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4}
                    placeholder="Não repita a saudação — o template já diz “Oi, <nome>!”. Comece pelo aviso: Novidade! Agora a Sora…"
                    className="w-full rounded-xl bg-background border border-border p-3 text-sm resize-none focus:outline-none focus:border-primary" />
          <p className="text-[11px] text-muted-foreground text-right tabular-nums">{chars} caracteres</p>
        </div>

        {/* Quem recebe */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Quem recebe</label>
          <div className="flex flex-wrap gap-1.5">
            {PLANOS_ENVIO.map(({ id, label }) => {
              const on = planos.includes(id);
              const cor = PLANO_META[id]?.cor || '#71717a';
              return (
                <button key={id} onClick={() => toggle(id)}
                        className={`h-9 px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-all ${on ? 'text-white' : 'text-muted-foreground hover:text-foreground border-border'}`}
                        style={on ? { background: cor, borderColor: cor } : undefined}>
                  {on && <Check size={12} />} {label}
                </button>
              );
            })}
          </div>
          {/* Vitalício tem plano='premium' no banco, então filtrar só por plano
              o inclui. Pra aviso de recurso de assinatura (ex.: Open Finance)
              isso mandaria a novidade pra quem não tem acesso a ela. */}
          <button onClick={() => { setTotal(null); setSoRecorrentes((v) => !v); }}
                  role="switch" aria-checked={soRecorrentes}
                  className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border hover:bg-muted/30 transition-colors text-left"
                  style={{ minHeight: 44 }}>
            <span className="min-w-0">
              <span className="text-xs font-bold text-foreground block">Só quem assina (exclui vitalício)</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                Use em aviso de recurso que é só da assinatura — o vitalício aparece como Premium.
              </span>
            </span>
            <span className={`w-10 h-6 rounded-full flex-shrink-0 relative transition-colors ${soRecorrentes ? '' : 'bg-muted'}`}
                  style={soRecorrentes ? { background: BRAND } : undefined}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${soRecorrentes ? 'left-5' : 'left-1'}`} />
            </span>
          </button>
          <p className="text-[11px] text-muted-foreground">Só usuários com WhatsApp vinculado recebem. Números repetidos entram uma vez só.</p>
        </div>

        {/* Teste */}
        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Teste antes de disparar</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={testePhone} onChange={(e) => setTestePhone(e.target.value)} inputMode="numeric"
                     placeholder="Número de teste (vazio = o seu)"
                     className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border text-sm tabular-nums placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
            </div>
            <button onClick={enviarTeste} disabled={!!busy || !texto.trim()}
                    className="h-11 px-4 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2 disabled:opacity-50">
              {busy === 'teste' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar teste
            </button>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
          <button onClick={contar} disabled={!!busy || planos.length === 0}
                  className="h-11 px-4 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted/40 inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy === 'contar' ? <Loader2 size={14} className="animate-spin" /> : <UsersIcon size={14} />}
            {total !== null ? `${total} destinatário${total === 1 ? '' : 's'}` : 'Contar destinatários'}
          </button>
          <button onClick={disparar} disabled={!!busy || !texto.trim() || planos.length === 0}
                  className="flex-1 h-11 px-4 rounded-xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/25 inline-flex items-center justify-center gap-2 disabled:opacity-50">
            {busy === 'disparar' ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />} Disparar comunicado
          </button>
        </div>
      </div>
    </div>
  );
}
