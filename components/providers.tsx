'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { SWRConfig } from 'swr';
import { AuthProvider } from '@/contexts/AuthContext';
import { MarcasCustomProvider } from '@/contexts/MarcasCustomContext';
import { CategoriasUserProvider } from '@/contexts/CategoriasUserContext';
import { localStorageProvider } from '@/lib/swr-cache';
import PaywallRedirect from '@/components/auth/PaywallRedirect';
import OnboardingRedirect from '@/components/auth/OnboardingRedirect';
import WelcomeTrigger from '@/components/auth/WelcomeTrigger';
import { LoadingGateProvider } from '@/components/ui/LoadingGate';
import ThemeColorSync from '@/components/layout/ThemeColorSync';
import OrigemSync from '@/components/app/OrigemSync';
import DispositivoSync from '@/components/app/DispositivoSync';
import AppInstaladoSync from '@/components/app/AppInstaladoSync';
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
      {/* Mantém a faixa do home-indicator na cor da barra. Fica AQUI, dentro
          do ThemeProvider, porque depende do tema resolvido — e fora do
          DashboardLayout porque a meta é do documento inteiro, landing incluída. */}
      <ThemeColorSync />
      {/* Marca a sessão como vinda do app Android antes de qualquer
          navegação. Fora do AuthProvider de propósito: não depende de
          usuário logado, e o sinal chega na primeira tela — que pode ser o
          login. */}
      <OrigemSync />
      <SWRConfig value={{ provider: localStorageProvider }}>
        <AuthProvider>
          <PaywallRedirect />
          <OnboardingRedirect />
          <WelcomeTrigger />
          {/* Precisa de sessão pra gravar (é o `id` que identifica a linha em
              `users`) — por isso mora AQUI, dentro do AuthProvider, e não ao
              lado do OrigemSync (que roda mesmo deslogado). */}
          <DispositivoSync />
          {/* Marca no servidor que a pessoa abriu a Sora DENTRO do app
              Android — é o que esconde a barra de convite da Play Store. */}
          <AppInstaladoSync />
          <MarcasCustomProvider>
            {/* Categorias do grupo: é delas que sai o emoji/cor de cada
                transação. Fica ao lado das marcas porque as duas alimentam o
                mesmo ícone — ver CategoriasUserContext. */}
            <CategoriasUserProvider>
              <LoadingGateProvider>
                {children}
              </LoadingGateProvider>
            </CategoriasUserProvider>
          </MarcasCustomProvider>
        </AuthProvider>
      </SWRConfig>
    </ThemeProvider>
  );
}
