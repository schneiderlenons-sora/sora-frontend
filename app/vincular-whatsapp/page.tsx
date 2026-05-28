'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Loader2, Smartphone, CheckCircle2 } from 'lucide-react';

export default function VincularWhatsapp() {
  const { user, perfil, recarregar } = useAuth();
  const router  = useRouter();
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    let numero = phone.replace(/\D/g, '');
    // Garante código do país Brasil (55) — Z-API sempre envia com ele
    if (!numero.startsWith('55')) numero = '55' + numero;
    if (numero.length < 12) {
      setErro('Digite um número válido com DDD. Ex: 11999998888');
      return;
    }
    if (!user?.id) {
      setErro('Sessão expirada. Faça login novamente.');
      return;
    }
    setLoading(true);
    try {
      const nome = user.user_metadata?.name || perfil?.name || 'Usuário';
      const { error } = await supabase
        .from('users')
        .update({ phone: numero, name: nome })
        .eq('id', user.id);
      if (error) throw error;

      // Dispara mensagem de boas-vindas no WhatsApp (não bloqueia o fluxo)
      api.user.welcome({ user_id: user.id, phone: numero, nome }).catch((err) => {
        console.warn('[vincular-whatsapp] welcome falhou:', err);
      });

      await recarregar();
      // Se ainda não fez onboarding → redirect pra lá. Caso contrário → dashboard.
      router.push(perfil?.onboarding_completed ? '/dashboard' : '/onboarding');
    } catch (err: any) {
      setErro(err.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm space-y-8 animate-fade-in">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-glow"
               style={{ background: 'var(--gradient-primary)' }}>
            <Smartphone size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Vincular WhatsApp</h1>
          <p className="text-muted-foreground text-sm">
            Informe o número com DDD (sem código do país, ex: 11999998888).
          </p>
        </div>

        <form onSubmit={handleSalvar} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Número do WhatsApp
            </label>
            <input
              type="tel"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              className="input text-lg tracking-wide"
            />
            <p className="text-xs text-muted-foreground">
              Com DDD. Ex: 11999998888
            </p>
          </div>

          {erro && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full"
                  style={{ padding: '11px 16px', fontSize: '15px' }}>
            {loading
              ? <><Loader2 size={16} className="animate-spin" /> Salvando...</>
              : <><CheckCircle2 size={16} /> Salvar e continuar</>
            }
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          Você pode alterar isso depois em Configurações.
        </p>
      </div>
    </div>
  );
}