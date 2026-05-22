'use client';

/**
 * iPhone 15 Pro mockup CSS-only — Dynamic Island + bordas finas + sombra refinada
 * Aspect-ratio 9:19.5 (idêntico ao iPhone 15 Pro real)
 */
export default function IPhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ aspectRatio: '9 / 19.5' }}>
      {/* Reflexo / borda externa (titanium) */}
      <div className="absolute inset-0 rounded-[14%] p-[3px]"
           style={{
             background: 'linear-gradient(135deg, #4a4a52 0%, #2a2a2e 35%, #0a0a0c 65%, #1a1a1e 100%)',
             boxShadow: `
               0 30px 60px -20px rgba(0, 0, 0, 0.5),
               0 18px 40px -16px rgba(0, 0, 0, 0.3),
               inset 0 1px 2px rgba(255, 255, 255, 0.08)
             `,
           }}>
        {/* Border interna (preto profundo) */}
        <div className="w-full h-full rounded-[13%] p-[2px] bg-black">
          {/* Screen */}
          <div className="relative w-full h-full rounded-[12%] overflow-hidden bg-black">
            {children}

            {/* Dynamic Island */}
            <div className="absolute top-[1.5%] left-1/2 -translate-x-1/2 w-[34%] h-[3.6%] bg-black rounded-full z-50 shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />

            {/* Highlight de tela (reflexo de vidro top-left) */}
            <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
                 style={{
                   background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 30%, transparent 70%, rgba(255,255,255,0.05) 100%)',
                 }} />
          </div>
        </div>
      </div>

      {/* Botões laterais (volume, power) */}
      <div className="absolute left-[-1.5%] top-[20%] w-[1.5%] h-[6%] rounded-l-md bg-gradient-to-b from-[#3a3a3e] to-[#2a2a2e]" />
      <div className="absolute left-[-1.5%] top-[28%] w-[1.5%] h-[10%] rounded-l-md bg-gradient-to-b from-[#3a3a3e] to-[#2a2a2e]" />
      <div className="absolute left-[-1.5%] top-[40%] w-[1.5%] h-[10%] rounded-l-md bg-gradient-to-b from-[#3a3a3e] to-[#2a2a2e]" />
      <div className="absolute right-[-1.5%] top-[25%] w-[1.5%] h-[14%] rounded-r-md bg-gradient-to-b from-[#3a3a3e] to-[#2a2a2e]" />
    </div>
  );
}
