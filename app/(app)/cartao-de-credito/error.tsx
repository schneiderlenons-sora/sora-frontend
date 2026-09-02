'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

// Error boundary da rota de cartões. Captura qualquer erro de runtime
// (ex: React #284 do Recharts) e mostra um retry amigável, em vez da
// tela genérica "This page couldn't load" do navegador/Next.
export default function CartaoError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[cartao-de-credito] erro de runtime:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="card rounded-3xl p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={26} className="text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-lg font-bold text-foreground">Não foi possível carregar os cartões</h2>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          Tivemos um problema ao montar esta página. Tente novamente — seus dados estão seguros.
        </p>
        <button
          onClick={() => reset()}
          className="btn btn-primary px-5 py-2.5 text-sm gap-2 mt-5 inline-flex items-center shadow-glow-sm"
        >
          <RefreshCw size={15} /> Tentar novamente
        </button>
        <a href="/dashboard" className="block text-xs text-muted-foreground hover:text-foreground mt-3 underline">
          Voltar ao dashboard
        </a>
      </div>
    </div>
  );
}
