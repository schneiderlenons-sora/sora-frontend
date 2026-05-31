'use client';

import { ThemeProvider } from 'next-themes';
import { AuthProvider } from '@/contexts/AuthContext';
import PaywallRedirect from '@/components/auth/PaywallRedirect';
import OnboardingRedirect from '@/components/auth/OnboardingRedirect';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      themes={['light', 'dark', 'black']}
      value={{ light: 'light', dark: 'dark', black: 'dark' }}
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
