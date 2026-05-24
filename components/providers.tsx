'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import IntentPlanoRedirect from '@/components/auth/IntentPlanoRedirect';
import OnboardingRedirect from '@/components/auth/OnboardingRedirect';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      themes={['light', 'dark', 'black']}
      value={{ light: 'light', dark: 'dark', black: 'dark' }}
      storageKey="sora-theme"
      disableTransitionOnChange={false}
    >
      <AuthProvider>
        <IntentPlanoRedirect />
        <OnboardingRedirect />
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
