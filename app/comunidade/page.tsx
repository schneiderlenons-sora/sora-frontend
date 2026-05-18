'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import CriarGrupoModal from '@/components/grupos/CriarGrupoModal';
import ConvidarModal from '@/components/grupos/ConvidarModal';
import EntrarGrupoModal from '@/components/grupos/EntrarGrupoModal';
import MudarPapelModal from '@/components/grupos/MudarPapelModal';
import {
  Plus, Sparkles, Users, UserPlus, Crown, Pencil, MoreVertical,
  LogOut, Check, ArrowLeftRight, Wallet, Layers, Lock,
  Trash2, Shield,
} from 'lucide-react';

const BRAND = '#61D17B';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const PAPEL_INFO: Record<string, { label: string; emoji: string; color: string }> = {
  admin:   { label: 'Admin',   emoji: '👑', color: '#f59e0b' },
  escrita: { label: 'Escrita', emoji: '✍️', color: '#3b82f6' },
  leitura: { label: 'Leitura', emoji: '👀', color: '#8b5cf6' },
};

const LIMITE_PLANO: Record<string, number> = { inativo: 1, basico: 1, premium: 3, black: 5 };

function maskPhone(p: string): string {
  if (!p) return '';
  const s = p.replace(/\D/g, '');
  return `••• •••• ${s.slice(-4)}`;
}

interface GrupoListItem {
  grupo_id: string;
  papel:    string;
  grupos:   { id: string; nome: string; dono_id: string; emoji?: string };
}

interface Membro {
  id:    string;
  papel: string;
  user_id: string;
  users: { id: string; name: string; phone: string; plano: string };
  created_at?: string;
}

