'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import AvatarMembro from '@/components/ui/AvatarMembro';
import { AVATAR_CORES, AVATAR_PRESETS, AVATAR_COR_PADRAO } from '@/lib/avatares';
import { PLANOS_INFO, type PlanoId, type Intervalo } from '@/lib/stripe';
import { PLANOS_DISPLAY, type PlanoDisplay } from '@/lib/planos-display';
import { type Plano } from '@/lib/plans';
import {
  Sparkles, User, CreditCard, MessageCircle, ShieldCheck,
  Check, Crown, Loader2, AlertCircle, Camera, Pencil, ExternalLink,
  Download, Trash2, Mail, Phone, Lock, Info, Upload,
  Zap, Calendar, Receipt, Settings as SettingsIcon,
  ArrowUpRight, ArrowDownRight, ShieldX, Gem, Palette,
  RotateCcw, Wallet, Briefcase, Sprout, Users,
} from 'lucide-react';
import { PALETAS, getPaletaSalva, aplicarPaleta } from '@/lib/theme-colors';
import { limparCacheSWR } from '@/lib/swr-cache';
import { limparPerfilCache } from '@/lib/perfil-cache';
import { fmtDataBR } from '@/lib/data-br';

const BRAND = 'hsl(var(--primary))';

type Secao = 'perfil' | 'plano' | 'whatsapp' | 'aparencia' | 'dados';

