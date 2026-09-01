'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { SWRConfig } from 'swr';
import { AuthProvider } from '@/contexts/AuthContext';
import { MarcasCustomProvider } from '@/contexts/MarcasCustomContext';
import { localStorageProvider } from '@/lib/swr-cache';
import PaywallRedirect from '@/components/auth/PaywallRedirect';
import OnboardingRedirect from '@/components/auth/OnboardingRedirect';
import WelcomeTrigger from '@/components/auth/WelcomeTrigger';
import { LoadingGateProvider } from '@/components/ui/LoadingGate';
import AberturaSora from '@/components/ui/AberturaSora';
import { aplicarPaleta, getPaletaSalva } from '@/lib/theme-colors';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Garante o domínio canônico (www). O cookie de sessão é do www; se o usuário
  // cair no apex (forsora.com) fica "sem sessão"/inativo. Rede de segurança caso
  // o redirect de borda não pegue.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'forsora.com') {
      window.location.replace(
        'https://www.forsora.com' + window.location.pathname + window.location.search + window.location.hash,
      );
    }
  }, []);

  // Reaplica a cor temática salva (consistência após hidratação)
  useEffect(() => { aplicarPaleta(getPaletaSalva()); }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={['light', 'black']}
      value={{ light: 'light', black: 'dark' }}
      storageKey="sora-theme"
      disableTransitionOnChange={false}
    >
      <SWRConfig value={{ provider: localStorageProvider }}>
        <AuthProvider>
          <PaywallRedirect />
          <OnboardingRedirect />
          <WelcomeTrigger />
          <MarcasCustomProvider>
            <LoadingGateProvider>
              {children}
              {/* Animação de abertura (só mobile, 1× por sessão). Mora aqui e
                  não num layout pra cobrir a tela inteira desde o primeiro
                  paint — dentro do DashboardLayout ela nasceria com a sidebar
                  já desenhada por baixo. */}
              <AberturaSora />
            </LoadingGateProvider>
          </MarcasCustomProvider>
        </AuthProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
