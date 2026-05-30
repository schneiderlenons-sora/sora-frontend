'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import WizardShell from './components/WizardShell';
import { Loader2 } from 'lucide-react';

import Step1Boasvindas    from './steps/Step1Boasvindas';
import Step2PerfilUso     from './steps/Step2PerfilUso';
import Step3Objetivo      from './steps/Step3Objetivo';
import Step4Categorias    from './steps/Step4Categorias';
import Step5Contas        from './steps/Step5Contas';
import Step6GastosFixos   from './steps/Step6GastosFixos';
import Step7ReceitasFixas from './steps/Step7ReceitasFixas';
import Step8PrimeiraMeta  from './steps/Step8PrimeiraMeta';
import Step9WhatsappTour  from './steps/Step9WhatsappTour';

export default function OnboardingPage() {
  const { loading, user, perfil, recarregar } = useAuth();
  const router = useRouter();

  // Garante perfil fresco ao entrar (phone/grupo recém-salvos no cadastro),
  // pra que os passos que chamam o backend tenham o número vinculado.
  useEffect(() => {
    if (user) recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Sem auth → manda pra login (provavelmente clicou no link do WhatsApp
  // sem estar logado no browser; ele já tem conta, é só logar).
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
  }, [loading, user, router]);

  // Já completou → manda pra dashboard
  useEffect(() => {
    if (!perfil) return;
    if (perfil.onboarding_completed) router.replace('/dashboard');
  }, [perfil, router]);

  if (loading || !user || !perfil) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <OnboardingProvider>
      <WizardShell>
        <StepRouter />
      </WizardShell>
    </OnboardingProvider>
  );
}

function StepRouter() {
  const { state } = useOnboarding();
  switch (state.step) {
    case 1: return <Step1Boasvindas />;
    case 2: return <Step2PerfilUso />;
    case 3: return <Step3Objetivo />;
    case 4: return <Step4Categorias />;
    case 5: return <Step5Contas />;
    case 6: return <Step6GastosFixos />;
    case 7: return <Step7ReceitasFixas />;
    case 8: return <Step8PrimeiraMeta />;
    case 9: return <Step9WhatsappTour />;
    default: return <Step1Boasvindas />;
  }
}
