'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ChevronsUpDown } from 'lucide-react';

// Ícone do Sora Finance: 🐋
function IconeFinance() {
  return (
    <span
      className="select-none leading-none"
      style={{ fontSize: 26, lineHeight: 1, display: 'inline-block' }}
      aria-hidden
    >
      🐋
    </span>
  );
}

// Ícone do Sora Grow: 🐋 com óculos escuros 🕶️
function IconeGrow() {
  return (
    <span
      className="relative inline-flex items-center justify-center select-none"
      style={{ width: 28, height: 28 }}
      aria-hidden
    >
      <span style={{ fontSize: 26, lineHeight: 1 }}>🐋</span>
      {/* óculos escuros sobre o olho da baleia (canto sup. direito) */}
      <span
        style={{
          position: 'absolute',
          top: 4,
          right: 0,
          fontSize: 12,
          transform: 'rotate(-10deg)',
          filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
        }}
      >
        🕶️
      </span>
    </span>
  );
}

export default function PainelSwitch() {
  const { painelAtivo, trocarPainel, temAcessoGrow, trialAtivo, diasTrialRestantes } = useAuth();
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);

  async function handleSwitch() {
    if (trocando) return;
    const proximo = painelAtivo === 'finance' ? 'grow' : 'finance';
    if (proximo === 'grow' && !temAcessoGrow) {
      router.push('/grow/upgrade');
      return;
    }
    setTrocando(true);
    // Navega imediatamente — a transição visual acontece em paralelo
    router.push(proximo === 'grow' ? '/grow/dashboard' : '/dashboard');
    trocarPainel(proximo).finally(() => {
      setTimeout(() => setTrocando(false), 250);
    });
  }

  const ehGrow = painelAtivo === 'grow';

  return (
    <button
      onClick={handleSwitch}
      aria-label={`Trocar para Sora ${ehGrow ? 'Finance' : 'Grow'}`}
      title={`Trocar para Sora ${ehGrow ? 'Finance' : 'Grow'}`}
      className={`group relative flex items-center gap-2.5 min-w-0 rounded-xl px-2 py-1.5 -mx-2 transition-all duration-200
        hover:bg-white/10 active:bg-white/5 active:scale-[0.99]
        ${trocando ? 'pointer-events-none' : ''}`}
    >
      {/* Wrapper do ícone — crossfade suave entre baleias */}
      <span
        className={`relative inline-flex items-center justify-center w-8 h-8 flex-shrink-0 transition-transform duration-300 ${
          trocando ? 'scale-90' : 'scale-100 group-hover:scale-105'
        }`}
      >
        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            ehGrow ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <IconeFinance />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${
            ehGrow ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <IconeGrow />
        </span>
      </span>

      {/* Texto: "Sora Finance" / "Sora Grow" na fonte Sora */}
      <span className="flex-1 min-w-0 text-left leading-none">
        <span
          className="block text-white font-extrabold tracking-tight truncate"
          style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif', fontSize: 18, letterSpacing: '-0.02em' }}
        >
          Sora <span className="font-bold">{ehGrow ? 'Grow' : 'Finance'}</span>
        </span>
      </span>

      {/* Chevron pra indicar que troca */}
      <ChevronsUpDown
        size={13}
        className={`text-white/70 flex-shrink-0 transition-transform duration-300 ${
          trocando ? 'rotate-180' : 'group-hover:text-white'
        }`}
      />

      {trialAtivo && !ehGrow && (
        <span
          className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-300 text-yellow-900 shadow-md"
          style={{ fontFamily: 'var(--font-sora), system-ui, sans-serif' }}
        >
          {diasTrialRestantes}d
        </span>
      )}
    </button>
  );
}
