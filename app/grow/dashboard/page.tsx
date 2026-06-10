'use client';

// Dashboard do Grow foi unificado no dashboard principal (/dashboard).
// Mantém a rota viva (links antigos, WhatsApp) redirecionando.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function GrowDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 size={24} className="animate-spin text-primary" />
    </div>
  );
}
