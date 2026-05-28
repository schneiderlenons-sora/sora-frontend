'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import IconeMarca, { slugDaMarca } from '@/components/ui/IconeMarca';
import {
  Plus, Pencil, Trash2, X, Loader2, Wallet as WalletIcon, Wallet,
  TrendingUp, CreditCard, PiggyBank, Banknote, CheckCircle2,
  Archive, ArchiveRestore, ArrowLeftRight, DollarSign,
  Shield, Star, Sparkles, AlertCircle, Eye, EyeOff, Link2, Clock, Zap,
  ChevronDown,
} from 'lucide-react';

// Bancos suportados pelo Open Finance via Pluggy (em breve disponíveis)
const BANCOS_OPEN_FINANCE = [
  { nome: 'Nubank' },
  { nome: 'Itaú' },
  { nome: 'Bradesco' },
  { nome: 'Santander' },
  { nome: 'Banco do Brasil' },
  { nome: 'Caixa' },
  { nome: 'Inter' },
  { nome: 'C6 Bank' },
  { nome: 'BTG Pactual' },
  { nome: 'XP' },
  { nome: 'Next' },
  { nome: 'Mercado Pago' },
  { nome: 'PicPay' },
  { nome: 'PagBank' },
  { nome: 'Original' },
  { nome: 'Safra' },
  { nome: 'Sicredi' },
  { nome: 'Neon' },
];

const BRAND = '#61D17B';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// ─────────────────────────────────────────────────────────────
// CONFIGURAÇÕES
// ─────────────────────────────────────────────────────────────
const TIPOS = ['Corrente', 'Poupança', 'Vale Alimentação', 'Dinheiro'] as const;

const TIPO_ICON: Record<string, any> = {
  'Corrente':         WalletIcon,
  'Poupança':         PiggyBank,
  'Crédito':          CreditCard,
  'Vale-Alimentação': Banknote,
  'Vale Alimentação': Banknote,
  'Dinheiro':         Banknote,
};

const TIPO_HUE: Record<string, number> = {
  'Corrente':         142,
  'Poupança':         215,
  'Crédito':          0,
  'Vale-Alimentação': 35,
  'Vale Alimentação': 35,
  'Dinheiro':         50,
};

// Gradientes de banco — tom rico para o avatar circular
const BANCO_GRAD: Record<string, [string, string]> = {
  nubank:    ['#8b16f0', '#5e1ba8'],
  inter:     ['#ff7a00', '#e85a00'],
  itau:      ['#ec7000', '#cc5500'],
  bradesco:  ['#cc092f', '#7a061d'],
  santander: ['#ec0000', '#a30000'],
  caixa:     ['#0067b1', '#003d6b'],
  c6:        ['#27272a', '#0a0a0a'],
  mercado:   ['#00b4ff', '#0070b8'],
  picpay:    ['#21c25e', '#0d8a3a'],
  bb:        ['#fcc100', '#c69b00'],
  banco:     ['#fcc100', '#c69b00'],
  safra:     ['#1e3a5f', '#0d1f33'],
  alelo:     ['#00b85c', '#007a3d'],
  ticket:    ['#ff6b00', '#cc5500'],
  vr:        ['#003366', '#001a33'],
  sodexo:    ['#e30613', '#990008'],
  dinheiro:  ['#10b981', '#047857'],
  pix:       ['#32bcad', '#1a8077'],
};

function bancoGrad(nome: string): [string, string] {
  const lower = (nome || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [key, grad] of Object.entries(BANCO_GRAD)) {
    if (lower.includes(key)) return grad;
  }
  // Fallback: gera HSL baseado no hash do nome
  let hash = 0;
  for (let i = 0; i < lower.length; i++) hash = lower.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return [`hsl(${h} 65% 50%)`, `hsl(${h} 70% 35%)`];
}

interface Wallet {
  id: string;
  nome: string;
  tipo: string;
  saldo: number;
  limite: number;
  padrao?: boolean;
  arquivada?: boolean;
}

interface Form {
  nome:  string;
  tipo:  string;
  saldo: string;
}

const FORM_VAZIO: Form = { nome: '', tipo: 'Corrente', saldo: '' };

type Tab = 'ativas' | 'arquivadas';