export default function ConfiguracoesPage() {
  const [secao, setSecao] = useState<Secao>('perfil');

  const items: { id: Secao; label: string; desc: string; icon: any }[] = [
    { id: 'perfil',   label: 'Meu Perfil',         desc: 'Foto, nome, email e senha',        icon: User        },
    { id: 'plano',    label: 'Plano e Cobrança',   desc: 'Plano atual e comparação',         icon: CreditCard  },
    { id: 'whatsapp', label: 'WhatsApp',           desc: 'Vínculo da conta com o número',    icon: MessageCircle },
    { id: 'aparencia',label: 'Aparência',          desc: 'Cor do tema do app',               icon: Palette },
    { id: 'dados',    label: 'Privacidade e Dados', desc: 'Exportar, excluir conta',         icon: ShieldCheck },
  ];

  return (
    <>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        {/* HERO HEADER */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(var(--primary) / .12) 0%, transparent 60%)' }} />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 mb-3">
              <Sparkles size={12} style={{ color: BRAND }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: BRAND }}>
                Conta e preferências
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight leading-none">
              Configurações
            </h1>
            <p className="text-muted-foreground text-sm mt-2 max-w-md">
              Gerencie sua conta, plano e informações pessoais.
            </p>
          </div>
        </div>

        {/* GRID: sidebar + content */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {/* ─── SIDEBAR DE TABS ─── */}
          <aside className="lg:sticky lg:top-4 lg:self-start">
            {/* Mobile: horizontal scroll */}
            <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
              {items.map(({ id, label, desc, icon: Icon }) => {
                const ativo = secao === id;
                return (
                  <button
                    key={id}
                    onClick={() => setSecao(id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all flex-shrink-0 lg:flex-shrink ${
                      ativo
                        ? 'bg-primary/10 ring-1 ring-primary/30 shadow-glow-sm'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      ativo ? '' : 'bg-muted/60'
                    }`}
                    style={ativo ? { background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' } : undefined}>
                      <Icon size={16} style={{ color: ativo ? BRAND : 'hsl(var(--fg-muted))' }} />
                    </div>
                    <div className="min-w-0 hidden sm:block">
                      <p className={`text-sm font-semibold truncate ${ativo ? 'text-foreground' : 'text-foreground'}`}>{label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{desc}</p>
                    </div>
                    <span className="sm:hidden text-sm font-semibold">{label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* ─── CONTEÚDO ─── */}
          <section key={secao} className="animate-fade-in">
            {secao === 'perfil'   && <SecaoPerfil />}
            {secao === 'plano'    && <SecaoPlano />}
            {secao === 'whatsapp' && <SecaoWhatsApp />}
            {secao === 'aparencia'&& <SecaoAparencia />}
            {secao === 'dados'    && <SecaoDados />}
          </section>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: MEU PERFIL
// ═══════════════════════════════════════════════════════════════
function SecaoAparencia() {
  const [sel, setSel] = useState<string>(getPaletaSalva());
  function escolher(id: string) { setSel(id); aplicarPaleta(id); }

  return (
    <div className="space-y-6">
      <div className="card rounded-3xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <Palette size={18} style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-foreground">Cor do tema</h2>
            <p className="text-sm text-muted-foreground">Escolha a cor que mais combina com você — vale pro Finance e pro Grow.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
          {PALETAS.map(p => {
            const ativo = sel === p.id;
            return (
              <button key={p.id} onClick={() => escolher(p.id)} aria-pressed={ativo}
                className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all text-left active:scale-[0.98] ${
                  ativo ? 'border-transparent ring-2 shadow-sm' : 'border-border hover:bg-muted/40'
                }`}
                style={ativo ? ({ ['--tw-ring-color']: p.hex, background: `${p.hex}14` } as any) : undefined}>
                <span className="w-9 h-9 rounded-full flex-shrink-0 shadow-inner ring-1 ring-black/5" style={{ background: p.hex }} />
                <span className="text-sm font-semibold text-foreground flex-1 truncate">{p.nome}</span>
                {ativo && <Check size={16} className="flex-shrink-0" style={{ color: p.hex }} />}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground mt-5 flex items-center gap-1.5">
          <Info size={13} className="flex-shrink-0" /> A mudança é instantânea e fica salva neste dispositivo.
        </p>
      </div>
    </div>
  );
}

function SecaoPerfil() {
  const { perfil, user, recarregar } = useAuth();
  const [nome,         setNome]         = useState(perfil?.name || '');
  const [editandoNome, setEditandoNome] = useState(false);
  const [salvando,     setSalvando]     = useState(false);
  const [mensagem,     setMensagem]     = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [novaSenha,    setNovaSenha]    = useState('');
  const [trocandoSenha,setTrocandoSenha]= useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setNome(perfil?.name || ''); }, [perfil?.name]);

  function flash(tipo: 'ok' | 'erro', texto: string) {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 4000);
  }

  async function salvarNome() {
    if (!perfil?.id || !nome.trim() || nome.trim() === perfil.name) {
      setEditandoNome(false);
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.from('users').update({ name: nome.trim() }).eq('id', perfil.id);
      if (error) throw error;
      await recarregar();
      setEditandoNome(false);
      flash('ok', 'Nome atualizado.');
    } catch (e: any) {
      flash('erro', e.message || 'Erro ao atualizar nome.');
    } finally {
      setSalvando(false);
    }
  }

  async function trocarSenha() {
    if (novaSenha.length < 6) { flash('erro', 'A senha deve ter pelo menos 6 caracteres.'); return; }
    setTrocandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
      setNovaSenha('');
      flash('ok', 'Senha atualizada com sucesso.');
    } catch (e: any) {
      flash('erro', e.message || 'Erro ao trocar senha.');
    } finally {
      setTrocandoSenha(false);
    }
  }

  async function handleAvatarFile(file: File) {
    if (!perfil?.id) return;
    if (file.size > 5 * 1024 * 1024) { flash('erro', 'Imagem muito grande (máx. 5MB).'); return; }
    setUploadingAvatar(true);
    try {
      // Redimensiona em canvas para 256x256 jpeg ~85% qualidade
      const dataUrl = await redimensionar(file, 256, 0.85);
      // Foto tem prioridade — limpa o preset de baleia ao enviar uma foto.
      const { error } = await supabase.from('users').update({ avatar_url: dataUrl, avatar_preset: null }).eq('id', perfil.id);
      if (error) throw error;
      await recarregar();
      flash('ok', 'Foto atualizada.');
    } catch (e: any) {
      flash('erro', e.message || 'Erro ao atualizar foto.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function removerAvatar() {
    if (!perfil?.id) return;
    try {
      await supabase.from('users').update({ avatar_url: null }).eq('id', perfil.id);
      await recarregar();
      flash('ok', 'Foto removida.');
    } catch (e: any) {
      flash('erro', e.message || 'Erro ao remover foto.');
    }
  }

  // Escolhe um ícone de baleia — vira o avatar (e tira a foto, que tem prioridade).
  async function escolherPreset(id: string) {
    if (!perfil?.id) return;
    try {
      await supabase.from('users').update({
        avatar_preset: id,
        avatar_cor: perfil.avatar_cor || AVATAR_COR_PADRAO,
        avatar_url: null,
      }).eq('id', perfil.id);
      await recarregar();
      flash('ok', 'Ícone atualizado.');
    } catch (e: any) {
      flash('erro', e.message || 'Erro ao atualizar ícone.');
    }
  }

  // Escolhe a cor de fundo do ícone/inicial.
  async function escolherCor(cor: string) {
    if (!perfil?.id) return;
    try {
      await supabase.from('users').update({ avatar_cor: cor }).eq('id', perfil.id);
      await recarregar();
    } catch (e: any) {
      flash('erro', e.message || 'Erro ao atualizar cor.');
    }
  }

  return (
    <div className="space-y-4">
      {/* Card do avatar + identidade */}
      <Card titulo="Foto e identidade" subtitulo="Como você aparece no painel e nos grupos">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative group">
            <AvatarMembro name={perfil?.name} src={perfil?.avatar_url} preset={perfil?.avatar_preset} cor={perfil?.avatar_cor} size="xl" />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5"
            >
              {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              {uploadingAvatar ? 'Enviando...' : 'Mudar'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ''; }}
            />
          </div>

          <div className="flex-1 w-full">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Foto de perfil</p>
            <p className="text-sm text-foreground mt-1">PNG ou JPG até 5MB. Será redimensionada para 256×256.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button onClick={() => fileInputRef.current?.click()} className="btn-outline px-3 py-2 text-sm gap-2">
                <Upload size={13} /> Enviar foto
              </button>
              {perfil?.avatar_url && (
                <button onClick={removerAvatar} className="btn-ghost px-3 py-2 text-sm gap-1.5 text-red-600 dark:text-red-400">
                  <Trash2 size={13} /> Remover
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cor do ícone */}
        <div className="mt-6 pt-5 border-t border-border/60">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">Cor do ícone</p>
          <div className="flex flex-wrap gap-2">
            {AVATAR_CORES.map(c => {
              const ativa = (perfil?.avatar_cor || AVATAR_COR_PADRAO) === c;
              return (
                <button key={c} onClick={() => escolherCor(c)} aria-label={`Cor ${c}`} title={c}
                  className={`w-9 h-9 rounded-full inline-flex items-center justify-center transition-all ${ativa ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : 'hover:scale-105'}`}
                  style={{ background: c, ['--tw-ring-color' as any]: c }}>
                  {ativa && <Check size={14} className="text-white" strokeWidth={3} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ícones da Sora (baleias) */}
        <div className="mt-6 pt-5 border-t border-border/60">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Ícones da Sora</p>
          <p className="text-sm text-muted-foreground mb-3">Escolha uma baleia pro seu perfil (substitui a foto).</p>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {AVATAR_PRESETS.map(p => {
              const ativo = !perfil?.avatar_url && perfil?.avatar_preset === p.id;
              return (
                <button key={p.id} onClick={() => escolherPreset(p.id)} title={p.label}
                  className="flex flex-col items-center gap-1.5 group">
                  <AvatarMembro
                    name={perfil?.name}
                    preset={p.id}
                    cor={perfil?.avatar_cor || AVATAR_COR_PADRAO}
                    size="lg"
                    showTooltip={false}
                    className={`transition-all ${ativo ? 'ring-2 ring-primary scale-105' : 'group-hover:scale-105 opacity-90 group-hover:opacity-100'}`}
                  />
                  <span className={`text-[10px] font-medium ${ativo ? 'text-primary' : 'text-muted-foreground'}`}>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Nome */}
      <Card titulo="Informações da conta">
        <div className="space-y-4">
          {/* Nome */}
          <FieldRow label="Nome">
            {editandoNome ? (
              <div className="flex items-center gap-2 w-full">
                <input
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="input flex-1"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') salvarNome(); if (e.key === 'Escape') { setNome(perfil?.name || ''); setEditandoNome(false); } }}
                />
                <button onClick={salvarNome} disabled={salvando}
                        className="btn btn-primary px-3 py-1.5 text-xs gap-1.5">
                  {salvando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Salvar
                </button>
                <button onClick={() => { setNome(perfil?.name || ''); setEditandoNome(false); }}
                        className="btn-ghost px-3 py-1.5 text-xs">Cancelar</button>
              </div>
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground">{perfil?.name || '—'}</span>
                <button onClick={() => setEditandoNome(true)} className="btn-ghost p-1.5 ml-2" title="Editar">
                  <Pencil size={13} className="text-muted-foreground" />
                </button>
              </>
            )}
          </FieldRow>

          {/* Email */}
          <FieldRow label="Email" icon={<Mail size={13} />}>
            <span className="text-sm text-foreground">{user?.email || '—'}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 ml-2">
              Verificado
            </span>
          </FieldRow>

          {/* Senha */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Lock size={13} className="text-muted-foreground" />
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Senha</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="Nova senha (mín. 6 caracteres)"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                className="input flex-1"
              />
              <button onClick={trocarSenha} disabled={trocandoSenha || novaSenha.length < 6}
                      className="btn-primary px-3 py-2 text-sm gap-1.5 inline-flex items-center">
                {trocandoSenha ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                Trocar
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">Você continuará logado após a troca.</p>
          </div>

          {mensagem && (
            <Flash tipo={mensagem.tipo} texto={mensagem.texto} />
          )}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: PLANO E COBRANÇA
// ═══════════════════════════════════════════════════════════════

// Ícone exibido junto ao nome do plano (mapeado a partir do id).
// Mantido aqui pra não vazar lucide-react no lib/planos-display.
const ICONE_PLANO = {
  basico:   Zap,
  premium:  Gem,
  platinum: Crown,
} as const;

// Catálogo de planos vem de lib/planos-display (fonte única, igual à landing).
// Os três planos de assinatura aparecem no painel.
const PLANOS_DETALHE = PLANOS_DISPLAY;

// Ordem pra decidir se o card é upgrade ou downgrade em relação ao plano
// atual. Kit empata com Básico de propósito: é vitalício, não escada.
// `gratis` empata com `inativo` (0): nenhum dos dois paga, então todo plano
// pago é upgrade pros dois.
const ORDEM_PLANO: Record<Plano, number> = {
  inativo: 0, gratis: 0, basico: 1, kit: 1, premium: 2, platinum: 3,
};

function SecaoPlano() {
  const { perfil, plano: planoAtual, recarregar } = useAuth();
  const [anual, setAnual] = useState(false);
  const [loadingPlano, setLoadingPlano] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // Plano fora do catálogo de assinatura (kit, inativo) cai no visual do Premium.
  const planoVisual = PLANOS_DETALHE.find(p => p.id === planoAtual) ?? PLANOS_DETALHE.find(p => p.id === 'premium');
  const ordemAtual = ORDEM_PLANO[planoAtual];
  const temAssinatura = planoAtual !== 'inativo';
  const validoAte = perfil?.plano_valido_ate ? new Date(perfil.plano_valido_ate) : null;
  const intervaloAssinatura = (perfil?.plano_intervalo as Intervalo | undefined) ?? 'mensal';

  // Dias até a próxima cobrança
  const diasRestantes = validoAte
    ? Math.max(0, Math.ceil((validoAte.getTime() - Date.now()) / 86400000))
    : null;

  async function iniciarCheckout(planoAlvo: PlanoId) {
    setFeedback(null);
    setLoadingPlano(planoAlvo);
    try {
      const intervalo: Intervalo = anual ? 'anual' : 'mensal';
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: planoAlvo, intervalo }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Erro ao iniciar checkout.' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Falha de conexão. Tente novamente.' });
    } finally {
      setLoadingPlano(null);
    }
  }

  async function abrirPortal() {
    setFeedback(null);
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setFeedback({ tipo: 'erro', texto: data.erro || 'Erro ao abrir portal.' });
      }
    } catch {
      setFeedback({ tipo: 'erro', texto: 'Falha de conexão.' });
    } finally {
      setLoadingPortal(false);
    }
  }

  return (
    <div className="space-y-5">

      {feedback && <Flash tipo={feedback.tipo} texto={feedback.texto} />}

      {/* ═══════════════════════════════════════════════════════════
          HERO DO PLANO ATUAL
      ═══════════════════════════════════════════════════════════ */}
      <HeroPlanoAtual
        planoVisual={planoVisual}
        planoAtual={planoAtual}
        intervalo={intervaloAssinatura}
        validoAte={validoAte}
        diasRestantes={diasRestantes}
        temAssinatura={temAssinatura}
        loadingPortal={loadingPortal}
        onGerenciar={abrirPortal}
        criadoEm={perfil?.created_at ? new Date(perfil.created_at) : null}
        isVitalicio={!!perfil?.vitalicio}
        vitalicioEm={perfil?.vitalicio_em ? new Date(perfil.vitalicio_em) : null}
        temAssinaturaConexao={(Number(perfil?.of_conexoes_pagas) || 0) > 0}
      />

      {/* ═══════════════════════════════════════════════════════════
          OUTROS PLANOS DISPONÍVEIS
      ═══════════════════════════════════════════════════════════ */}
      <Card
        titulo={temAssinatura ? 'Mudar de plano' : 'Escolha seu plano'}
        subtitulo={
          temAssinatura
            ? 'Faça upgrade pra desbloquear mais recursos, ou downgrade quando quiser.'
            : 'Comece quando quiser. Sem fidelidade, cancelamento a qualquer momento.'
        }
      >
        {/* Toggle Mensal/Anual */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/60">
            <button
              onClick={() => setAnual(false)}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                !anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setAnual(true)}
              className={`relative px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                anual ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Anual
              {!anual && (
                <span
                  className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white shadow-sm"
                  style={{ background: BRAND }}
                >
                  até -40%
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Grid de planos — pt-10 reserva espaço pros badges absolutos (-top-9) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-10">
          {PLANOS_DETALHE.map((p) => (
            <PlanoCard
              key={p.id}
              plano={p}
              ehAtual={p.id === planoAtual}
              ordemAtual={ordemAtual}
              anual={anual}
              loading={loadingPlano === p.id}
              loadingPortal={loadingPortal}
              onAssinar={() => iniciarCheckout(p.id)}
              onGerenciar={abrirPortal}
            />
          ))}
        </div>

        {/* Confiança */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={11} /> Pagamento seguro via Stripe
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldX size={11} /> Cancele quando quiser
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Receipt size={11} /> Sem letras miúdas
          </span>
        </div>
      </Card>
    </div>
  );
}

// ─── HERO DO PLANO ATUAL ────────────────────────────────────────

function HeroPlanoAtual({
  planoVisual, planoAtual, intervalo, validoAte, diasRestantes,
  temAssinatura, loadingPortal, onGerenciar, criadoEm, isVitalicio, vitalicioEm,
  temAssinaturaConexao,
}: {
  planoVisual?: PlanoDisplay;
  planoAtual: Plano;
  intervalo: Intervalo;
  validoAte: Date | null;
  diasRestantes: number | null;
  temAssinatura: boolean;
  loadingPortal: boolean;
  onGerenciar: () => void;
  criadoEm: Date | null;
  isVitalicio?: boolean;
  vitalicioEm?: Date | null;
  /** Vitalício que contratou conexão de Open Finance TEM cobrança no Stripe. */
  temAssinaturaConexao?: boolean;
}) {
  // Estado: inativo → estado vazio sofisticado
  if (!temAssinatura || !planoVisual) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card">
        {/* Mesh decorativo */}
        <div
          className="absolute inset-0 pointer-events-none opacity-60"
          style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in srgb, hsl(var(--primary)) 10%, transparent) 0%, transparent 60%)' }}
        />
        <div className="relative p-7 sm:p-9 text-center">
          <div
            className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 shadow-glow"
            style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
          >
            <Sparkles size={22} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Você ainda não tem um plano ativo</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
            Escolha um plano abaixo e desbloqueie o seu jeito de organizar a vida financeira.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <Check size={11} style={{ color: BRAND }} /> Sem fidelidade
            <span className="text-border">•</span>
            <Check size={11} style={{ color: BRAND }} /> Cancele quando quiser
          </div>
        </div>
      </div>
    );
  }

  const Icon = ICONE_PLANO[planoVisual.id];
  const precoMensalRef = PLANOS_INFO[planoVisual.id]?.[intervalo] ?? 0;

  const statusInfo = (() => {
    if (!validoAte) return { label: 'Ativo', cor: 'emerald' as const };
    if (diasRestantes === null) return { label: 'Ativo', cor: 'emerald' as const };
    if (diasRestantes <= 3) return { label: `Expira em ${diasRestantes}d`, cor: 'amber' as const };
    return { label: 'Ativo', cor: 'emerald' as const };
  })();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card">
      {/* Gradient overlay sutil baseado no plano */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 90% 60% at 100% 0%, color-mix(in srgb, ${planoVisual.cor} 12%, transparent) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 0% 100%, color-mix(in srgb, ${planoVisual.cor} 8%, transparent) 0%, transparent 50%)
          `,
        }}
      />
      {/* Marca d'água do ícone gigante no fundo */}
      <div
        className="absolute -right-8 -top-8 pointer-events-none opacity-[0.06] dark:opacity-[0.08]"
        aria-hidden
      >
        <Icon size={180} style={{ color: planoVisual.cor }} strokeWidth={1.2} />
      </div>

      <div className="relative p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-glow"
              style={{ background: `linear-gradient(135deg, ${planoVisual.cor}, ${escurecer(planoVisual.cor)})` }}
            >
              <Icon size={26} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Plano atual
                </p>
                {isVitalicio ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: 'color-mix(in srgb, #8b5cf6 16%, transparent)', color: '#8b5cf6' }}>
                    ∞ Vitalício
                  </span>
                ) : (
                  <StatusPill cor={statusInfo.cor} label={statusInfo.label} />
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight leading-tight">
                Sora <span style={{ color: planoVisual.cor }}>{planoVisual.nome}</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">{planoVisual.subtitulo}</p>
            </div>
          </div>

          {/* CTA Gerenciar — abre o portal do Stripe.
              ⚠️ O VITALÍCIO TAMBÉM PRECISA DISTO. Antes a condição era só
              `!isVitalicio`, com a justificativa "vitalício não tem portal
              Stripe" — que era verdade até existir a CONEXÃO DE OPEN FINANCE
              avulsa (R$6/mês). Quem é vitalício e contrata uma conexão passa a
              ter cliente e assinatura no Stripe, e ficava SEM NENHUMA forma de
              cancelar pelo painel — enquanto o texto do checkout promete "dá
              pra cancelar quando quiser".
              Medido quando isto foi corrigido: os 13 pagantes de conexão eram
              TODOS vitalícios, 11 assinaturas ativas, R$ 198/mês. Dois deles
              pagavam por conexão que já tinham desconectado — porque
              "Desconectar" remove o banco mas NÃO cancela a cobrança. */}
          {(!isVitalicio || temAssinaturaConexao) && (
            <button
              onClick={onGerenciar}
              disabled={loadingPortal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: planoVisual.cor, color: planoVisual.cor }}
            >
              {loadingPortal ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <SettingsIcon size={14} />
              )}
              {/* Rótulo honesto: pro vitalício a ÚNICA coisa cobrável ali é a
                  conexão — dizer "assinatura" faria ele temer perder o acesso
                  vitalício, que não tem mensalidade nenhuma. */}
              {isVitalicio ? 'Gerenciar conexões pagas' : 'Gerenciar assinatura'}
            </button>
          )}
        </div>

        {/* Preço grande — ou selo de vitalício (pago uma vez) */}
        {isVitalicio ? (
          <div className="mt-6 flex items-center gap-3 rounded-2xl p-4 border"
               style={{ borderColor: 'color-mix(in srgb, #8b5cf6 30%, transparent)', background: 'color-mix(in srgb, #8b5cf6 6%, transparent)' }}>
            <span className="text-3xl" aria-hidden>🎉</span>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground tracking-tight leading-none">Acesso vitalício</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você pagou <strong className="text-foreground">uma vez</strong> — sem mensalidade, seu acesso é pra sempre. 💜
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-sm font-bold text-muted-foreground">R$</span>
            <span className="text-5xl sm:text-6xl font-bold text-foreground tabular-nums tracking-tight leading-none">
              {Math.floor(precoMensalRef)}
            </span>
            <span className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums">
              ,{(precoMensalRef % 1).toFixed(2).slice(2)}
            </span>
            <span className="text-sm text-muted-foreground ml-1">
              /mês {intervalo === 'anual' && '· pago anualmente'}
            </span>
          </div>
        )}

        {/* Grid de info */}
        <div className="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <InfoCell
            icon={<Calendar size={13} />}
            label="Próxima cobrança"
            value={isVitalicio ? 'Nunca' : (
              validoAte
                ? validoAte.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
                : '—'
            )}
            sub={isVitalicio ? 'acesso vitalício' : (diasRestantes !== null ? `em ${diasRestantes} ${diasRestantes === 1 ? 'dia' : 'dias'}` : undefined)}
          />
          <InfoCell
            icon={<Receipt size={13} />}
            label="Ciclo"
            value={isVitalicio ? 'Vitalício' : (intervalo === 'anual' ? 'Anual' : 'Mensal')}
            sub={isVitalicio ? 'pagamento único' : (intervalo === 'anual' ? 'com desconto' : 'renova automaticamente')}
          />
          <InfoCell
            icon={<CreditCard size={13} />}
            label="Pagamento"
            value={isVitalicio ? 'Único' : 'Cartão'}
            sub={isVitalicio ? 'Mercado Pago' : 'Gerencie no portal'}
          />
          <InfoCell
            icon={<Sparkles size={13} />}
            label="Cliente desde"
            value={
              criadoEm
                ? criadoEm.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')
                : '—'
            }
          />
        </div>

        {/* Aviso de expiração proativo */}
        {diasRestantes !== null && diasRestantes <= 7 && diasRestantes > 0 && (
          <div className="mt-5 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
            <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              Sua próxima cobrança acontece em <strong>{diasRestantes} {diasRestantes === 1 ? 'dia' : 'dias'}</strong>.
              {' '}Atualize seu cartão pelo portal se precisar.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CARD DE PLANO (comparação) ────────────────────────────────
// Design replicado do componente Pricing da landing — mantém vibração visual
// idêntica, só troca o CTA "Começar agora" pela ação de Stripe contextual.

function PlanoCard({
  plano, ehAtual, ordemAtual, anual, loading, loadingPortal,
  onAssinar, onGerenciar,
}: {
  plano:         PlanoDisplay;
  ehAtual:       boolean;
  ordemAtual:    number;
  anual:         boolean;
  loading:       boolean;
  loadingPortal: boolean;
  onAssinar:     () => void;
  onGerenciar:   () => void;
}) {
  const Icon = ICONE_PLANO[plano.id];
  const info = PLANOS_INFO[plano.id];
  const precoExibido = anual ? info.anual : info.mensal;
  const podeSubir  = ORDEM_PLANO[plano.id] > ordemAtual;
  const podeDescer = ORDEM_PLANO[plano.id] < ordemAtual && ordemAtual > 0;

  return (
    <div
      className={`relative rounded-3xl p-7 transition-all hover:-translate-y-1 duration-300 ${
        plano.destaque
          ? 'border-2 shadow-[0_20px_60px_-20px_color-mix(in srgb, hsl(var(--primary)) 40%, transparent)] bg-card'
          : 'border border-border hover:border-foreground/20 shadow-sm bg-card/60'
      }`}
      style={plano.destaque ? { borderColor: plano.cor } : {}}
    >
      {/* Tinted overlay no destaque, em ambos os temas */}
      {plano.destaque && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-3xl pointer-events-none"
          style={{ background: 'linear-gradient(180deg, color-mix(in srgb, hsl(var(--primary)) 6%, transparent), transparent 60%)' }}
        />
      )}

      <div className="relative">
        {/* Badge no topo (Mais popular / Business / Plano atual) */}
        {ehAtual ? (
          <div
            className="absolute -top-9 -right-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-md whitespace-nowrap"
            style={{ background: `linear-gradient(135deg, ${plano.cor} 0%, ${escurecer(plano.cor)} 100%)` }}
          >
            <Check size={9} strokeWidth={3} /> Plano atual
          </div>
        ) : plano.badge ? (
          <div
            className="absolute -top-9 -right-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white shadow-md whitespace-nowrap"
            style={{ background: `linear-gradient(135deg, ${plano.cor} 0%, ${escurecer(plano.cor)} 100%)` }}
          >
            {plano.destaque && <Sparkles size={9} />}
            {plano.id === 'platinum' && <Crown size={9} />}
            {plano.badge}
          </div>
        ) : null}

        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {Icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `color-mix(in srgb, ${plano.cor} 9%, transparent)` }}
            >
              <Icon size={13} style={{ color: plano.cor }} />
            </div>
          )}
          <h3 className="text-xl font-bold text-foreground tracking-tight">{plano.nome}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{plano.subtitulo}</p>

        {/* Preço */}
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-foreground">R$</span>
            <span className="text-5xl font-bold text-foreground tabular-nums tracking-tight">
              {Math.floor(precoExibido)}
              <span className="text-2xl">,{(precoExibido % 1).toFixed(2).slice(2)}</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            por mês{anual && (
              <>
                {' '}· pago anualmente ·{' '}
                <span style={{ color: plano.cor }} className="font-bold">{info.descAnual}% off</span>
              </>
            )}
          </p>
        </div>

        {/* CTA contextual: Gerenciar (atual) / Upgrade / Downgrade / Assinar */}
        <PlanoCTA
          ehAtual={ehAtual}
          podeSubir={podeSubir}
          podeDescer={podeDescer}
          loading={loading}
          loadingPortal={loadingPortal}
          plano={plano}
          ordemAtual={ordemAtual}
          onAssinar={onAssinar}
          onGerenciar={onGerenciar}
        />

        {/* Features list — mesmo design da landing */}
        <ul className="space-y-2.5">
          {plano.features.map((f) => (
            <li
              key={f}
              className="flex items-start gap-2 text-[13px] text-foreground/85 leading-snug"
            >
              <span
                className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: `color-mix(in srgb, ${plano.cor} 13%, transparent)` }}
              >
                <Check size={9} style={{ color: plano.cor }} strokeWidth={3} />
              </span>
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── CTA do card de plano ──────────────────────────────────────
// Mantém o mesmo estilo visual do CTA "Começar agora" da landing
// (gradient cheio no destaque, outline nos demais), apenas com texto
// e ação contextuais ao estado de assinatura do usuário.

function PlanoCTA({
  ehAtual, podeSubir, podeDescer, loading, loadingPortal, plano, ordemAtual,
  onAssinar, onGerenciar,
}: {
  ehAtual:       boolean;
  podeSubir:     boolean;
  podeDescer:    boolean;
  loading:       boolean;
  loadingPortal: boolean;
  plano:         PlanoDisplay;
  ordemAtual:    number;
  onAssinar:     () => void;
  onGerenciar:   () => void;
}) {
  const baseClass =
    'block w-full text-center px-4 py-3 text-sm font-bold rounded-xl mb-7 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2';

  if (ehAtual) {
    return (
      <button
        onClick={onGerenciar}
        disabled={loadingPortal}
        className={`${baseClass} text-white shadow-md hover:shadow-lg`}
        style={{ background: `linear-gradient(135deg, ${plano.cor} 0%, ${escurecer(plano.cor)} 100%)` }}
      >
        {loadingPortal ? <Loader2 size={14} className="animate-spin" /> : <SettingsIcon size={14} />}
        Gerenciar assinatura
      </button>
    );
  }
  if (podeSubir) {
    return (
      <button
        onClick={onAssinar}
        disabled={loading}
        className={`${baseClass} ${plano.destaque ? 'text-white shadow-md hover:shadow-lg' : 'border border-border text-foreground hover:bg-muted/60'}`}
        style={
          plano.destaque
            ? { background: `linear-gradient(135deg, ${plano.cor} 0%, ${escurecer(plano.cor)} 100%)` }
            : undefined
        }
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowUpRight size={14} />}
        {ordemAtual === 0 ? 'Assinar' : 'Fazer upgrade'}
      </button>
    );
  }
  if (podeDescer) {
    return (
      <button
        onClick={onGerenciar}
        disabled={loadingPortal}
        className={`${baseClass} border border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground`}
      >
        {loadingPortal ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownRight size={14} />}
        Fazer downgrade
      </button>
    );
  }
  return null;
}

// Escurece um hex pra montar gradient dos botões/badges (cópia do helper
// usado no componente Pricing da landing).
function escurecer(hex: string, amt = 0.18): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ─── Auxiliares visuais ────────────────────────────────────────

function StatusPill({ cor, label }: { cor: 'emerald' | 'amber'; label: string }) {
  const tons = {
    emerald: {
      bg: 'bg-emerald-100 dark:bg-emerald-950/40',
      text: 'text-emerald-700 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    },
    amber: {
      bg: 'bg-amber-100 dark:bg-amber-950/40',
      text: 'text-amber-700 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
  }[cor];

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${tons.bg} ${tons.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${tons.dot} animate-pulse`} />
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </span>
  );
}

function InfoCell({
  icon, label, value, sub,
}: {
  icon:  React.ReactNode;
  label: string;
  value: string;
  sub?:  string;
}) {
  return (
    <div className="rounded-xl p-3 bg-muted/30 dark:bg-muted/20 border border-border/40 transition-colors hover:bg-muted/40">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] font-bold uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-sm font-bold text-foreground tabular-nums mt-1 leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: WHATSAPP
// ═══════════════════════════════════════════════════════════════
function SecaoWhatsApp() {
  const { perfil } = useAuth();
  const phone = perfil?.phone;
  // Suporta 55XXXXXXXXXXX (13 dígitos) e 55XXXXXXXXXX (12 dígitos)
  const phoneFmt = phone
    ? phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '+55 ($1) $2-$3')
    : '';

  return (
    <div className="space-y-4">
      <Card titulo="Número vinculado" subtitulo="Onde você conversa com a Sora">
        {phone ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-950/40 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-foreground tabular">{phoneFmt}</p>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Vinculado</span>
                </div>
              </div>
            </div>
            <a href="/vincular-whatsapp"
               className="btn-outline px-3 py-2 text-sm gap-2 inline-flex items-center">
              <ExternalLink size={13} /> Reconfigurar
            </a>
          </div>
        ) : (
          <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
            <div className="flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">WhatsApp não vinculado</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                  Vincule seu número pra registrar gastos por mensagem, áudio ou foto direto no app da Sora.
                </p>
                <a href="/vincular-whatsapp"
                   className="btn btn-primary px-3 py-2 text-sm gap-2 mt-3 inline-flex items-center shadow-glow-sm">
                  <Phone size={13} /> Vincular agora
                </a>
              </div>
            </div>
          </div>
        )}
      </Card>

      {phone && <ResumosCard />}

      <Card titulo="Como funciona" subtitulo="O que dá pra fazer pelo WhatsApp">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Recurso emoji="💬" titulo="Registrar gastos por texto"
                   desc='"Gastei 50 no mercado" → vira transação automaticamente' />
          <Recurso emoji="🎙️" titulo="Áudios e fotos de comprovantes"
                   desc="Mande nota fiscal ou áudio que a Sora interpreta" />
          <Recurso emoji="📊" titulo="Consultar saldo e relatórios"
                   desc='Pergunte "Quanto gastei esse mês?" e receba o resumo' />
          <Recurso emoji="🔔" titulo="Alertas inteligentes"
                   desc="Avisa quando você se aproxima do limite ou tem fatura vencendo" />
        </div>
      </Card>
    </div>
  );
}

function Recurso({ emoji, titulo, desc }: { emoji: string; titulo: string; desc: string }) {
  return (
    <div className="rounded-xl p-3 bg-muted/30 border border-border/60 flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">{emoji}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: PRIVACIDADE E DADOS
// ═══════════════════════════════════════════════════════════════
function SecaoDados() {
  const { phone, user, perfil, signOut, podeUsar } = useAuth();
  const grupoId = (perfil as any)?.grupo_ativo as string | undefined;
  const podeExportar = podeUsar('export_dados');
  const [exportando, setExportando] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [digitouConfirma, setDigitouConfirma] = useState('');
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  // ── Resetar conta (limpar dados por módulo, sem excluir a conta) ──
  const [modResetar, setModResetar] = useState({ financas: false, negocios: false, grow: false });
  const [confirmReset, setConfirmReset] = useState(false);
  const [digitouReset, setDigitouReset] = useState('');
  const [resetando, setResetando] = useState(false);
  const [compartilhada, setCompartilhada] = useState(false);

  // Conta compartilhada? (grupo com >1 membro) → Finanças/Negócios ficam
  // bloqueados no reset (apagariam dados do parceiro). O backend é a trava real.
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!grupoId) return;
      try {
        const membros = await api.grupos.membros(grupoId);
        if (vivo) setCompartilhada(Array.isArray(membros) && membros.length > 1);
      } catch { /* tolerante: mantém como solo; backend valida no reset */ }
    })();
    return () => { vivo = false; };
  }, [grupoId]);

  const algumMarcado = modResetar.financas || modResetar.negocios || modResetar.grow;

  async function resetarConta() {
    if (digitouReset.toUpperCase() !== 'RESETAR' || !algumMarcado) return;
    setResetando(true);
    try {
      await api.user.resetar(modResetar);
      // Cache local guarda dado financeiro/perfil — limpar pra não mostrar velho.
      limparCacheSWR();
      limparPerfilCache();
      flash('ok', 'Conta resetada. Recarregando…');
      setTimeout(() => window.location.assign('/dashboard'), 900);
    } catch (e: any) {
      flash('erro', e.message || 'Não foi possível resetar.');
      setConfirmReset(false);
      setDigitouReset('');
    } finally {
      setResetando(false);
    }
  }

  function flash(tipo: 'ok' | 'erro', texto: string) {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 4500);
  }

  async function exportar() {
    if (!podeExportar) { flash('erro', 'Exportação de dados está disponível no plano Premium.'); return; }
    if (!phone) { flash('erro', 'Vincule o WhatsApp primeiro.'); return; }
    setExportando(true);
    try {
      const { api } = await import('@/lib/api');
      const r = await api.transacoes.listar(phone, { limit: 5000 });
      const txs = r?.transacoes || [];
      if (txs.length === 0) { flash('erro', 'Você ainda não tem transações.'); return; }

      const headers = ['Data', 'Tipo', 'Categoria', 'Valor', 'Conta', 'Observação'];
      const rows = txs.map((t: any) => [
        fmtDataBR(t.data, { day: '2-digit', month: '2-digit', year: 'numeric' }),
        t.tipo,
        (t.categoria || '').replace(/,/g, ';'),
        Number(t.valor || 0).toFixed(2).replace('.', ','),
        (t.carteira_nome || '').replace(/,/g, ';'),
        (t.observacao || '').replace(/,/g, ';').replace(/\n/g, ' '),
      ]);
      const csv = '﻿' + [headers, ...rows].map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sora-transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      flash('ok', `${txs.length} transações exportadas.`);
    } catch (e: any) {
      flash('erro', e.message || 'Erro ao exportar.');
    } finally {
      setExportando(false);
    }
  }

  async function excluirConta() {
    if (digitouConfirma.toUpperCase() !== 'EXCLUIR') return;
    // Atualmente sem endpoint backend de deleção total. Mostra mensagem.
    flash('ok', 'Solicitação registrada. Entre em contato com suporte pra confirmação final.');
    setConfirmDel(false);
    setDigitouConfirma('');
  }

  return (
    <div className="space-y-4">
      <Card titulo="Exportar meus dados" subtitulo="Baixe todas as suas transações em CSV">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
              <Download size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="max-w-md">
              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                Histórico completo em CSV
                {!podeExportar && (
                  <span className="text-[9px] uppercase tracking-wider font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">Premium</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {podeExportar
                  ? 'Inclui data, tipo, categoria, valor, conta e observação de todas as transações. Abre direto no Excel ou Google Sheets.'
                  : 'Exportação de histórico em CSV está disponível no plano Premium.'}
              </p>
            </div>
          </div>
          <button onClick={exportar} disabled={exportando || !podeExportar}
                  title={podeExportar ? '' : 'Disponível no plano Premium'}
                  className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {exportando ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Baixar CSV
          </button>
        </div>
      </Card>

      <Card titulo="Sessão" subtitulo="Encerrar acesso neste navegador">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-muted/60 flex items-center justify-center flex-shrink-0">
              <Lock size={18} className="text-muted-foreground" />
            </div>
            <div className="max-w-md">
              <p className="text-sm font-semibold text-foreground">Sair desta conta</p>
              <p className="text-xs text-muted-foreground mt-1">Você precisará entrar de novo com email e senha.</p>
            </div>
          </div>
          <button onClick={signOut} className="btn-outline px-4 py-2 text-sm gap-2">
            Sair
          </button>
        </div>
      </Card>

      <Card titulo="Resetar minha conta" subtitulo="Limpar dados pra recomeçar — sem excluir a conta">
        <div className="rounded-xl p-4 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center flex-shrink-0">
              <RotateCcw size={18} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Escolha o que limpar</p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                Mantém seu login, plano e WhatsApp. Marque os módulos que quer zerar pra reorganizar do zero.
              </p>

              {compartilhada && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-100/70 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
                  <Users size={13} className="flex-shrink-0 mt-0.5" />
                  <span>Conta compartilhada: Finanças e Negócios ficam bloqueados pra não apagar dados dos outros membros. O Sora Grow pode ser resetado.</span>
                </div>
              )}

              <div className="mt-3 space-y-2">
                {([
                  { id: 'financas', icon: Wallet,    titulo: 'Finanças',  desc: 'Transações, contas, cartões, metas, dívidas, investimentos e limites. Recria as categorias padrão.', bloq: compartilhada },
                  { id: 'negocios', icon: Briefcase, titulo: 'Negócios',  desc: 'Empresas, caixa, contas a pagar, folha, DRE e integrações.', bloq: compartilhada },
                  { id: 'grow',     icon: Sprout,    titulo: 'Sora Grow', desc: 'Hábitos, tarefas, saúde, estudos, agenda, casa, notas e Drive.', bloq: false },
                ] as const).map((m) => {
                  const Icon = m.icon;
                  const marcado = modResetar[m.id];
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={m.bloq}
                      onClick={() => setModResetar(s => ({ ...s, [m.id]: !s[m.id] }))}
                      className={`w-full flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        m.bloq
                          ? 'opacity-50 cursor-not-allowed border-border/50 bg-muted/30'
                          : marcado
                            ? 'border-amber-400 dark:border-amber-600 bg-amber-100/60 dark:bg-amber-900/30'
                            : 'border-border hover:bg-muted/40'
                      }`}
                    >
                      <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border ${
                        marcado ? 'bg-amber-500 border-amber-500' : 'border-border bg-transparent'
                      }`}>
                        {marcado && <Check size={13} className="text-white" strokeWidth={3} />}
                      </span>
                      <Icon size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{m.titulo}</span>
                        <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setConfirmReset(true)}
                disabled={!algumMarcado}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 text-sm font-bold rounded-lg text-white disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              >
                <RotateCcw size={13} /> Resetar selecionados
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card titulo="Zona de perigo" subtitulo="Ações irreversíveis" perigo>
        <div className="rounded-xl p-4 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/60">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-950/50 flex items-center justify-center flex-shrink-0">
              <Trash2 size={18} className="text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-800 dark:text-red-300">Excluir minha conta</p>
              <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-1 leading-relaxed">
                Apaga permanentemente todas as suas transações, contas, categorias, grupos, investimentos e o login.
                Esta ação <strong>não pode ser desfeita</strong>.
              </p>
              <button onClick={() => setConfirmDel(true)}
                      className="btn-danger px-3 py-2 text-sm gap-2 mt-3 inline-flex items-center">
                <Trash2 size={13} /> Solicitar exclusão
              </button>
            </div>
          </div>
        </div>
      </Card>

      {mensagem && <Flash tipo={mensagem.tipo} texto={mensagem.texto} />}

      {/* Modal de confirmação de RESET */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => !resetando && setConfirmReset(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border animate-fade-in p-6"
               onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mb-4">
              <RotateCcw size={22} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Resetar estes dados?</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Vamos apagar de forma <strong className="text-foreground">permanente</strong> os módulos marcados. Sua conta, plano e WhatsApp continuam. Não dá pra recuperar.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {modResetar.financas && <li className="flex items-center gap-2 text-foreground"><Wallet size={14} className="text-amber-600" /> Finanças <span className="text-muted-foreground text-xs">(+ categorias padrão)</span></li>}
              {modResetar.negocios && <li className="flex items-center gap-2 text-foreground"><Briefcase size={14} className="text-amber-600" /> Negócios</li>}
              {modResetar.grow && <li className="flex items-center gap-2 text-foreground"><Sprout size={14} className="text-amber-600" /> Sora Grow</li>}
            </ul>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Pra confirmar, digite <span className="font-mono text-amber-600 dark:text-amber-400">RESETAR</span>
              </label>
              <input
                value={digitouReset}
                onChange={e => setDigitouReset(e.target.value)}
                className="input"
                placeholder="RESETAR"
                autoFocus
                disabled={resetando}
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => { setConfirmReset(false); setDigitouReset(''); }} disabled={resetando} className="btn-ghost px-4 py-2 text-sm">
                Cancelar
              </button>
              <button onClick={resetarConta}
                      disabled={digitouReset.toUpperCase() !== 'RESETAR' || resetando}
                      className="px-4 py-2 text-sm gap-2 inline-flex items-center rounded-lg text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                {resetando ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />} Resetar agora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmação de exclusão */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDel(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border animate-fade-in p-6"
               onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
              <AlertCircle size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Excluir conta {user?.email}?</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Vamos apagar <strong className="text-foreground">tudo</strong> que está vinculado a esta conta — transações, categorias, contas bancárias, cartões, investimentos, grupos. Não dá pra recuperar.
            </p>
            <div className="mt-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                Pra confirmar, digite <span className="font-mono text-red-600 dark:text-red-400">EXCLUIR</span>
              </label>
              <input
                value={digitouConfirma}
                onChange={e => setDigitouConfirma(e.target.value)}
                className="input"
                placeholder="EXCLUIR"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => { setConfirmDel(false); setDigitouConfirma(''); }} className="btn-ghost px-4 py-2 text-sm">
                Cancelar
              </button>
              <button onClick={excluirConta}
                      disabled={digitouConfirma.toUpperCase() !== 'EXCLUIR'}
                      className="btn-danger px-4 py-2 text-sm gap-2 inline-flex items-center">
                <Trash2 size={14} /> Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTES AUXILIARES
// ═══════════════════════════════════════════════════════════════
function ResumosCard() {
  const [semanal, setSemanal] = useState(true);
  const [mensal, setMensal]   = useState(true);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    api.user.resumos.get()
      .then((r) => { setSemanal(r.semanal); setMensal(r.mensal); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  function toggle(tipo: 'semanal' | 'mensal') {
    if (tipo === 'semanal') {
      const v = !semanal; setSemanal(v);
      api.user.resumos.set({ semanal: v }).catch(() => setSemanal(!v));
    } else {
      const v = !mensal; setMensal(v);
      api.user.resumos.set({ mensal: v }).catch(() => setMensal(!v));
    }
  }

  return (
    <Card titulo="Resumos no WhatsApp" subtitulo="A Sora te manda um resumo automático dos seus números">
      <div className="space-y-2.5">
        <ToggleRow icon={Calendar} titulo="Resumo semanal" desc="Todo domingo de manhã — seus gastos da semana"
                   on={semanal} onToggle={() => toggle('semanal')} disabled={!loaded} />
        <ToggleRow icon={Receipt} titulo="Fechamento mensal" desc="No dia 1º — o resumo do mês anterior"
                   on={mensal} onToggle={() => toggle('mensal')} disabled={!loaded} />
      </div>
    </Card>
  );
}

function ToggleRow({ icon: Icon, titulo, desc, on, onToggle, disabled }: {
  icon: any; titulo: string; desc: string; on: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl p-3 bg-muted/20 border border-border/40">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{titulo}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <button role="switch" aria-checked={on} aria-label={titulo} disabled={disabled} onClick={onToggle}
              className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 disabled:opacity-50 ${on ? 'bg-primary' : 'bg-muted'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function Card({ titulo, subtitulo, perigo, children }: { titulo: string; subtitulo?: string; perigo?: boolean; children: React.ReactNode }) {
  return (
    <div className={`card rounded-2xl p-5 sm:p-6 ${perigo ? 'border-red-200/50 dark:border-red-900/30' : ''}`}>
      <div className="mb-4">
        <h3 className={`text-base font-bold ${perigo ? 'text-red-700 dark:text-red-400' : 'text-foreground'}`}>{titulo}</h3>
        {subtitulo && <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}

function FieldRow({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-center min-h-[36px]">{children}</div>
    </div>
  );
}

function Flash({ tipo, texto }: { tipo: 'ok' | 'erro'; texto: string }) {
  const cls = tipo === 'ok'
    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/60 text-green-700 dark:text-green-400'
    : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-400';
  const Icon = tipo === 'ok' ? Check : AlertCircle;
  return (
    <div className={`rounded-xl p-3 border flex items-start gap-2.5 animate-fade-in ${cls}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <p className="text-xs leading-relaxed">{texto}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
async function redimensionar(file: File, max: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const escala = Math.min(max / img.width, max / img.height, 1);
        canvas.width  = Math.round(img.width  * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não suportado'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Imagem inválida'));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
