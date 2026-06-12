'use client';

// Loader fofo da Sora — uma baleia nadando com bolhas. Usado enquanto os dados
// da aba ainda não chegaram, pra nunca mostrar a tela "zerada".
export default function SoraLoader({ label = 'Carregando seus dados…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 select-none" role="status" aria-live="polite">
      <div className="relative w-[180px] h-[150px]">
        {/* bolhas subindo */}
        {[
          { left: 116, delay: 0,    size: 9 },
          { left: 132, delay: 0.6,  size: 6 },
          { left: 124, delay: 1.1,  size: 7 },
        ].map((b, i) => (
          <span key={i} aria-hidden
            className="absolute rounded-full motion-safe:animate-[bubble-rise_2.4s_ease-in-out_infinite]"
            style={{
              left: b.left, top: 60, width: b.size, height: b.size,
              background: 'hsl(var(--primary) / 0.35)',
              border: '1px solid hsl(var(--primary) / 0.5)',
              animationDelay: `${b.delay}s`,
            }} />
        ))}

        {/* baleia (bob + leve rotação) */}
        <svg viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full origin-center motion-safe:animate-[whale-swim_3.2s_ease-in-out_infinite] drop-shadow-[0_12px_18px_rgba(2,132,199,0.25)]">
          <defs>
            <linearGradient id="whaleBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>

          {/* cauda (abana) */}
          <g style={{ transformOrigin: '150px 75px' }} className="motion-safe:animate-[whale-tail_1.6s_ease-in-out_infinite]">
            <path d="M148 75 L188 52 Q180 75 188 100 Z" fill="#0ea5e9" />
          </g>

          {/* corpo */}
          <ellipse cx="92" cy="78" rx="62" ry="42" fill="url(#whaleBody)" />
          {/* barriga */}
          <path d="M40 96 Q92 122 150 92 Q118 108 92 108 Q66 108 40 96 Z" fill="#e0f2fe" opacity="0.95" />
          {/* nadadeira de cima */}
          <path d="M86 38 Q96 22 112 34 Q100 40 86 42 Z" fill="#0ea5e9" />
          {/* nadadeira lateral */}
          <path d="M70 96 Q78 112 96 104 Q84 100 76 92 Z" fill="#0284c7" opacity="0.85" />

          {/* olho */}
          <circle cx="62" cy="70" r="6.5" fill="#fff" />
          <circle cx="60" cy="71" r="3.4" fill="#0c4a6e" className="motion-safe:animate-[blink_4s_ease-in-out_infinite]" />
          {/* sorriso */}
          <path d="M52 86 Q62 93 74 86" stroke="#0c4a6e" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          {/* bochecha */}
          <circle cx="50" cy="82" r="4" fill="#fb7185" opacity="0.35" />

          {/* esguicho */}
          <g stroke="hsl(var(--primary))" strokeWidth="2.4" strokeLinecap="round" opacity="0.7"
             className="motion-safe:animate-[whale-tail_2.2s_ease-in-out_infinite]" style={{ transformOrigin: '99px 36px' }}>
            <path d="M99 34 Q97 22 100 14" />
            <path d="M99 34 Q91 24 88 18" />
            <path d="M99 34 Q107 24 110 18" />
          </g>
        </svg>

        {/* "água" — onda que desliza por baixo */}
        <div className="absolute inset-x-0 bottom-1 h-5 overflow-hidden opacity-60" aria-hidden>
          <div className="w-[200%] h-full motion-safe:animate-[wave-slide_3s_linear_infinite]"
            style={{
              maskImage: 'radial-gradient(ellipse 60% 100% at 50% 0%, black 40%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse 60% 100% at 50% 0%, black 40%, transparent 75%)',
              backgroundImage: 'repeating-radial-gradient(circle at 10px -6px, hsl(var(--primary) / 0.25) 0 10px, transparent 10px 20px)',
              backgroundSize: '40px 20px',
            }} />
        </div>
      </div>

      <p className="text-sm font-medium text-muted-foreground motion-safe:animate-[fade-in_400ms_ease-out_both]">
        {label}
      </p>
    </div>
  );
}
