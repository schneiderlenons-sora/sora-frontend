import type { Metadata } from 'next';
import { MoedaOnboardingProvider } from './MoedaOnboarding';

export const metadata: Metadata = {
  title: 'Bem-vindo à Sora — Configuração inicial',
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <MoedaOnboardingProvider>{children}</MoedaOnboardingProvider>
    </div>
  );
}
