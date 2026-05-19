'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRightLeft, Sparkles } from 'lucide-react';

export default function PainelSwitch() {
  const { painelAtivo, trocarPainel, temAcessoGrow, trialAtivo, diasTrialRestantes } = useAuth();
  const router = useRouter();
  const [animating, setAnimating] = useState(false);

  async function handleSwitch() {
    if (animating) return;
    const proximo = painelAtivo === 'finance' ? 'grow' : 'finance';
    if (proximo === 'grow' && !temAcessoGrow) {
      router.push('/grow/upgrade');
      return;
    }
    setAnimating(true);
    await trocarPainel(proximo);
    setTimeout(() => {
      router.push(proximo === 'grow' ? '/grow/dashboard' : '/dashboard');
      setAnimating(false);
    }, 350);
  }

  const ehGrow = painelAtivo === 'grow';

  return (
    <button
      onClick={handleSwitch}
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 overflow-hidden
        ${animating ? 'scale-95 opacity-70' : 'hover:bg-white/15 active:scale-98'}
        bg-white/10 backdrop-blur-sm border border-white/15`}
      title={`Trocar para ${ehGrow ? 'Finance' : 'Grow'}`}
    >
      <div className={`text-xl transition-transform duration-500 ${animating ? 'rotate-180 scale-75' : 'group-hover:scale-110'}`}>
        {ehGrow ? '🌱' : '🐋'}
      </div>
      <div className="flex-1 text-left min-w-0">
        <div className="text-white font-bold text-sm leading-tight truncate">
          Sora {ehGrow ? 'Grow' : 'Finance'}
        </div>
        <div className="text-white/65 text-[10px] mt-0.5 flex items-center gap-1">
          <ArrowRightLeft size={9} />
          Trocar para {ehGrow ? 'Finance' : 'Grow'}
        </div>
      </div>
      {trialAtivo && !ehGrow && (
        <span className="absolute -top-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900 shadow-md">
          {diasTrialRestantes}d
        </span>
      )}
      {!temAcessoGrow && !ehGrow && (
        <Sparkles size={12} className="text-yellow-200" />
      )}
    </button>
  );
}
