'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { supabase } from '@/lib/supabase';
import { marcaDe } from '@/components/ui/IconeMarca';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import AvatarMembro from '@/components/ui/AvatarMembro';
import ExcluirContaModal from '@/components/contas/ExcluirContaModal';
import DetalhesContaModal from '@/components/contas/DetalhesContaModal';
// Conta em moeda estrangeira (migration 144). `saldo_brl` vem pronto do backend
// — o painel NÃO busca câmbio, senão cada tela teria a sua cotação e elas
// divergiriam entre si. O fallback pra `saldo` mantém tudo certo antes da
// migration e em payload antigo no cache do SWR, onde `saldo` já é BRL.
import { saldoBRL, normalizarMoeda, formatarMoeda, ehEstrangeira, MOEDAS } from '@/lib/moeda';
import {
  Plus, Pencil, Trash2, X, Loader2, Wallet as WalletIcon, Wallet,
  TrendingUp, CreditCard, PiggyBank, Banknote, CheckCircle2,
  Archive, ArchiveRestore, ArrowLeftRight, DollarSign,
  Shield, Star, Sparkles, AlertCircle, Eye, EyeOff,
  ChevronRight,
} from 'lucide-react';

const BRAND = 'hsl(var(--primary))';

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
  cheque_especial?: number;
  // Moeda da conta + equivalente em BRL calculado pelo BACKEND (migration 144).
  // ⚠️ `saldo_brl === null` significa CÂMBIO INDISPONÍVEL, não zero.
  moeda?: string | null;
  saldo_brl?: number | null;
  padrao?: boolean;
  arquivada?: boolean;
  dono?: { id: string; name: string; phone?: string; avatar_url?: string | null; avatar_preset?: string | null; avatar_cor?: string | null } | null;
}

interface Form {
  nome:  string;
  tipo:  string;
  saldo: string;
  cheque: string;   // limite de cheque especial (R$)
  moeda: string;    // ISO 4217 — 'BRL' por padrão
}

const FORM_VAZIO: Form = { nome: '', tipo: 'Corrente', saldo: '', cheque: '', moeda: 'BRL' };

type Tab = 'ativas' | 'arquivadas';

