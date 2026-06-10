'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import PaywallRedirect from '@/components/auth/PaywallRedirect';
import OnboardingRedirect from '@/components/auth/OnboardingRedirect';

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
      <AuthProvider>
        <PaywallRedirect />
        <OnboardingRedirect />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