export default function ComunidadePage() {
  const { phone, perfil, isPremium, isBlack, recarregar } = useAuth();

  const [grupos,  setGrupos]  = useState<GrupoListItem[]>([]);
  const [membros, setMembros] = useState<Membro[]>([]);
  const [stats,   setStats]   = useState<any>({ total_membros: 0, limite_membros: 1, total_categorias: 0, total_transacoes_mes: 0, valor_movimentado_mes: 0 });

  // Modais
  const [criarOpen,   setCriarOpen]   = useState(false);
  const [convidarOpen,setConvidarOpen]= useState(false);
  const [entrarOpen,  setEntrarOpen]  = useState(false);
  const [mudarPapel,  setMudarPapel]  = useState<Membro | null>(null);
  const [confirmRem,  setConfirmRem]  = useState<Membro | null>(null);
  const [confirmSair, setConfirmSair] = useState<GrupoListItem | null>(null);
  const [menuMembro,  setMenuMembro]  = useState<string | null>(null);

  const temAcesso = isPremium || isBlack;
  const grupoAtivoId = perfil?.grupo_ativo?.id;
  const grupoAtivo = useMemo(
    () => grupos.find(g => g.grupo_id === grupoAtivoId) || grupos[0],
    [grupos, grupoAtivoId]
  );
  const meuPapelNoAtivo = grupoAtivo?.papel || 'leitura';
  const souAdmin = meuPapelNoAtivo === 'admin';

  const carregar = useCallback(async () => {
    if (!phone) return;
    try {
      const gs = await api.grupos.listar(phone);
      setGrupos(Array.isArray(gs) ? gs : []);
    } catch (e) { console.warn('[grupos] listar erro:', e); }
  }, [phone]);

  const carregarMembros = useCallback(async () => {
    if (!grupoAtivo?.grupo_id) { setMembros([]); return; }
    try {
      const ms = await api.grupos.membros(grupoAtivo.grupo_id);
      setMembros(Array.isArray(ms) ? ms : []);
    } catch (e) { console.warn('[grupos] membros erro:', e); }
    try {
      const s = await api.grupos.stats(grupoAtivo.grupo_id);
      setStats(s || stats);
    } catch (e) { console.warn('[grupos] stats erro:', e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupoAtivo?.grupo_id]);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarMembros(); }, [carregarMembros]);

  async function trocarPara(grupoId: string) {
    if (!phone || grupoId === grupoAtivoId) return;
    try {
      await api.grupos.trocar(phone, grupoId);
      await recarregar();
      carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao trocar de grupo.');
    }
  }

  async function sairDoGrupo(g: GrupoListItem) {
    if (!phone) return;
    try {
      await api.grupos.sair(g.grupo_id, phone);
      setConfirmSair(null);
      await recarregar();
      carregar();
    } catch (e: any) {
      alert(e.message || 'Erro ao sair do grupo.');
    }
  }

  async function removerMembro(m: Membro) {
    if (!phone) return;
    try {
      await api.grupos.removerMembro(m.id, phone);
      setConfirmRem(null);
      carregarMembros();
    } catch (e: any) {
      alert(e.message || 'Erro ao remover membro.');
    }
  }

  const limitePlanoTotal = LIMITE_PLANO[perfil?.plano || 'inativo'] || 1;

  // ─────────────────────────────────────────────────────────
  // PAYWALL
  // ─────────────────────────────────────────────────────────
  if (!temAcesso) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto pb-20 space-y-6">
          <HeroHeader title="Grupos" />
          <PaywallGrupos />
        </div>
      </DashboardLayout>
    );
  }

  // ─────────────────────────────────────────────────────────
  // PÁGINA PRINCIPAL
  // ─────────────────────────────────────────────────────────
  const grupoAtivoInfo = grupoAtivo?.grupos;
  const ehGrupoPessoal = /pessoal/i.test(grupoAtivoInfo?.nome || '');
  const vagasRestantes = Math.max(0, (stats.limite_membros || limitePlanoTotal) - (stats.total_membros || membros.length));

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">

        <HeroHeader
          title="Grupos"
          actions={
            <>
              <button onClick={() => setEntrarOpen(true)} className="btn-outline px-3 py-2 text-sm gap-2">
                <UserPlus size={14} /> Entrar em grupo
              </button>
              <button onClick={() => setCriarOpen(true)} className="btn btn-primary px-4 py-2.5 text-sm gap-2 shadow-glow-sm">
                <Plus size={16} /> Criar grupo
              </button>
            </>
          }
        />

        {/* ════════════════════════════════════════════════════
            CARD HERO DO GRUPO ATIVO
        ════════════════════════════════════════════════════ */}
        {grupoAtivo && grupoAtivoInfo && (
          <div className="card rounded-3xl p-6 sm:p-8 animate-fade-in" style={{ animationDelay: '60ms' }}>
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              {/* Avatar + identidade */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-glow-sm"
                     style={{ background: `linear-gradient(135deg, ${BRAND}40, ${BRAND}15)` }}>
                  {grupoAtivoInfo.emoji || '👨‍👩‍👧'}
                </div>
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold mb-1.5"
                       style={{ background: `${PAPEL_INFO[meuPapelNoAtivo]?.color}22`, color: PAPEL_INFO[meuPapelNoAtivo]?.color }}>
                    {PAPEL_INFO[meuPapelNoAtivo]?.emoji} Você é {PAPEL_INFO[meuPapelNoAtivo]?.label}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-none truncate">
                    {grupoAtivoInfo.nome}
                  </h2>
                  {ehGrupoPessoal && (
                    <p className="text-xs text-muted-foreground mt-1.5 inline-flex items-center gap-1">
                      <Shield size={11} /> Grupo Pessoal (não compartilhável)
                    </p>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 flex-shrink-0">
                <MiniStat
                  label="Membros"
                  value={`${stats.total_membros || membros.length || 1}/${stats.limite_membros || limitePlanoTotal}`}
                  icon={Users}
                />
                <MiniStat
                  label="Movimentado"
                  value={fmt(stats.valor_movimentado_mes || 0)}
                  icon={Wallet}
                />
                <MiniStat
                  label="Categorias"
                  value={String(stats.total_categorias || 0)}
                  icon={Layers}
                />
              </div>
            </div>

            {/* Ações no rodapé */}
            <div className="flex flex-wrap items-center gap-2 mt-6 pt-5 border-t border-border/60">
              {souAdmin && !ehGrupoPessoal && (
                <button onClick={() => setConvidarOpen(true)} className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm">
                  <UserPlus size={14} /> Gerar código de convite
                </button>
              )}
              {!ehGrupoPessoal && (
                <button
                  onClick={() => setConfirmSair(grupoAtivo)}
                  className="btn-ghost px-3 py-2 text-sm gap-1.5 text-red-600 dark:text-red-400 ml-auto"
                >
                  <LogOut size={13} /> Sair do grupo
                </button>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            MEMBROS
        ════════════════════════════════════════════════════ */}
        <div className="space-y-3 animate-fade-in" style={{ animationDelay: '120ms' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                <Users size={16} className="text-foreground" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Membros{' '}
                <span className="text-muted-foreground font-normal">({membros.length})</span>
              </h3>
            </div>
            {vagasRestantes > 0 && souAdmin && !ehGrupoPessoal && (
              <span className="text-[11px] text-muted-foreground">
                {vagasRestantes} vaga{vagasRestantes !== 1 ? 's' : ''} restante{vagasRestantes !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {membros.map((m, i) => {
              const isMe = m.users?.phone === phone;
              const papel = PAPEL_INFO[m.papel] || PAPEL_INFO.leitura;
              const initial = (m.users?.name || '?').charAt(0).toUpperCase();
              return (
                <div key={m.id}
                     className="card-hover rounded-2xl p-4 animate-fade-in relative"
                     style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm"
                         style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND}aa)` }}>
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-foreground truncate">
                          {m.users?.name || 'Sem nome'}
                        </p>
                        {isMe && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                            Você
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground tabular truncate">
                        {maskPhone(m.users?.phone || '')}
                      </p>
                      <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                           style={{ background: `${papel.color}22`, color: papel.color }}>
                        {papel.emoji} {papel.label}
                      </div>
                    </div>
                    {souAdmin && !isMe && (
                      <button
                        onClick={() => setMenuMembro(menuMembro === m.id ? null : m.id)}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                      >
                        <MoreVertical size={14} className="text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* Menu de ações */}
                  {menuMembro === m.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuMembro(null)} />
                      <div className="absolute right-3 top-12 z-20 w-44 card p-1 animate-fade-in border border-border shadow-xl">
                        <button
                          onClick={() => { setMenuMembro(null); setMudarPapel(m); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-xs text-foreground transition-colors"
                        >
                          <Pencil size={12} /> Mudar papel
                        </button>
                        <button
                          onClick={() => { setMenuMembro(null); setConfirmRem(m); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs text-red-600 dark:text-red-400 transition-colors"
                        >
                          <Trash2 size={12} /> Remover do grupo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Card de convidar */}
            {vagasRestantes > 0 && souAdmin && !ehGrupoPessoal && (
              <button
                onClick={() => setConvidarOpen(true)}
                className="rounded-2xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/20 transition-all p-4 min-h-[110px] flex flex-col items-center justify-center group"
              >
                <div className="w-11 h-11 rounded-full flex items-center justify-center mb-2 transition-all group-hover:scale-110"
                     style={{ background: `${BRAND}22` }}>
                  <UserPlus size={18} style={{ color: BRAND }} />
                </div>
                <p className="text-xs font-semibold text-foreground">Convidar membro</p>
                <p className="text-[10px] text-muted-foreground">por código ou QR</p>
              </button>
            )}
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            MEUS GRUPOS (lista)
        ════════════════════════════════════════════════════ */}
        {grupos.length > 1 && (
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: '180ms' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                <ArrowLeftRight size={16} className="text-foreground" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Meus grupos{' '}
                <span className="text-muted-foreground font-normal">({grupos.length})</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grupos.map((g, i) => {
                const ativo = g.grupo_id === grupoAtivoId;
                const papel = PAPEL_INFO[g.papel] || PAPEL_INFO.leitura;
                return (
                  <div key={g.grupo_id}
                       className={`rounded-2xl p-4 border transition-all animate-fade-in ${
                         ativo ? 'border-primary bg-primary/5 shadow-glow-sm' : 'border-border bg-card hover:border-primary/30'
                       }`}
                       style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                           style={{ background: `${BRAND}15` }}>
                        {g.grupos?.emoji || '👨‍👩‍👧'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground truncate">{g.grupos?.nome}</p>
                          {ativo && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                              <Check size={9} /> Ativo
                            </span>
                          )}
                        </div>
                        <div className="inline-flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                          {papel.emoji} {papel.label}
                        </div>
                      </div>
                      {!ativo && (
                        <button
                          onClick={() => trocarPara(g.grupo_id)}
                          className="btn-outline px-3 py-1.5 text-xs gap-1.5 flex-shrink-0"
                        >
                          <ArrowLeftRight size={11} /> Trocar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
          MODAIS
      ════════════════════════════════════════════════════ */}
      {criarOpen && phone && (
        <CriarGrupoModal
          phone={phone}
          limiteMembros={limitePlanoTotal}
          onClose={() => setCriarOpen(false)}
          onSuccess={async () => { await recarregar(); carregar(); }}
        />
      )}

      {convidarOpen && phone && grupoAtivo && grupoAtivoInfo && (
        <ConvidarModal
          phone={phone}
          grupoId={grupoAtivo.grupo_id}
          grupoNome={grupoAtivoInfo.nome}
          onClose={() => setConvidarOpen(false)}
        />
      )}

      {entrarOpen && phone && (
        <EntrarGrupoModal
          phone={phone}
          onClose={() => setEntrarOpen(false)}
          onSuccess={async () => { await recarregar(); carregar(); }}
        />
      )}

      {mudarPapel && phone && (
        <MudarPapelModal
          phone={phone}
          membroId={mudarPapel.id}
          membroNome={mudarPapel.users?.name || 'Membro'}
          papelAtual={(mudarPapel.papel as any) || 'leitura'}
          onClose={() => setMudarPapel(null)}
          onSuccess={carregarMembros}
        />
      )}

      {/* Confirmação: remover membro */}
      {confirmRem && (
        <ConfirmDialog
          icon={<UserPlus size={22} className="text-red-600 dark:text-red-400" />}
          iconBg="bg-red-100 dark:bg-red-950/40"
          title="Remover membro?"
          body={<>
            Tem certeza que deseja remover <strong className="text-foreground">{confirmRem.users?.name}</strong> do grupo?
            <br />As transações que ele criou continuarão no histórico.
          </>}
          confirmLabel="Remover"
          danger
          onCancel={() => setConfirmRem(null)}
          onConfirm={() => removerMembro(confirmRem)}
        />
      )}

      {/* Confirmação: sair */}
      {confirmSair && (
        <ConfirmDialog
          icon={<LogOut size={22} className="text-red-600 dark:text-red-400" />}
          iconBg="bg-red-100 dark:bg-red-950/40"
          title="Sair do grupo?"
          body={<>Você sairá de <strong className="text-foreground">{confirmSair.grupos?.nome}</strong>. Se for o único admin, o papel será transferido para o membro mais antigo.</>}
          confirmLabel="Sair do grupo"
          danger
          onCancel={() => setConfirmSair(null)}
          onConfirm={() => sairDoGrupo(confirmSair)}
        />
      )}
    </DashboardLayout>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO HEADER (compartilhado entre paywall e página principal)
// ─────────────────────────────────────────────────────────────
function HeroHeader({ title, actions }: { title: string; actions?: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
         style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-50"
           style={{ background: 'radial-gradient(ellipse at top right, hsl(134 55% 60% / .12) 0%, transparent 60%)' }} />
      <div className="relative flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
            <Sparkles size={12} style={{ color: BRAND }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
              Gestão compartilhada
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm mt-2 max-w-md">
            Compartilhe suas finanças com família ou amigos.
          </p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <div className="rounded-xl p-3 bg-muted/30 border border-border/60 min-w-[110px]">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        <Icon size={11} />
        {label}
      </div>
      <p className="text-base font-bold text-foreground tabular mt-1 truncate">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAYWALL
// ─────────────────────────────────────────────────────────────
function PaywallGrupos() {
  const features = {
    premium: [
      'Até 3 membros no grupo',
      'Categorias compartilhadas',
      'Limites por categoria',
      'Histórico ilimitado',
    ],
    black: [
      'Até 5 membros no grupo',
      'Tudo do Premium',
      'Portfólio de investimentos',
      'Suporte prioritário',
    ],
  };

  return (
    <div className="card rounded-3xl p-8 sm:p-10 text-center animate-fade-in" style={{ animationDelay: '60ms' }}>
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-glow"
           style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND}aa)` }}>
        <Users size={36} className="text-white" />
      </div>
      <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
        Compartilhe suas finanças
      </h2>
      <p className="text-muted-foreground text-sm mt-2 max-w-lg mx-auto leading-relaxed">
        Crie grupos com até 5 pessoas e gerencie as finanças em conjunto. Disponível nos planos Premium e Black.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 text-left max-w-2xl mx-auto">
        {/* Premium */}
        <div className="card rounded-2xl p-5 border border-border">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground">Premium</p>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 px-2 py-0.5 rounded-full">
              Recomendado
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground tabular tracking-tight">R$ 29,90<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          <ul className="space-y-2 mt-4 mb-5">
            {features.premium.map(f => (
              <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                <Check size={14} className="text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <button className="btn btn-primary w-full py-2 text-sm gap-2">
            Assinar Premium
          </button>
        </div>

        {/* Black */}
        <div className="relative card rounded-2xl p-5 border-2"
             style={{ borderColor: BRAND, background: `linear-gradient(135deg, hsl(var(--bg-card)), ${BRAND}08)` }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-foreground inline-flex items-center gap-1.5">
              <Crown size={14} style={{ color: BRAND }} /> Black
            </p>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-zinc-900 text-white px-2 py-0.5 rounded-full">
              Top
            </span>
          </div>
          <p className="text-3xl font-bold text-foreground tabular tracking-tight">R$ 37,00<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
          <ul className="space-y-2 mt-4 mb-5">
            {features.black.map(f => (
              <li key={f} className="flex items-start gap-2 text-xs text-foreground">
                <Check size={14} className="text-primary flex-shrink-0 mt-0.5" />
                {f}
              </li>
            ))}
          </ul>
          <button className="btn w-full py-2 text-sm gap-2 text-white shadow-glow-sm"
                  style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND}cc)` }}>
            Assinar Black
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-6 inline-flex items-center gap-1.5">
        <Lock size={11} /> Cancele a qualquer momento. Sem fidelidade.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CONFIRM DIALOG (genérico)
// ─────────────────────────────────────────────────────────────
function ConfirmDialog({
  icon, iconBg, title, body, confirmLabel, danger, onCancel, onConfirm,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border animate-fade-in p-6"
           onClick={e => e.stopPropagation()}>
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${iconBg}`}>
          {icon}
        </div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{body}</p>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={onCancel} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={onConfirm} className={`px-4 py-2 text-sm gap-2 inline-flex items-center rounded-xl font-semibold ${
            danger ? 'btn-danger' : 'btn btn-primary'
          }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
