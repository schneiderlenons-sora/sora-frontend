'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRightLeft, Sparkles } from 'lucide-react';

export default function PainelSwitch() {
  const { painelAtivo, trocarPainel, temAcessoGrow, trialAtivo, diasTrialRestantes } = useAuth();
  const router = useRouter();
  const [animating, setAnimating] = useState(false);

  function handleSwitch() {
    if (animating) return;
    const proximo = painelAtivo === 'finance' ? 'grow' : 'finance';

    if (proximo === 'grow' && !temAcessoGrow) {
      router.push('/grow/upgrade');
      return;
    }

    setAnimating(true);
    router.push(proximo === 'grow' ? '/grow/dashboard' : '/dashboard');
    trocarPainel(proximo);
    setTimeout(() => setAnimating(false), 550);
  }

  const ehGrow = painelAtivo === 'grow';
  const imagemAtual = ehGrow ? '/icon-soragrow.png' : '/icon-sorafinance.png';

  return (
    <button
      onClick={handleSwitch}
      className="group relative w-full block overflow-hidden rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm
                 px-3 pt-2 pb-1.5
                 transition-all duration-300 ease-out
                 hover:bg-white/15 active:scale-[0.99]"
      style={{
        transform: animating ? 'scale(0.96)' : 'scale(1)',
        opacity: animating ? 0.85 : 1,
      }}
      title={`Trocar para Sora ${ehGrow ? 'Finance' : 'Grow'}`}
    >
      {/* Container do logo — imagem fantasma dimensiona, outras 2 fazem crossfade */}
      <div className="relative w-full">
        <img
          src={imagemAtual}
          alt=""
          aria-hidden
          className="block w-full h-auto opacity-0 pointer-events-none"
          draggable={false}
        />
        <img
          src="/icon-sorafinance.png"
          alt="Sora Finance"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ease-out"
          style={{ opacity: ehGrow ? 0 : 1 }}
        />
        <img
          src="/icon-soragrow.png"
          alt="Sora Grow"
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain transition-opacity duration-300 ease-out"
          style={{ opacity: ehGrow ? 1 : 0 }}
        />
      </div>

      {/* Indicador "Trocar para X" */}
      <div className="text-white/65 text-[10px] mt-1 flex items-center justify-center gap-1 leading-none">
        <ArrowRightLeft size={9} />
        Trocar para {ehGrow ? 'Finance' : 'Grow'}
      </div>

      {trialAtivo && !ehGrow && (
        <span className="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900 shadow-md">
          {diasTrialRestantes}d
        </span>
      )}
      {!temAcessoGrow && !ehGrow && (
        <Sparkles size={12} className="absolute top-1.5 right-1.5 text-yellow-200" />
      )}
    </button>
  );
}
