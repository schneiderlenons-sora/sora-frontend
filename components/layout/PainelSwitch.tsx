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

  return (
    <button
      onClick={handleSwitch}
      className={`group relative w-full flex items-center gap-1.5 px-3 py-3 rounded-xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-sm
        transition-[transform,opacity,background-color] duration-300 ease-out
        ${animating ? 'scale-[0.97] opacity-80' : 'hover:bg-white/15 active:scale-[0.99]'}`}
      title={`Trocar para Sora ${ehGrow ? 'Finance' : 'Grow'}`}
    >
      {/* Ícone Sora — anima rotação na troca */}
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{
          width: 60, height: 60,
          transition: 'transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: animating ? 'rotate(360deg) scale(0.85)' : 'rotate(0deg) scale(1)',
        }}
      >
        <img
          src="/soraicon-transparente.png"
          alt="Sora"
          width={60}
          height={60}
          style={{ width: 60, height: 60, objectFit: 'contain', display: 'block' }}
          draggable={false}
        />
      </div>

      {/* Wordmark — crossfade entre as 2 imagens (Finance ↔ Grow) */}
      <div className="flex-1 min-w-0 text-left">
        <div className="relative w-full" style={{ height: 42 }}>
          <img
            src="/sora-finance.png"
            alt="Sora Finance"
            draggable={false}
            className={`absolute inset-0 transition-opacity duration-250 ease-out`}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              objectPosition: 'left center',
              opacity: ehGrow ? 0 : 1,
            }}
          />
          <img
            src="/sora-grow.png"
            alt="Sora Grow"
            draggable={false}
            className={`absolute inset-0 transition-opacity duration-250 ease-out`}
            style={{
              height: '100%',
              width: 'auto',
              maxWidth: '100%',
              objectFit: 'contain',
              objectPosition: 'left center',
              opacity: ehGrow ? 1 : 0,
            }}
          />
        </div>
        <div className="text-white/65 text-[10px] mt-0.5 flex items-center gap-1 leading-none">
          <ArrowRightLeft size={9} />
          Trocar para {ehGrow ? 'Finance' : 'Grow'}
        </div>
      </div>

      {trialAtivo && !ehGrow && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900 shadow-md">
          {diasTrialRestantes}d
        </span>
      )}
      {!temAcessoGrow && !ehGrow && (
        <Sparkles size={13} className="text-yellow-200 flex-shrink-0" />
      )}
    </button>
  );
}
