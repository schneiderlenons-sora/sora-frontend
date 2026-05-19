'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRightLeft, Sparkles } from 'lucide-react';

// ─── ÍCONES ────────────────────────────────────────────────────────
// Finance: baleia padrão
function IconeFinance({ size = 22 }: { size?: number }) {
  return (
    <span style={{ fontSize: size, lineHeight: 1, display: 'inline-block' }} aria-hidden>
      🐋
    </span>
  );
}

// Grow: a mesma baleia + óculos escuros (SVG) sobre o olho.
// SVG pra controle pixel-perfect (emoji 🕶️ renderiza diferente por OS).
function IconeGrow({ size = 22 }: { size?: number }) {
  // emoji 🐋 (Apple/Google): face/olho ficam aprox. no quadrante inferior-direito.
  // Posiciono os óculos em ~58% top, ~50% left, escala proporcional ao emoji.
  const glassW = size * 0.46;
  const glassH = size * 0.18;
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{ width: size + 4, height: size + 2 }}
      aria-hidden
    >
      <IconeFinance size={size} />
      <svg
        viewBox="0 0 24 9"
        width={glassW}
        height={glassH}
        style={{
          position: 'absolute',
          top: '38%',
          left: '36%',
          transform: 'rotate(-6deg)',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))',
        }}
      >
        {/* Lente esquerda */}
        <rect x="0.6" y="0.6" width="9" height="7.8" rx="2.2" fill="#0b0b0b" stroke="#fff" strokeOpacity="0.85" strokeWidth="0.55" />
        {/* Lente direita */}
        <rect x="14.4" y="0.6" width="9" height="7.8" rx="2.2" fill="#0b0b0b" stroke="#fff" strokeOpacity="0.85" strokeWidth="0.55" />
        {/* Ponte entre as lentes */}
        <path d="M 9.6 4 L 14.4 4" stroke="#0b0b0b" strokeWidth="1.4" strokeLinecap="round" />
        {/* Reflexos brilhosos nas lentes */}
        <path d="M 2 1.6 L 4 4" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M 15.8 1.6 L 17.8 4" stroke="#fff" strokeOpacity="0.6" strokeWidth="0.9" strokeLinecap="round" />
      </svg>
    </span>
  );
}

// ─── SWITCH ────────────────────────────────────────────────────────
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
    // Navega imediatamente — sem setTimeout bloqueando.
    router.push(proximo === 'grow' ? '/grow/dashboard' : '/dashboard');
    trocarPainel(proximo);
    // Reseta o estado de animação só pra deixar o feedback visual rodar.
    setTimeout(() => setAnimating(false), 550);
  }

  const ehGrow = painelAtivo === 'grow';

  return (
    <button
      onClick={handleSwitch}
      className={`group relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl overflow-hidden border border-white/15 bg-white/10 backdrop-blur-sm
        transition-[transform,opacity,background-color] duration-300 ease-out
        ${animating ? 'scale-[0.97] opacity-80' : 'hover:bg-white/15 active:scale-[0.99]'}`}
      title={`Trocar para Sora ${ehGrow ? 'Finance' : 'Grow'}`}
    >
      {/* Ícone: rotação fluida com cross-fade entre Finance e Grow */}
      <div
        className="relative w-7 h-7 flex items-center justify-center flex-shrink-0"
        style={{
          transition: 'transform 550ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          transform: animating ? 'rotate(360deg) scale(0.9)' : 'rotate(0deg) scale(1)',
        }}
      >
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transition: 'opacity 220ms ease-out',
            opacity: ehGrow ? 0 : 1,
          }}
        >
          <IconeFinance size={24} />
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transition: 'opacity 220ms ease-out',
            opacity: ehGrow ? 1 : 0,
          }}
        >
          <IconeGrow size={24} />
        </span>
      </div>

      {/* Textos */}
      <div className="flex-1 text-left min-w-0">
        <div
          className="text-white leading-none truncate"
          style={{
            fontFamily: 'var(--font-brand), Caveat, cursive',
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '0.01em',
          }}
        >
          Sora {ehGrow ? 'Grow' : 'Finance'}
        </div>
        <div className="text-white/65 text-[10px] mt-0.5 flex items-center gap-1 leading-none">
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
