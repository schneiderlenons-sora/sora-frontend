'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  X, Smartphone, Monitor, Apple, Share, Plus, Download,
  Zap, Wifi, Bell, Check, Sparkles, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { LINK_PLAY_STORE } from '@/lib/play-store';

// ════════════════════════════════════════════════════════════
// CONTEXT — permite outras telas dispararem o modal
// ════════════════════════════════════════════════════════════
type PwaCtx = { abrir: () => void };
const Ctx = createContext<PwaCtx>({ abrir: () => {} });
export function usePwa() { return useContext(Ctx); }

// ════════════════════════════════════════════════════════════
// DETECÇÃO DE PLATAFORMA
// ════════════════════════════════════════════════════════════
type Plataforma = 'ios' | 'android' | 'desktop';

function detectarPlataforma(): Plataforma {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

function jaInstalado(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari standalone
  if ((window.navigator as any).standalone === true) return true;
  // Chrome / Edge standalone
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  return false;
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════
const STORAGE_KEY = 'sora-pwa-prompted-v1';

export default function InstallPwa({ children }: { children?: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);
  const [montado, setMontado] = useState(false);
  const pathname = usePathname();
  const { perfil } = useAuth();

  // Registra o service worker (necessário pro Chrome mostrar instalação)
  useEffect(() => {
    setMontado(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        console.warn('[pwa] SW register falhou:', e?.message);
      });
    }
  }, []);

  // Captura o evento beforeinstallprompt (Chrome / Edge / Samsung)
  useEffect(() => {
    function handler(e: Event) {
      e.preventDefault();
      setDeferred(e);
    }
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Auto-prompt: só aparece quando o usuário já está no painel com o onboarding
  // concluído (não na landing, auth, nem durante as configurações iniciais).
  useEffect(() => {
    if (!montado) return;
    if (jaInstalado()) return;
    if (typeof localStorage === 'undefined') return;

    // Só depois do onboarding concluído — nada de prompt no cadastro/config inicial.
    if (!perfil?.onboarding_completed) return;

    const rotasFora = ['/', '/login', '/signup', '/vincular-whatsapp'];
    if (rotasFora.includes(pathname || '') || pathname?.startsWith('/onboarding')) return;

    const flag = localStorage.getItem(STORAGE_KEY);
    if (flag === 'dismissed' || flag === 'installed') return;

    const t = window.setTimeout(() => setAberto(true), 30000);
    return () => window.clearTimeout(t);
  }, [montado, pathname, perfil?.onboarding_completed]);

  const abrir  = useCallback(() => setAberto(true), []);
  const fechar = useCallback((motivo: 'x' | 'instalado' | 'later' = 'x') => {
    setAberto(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, motivo === 'instalado' ? 'installed' : 'dismissed');
    }
  }, []);

  const value = useMemo(() => ({ abrir }), [abrir]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {aberto && <Modal deferred={deferred} onClose={(m) => fechar(m)} />}
    </Ctx.Provider>
  );
}

// ════════════════════════════════════════════════════════════
// MODAL
// ════════════════════════════════════════════════════════════
function Modal({ deferred, onClose }: { deferred: any; onClose: (m?: 'x' | 'instalado' | 'later') => void }) {
  const [aba, setAba] = useState<Plataforma>(() => detectarPlataforma());
  const [instalando, setInstalando] = useState(false);

  async function instalarNativo() {
    if (!deferred) return;
    setInstalando(true);
    try {
      deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') {
        onClose('instalado');
      }
    } catch (e) {
      console.warn('[pwa] install falhou:', e);
    } finally {
      setInstalando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-4" onClick={() => onClose('x')}>
      {/* Backdrop com blur */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <div
        className="relative w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header com gradient */}
        <div className="relative overflow-hidden p-6 pb-4 border-b border-border"
             style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / .12) 0%, hsl(var(--primary) / .03) 100%)' }}>
          {/* Halo decorativo */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-30 pointer-events-none"
               style={{ background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)' }} />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-card flex items-center justify-center flex-shrink-0 shadow-sm border border-primary/30">
                <Download size={22} className="text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-foreground leading-none">
                  {aba === 'android' ? 'Baixar a Sora' : 'Instalar Sora'}
                </h2>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {aba === 'ios'
                    ? 'Adicione à Tela de Início e use como um app'
                    : aba === 'android'
                      ? 'O app oficial da Sora, direto da Google Play'
                      : 'Instale como app e abra em janela própria'}
                </p>
              </div>
            </div>
            <button onClick={() => onClose('x')} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Tabs de plataforma */}
          <div className="mt-5 relative inline-flex items-center gap-1 bg-muted/40 rounded-2xl p-1 backdrop-blur-sm">
            {([
              { v: 'ios',     l: 'iPhone',  icon: Apple      },
              { v: 'android', l: 'Android', icon: Smartphone },
              { v: 'desktop', l: 'Desktop', icon: Monitor    },
            ] as { v: Plataforma; l: string; icon: any }[]).map(({ v, l, icon: Icon }) => {
              const ativo = aba === v;
              return (
                <button
                  key={v}
                  onClick={() => setAba(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    ativo ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon size={13} />
                  {l}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conteúdo rolável */}
        <div key={aba} className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 animate-fade-in">
          {aba === 'ios'     && <PassosIos />}
          {aba === 'android' && <BaixarAndroid onIr={() => onClose('instalado')} />}
          {aba === 'desktop' && <PassosDesktop podeNativo={!!deferred} onInstalar={instalarNativo} instalando={instalando} />}

          {/* Por que instalar */}
          <div className="rounded-2xl p-4 bg-muted/30 border border-border/60 mt-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3 inline-flex items-center gap-1.5">
              <Sparkles size={11} style={{ color: 'hsl(var(--primary))' }} />
              Por que instalar?
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Beneficio icon={Zap}  titulo="Acesso instantâneo" desc="Abre direto pelo ícone, sem digitar URL" />
              <Beneficio icon={Wifi} titulo="Funciona offline"   desc="Última versão fica salva no seu celular" />
              <Beneficio icon={Bell} titulo="Notificações"        desc="Em breve — alertas de fatura e limite" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={() => onClose('later')} className="btn-ghost px-4 py-2 text-sm">
            Mais tarde
          </button>
          <button onClick={() => onClose('x')} className="btn-outline px-4 py-2 text-sm">
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// PASSOS POR PLATAFORMA
// ════════════════════════════════════════════════════════════
function PassosIos() {
  return (
    <Passos>
      <Passo numero={1} titulo="Abra no Safari" icon={Apple} highlight="Safari">
        A instalação só funciona pelo navegador <strong>Safari</strong> da Apple — Chrome no iPhone não suporta.
      </Passo>
      <Passo numero={2} titulo="Toque em Compartilhar" icon={Share}>
        Na barra inferior do Safari, toque no ícone de <strong>Compartilhar</strong>
        <Inline><Share size={11} /></Inline> (quadrado com seta pra cima).
      </Passo>
      <Passo numero={3} titulo="Adicionar à Tela de Início" icon={Plus}>
        Role a lista e toque em <strong>Adicionar à Tela de Início</strong>. Depois toque em <strong>Adicionar</strong> no canto superior direito.
      </Passo>
      <Concluido texto="Pronto! O ícone da Sora aparece na sua tela inicial — abre como app de verdade, sem barra de endereço." />
    </Passos>
  );
}

// ANDROID agora é o app NATIVO da Play Store (público desde out/2026), não mais
// PWA. O botão leva direto pra loja; `onIr` marca o prompt como resolvido pra
// não insistir depois. iOS e desktop seguem no PWA (Apple não tem loja pra isso).
function BaixarAndroid({ onIr }: { onIr: () => void }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4 border-2 border-primary/30 bg-primary/5 text-center">
        <span className="inline-grid place-items-center w-12 h-12 rounded-2xl bg-card border border-primary/30 shadow-sm mb-3">
          {/* Triângulo do Play monocromático, na cor da marca */}
          <svg viewBox="0 0 24 24" width={22} height={22} fill="hsl(var(--primary))" aria-hidden>
            <path d="M5 3.6v16.8a1.1 1.1 0 0 0 1.66.95l14.5-8.4a1.1 1.1 0 0 0 0-1.9L6.66 2.65A1.1 1.1 0 0 0 5 3.6z" />
          </svg>
        </span>
        <p className="text-sm font-bold text-foreground">A Sora está na Google Play</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xs mx-auto">
          Baixe o app oficial e abra a Sora direto pelo ícone — mais rápido e sem barra de navegador.
        </p>
        <a
          href={LINK_PLAY_STORE}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onIr}
          className="btn btn-primary w-full py-2.5 text-sm gap-2 shadow-glow-sm mt-3"
        >
          <Download size={14} />
          Baixar na Play Store
          <ExternalLink size={13} className="opacity-80" />
        </a>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl p-3 bg-muted/30 border border-border/60">
        <ShieldCheck size={15} className="text-primary flex-shrink-0 mt-0.5" aria-hidden />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          App oficial, publicado pela Sora. Seus dados continuam os mesmos — é só entrar com a sua conta.
        </p>
      </div>
    </div>
  );
}

function PassosDesktop({ podeNativo, onInstalar, instalando }: { podeNativo: boolean; onInstalar: () => void; instalando: boolean }) {
  return (
    <Passos>
      {podeNativo && (
        <div className="rounded-2xl p-4 border-2 border-primary/30 bg-primary/5 mb-3">
          <p className="text-sm font-semibold text-foreground mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={14} className="text-primary" />
            Instalação automática disponível
          </p>
          <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
            Seu navegador permite instalar com 1 clique. A Sora vira um app que abre em janela própria.
          </p>
          <button
            onClick={onInstalar}
            disabled={instalando}
            className="btn btn-primary w-full py-2.5 text-sm gap-2 shadow-glow-sm"
          >
            <Download size={14} />
            {instalando ? 'Instalando...' : 'Instalar agora'}
          </button>
        </div>
      )}

      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {podeNativo ? 'Ou faça manualmente' : 'Como instalar'}
      </p>

      <Passo numero={1} titulo="Use Chrome ou Edge" icon={Monitor}>
        A instalação como app funciona no <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, Brave ou Arc.
      </Passo>
      <Passo numero={2} titulo="Ícone de instalar" icon={Download}>
        Na <strong>barra de endereço</strong> (perto do botão de favoritos), aparece um ícone de <strong>instalar</strong>
        <Inline><Download size={11} /></Inline>. Clique nele.
      </Passo>
      <Passo numero={3} titulo="Confirme" icon={Check}>
        Clique em <strong>Instalar</strong> no popup. A Sora abre numa janela própria, separada do navegador.
      </Passo>
      <Concluido texto="Pronto! No Windows, vira atalho na área de trabalho e no menu Iniciar. No Mac, fica no Launchpad e Dock." />
    </Passos>
  );
}

// ════════════════════════════════════════════════════════════
// AUXILIARES VISUAIS
// ════════════════════════════════════════════════════════════
function Passos({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

function Passo({ numero, titulo, icon: Icon, children }: {
  numero: number; titulo: string; icon: any; highlight?: string; children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-2xl p-4 bg-muted/30 border border-border/60 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="relative flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-glow-sm">
            {numero}
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-card border border-border flex items-center justify-center">
            <Icon size={10} className="text-foreground" />
          </div>
        </div>
        <div className="flex-1 pt-0.5 min-w-0">
          <p className="text-sm font-bold text-foreground">{titulo}</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">{children}</p>
        </div>
      </div>
    </div>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-muted/60 mx-0.5 align-middle">
      {children}
    </span>
  );
}

function Concluido({ texto }: { texto: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/60 mt-1">
      <div className="w-5 h-5 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Check size={11} className="text-white" />
      </div>
      <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">{texto}</p>
    </div>
  );
}

function Beneficio({ icon: Icon, titulo, desc }: { icon: any; titulo: string; desc: string }) {
  return (
    <div className="rounded-xl p-3 bg-card border border-border/40">
      <Icon size={14} className="text-primary mb-1.5" />
      <p className="text-xs font-bold text-foreground leading-tight">{titulo}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
    </div>
  );
}
