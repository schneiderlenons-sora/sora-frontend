'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { type Plano, type Feature, type Recurso, podeUsar as _podeUsar, limiteDe as _limiteDe } from '@/lib/plans';

export type Papel = 'admin' | 'escrita' | 'leitura';
export type Painel = 'finance' | 'grow';
export type PlanoGrow = 'sem_acesso' | 'trial' | 'grow_basico' | 'grow_premium';

export type PerfilUso = 'pessoal' | 'casal' | 'empresarial' | 'ambos';
export type ObjetivoPrincipal = 'vermelho' | 'meta' | 'organizar' | 'negocio';

interface Perfil {
  id:               string;
  phone:            string | null;
  name:             string;
  email?:           string | null;
  avatar_url?:      string | null;
  created_at?:      string | null;
  plano:            Plano;
  plano_intervalo?: 'mensal' | 'anual' | null;
  plano_valido_ate?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  plano_grow?:      PlanoGrow;
  grow_trial_inicio?: string | null;
  grow_trial_fim?:    string | null;
  painel_ativo?:    Painel;
  grupo_ativo:      { id: string; nome: string } | null;
  // ── Onboarding wizard ────────────────────────────────────────────
  onboarding_completed?: boolean;
  onboarding_step?:      number;
  perfil_uso?:           PerfilUso | null;
  objetivo_principal?:   ObjetivoPrincipal | null;
  // ── WhatsApp / preferências de conta ─────────────────────────────
  welcomed_at?:          string | null;
  wallet_padrao_id?:     string | null;
}

