'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export type Papel = 'admin' | 'escrita' | 'leitura';

interface Perfil {
  id:          string;
  phone:       string | null;
  name:        string;
  plano:       'inativo' | 'basico' | 'premium' | 'black';
  grupo_ativo: { id: string; nome: string } | null;
}

interface AuthContextType {
  user:            User | null;
  perfil:          Perfil | null;
  loading:         boolean;
  phone:           string;
  isBlack:         boolean;
  isPremium:       boolean;
  papel:           Papel;            // papel no grupo ativo
  podeEditar:      boolean;          // admin | escrita
  podeAdministrar: boolean;          // admin
  signIn:     (email: string, password: string) => Promise<void>;
  signUp:     (email: string, password: string, name: string) => Promise<void>;
  signOut:    () => Promise<void>;
  recarregar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [perfil,  setPerfil]  = useState<Perfil | null>(null);
  const [papel,   setPapel]   = useState<Papel>('admin');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function carregarPerfil(u: User) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*, grupo_ativo:grupos!fk_users_grupo_ativo(id, nome, dono_id)')
        .eq('id', u.id)
        .maybeSingle();
      if (error) {
        console.warn('[AuthContext] carregarPerfil erro:', error);
        setPerfil(null);
        setPapel('admin');
        return;
      }
      setPerfil(data || null);

      // Descobre o papel no grupo ativo
      const grupoAtivoId = (data as any)?.grupo_ativo?.id;
      const grupoDonoId  = (data as any)?.grupo_ativo?.dono_id;
      if (!grupoAtivoId) { setPapel('admin'); return; }

      const { data: membro } = await supabase
        .from('grupo_membros')
        .select('papel')
        .eq('grupo_id', grupoAtivoId).eq('user_id', u.id)
        .maybeSingle();
      if (membro?.papel) {
        setPapel(membro.papel as Papel);
      } else if (grupoDonoId === u.id) {
        // Fallback: dono do grupo, sem registro em grupo_membros
        setPapel('admin');
      } else {
        setPapel('leitura');
      }
    } catch {
      setPerfil(null);
      setPapel('admin');
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) carregarPerfil(session.user);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) await carregarPerfil(session.user);
        else setPerfil(null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
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

  async function signUp(email: string, password: string, name: string) {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { name } }
    });
    if (error) throw new Error(error.message);
    // Trigger do Supabase cria o perfil automaticamente
    router.push('/vincular-whatsapp');
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
  const isBlack  = perfil?.plano === 'black';
  const isPremium = perfil?.plano === 'premium' || isBlack;
  const podeEditar      = papel === 'admin' || papel === 'escrita';
  const podeAdministrar = papel === 'admin';

  return (
    <AuthContext.Provider value={{
      user, perfil, loading, phone,
      isBlack, isPremium,
      papel, podeEditar, podeAdministrar,
      signIn, signUp, signOut, recarregar
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);