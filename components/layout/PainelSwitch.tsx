'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRightLeft, Sparkles } from 'lucide-react';

// Ícone da marca Sora — PNG transparente em public/
function IconeSora({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/soraicon-transparente.png"
      alt="Sora"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
      draggable={false}
    />
  );
}

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
      className={`group relative w-full flex items-center gap-3 px-3 py-3 rounded-xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-sm
        transition-[transform,opacity,background-color] duration-300 ease-out
        ${animating ? 'scale-[0.97] opacity-80' : 'hover:bg-white/15 active:scale-[0.99]'}`}
      title={`Trocar para Sora ${ehGrow ? 'Finance' : 'Grow'}`}
    >
      {/* Ícone único Sora — anima rotação ao trocar de painel */}
      <div
        className="relative w-10 h-10 flex items-center justify-center flex-shrink-0"
        style={{
          transition: 'transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: animating ? 'rotate(360deg) scale(0.85)' : 'rotate(0deg) scale(1)',
        }}
      >
        <IconeSora size={38} />
      </div>

      {/* "Sora Finance" / "Sora Grow" — fonte Allura, grande */}
      <div className="flex-1 text-left min-w-0">
        <div
          className="text-white leading-[0.95] truncate"
          style={{
            fontFamily: 'var(--font-brand), Allura, cursive',
            fontSize: 30,
            fontWeight: 400,
            letterSpacing: '0.005em',
          }}
        >
          Sora {ehGrow ? 'Grow' : 'Finance'}
        </div>
        <div className="text-white/65 text-[10px] mt-1 flex items-center gap-1 leading-none">
          <ArrowRightLeft size={9} />
          Trocar para {ehGrow ? 'Finance' : 'Grow'}
        </div>
      </div>

      {trialAtivo && !ehGrow && (
        <span
          className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900 shadow-md"
        >
          {diasTrialRestantes}d
        </span>
      )}
      {!temAcessoGrow && !ehGrow && (
        <Sparkles size={13} className="text-yellow-200 flex-shrink-0" />
      )}
    </button>
  );
}