interface AuthContextType {
  user:            User | null;
  perfil:          Perfil | null;
  loading:         boolean;
  phone:           string;
  plano:           Plano;
  // Flags legados — mantidos por compat. Para novo código use `podeUsar`.
  isBlack:         boolean;
  isPremium:       boolean;
  // Helpers centralizados (lib/plans.ts)
  podeUsar:        (feature: Feature) => boolean;
  limiteDe:        (recurso: Recurso) => number;
  papel:           Papel;
  podeEditar:      boolean;
  podeAdministrar: boolean;
  // ── Grow ──
  painelAtivo:     Painel;
  temAcessoGrow:   boolean;
  podeAtivarTrialGrow: boolean;
  trialAtivo:      boolean;
  diasTrialRestantes: number;
  trocarPainel:    (p: Painel) => Promise<void>;
  ativarTrialGrow: () => Promise<void>;
  // ──────────
  signIn:           (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple:  () => Promise<void>;
  signUp:           (email: string, password: string, name: string) => Promise<string | null>;
  signOut:          () => Promise<void>;
  recarregar:       () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [perfil,  setPerfil]  = useState<Perfil | null>(null);
  const [papel,   setPapel]   = useState<Papel>('admin');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Carrega o perfil pelo SERVIDOR (/api/me): lê a sessão via cookie + service
  // role. É confiável no F5 — o caminho client-side (RLS + sessão ainda
  // hidratando) voltava vazio/erro e travava o painel. Reententa em falha.
  async function carregarPerfil(_u: User, tentativa = 0): Promise<void> {
    const MAX = 3;
    try {
      const res = await fetch('/api/me', { cache: 'no-store' });
      if (!res.ok) throw new Error('status ' + res.status);
      const { perfil: p, papel: pap } = await res.json();
      if (!p) {
        if (tentativa < MAX) {
          await new Promise((r) => setTimeout(r, 500));
          return carregarPerfil(_u, tentativa + 1);
        }
        setPerfil(null); setPapel('admin'); return;
      }
      setPerfil(p);
      setPapel((pap as Papel) || 'admin');
    } catch (e) {
      if (tentativa < MAX) {
        await new Promise((r) => setTimeout(r, 500));
        return carregarPerfil(_u, tentativa + 1);
      }
      console.warn('[AuthContext] carregarPerfil falhou:', e);
      setPerfil(null); setPapel('admin');
    }
  }

  useEffect(() => {
    // Blindagem: garante que `loading` SEMPRE resolve (senão o painel fica em
    // loader infinito quando getSession trava/rejeita no F5).
    let resolvido = false;
    const finalizar = () => { if (!resolvido) { resolvido = true; setLoading(false); } };
    const hardTimeout = setTimeout(finalizar, 8000);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) await carregarPerfil(session.user);
      })
      .catch(() => {})
      .finally(finalizar);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) await carregarPerfil(session.user);
        else setPerfil(null);
        finalizar();
      }
    );

    return () => { clearTimeout(hardTimeout); subscription.unsubscribe(); };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(
      error.message === 'Invalid login credentials'
        ? 'Email ou senha incorretos.'
        : error.message
    );
    router.push('/dashboard');
  }

  async function signInWithProvider(provider: 'google' | 'apple') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) throw new Error(error.message);
  }
  const signInWithGoogle = () => signInWithProvider('google');
  const signInWithApple  = () => signInWithProvider('apple');

  async function signUp(email: string, password: string, name: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    });
    if (error) throw new Error(error.message);
    // Trigger do Supabase cria o perfil automaticamente. NÃO navega aqui — o
    // wizard de cadastro controla os passos (dados → plano → pagamento).
    return data.user?.id ?? null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setPerfil(null);
    router.push('/login');
  }

  async function recarregar() {
    if (user) await carregarPerfil(user);
  }

  const phone    = perfil?.phone || '';
  const plano: Plano = perfil?.plano || 'inativo';
  const isBlack  = plano === 'black';
  const isPremium = plano === 'premium' || isBlack;
  const podeUsar = (f: Feature) => _podeUsar(plano, f);
  const limiteDe = (r: Recurso) => _limiteDe(plano, r);
  const podeEditar      = papel === 'admin' || papel === 'escrita';
  const podeAdministrar = papel === 'admin';

  // ── GROW: acesso, trial, troca de painel ───────────────────────────
  // Premium e Black têm Sora Grow incluso (acesso direto, sem trial).
  // Básico pode ativar 7 dias grátis. Inativo idem (onboarding).
  // Histórico: planos legados "grow_basico"/"grow_premium" continuam valendo.
  const planoGrow = perfil?.plano_grow || 'sem_acesso';
  const trialFim  = perfil?.grow_trial_fim ? new Date(perfil.grow_trial_fim) : null;
  const agora     = new Date();
  const trialAtivo = planoGrow === 'trial' && trialFim != null && trialFim > agora;
  const diasTrialRestantes = trialFim ? Math.max(0, Math.ceil((trialFim.getTime() - agora.getTime()) / 86400000)) : 0;
  // Todos os planos têm acesso base ao Grow (hábitos, tarefas, bem-estar,
  // lista de compras, agenda). Saúde/Estudos/Casa-avançada são gated por
  // sub-feature (grow_saude, grow_estudos, grow_despensa) no Premium+.
  const temAcessoGrow =
    podeUsar('sora_grow') ||
    ['grow_basico', 'grow_premium'].includes(planoGrow) ||
    trialAtivo;
  // Trial descontinuado — todos já têm o Grow base.
  const podeAtivarTrialGrow = false;
  // Painel ativo é DERIVADO da URL — fonte de verdade única, sem race
  // condition entre state local e navegação. Sidebar/UI ficam sempre
  // consistentes com a rota atual.
  const painelAtivo: Painel = pathname?.startsWith('/grow') ? 'grow' : 'finance';

  async function trocarPainel(p: Painel) {
    if (!phone) return;
    // Persiste no backend (usado pela conversa do WhatsApp); a UI já
    // reflete a troca via mudança de pathname.
    try { await api.grow.trocarPainel(phone, p); } catch (e) { console.warn('[grow] trocar painel falhou', e); }
  }

  async function ativarTrialGrow() {
    if (!phone) return;
    await api.grow.ativarTrial(phone);
    await recarregar();
  }

  return (
    <AuthContext.Provider value={{
      user, perfil, loading, phone,
      plano, isBlack, isPremium,
      podeUsar, limiteDe,
      papel, podeEditar, podeAdministrar,
      painelAtivo, temAcessoGrow, podeAtivarTrialGrow, trialAtivo, diasTrialRestantes,
      trocarPainel, ativarTrialGrow,
      signIn, signInWithGoogle, signInWithApple, signUp, signOut, recarregar
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);