// ─────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function ContasBancariasPage() {
  const { phone, perfil, limiteDe } = useAuth();

  const [wallets,    setWallets]    = useState<Wallet[]>([]);
  const [tab,        setTab]        = useState<Tab>('ativas');
  const [modal,      setModal]      = useState(false);
  const [editando,   setEditando]   = useState<Wallet | null>(null);
  const [form,       setForm]       = useState<Form>(FORM_VAZIO);
  const [salvando,   setSalvando]   = useState(false);
  const [deletando,  setDeletando]  = useState<string | null>(null);
  const [sucesso,    setSucesso]    = useState(false);
  const [erro,       setErro]       = useState('');
  const [ocultar,    setOcultar]    = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState<Wallet | null>(null);
  const [transferOpen,setTransferOpen] = useState(false);
  const [openFinanceAberto, setOpenFinanceAberto] = useState(false);

  const plano        = perfil?.plano || 'inativo';
  const limiteContas = limiteDe('contas');

  // ── Carregamento sem bloquear UI ───────────────────────────
  // Marca a wallet padrão (perfil.wallet_padrao_id) com padrao:true
  // pra UI renderizar corretamente.
  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const data = await api.wallets.listar(phone);
      const walletPadraoId = perfil?.wallet_padrao_id || null;
      const comPadrao = (data || []).map((w: Wallet) => ({
        ...w,
        padrao: walletPadraoId ? w.id === walletPadraoId : !!w.padrao,
      }));
      setWallets(comPadrao);
    } catch (e) { console.warn('[contas] listar erro:', e); }
  }, [phone, perfil]);

  useEffect(() => { carregar(); }, [carregar]);

  // ── Helpers ────────────────────────────────────────────────
  const walletsAtivas    = useMemo(() => wallets.filter(w => !w.arquivada), [wallets]);
  const walletsArquivadas= useMemo(() => wallets.filter(w => w.arquivada),  [wallets]);
  const walletsList      = tab === 'ativas' ? walletsAtivas : walletsArquivadas;

  const saldoTotal = useMemo(() =>
    walletsAtivas
      .filter(w => w.tipo !== 'Crédito')
      .reduce((s, w) => s + (w.saldo || 0), 0),
    [walletsAtivas]
  );

  const podeAdicionar = walletsAtivas.length < limiteContas;

  // ── Ações ──────────────────────────────────────────────────
  function abrirModal(w?: Wallet) {
    setErro(''); setSucesso(false);
    if (w) {
      setEditando(w);
      setForm({ nome: w.nome, tipo: w.tipo, saldo: String(w.saldo) });
    } else {
      setEditando(null);
      setForm(FORM_VAZIO);
    }
    setModal(true);
  }

  function fecharModal() {
    setModal(false); setEditando(null); setForm(FORM_VAZIO);
    setErro(''); setSucesso(false);
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Informe um nome.'); return; }
    if (!phone) {
      setErro('Telefone não vinculado. Vincule o WhatsApp antes de criar uma conta.');
      return;
    }
    setSalvando(true); setErro('');

    const payload = {
      phone,
      nome:   form.nome.trim(),
      tipo:   form.tipo,
      saldo:  parseFloat((form.saldo || '0').replace(',', '.')) || 0,
      limite: 0,
    };
    console.log('[contas] salvar wallet — payload:', payload);

    try {
      const resp = await api.wallets.salvar(payload);
      console.log('[contas] salvar wallet — resposta:', resp);
      setSucesso(true);
      await carregar();
      setTimeout(fecharModal, 1000);
    } catch (e: any) {
      console.error('[contas] salvar wallet — erro:', e);
      setErro(e?.message ? `Erro ao salvar: ${e.message}` : 'Erro ao salvar conta (sem detalhes do servidor).');
    } finally {
      setSalvando(false);
    }
  }

  async function deletar(id: string) {
    if (!confirm('Excluir esta conta? Esta ação não pode ser desfeita.')) return;
    setDeletando(id);
    try {
      await api.wallets.deletar(id);
      setWallets(prev => prev.filter(w => w.id !== id));
    } catch (e: any) {
      alert('Erro ao excluir: ' + (e.message || ''));
    } finally {
      setDeletando(null);
    }
  }

  async function tornarPadrao(w: Wallet) {
    // Otimista
    setWallets(prev => prev.map(x => ({ ...x, padrao: x.id === w.id })));
    if (!perfil?.id) return;
    try {
      await supabase.from('users').update({ wallet_padrao_id: w.id }).eq('id', perfil.id);
    } catch (e: any) {
      console.warn('[contas] erro ao salvar wallet_padrao_id:', e);
    }
  }

  function toggleArquivar(w: Wallet) {
    setWallets(prev => prev.map(x => x.id === w.id ? { ...x, arquivada: !x.arquivada } : x));
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        {/* ═══════════════════════════════════════════════════════
            HERO HEADER
        ═══════════════════════════════════════════════════════ */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>

          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(134 55% 60% / .12) 0%, transparent 60%)' }} />

          <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
                <Sparkles size={12} style={{ color: BRAND }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
                  {walletsAtivas.length}/{limiteContas === Infinity ? '∞' : limiteContas} contas
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
                Contas bancárias
              </h1>
              <p className="text-muted-foreground text-sm mt-2 max-w-md">
                Organize suas finanças criando múltiplas contas (Bradesco, Nubank, Itaú e outras).
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

              {walletsAtivas.length >= 2 && (
                <button
                  onClick={() => setTransferOpen(true)}
                  className="btn-outline px-3 py-2 text-sm gap-2"
                >
                  <ArrowLeftRight size={14} /> Transferir
                </button>
              )}

              <button
                onClick={() => abrirModal()}
                disabled={!podeAdicionar}
                className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm"
                title={!podeAdicionar ? 'Limite de contas atingido' : 'Adicionar nova conta'}
              >
                <Plus size={16} /> Adicionar conta
              </button>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            SALDO TOTAL — CARD PREMIUM
        ═══════════════════════════════════════════════════════ */}
        {walletsAtivas.length > 0 && (
          <div className="relative overflow-hidden rounded-3xl p-6 sm:p-7 animate-fade-in"
               style={{
                 background: 'linear-gradient(135deg, #0a1f12 0%, #1a3d28 50%, #0d2418 100%)',
                 animationDelay: '60ms',
               }}>
            {/* Mesh decorativo */}
            <div className="absolute inset-0 pointer-events-none opacity-50"
                 style={{ background: `radial-gradient(circle at 20% 10%, ${BRAND} 0%, transparent 60%), radial-gradient(circle at 80% 90%, hsl(200 80% 60%) 0%, transparent 60%)` }} />

            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Shield size={11} /> Saldo total disponível
                </p>
                <p className="text-4xl sm:text-5xl font-bold text-white tabular tracking-tight mt-2 leading-none">
                  {ocultar ? '••••••••' : fmt(saldoTotal)}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-white/40 text-xs flex items-center gap-1.5">
                    <CheckCircle2 size={11} className="text-green-400" />
                    {walletsAtivas.filter(w => w.tipo !== 'Crédito').length} conta{walletsAtivas.length !== 1 ? 's' : ''} ativa{walletsAtivas.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-white/20">·</span>
                  <span className="text-white/40 text-xs">Plano {plano}</span>
                </div>
              </div>

              {/* Ícone decorativo elegante */}
              <div className="hidden sm:flex flex-shrink-0 w-20 h-20 rounded-2xl items-center justify-center"
                   style={{
                     background: `linear-gradient(135deg, ${BRAND}30, ${BRAND}10)`,
                     animation: 'float 3s ease-in-out infinite',
                     border: `1px solid ${BRAND}30`,
                   }}>
                <WalletIcon size={32} style={{ color: BRAND }} />
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            TABS
        ═══════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between animate-fade-in" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center gap-1 bg-muted/40 rounded-2xl p-1.5 w-fit">
            {([
              { v: 'ativas',     l: 'Ativas',     count: walletsAtivas.length     },
              { v: 'arquivadas', l: 'Arquivadas', count: walletsArquivadas.length },
            ] as { v: Tab; l: string; count: number }[]).map(({ v, l, count }) => (
              <button
                key={v}
                onClick={() => setTab(v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  tab === v
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {l}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular ${
                  tab === v ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-muted-foreground'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            LISTA DE CONTAS
        ═══════════════════════════════════════════════════════ */}
        {walletsList.length === 0 ? (
          <EmptyState
            tab={tab}
            podeAdicionar={podeAdicionar}
            onAdicionar={() => abrirModal()}
          />
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {walletsList.map((w, i) => (
              <WalletCard
                key={w.id}
                wallet={w}
                index={i}
                ocultar={ocultar}
                deletando={deletando === w.id}
                onEditar={() => abrirModal(w)}
                onDeletar={() => deletar(w.id)}
                onTornarPadrao={() => tornarPadrao(w)}
                onArquivar={() => toggleArquivar(w)}
                onAjustar={() => setAjusteOpen(w)}
                onTransferir={() => setTransferOpen(true)}
              />
            ))}

            {/* Card de adicionar (apenas tab ativas) */}
            {tab === 'ativas' && podeAdicionar && (
              <button
                onClick={() => abrirModal()}
                className="group rounded-3xl border-2 border-dashed border-border hover:border-primary/60
                           flex flex-col items-center justify-center gap-3 p-8 min-h-[280px]
                           text-muted-foreground hover:text-primary hover:bg-primary/5
                           transition-all duration-200 animate-fade-in"
                style={{ animationDelay: `${walletsList.length * 50}ms` }}
              >
                <div className="w-14 h-14 rounded-2xl bg-muted group-hover:bg-primary/15 flex items-center justify-center transition-colors">
                  <Plus size={22} className="transition-transform group-hover:rotate-90 duration-300" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold">Adicionar nova conta</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Bradesco, Nubank, Itaú...</p>
                </div>
              </button>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════
            CONECTAR VIA OPEN FINANCE — colapsado por padrão
        ═══════════════════════════════════════════════════════ */}
        <div className="card rounded-3xl animate-fade-in relative overflow-hidden"
             style={{ animationDelay: '180ms' }}>
          {/* Halo decorativo */}
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full pointer-events-none opacity-15"
               style={{ background: `radial-gradient(circle, ${BRAND} 0%, transparent 70%)` }} />

          <button
            onClick={() => setOpenFinanceAberto(v => !v)}
            className="relative w-full flex items-center gap-3 px-5 sm:px-6 py-4 text-left hover:bg-muted/30 transition-colors"
            aria-expanded={openFinanceAberto}
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-glow-sm"
                 style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND}aa)` }}>
              <Link2 size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  Conectar via Open Finance
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                  <Clock size={9} /> Em breve
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">
                Sincronize seus extratos automaticamente — toque para ver os bancos suportados.
              </p>
            </div>
            <ChevronDown
              size={18}
              className="text-muted-foreground flex-shrink-0 transition-transform duration-300"
              style={{ transform: openFinanceAberto ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>

          {openFinanceAberto && (
            <div className="relative px-5 sm:px-6 pb-5 sm:pb-6 animate-fade-in">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-2">
                {BANCOS_OPEN_FINANCE.map((b, i) => {
                  const conhecida = slugDaMarca(b.nome);
                  return (
                    <div
                      key={b.nome}
                      title={`${b.nome} — em breve via Open Finance`}
                      aria-label={`${b.nome} — em breve`}
                      className="group relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-muted/30 border border-border/60 cursor-not-allowed transition-all hover:bg-muted/50 hover:border-primary/30 animate-fade-in"
                      style={{ animationDelay: `${i * 25}ms` }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center overflow-hidden ring-1 ring-border/40 transition-transform group-hover:scale-105">
                        {conhecida ? (
                          <IconeMarca
                            nome={b.nome}
                            size={28}
                            fallback={<span className="text-base font-bold text-foreground">{b.nome.charAt(0)}</span>}
                          />
                        ) : (
                          <span className="text-base font-bold text-foreground">{b.nome.charAt(0)}</span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold text-foreground text-center leading-tight line-clamp-1">
                        {b.nome}
                      </p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
                        Em breve
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-start gap-2 mt-5 pt-4 border-t border-border/40">
                <Zap size={12} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Estamos integrando Open Finance.</strong>{' '}
                  Em breve será possível sincronizar gastos e saldo dos seus bancos automaticamente.
                  Por enquanto, adicione suas contas <strong className="text-foreground">manualmente</strong>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAIS
      ═══════════════════════════════════════════════════════ */}
      {modal && (
        <ContaModal
          form={form}
          setForm={setForm}
          editando={editando}
          salvando={salvando}
          sucesso={sucesso}
          erro={erro}
          onClose={fecharModal}
          onSalvar={salvar}
        />
      )}

      {ajusteOpen && (
        <AjusteSaldoModal
          wallet={ajusteOpen}
          phone={phone}
          onClose={() => setAjusteOpen(null)}
          onSuccess={carregar}
        />
      )}

      {transferOpen && (
        <TransferenciaModal
          wallets={walletsAtivas}
          onClose={() => setTransferOpen(false)}
        />
      )}
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD DE CONTA — HORIZONTAL, INSPIRADO NA REFERÊNCIA MAS MAIS POLIDO
// ─────────────────────────────────────────────────────────────
function WalletCard({
  wallet, index, ocultar, deletando,
  onEditar, onDeletar, onTornarPadrao, onArquivar, onAjustar, onTransferir,
}: {
  wallet:        Wallet;
  index:         number;
  ocultar:       boolean;
  deletando:     boolean;
  onEditar:      () => void;
  onDeletar:     () => void;
  onTornarPadrao:() => void;
  onArquivar:    () => void;
  onAjustar:     () => void;
  onTransferir:  () => void;
}) {
  const [gradStart, gradEnd] = bancoGrad(wallet.nome);
  const Icon  = TIPO_ICON[wallet.tipo] || WalletIcon;
  const hue   = TIPO_HUE[wallet.tipo] ?? 220;
  const inicial = wallet.nome.charAt(0).toUpperCase();
  const isNeg = wallet.saldo < 0;

  return (
    <div
      className="group relative card rounded-3xl p-5 animate-fade-in overflow-hidden hover:shadow-lg transition-all duration-200"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Linha decorativa superior */}
      <div className="absolute top-0 left-0 right-0 h-1 opacity-80"
           style={{ background: `linear-gradient(90deg, ${gradStart}, ${gradEnd})` }} />

      {/* Halo decorativo */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full pointer-events-none opacity-15"
           style={{ background: `radial-gradient(circle, ${gradStart} 0%, transparent 70%)` }} />

      {/* ─── Cabeçalho ─── */}
      <div className="relative flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar com gradient do banco — substitui pela logo oficial quando reconhecemos a marca */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-lg ring-1 ring-white/20 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})` }}
          >
            {slugDaMarca(wallet.nome)
              ? <IconeMarca nome={wallet.nome} size={28} className="brightness-0 invert" fallback={<span>{inicial}</span>} />
              : <span>{inicial}</span>}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-base truncate">{wallet.nome}</h3>
              {wallet.padrao && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                  <Star size={8} fill="currentColor" /> Padrão
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Icon size={11} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground font-medium">{wallet.tipo}</p>
            </div>
          </div>
        </div>

        {/* Botão excluir — só aparece no hover */}
        <button
          onClick={onDeletar}
          disabled={deletando}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          title="Excluir"
        >
          {deletando ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>

      {/* ─── Saldo ─── */}
      <div className="relative rounded-2xl p-4 mb-3"
           style={{ background: `hsl(${hue} 70% 50% / 0.06)` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: `hsl(${hue} 55% 45%)` }}>
            <TrendingUp size={13} />
            <span>Saldo atual</span>
          </div>
          <p className={`text-xl font-bold tabular tracking-tight ${
            isNeg
              ? 'text-red-500'
              : ''
          }`}
          style={{ color: !isNeg ? `hsl(${hue} 55% 40%)` : undefined }}>
            {ocultar ? '••••••' : fmt(wallet.saldo)}
          </p>
        </div>
      </div>

      {/* ─── Conta nomeada / padrão ─── */}
      <button
        onClick={onTornarPadrao}
        className="w-full text-left rounded-2xl p-3.5 mb-4 bg-muted/40 hover:bg-muted/70 transition-colors flex items-start gap-2.5 group/btn"
      >
        <div className="w-7 h-7 rounded-lg bg-card flex items-center justify-center flex-shrink-0 ring-1 ring-border/60">
          <Shield size={13} className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Conta nomeada</p>
          <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
            Ao lançar via WhatsApp, só irá registrar nessa conta se informar o nome dela.
          </p>
        </div>
        {wallet.padrao ? (
          <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5 flex-shrink-0">
            <CheckCircle2 size={11} /> Padrão
          </span>
        ) : (
          <span className="text-[11px] font-medium text-primary opacity-0 group-hover/btn:opacity-100 transition-opacity flex-shrink-0">
            Tornar padrão →
          </span>
        )}
      </button>

      {/* ─── Ações ─── */}
      <div className="grid grid-cols-4 gap-1 -mx-1">
        <ActionButton icon={DollarSign}    label="Ajustar"    onClick={onAjustar} />
        <ActionButton icon={ArrowLeftRight} label="Transferir" onClick={onTransferir} />
        <ActionButton icon={Pencil}        label="Editar"     onClick={onEditar} />
        <ActionButton
          icon={wallet.arquivada ? ArchiveRestore : Archive}
          label={wallet.arquivada ? 'Restaurar' : 'Arquivar'}
          onClick={onArquivar}
        />
      </div>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 py-2.5 rounded-xl hover:bg-muted/60 transition-colors group/act"
    >
      <Icon size={16} className="text-muted-foreground group-hover/act:text-foreground transition-colors" />
      <span className="text-[11px] font-medium text-muted-foreground group-hover/act:text-foreground transition-colors">
        {label}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────
function EmptyState({ tab, podeAdicionar, onAdicionar }: { tab: Tab; podeAdicionar: boolean; onAdicionar: () => void }) {
  if (tab === 'arquivadas') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-border/60 bg-muted/40">
          <Archive size={40} className="text-muted-foreground" />
        </div>
        <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma conta arquivada</h3>
        <p className="text-muted-foreground text-sm mb-2 max-w-xs leading-relaxed">
          Contas arquivadas ficarão disponíveis aqui para você restaurar quando quiser.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-glow animate-float" style={{background: 'var(--gradient-primary)'}}>
          <Wallet size={40} className="text-white" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma conta cadastrada</h3>
      <p className="text-muted-foreground text-sm mb-8 max-w-xs leading-relaxed">
        Adicione suas contas bancárias para acompanhar saldos e movimentações em um só lugar.
      </p>
      {podeAdicionar && (
        <button onClick={onAdicionar}
                className="btn-primary gap-2 px-8 py-3 text-base rounded-2xl shadow-glow">
          <Plus size={20} />
          Adicionar primeira conta
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL ADICIONAR/EDITAR CONTA
// ─────────────────────────────────────────────────────────────
function ContaModal({
  form, setForm, editando, salvando, sucesso, erro,
  onClose, onSalvar,
}: {
  form:     Form;
  setForm:  (f: Form | ((f: Form) => Form)) => void;
  editando: Wallet | null;
  salvando: boolean;
  sucesso:  boolean;
  erro:     string;
  onClose:  () => void;
  onSalvar: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border/60">

        {/* Header com gradient sutil */}
        <div className="relative px-6 py-5 border-b border-border/60 overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none"
               style={{ background: `radial-gradient(ellipse at top right, ${BRAND}40 0%, transparent 70%)` }} />
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                {editando ? 'Editar conta' : 'Adicionar conta'}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {editando ? 'Atualize as informações da conta' : 'Crie uma nova conta bancária'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {sucesso ? (
          <div className="flex flex-col items-center py-16 px-6 gap-3">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center animate-fade-in">
              <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <p className="font-bold text-foreground text-lg">Conta salva!</p>
            <p className="text-sm text-muted-foreground">Sua conta foi cadastrada com sucesso</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* Nome */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Nome
              </label>
              <input
                type="text"
                placeholder="Ex: Nubank, Itaú, Carteira..."
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className="input py-3"
                autoFocus
              />
            </div>

            {/* Tipo — pílulas grandes */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Tipo da conta
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS.map(t => {
                  const Icon = TIPO_ICON[t] || WalletIcon;
                  const hue  = TIPO_HUE[t];
                  const isActive = form.tipo === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: t }))}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        isActive
                          ? 'border-primary bg-primary/8 text-foreground shadow-glow-sm'
                          : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-muted'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                           style={{ background: isActive ? `hsl(${hue} 70% 50% / .15)` : 'hsl(var(--bg-card))' }}>
                        <Icon size={14} style={{ color: isActive ? `hsl(${hue} 65% 50%)` : 'hsl(var(--fg-muted))' }} />
                      </div>
                      <span>{t}</span>
                      {isActive && <CheckCircle2 size={14} className="ml-auto text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Saldo inicial */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Saldo inicial
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.saldo}
                  onChange={e => setForm(f => ({ ...f, saldo: e.target.value.replace(/[^\d.,]/g, '') }))}
                  className="input pl-11 py-3 tabular text-lg font-semibold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertCircle size={10} />
                Você pode atualizar o saldo a qualquer momento
              </p>
            </div>

            {/* Erro */}
            {erro && (
              <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{erro}</p>
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-2.5 pt-2">
              <button onClick={onClose} className="btn-outline flex-1 py-3 text-sm font-semibold">
                Cancelar
              </button>
              <button
                onClick={onSalvar}
                disabled={salvando}
                className="btn btn-primary flex-[2] py-3 text-sm font-semibold shadow-glow-sm"
              >
                {salvando
                  ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
                  : 'Salvar conta'
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL AJUSTE DE SALDO
// ─────────────────────────────────────────────────────────────
function AjusteSaldoModal({
  wallet, phone, onClose, onSuccess,
}: {
  wallet:    Wallet;
  phone:     string;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [novoSaldo, setNovoSaldo] = useState(String(wallet.saldo));
  const [salvando,  setSalvando]  = useState(false);
  const [erro,      setErro]      = useState('');

  async function handleSalvar() {
    setSalvando(true); setErro('');
    try {
      await api.wallets.salvar({
        phone,
        nome:  wallet.nome,
        tipo:  wallet.tipo,
        saldo: parseFloat(novoSaldo.replace(',', '.')),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao ajustar saldo.');
    } finally {
      setSalvando(false);
    }
  }

  const diff = parseFloat(novoSaldo.replace(',', '.')) - wallet.saldo;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border/60">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
          <h2 className="text-xl font-bold text-foreground tracking-tight">Ajustar saldo</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Conta</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{wallet.nome}</p>
            <p className="text-xs text-muted-foreground">
              Saldo atual: <span className="tabular font-semibold text-foreground">{fmt(wallet.saldo)}</span>
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
              Novo saldo
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                R$
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={novoSaldo}
                onChange={e => setNovoSaldo(e.target.value.replace(/[^\d.,-]/g, ''))}
                className="input pl-11 py-3 tabular text-lg font-semibold"
                autoFocus
              />
            </div>
            {!isNaN(diff) && diff !== 0 && (
              <p className={`text-xs mt-2 tabular ${diff > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {diff > 0 ? '+' : ''}{fmt(diff)} {diff > 0 ? 'de entrada' : 'de saída'}
              </p>
            )}
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">{erro}</p>
            </div>
          )}

          <div className="flex gap-2.5">
            <button onClick={onClose} className="btn-outline flex-1 py-3 text-sm font-semibold">Cancelar</button>
            <button onClick={handleSalvar} disabled={salvando} className="btn btn-primary flex-[2] py-3 text-sm font-semibold shadow-glow-sm">
              {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : 'Confirmar ajuste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MODAL TRANSFERÊNCIA ENTRE CONTAS
// ─────────────────────────────────────────────────────────────
function TransferenciaModal({
  wallets, onClose,
}: {
  wallets: Wallet[];
  onClose: () => void;
}) {
  const [origem,  setOrigem]  = useState(wallets[0]?.id || '');
  const [destino, setDestino] = useState(wallets[1]?.id || '');
  const [valor,   setValor]   = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border/60">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/60">
          <div>
            <h2 className="text-xl font-bold text-foreground tracking-tight">Transferir entre contas</h2>
            <p className="text-xs text-muted-foreground mt-1">Movimente valores entre suas contas</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">De</label>
            <select value={origem} onChange={e => setOrigem(e.target.value)} className="input py-3">
              {wallets.map(w => <option key={w.id} value={w.id}>{w.nome} — {fmt(w.saldo)}</option>)}
            </select>
          </div>

          <div className="flex justify-center">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <ArrowLeftRight size={16} className="text-primary rotate-90" />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Para</label>
            <select value={destino} onChange={e => setDestino(e.target.value)} className="input py-3">
              {wallets.filter(w => w.id !== origem).map(w => <option key={w.id} value={w.id}>{w.nome} — {fmt(w.saldo)}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Valor</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">R$</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valor}
                onChange={e => setValor(e.target.value.replace(/[^\d.,]/g, ''))}
                className="input pl-11 py-3 tabular text-lg font-semibold"
              />
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button onClick={onClose} className="btn-outline flex-1 py-3 text-sm font-semibold">Cancelar</button>
            <button onClick={onClose} className="btn btn-primary flex-[2] py-3 text-sm font-semibold shadow-glow-sm gap-2">
              <ArrowLeftRight size={14} /> Confirmar transferência
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
