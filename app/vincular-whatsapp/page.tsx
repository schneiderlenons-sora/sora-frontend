'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Loader2, Smartphone, CheckCircle2, Check } from 'lucide-react';
import WhatsappInput, { whatsappBRValido } from '@/components/ui/WhatsappInput';

export default function VincularWhatsapp() {
  const { user, perfil, recarregar } = useAuth();
  const router  = useRouter();
  const [phone,   setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const local = phone.replace(/\D/g, '');
    if (!whatsappBRValido(local)) {
      setErro('Confira o número: precisa ser (DD) 9XXXX-XXXX, com DDD e o 9.');
      return;
    }
    // Z-API sempre envia com o código do país (55). E.164 sem o "+".
    const numero = '55' + local;
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
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 px-3 rounded-lg bg-card border border-border text-sm text-foreground">
                <span aria-hidden>🇧🇷</span> +55
              </span>
              <WhatsappInput value={phone} onChange={setPhone} required className="input text-lg tracking-wide flex-1" />
            </div>
            {whatsappBRValido(phone) ? (
              <p className="text-xs text-green-600 dark:text-green-400 inline-flex items-center gap-1">
                <Check size={12} strokeWidth={3} /> Número válido
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Com DDD — ex.: (11) 99999-9999</p>
            )}
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