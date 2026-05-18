'use client';

import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import AvatarMembro from '@/components/ui/AvatarMembro';
import {
  Sparkles, User, CreditCard, MessageCircle, ShieldCheck,
  Check, Crown, Loader2, AlertCircle, Camera, Pencil, ExternalLink,
  Download, Trash2, Mail, Phone, Lock, Info, Upload,
} from 'lucide-react';

const BRAND = '#61D17B';

type Secao = 'perfil' | 'plano' | 'whatsapp' | 'dados';

export default function ConfiguracoesPage() {
  const [secao, setSecao] = useState<Secao>('perfil');

  const items: { id: Secao; label: string; desc: string; icon: any }[] = [
    { id: 'perfil',   label: 'Meu Perfil',         desc: 'Foto, nome, email e senha',        icon: User        },
    { id: 'plano',    label: 'Plano e Cobrança',   desc: 'Plano atual e comparação',         icon: CreditCard  },
    { id: 'whatsapp', label: 'WhatsApp',           desc: 'Vínculo da conta com o número',    icon: MessageCircle },
    { id: 'dados',    label: 'Privacidade e Dados', desc: 'Exportar, excluir conta',         icon: ShieldCheck },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 space-y-6">
        {/* HERO HEADER */}
        <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 animate-fade-in border border-border/60"
             style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)' }}>
          <div className="absolute inset-0 pointer-events-none opacity-50"
               style={{ background: 'radial-gradient(ellipse at top right, hsl(134 55% 60% / .12) 0%, transparent 60%)' }} />
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
                    style={ativo ? { background: `${BRAND}22` } : undefined}>
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
            {secao === 'dados'    && <SecaoDados />}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: MEU PERFIL
// ═══════════════════════════════════════════════════════════════
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
      const { error } = await supabase.from('users').update({ avatar_url: dataUrl }).eq('id', perfil.id);
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

  return (
    <div className="space-y-4">
      {/* Card do avatar + identidade */}
      <Card titulo="Foto e identidade" subtitulo="Como você aparece no painel e nos grupos">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="relative group">
            <AvatarMembro name={perfil?.name} src={perfil?.avatar_url} size="xl" />
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
const PLANOS = [
  {
    id: 'basico' as const,
    nome: 'Básico',
    preco: 0,
    precoLabel: 'Grátis',
    destaque: false,
    cor: '#64748b',
    features: [
      'Controle individual de gastos',
      'Categorias e limites pessoais',
      'Sem grupos compartilhados',
      'WhatsApp Bot ilimitado',
      'Histórico dos últimos 3 meses',
    ],
  },
  {
    id: 'premium' as const,
    nome: 'Premium',
    preco: 29.90,
    precoLabel: 'R$ 29,90/mês',
    destaque: true,
    cor: '#3b82f6',
    features: [
      'Tudo do Básico, e mais:',
      'Grupos compartilhados (até 3 membros)',
      'Limites por categoria',
      'Histórico ilimitado',
      'Relatórios avançados',
    ],
  },
  {
    id: 'black' as const,
    nome: 'Black',
    preco: 37.00,
    precoLabel: 'R$ 37,00/mês',
    destaque: false,
    cor: '#facc15',
    features: [
      'Tudo do Premium, e mais:',
      'Grupos com até 5 membros',
      'Portfólio de investimentos completo',
      'Cotações em tempo real',
      'Suporte prioritário',
    ],
  },
];

function SecaoPlano() {
  const { perfil } = useAuth();
  const planoAtualId = perfil?.plano || 'inativo';
  const [modalUpgrade, setModalUpgrade] = useState<typeof PLANOS[number] | null>(null);

  const planoAtualInfo = PLANOS.find(p => p.id === planoAtualId);

  return (
    <div className="space-y-4">
      {/* Plano atual */}
      <Card titulo="Plano atual">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: `${planoAtualInfo?.cor || '#64748b'}22` }}>
              {planoAtualId === 'black' ? <Crown size={20} className="text-yellow-500" /> : <CreditCard size={20} style={{ color: planoAtualInfo?.cor }} />}
            </div>
            <div>
              <p className="text-xl font-bold text-foreground capitalize">{planoAtualInfo?.nome || 'Inativo'}</p>
              <p className="text-xs text-muted-foreground">
                {planoAtualInfo?.precoLabel || 'Sem plano ativo'}
                {perfil?.valido_ate && ` · válido até ${new Date(perfil.valido_ate).toLocaleDateString('pt-BR')}`}
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Ativo</span>
          </div>
        </div>
      </Card>

      {/* Comparação de planos */}
      <Card titulo="Comparar planos" subtitulo="Mude de plano a qualquer momento. Cancele quando quiser.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANOS.map((p) => {
            const ehAtual = p.id === planoAtualId;
            return (
              <div key={p.id}
                   className={`relative rounded-2xl p-5 border-2 transition-all ${
                     ehAtual
                       ? 'border-primary bg-primary/5 shadow-glow-sm'
                       : p.destaque
                         ? 'border-blue-500/30 hover:border-blue-500/60 bg-blue-50/30 dark:bg-blue-950/10'
                         : 'border-border bg-card hover:border-primary/30'
                   }`}>
                {p.destaque && !ehAtual && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    Mais popular
                  </div>
                )}
                {ehAtual && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider shadow-sm">
                    Plano atual
                  </div>
                )}

                <div className="flex items-center gap-2 mb-2">
                  {p.id === 'black' && <Crown size={16} className="text-yellow-500" />}
                  <h3 className="text-lg font-bold text-foreground">{p.nome}</h3>
                </div>

                <p className="text-3xl font-bold tabular tracking-tight" style={{ color: p.cor }}>
                  {p.preco === 0 ? 'Grátis' : `R$ ${p.preco.toFixed(2).replace('.', ',')}`}
                  {p.preco > 0 && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
                </p>

                <ul className="space-y-2 mt-4 min-h-[160px]">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-foreground leading-relaxed">
                      <Check size={13} className="text-primary flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => !ehAtual && setModalUpgrade(p)}
                  disabled={ehAtual}
                  className={`w-full mt-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    ehAtual
                      ? 'bg-muted/40 text-muted-foreground cursor-not-allowed'
                      : p.id === 'black'
                        ? 'text-white shadow-glow-sm hover:scale-[1.02]'
                        : 'btn btn-primary shadow-glow-sm'
                  }`}
                  style={p.id === 'black' && !ehAtual ? { background: 'linear-gradient(135deg, #18181b, #3f3f46)' } : undefined}
                >
                  {ehAtual ? 'Plano atual' : `Mudar para ${p.nome}`}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-start gap-2.5">
          <Info size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-blue-700 dark:text-blue-300 leading-relaxed">
            <strong>Sem fidelidade.</strong> Você pode mudar de plano ou cancelar a qualquer momento. Sem multas, sem letras miúdas.
          </p>
        </div>
      </Card>

      {/* Modal de upgrade (placeholder até gateway de pagamento) */}
      {modalUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalUpgrade(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border animate-fade-in p-6"
               onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                 style={{ background: `${modalUpgrade.cor}22` }}>
              {modalUpgrade.id === 'black' ? <Crown size={22} className="text-yellow-500" /> : <CreditCard size={22} style={{ color: modalUpgrade.cor }} />}
            </div>
            <h3 className="text-base font-bold text-foreground">Mudar para {modalUpgrade.nome}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Em breve! O gateway de pagamento (Stripe) está sendo integrado. Por enquanto, entre em contato pelo WhatsApp da Sora pra mudar seu plano manualmente.
            </p>
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60 mt-4">
              <p className="text-xs text-foreground">
                <strong>{modalUpgrade.nome}</strong> — <strong className="tabular">{modalUpgrade.precoLabel}</strong>
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button onClick={() => setModalUpgrade(null)} className="btn-ghost px-4 py-2 text-sm">Fechar</button>
              <a href="https://wa.me/?text=Quero%20mudar%20meu%20plano%20Sora" target="_blank" rel="noreferrer"
                 className="btn btn-primary px-4 py-2 text-sm gap-2 inline-flex items-center shadow-glow-sm">
                <MessageCircle size={14} /> Falar com a Sora
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SEÇÃO: WHATSAPP
// ═══════════════════════════════════════════════════════════════
function SecaoWhatsApp() {
  const { perfil } = useAuth();
  const phone = perfil?.phone;
  const phoneFmt = phone
    ? phone.replace(/(\d{2})(\d{2})(\d{5})(\d{4})/, '+$1 ($2) $3-$4')
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
  const { phone, user, signOut } = useAuth();
  const [exportando, setExportando] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [digitouConfirma, setDigitouConfirma] = useState('');
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  function flash(tipo: 'ok' | 'erro', texto: string) {
    setMensagem({ tipo, texto });
    setTimeout(() => setMensagem(null), 4500);
  }

  async function exportar() {
    if (!phone) { flash('erro', 'Vincule o WhatsApp primeiro.'); return; }
    setExportando(true);
    try {
      const { api } = await import('@/lib/api');
      const r = await api.transacoes.listar(phone, { limit: 5000 });
      const txs = r?.transacoes || [];
      if (txs.length === 0) { flash('erro', 'Você ainda não tem transações.'); return; }

      const headers = ['Data', 'Tipo', 'Categoria', 'Valor', 'Conta', 'Observação'];
      const rows = txs.map((t: any) => [
        new Date(t.data).toLocaleDateString('pt-BR'),
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
      <Card titulo="Exportar meus dados" subtitulo="Baixe todas as suas transações em CSV (LGPD Art. 18)">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
              <Download size={18} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="max-w-md">
              <p className="text-sm font-semibold text-foreground">Histórico completo em CSV</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Inclui data, tipo, categoria, valor, conta e observação de todas as transações. Abre direto no Excel ou Google Sheets.
              </p>
            </div>
          </div>
          <button onClick={exportar} disabled={exportando}
                  className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm">
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