// ─────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function ContasClient({ phoneInicial, initialData }: { phoneInicial?: string; initialData?: any } = {}) {
  const { phone: authPhone, perfil, limiteDe } = useAuth();
  const phone = authPhone || phoneInicial || ''; // SSR: phone do servidor até hidratar

  const [wallets,    setWallets]    = useState<Wallet[]>([]);
  const [tab,        setTab]        = useState<Tab>('ativas');
  const [modal,      setModal]      = useState(false);
  const [editando,   setEditando]   = useState<Wallet | null>(null);
  const [form,       setForm]       = useState<Form>(FORM_VAZIO);
  const [salvando,   setSalvando]   = useState(false);
  const [contaExcluir, setContaExcluir] = useState<Wallet | null>(null);
  const [contaDetalhe, setContaDetalhe] = useState<Wallet | null>(null);
  const [sucesso,    setSucesso]    = useState(false);
  const [erro,       setErro]       = useState('');
  const [ocultar,    setOcultar]    = useState(false);
  const [ajusteOpen, setAjusteOpen] = useState<Wallet | null>(null);
  const [transferOpen,setTransferOpen] = useState(false);

  const plano        = perfil?.plano || 'inativo';
  const limiteContas = limiteDe('contas');
  // Em grupo compartilhado (não-Pessoal), mostra de quem é cada conta.
  const compartilhado = !/pessoal/i.test((perfil?.grupo_ativo as any)?.nome || '');

  // ── Carregamento sem bloquear UI ───────────────────────────
  // Marca a wallet padrão (perfil.wallet_padrao_id) com padrao:true
  // pra UI renderizar corretamente.
  // SWR cacheia (revisita instantânea); mantém `wallets` local pro otimismo
  // (definir padrão, arquivar e excluir atualizam a UI na hora).
  const { data: walletsRaw, mutate: mWallets } = useApi(phone ? `contas:wallets:${phone}` : null, () => api.wallets.listar(phone), { fallbackData: initialData });
  useEffect(() => {
    if (walletsRaw === undefined) return;
    const walletPadraoId = perfil?.wallet_padrao_id || null;
    setWallets((walletsRaw as Wallet[]).map((w: Wallet) => ({
      ...w,
      padrao: walletPadraoId ? w.id === walletPadraoId : !!w.padrao,
    })));
  }, [walletsRaw, perfil?.wallet_padrao_id]);

  const carregar = useCallback(() => mWallets(), [mWallets]);

  // ── Helpers ────────────────────────────────────────────────
  // Cartões de crédito NÃO aparecem aqui — eles têm a aba própria (Cartão de
  // crédito). Esta aba é só de contas bancárias, pra não confundir.
  const semCartoes       = useMemo(() => wallets.filter(w => w.tipo !== 'Crédito'), [wallets]);
  const walletsAtivas    = useMemo(() => semCartoes.filter(w => !w.arquivada), [semCartoes]);
  const walletsArquivadas= useMemo(() => semCartoes.filter(w => w.arquivada),  [semCartoes]);
  const walletsList      = tab === 'ativas' ? walletsAtivas : walletsArquivadas;

  const saldoTotal = useMemo(() =>
    walletsAtivas
      .filter(w => w.tipo !== 'Crédito')
      .reduce((s, w) => s + (saldoBRL(w) ?? 0), 0),
    [walletsAtivas]
  );

  const podeAdicionar = walletsAtivas.length < limiteContas;

  // ── Ações ──────────────────────────────────────────────────
  function abrirModal(w?: Wallet) {
    setErro(''); setSucesso(false);
    if (w) {
      setEditando(w);
      setForm({ nome: w.nome, tipo: w.tipo, saldo: String(w.saldo),
                cheque: w.cheque_especial ? String(w.cheque_especial) : '',
                moeda: normalizarMoeda(w.moeda) });
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
      cheque_especial: Math.abs(parseFloat((form.cheque || '0').replace(',', '.')) || 0),
      // ⚠️ O `saldo` acima está NA MOEDA DA CONTA, não em reais. Uma conta
      // Nomad com US$ 6.834,56 guarda 6834.56 — o equivalente em real é
      // derivado pelo backend (`saldo_brl`) e muda com o câmbio, como deve.
      moeda: form.moeda,
    };
    console.log('[contas] salvar wallet — payload:', payload);

    try {
      // ⚠️ EDIÇÃO vai por PUT (id), não pelo POST. O POST faz upsert pela chave
      // `grupo_id,nome`: com um nome novo ele não acha nada pra atualizar e
      // CRIA outra conta, deixando a antiga com o nome velho. Era o relato
      // "edito, salvo, mas permanece o nome Banco". O PUT renomeia e arrasta o
      // `carteira_nome` das transações junto.
      const resp = editando
        ? await api.wallets.editar(editando.id, payload)
        : await api.wallets.salvar(payload);
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
                     background: `linear-gradient(135deg, color-mix(in srgb, ${BRAND} 19%, transparent), color-mix(in srgb, ${BRAND} 6%, transparent))`,
                     animation: 'float 3s ease-in-out infinite',
                     border: `1px solid color-mix(in srgb, ${BRAND} 19%, transparent)`,
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
                compartilhado={compartilhado}
                onEditar={() => abrirModal(w)}
                onDeletar={() => setContaExcluir(w)}
                onTornarPadrao={() => tornarPadrao(w)}
                onArquivar={() => toggleArquivar(w)}
                onAjustar={() => setAjusteOpen(w)}
                onTransferir={() => setTransferOpen(true)}
                onVerExtrato={() => setContaDetalhe(w)}
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
          phone={phone}
          onClose={() => setTransferOpen(false)}
          onSuccess={carregar}
        />
      )}

      {contaExcluir && (
        <ExcluirContaModal
          conta={contaExcluir}
          contas={walletsAtivas}
          onClose={() => setContaExcluir(null)}
          onExcluida={() => carregar()}
        />
      )}

      {contaDetalhe && phone && (
        <DetalhesContaModal
          phone={phone}
          conta={contaDetalhe}
          onClose={() => setContaDetalhe(null)}
          onExcluir={() => { setContaExcluir(contaDetalhe); setContaDetalhe(null); }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD DE CONTA — HORIZONTAL, INSPIRADO NA REFERÊNCIA MAS MAIS POLIDO
// ─────────────────────────────────────────────────────────────
function WalletCard({
  wallet, index, ocultar, compartilhado,
  onEditar, onDeletar, onTornarPadrao, onArquivar, onAjustar, onTransferir, onVerExtrato,
}: {
  wallet:        Wallet;
  index:         number;
  ocultar:       boolean;
  compartilhado: boolean;
  onEditar:      () => void;
  onDeletar:     () => void;
  onTornarPadrao:() => void;
  onArquivar:    () => void;
  onAjustar:     () => void;
  onTransferir:  () => void;
  onVerExtrato:  () => void;
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
          {/* Marca conhecida → CategoriaIcon resolve (bg oficial + logo branco
              ou fundo branco + logo colorido). Sem marca → gradiente do banco. */}
          {marcaDe(wallet.nome) ? (
            <CategoriaIcon
              nome={wallet.nome}
              size={48}
              rounded="rounded-2xl"
              className="shadow-lg"
            />
          ) : (
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-lg ring-1 ring-white/20 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${gradStart}, ${gradEnd})` }}
            >
              {inicial}
            </div>
          )}

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

        {/* Botão excluir — sempre visível no mobile; hover-reveal só no desktop */}
        <button
          onClick={onDeletar}
          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 lg:opacity-0 lg:group-hover:opacity-100 transition-all"
          title="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* ─── Dono (em grupo compartilhado) ─── */}
      {compartilhado && wallet.dono && (
        <div className="relative flex items-center gap-1.5 mb-3 -mt-1">
          <AvatarMembro
            name={wallet.dono.name}
            src={wallet.dono.avatar_url}
            preset={wallet.dono.avatar_preset}
            cor={wallet.dono.avatar_cor}
            size="sm"
          />
          <span className="text-[11px] text-muted-foreground">de <strong className="text-foreground font-semibold">{wallet.dono.name?.split(' ')[0]}</strong></span>
        </div>
      )}

      {/* ─── Saldo (clicável → extrato/movimentações) ─── */}
      <button
        onClick={onVerExtrato}
        className="relative w-full text-left rounded-2xl p-4 mb-3 transition-all hover:brightness-95 dark:hover:brightness-125 group/saldo"
        style={{ background: `hsl(${hue} 70% 50% / 0.06)` }}
        title="Ver movimentações"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: `hsl(${hue} 55% 45%)` }}>
            <TrendingUp size={13} />
            <span>Saldo atual</span>
          </div>
          <p className={`text-xl font-bold tabular tracking-tight ${isNeg ? 'text-red-500' : ''}`}
             style={{ color: !isNeg ? `hsl(${hue} 55% 40%)` : undefined }}>
            {/* ⚠️ O NÚMERO GRANDE É O NATIVO. É o que o cliente vê no app do
                banco dele — mostrar o convertido aqui faria o saldo "mudar
                sozinho" todo dia e ele não reconheceria a própria conta. */}
            {ocultar ? '••••••' : formatarMoeda(wallet.saldo, wallet.moeda)}
          </p>
        </div>
        {/* Equivalente em real, discreto: é derivado e muda com o câmbio.
            `saldo_brl === null` = câmbio fora do ar; dizer isso é melhor que
            mostrar um número que não existe. */}
        {ehEstrangeira(wallet.moeda) && !ocultar && (
          <p className="mt-1 text-[11px] text-muted-foreground tabular">
            {wallet.saldo_brl === null
              ? 'câmbio indisponível agora'
              : `≈ ${fmt(saldoBRL(wallet) ?? 0)}`}
          </p>
        )}
        <div className="flex items-center gap-0.5 mt-2 text-[11px] font-medium text-muted-foreground group-hover/saldo:text-foreground transition-colors">
          <span>Ver extrato — entradas e saídas</span>
          <ChevronRight size={12} className="group-hover/saldo:translate-x-0.5 transition-transform" />
        </div>
      </button>

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
               style={{ background: `radial-gradient(ellipse at top right, color-mix(in srgb, ${BRAND} 25%, transparent) 0%, transparent 70%)` }} />
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

            {/* Moeda da conta — conta internacional (Nomad, Wise, Revolut…).
                ⚠️ Fica ANTES do saldo de propósito: o símbolo do campo abaixo
                muda com esta escolha, então escolher depois faria o usuário
                digitar o número achando que era real. */}
            <div>
              <label htmlFor="conta-moeda" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Moeda
              </label>
              <select
                id="conta-moeda"
                value={form.moeda}
                onChange={e => setForm(f => ({ ...f, moeda: e.target.value }))}
                className="input py-3 font-semibold"
                style={{ minHeight: 44 }}
              >
                {Object.entries(MOEDAS).map(([cod, m]) => (
                  <option key={cod} value={cod}>
                    {m.bandeira} {cod} · {m.nome}
                  </option>
                ))}
              </select>
              {ehEstrangeira(form.moeda) && (
                <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                  O saldo e os lançamentos desta conta ficam em{' '}
                  <b className="text-foreground">{form.moeda}</b>. Nos totais do painel ela é
                  convertida para real pelo câmbio do dia.
                </p>
              )}
            </div>

            {/* Saldo inicial */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Saldo inicial
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  {MOEDAS[normalizarMoeda(form.moeda)].simbolo}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.saldo}
                  onChange={e => setForm(f => ({ ...f, saldo: e.target.value.replace(/[^\d.,]/g, '') }))}
                  className="input pl-14 py-3 tabular text-lg font-semibold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertCircle size={10} />
                Você pode atualizar o saldo a qualquer momento
              </p>
            </div>

            {/* Cheque especial (limite de saldo negativo) */}
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">
                Cheque especial <span className="text-muted-foreground/60 normal-case font-medium">(opcional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                  R$
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={form.cheque}
                  onChange={e => setForm(f => ({ ...f, cheque: e.target.value.replace(/[^\d.,]/g, '') }))}
                  className="input pl-11 py-3 tabular text-lg font-semibold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertCircle size={10} />
                Limite pra conta ficar negativa (transferências podem usar o cheque especial)
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
  wallets, phone, onClose, onSuccess,
}: {
  wallets:   Wallet[];
  phone:     string | null;
  onClose:   () => void;
  onSuccess: () => void;
}) {
  const [origem,  setOrigem]  = useState(wallets[0]?.id || '');
  const [destino, setDestino] = useState(wallets.find(w => w.id !== wallets[0]?.id)?.id || '');
  const [valor,   setValor]   = useState('');
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');
  const [sucesso, setSucesso] = useState(false);

  const contaOrigem  = wallets.find(w => w.id === origem);
  const contaDestino = wallets.find(w => w.id === destino);
  const v            = parseFloat((valor || '0').replace(',', '.')) || 0;
  const saldoOrigem  = contaOrigem?.saldo || 0;
  // Cheque especial: pode transferir até saldo + limite (deixa a conta negativa).
  const chequeOrigem = Math.abs(contaOrigem?.cheque_especial || 0);
  const disponivel   = saldoOrigem + chequeOrigem;
  const insuficiente = v > disponivel;
  const usaCheque    = v > saldoOrigem && !insuficiente; // vai usar o cheque especial
  const valido       = !!origem && !!destino && origem !== destino && v > 0 && !insuficiente;

  function inverter() { setOrigem(destino); setDestino(origem); }
  function escolherOrigem(id: string) {
    setOrigem(id);
    if (id === destino) setDestino(wallets.find(w => w.id !== id)?.id || '');
  }

  async function confirmar() {
    if (!valido || !phone) return;
    setLoading(true); setErro('');
    try {
      await api.wallets.transferir({ phone, origem_id: origem, destino_id: destino, valor: v });
      setSucesso(true);
      onSuccess();
      setTimeout(onClose, 1000);
    } catch (e: any) {
      setErro(e?.message || 'Erro ao transferir.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border/60 max-h-[90dvh] flex flex-col" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-primary/10">
                <ArrowLeftRight size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight leading-tight">Transferir entre contas</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Move o valor e registra no histórico</p>
              </div>
            </div>
            <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-muted transition-colors">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          {sucesso ? (
            <div className="flex flex-col items-center py-16 px-6 gap-3">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950/40 flex items-center justify-center animate-fade-in">
                <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
              </div>
              <p className="font-bold text-foreground text-lg">Transferência feita!</p>
              <p className="text-sm text-muted-foreground tabular">{fmt(v)} · {contaOrigem?.nome} → {contaDestino?.nome}</p>
            </div>
          ) : (
            <>
              <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4">
                {/* De */}
                <div>
                  <label htmlFor="transf-origem" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">De</label>
                  <select id="transf-origem" value={origem} onChange={e => escolherOrigem(e.target.value)} className="input py-3">
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.nome} — {fmt(w.saldo)}</option>)}
                  </select>
                </div>

                {/* Inverter */}
                <div className="flex justify-center">
                  <button type="button" onClick={inverter} aria-label="Inverter origem e destino"
                          className="w-9 h-9 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all active:scale-95">
                    <ArrowLeftRight size={16} className="text-primary rotate-90" />
                  </button>
                </div>

                {/* Para */}
                <div>
                  <label htmlFor="transf-destino" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Para</label>
                  <select id="transf-destino" value={destino} onChange={e => setDestino(e.target.value)} className="input py-3">
                    {wallets.filter(w => w.id !== origem).map(w => <option key={w.id} value={w.id}>{w.nome} — {fmt(w.saldo)}</option>)}
                  </select>
                </div>

                {/* Valor */}
                <div>
                  <label htmlFor="transf-valor" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2 block">Valor</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">R$</span>
                    <input id="transf-valor" type="text" inputMode="decimal" placeholder="0,00" value={valor} autoFocus
                           onChange={e => setValor(e.target.value.replace(/[^\d.,]/g, ''))}
                           className="input pl-11 py-3 tabular text-lg font-semibold" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 tabular">
                    Disponível em {contaOrigem?.nome}: <span className="font-semibold text-foreground">{fmt(disponivel)}</span>
                    {chequeOrigem > 0 && <span className="text-muted-foreground/70"> (saldo {fmt(saldoOrigem)} + cheque especial {fmt(chequeOrigem)})</span>}
                  </p>
                </div>

                {/* Preview dos saldos */}
                {v > 0 && !insuficiente && contaOrigem && contaDestino && (
                  <div className="rounded-xl p-3.5 bg-muted/40 border border-border/60 space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Depois da transferência</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{contaOrigem.nome}</span>
                      <span className="tabular text-muted-foreground whitespace-nowrap">{fmt(saldoOrigem)} → <span className={`font-bold ${saldoOrigem - v < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>{fmt(saldoOrigem - v)}</span></span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate mr-2">{contaDestino.nome}</span>
                      <span className="tabular text-muted-foreground whitespace-nowrap">{fmt(contaDestino.saldo || 0)} → <span className="font-bold text-foreground">{fmt((contaDestino.saldo || 0) + v)}</span></span>
                    </div>
                    {usaCheque && (
                      <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1 pt-0.5">
                        <AlertCircle size={10} /> Usa o cheque especial de {contaOrigem.nome} (fica negativa).
                      </p>
                    )}
                  </div>
                )}

                {/* Erro / saldo insuficiente */}
                {(erro || insuficiente) && (
                  <div role="alert" className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {erro || `Saldo insuficiente em ${contaOrigem?.nome}.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer fixo */}
              <div className="shrink-0 flex gap-2.5 px-6 py-4 border-t border-border/60 bg-muted/20">
                <button onClick={onClose} className="btn-outline flex-1 py-3 text-sm font-semibold">Cancelar</button>
                <button onClick={confirmar} disabled={!valido || loading}
                        className="btn btn-primary flex-[2] py-3 text-sm font-semibold shadow-glow-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  {loading ? <><Loader2 size={15} className="animate-spin" /> Transferindo...</> : <><ArrowLeftRight size={14} /> Transferir</>}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
