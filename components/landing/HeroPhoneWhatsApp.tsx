'use client';

/**
 * Conteúdo do iPhone 1 — conversa WhatsApp com a Sora pixel-perfect.
 * Cores oficiais do WhatsApp dark: #0B141A bg, #005C4B bolha enviada, #202C33 bolha recebida.
 */
export default function HeroPhoneWhatsApp() {
  return (
    <div className="relative w-full h-full bg-[#0B141A] flex flex-col text-white text-[10px]"
         style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Status bar iOS */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[8px] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-0.5">
          <span>●●●</span>
          <span>📶</span>
        </span>
      </div>

      {/* Header WhatsApp */}
      <div className="flex items-center gap-2 px-2 py-2 bg-[#1F2C33] border-b border-white/5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white/80">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
             style={{ background: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
          S
        </div>
        <div className="flex-1 min-w-0 leading-tight">
          <p className="font-semibold truncate">Sora</p>
          <p className="text-[8px] text-white/55">online</p>
        </div>
        <div className="flex items-center gap-2 text-white/70 text-[10px]">
          <span>📹</span>
          <span>📞</span>
        </div>
      </div>

      {/* Mensagens — doodle bg */}
      <div className="flex-1 px-2 py-3 space-y-1.5 overflow-hidden relative"
           style={{
             backgroundColor: '#0B141A',
             backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Cg fill='%23FFFFFF08'%3E%3Cpath d='M10 20l5-5 5 5z'/%3E%3Ccircle cx='40' cy='15' r='4'/%3E%3Cpath d='M60 30l3 3-3 3-3-3z'/%3E%3Ccircle cx='15' cy='50' r='3'/%3E%3Cpath d='M50 60l4-4 4 4-4 4z'/%3E%3C/g%3E%3C/svg%3E")`,
           }}>

        {/* Mensagem enviada */}
        <div className="flex justify-end">
          <div className="relative max-w-[80%] px-2 py-1.5 rounded-lg rounded-tr-sm text-[9px] leading-snug shadow-sm"
               style={{ background: '#005C4B' }}>
            gastei 50 no mercado
            <div className="text-[7px] text-white/55 text-right mt-0.5 flex items-center justify-end gap-0.5">
              9:41
              <svg width="10" height="6" viewBox="0 0 12 8" fill="#53BDEB" className="ml-0.5"><path d="M0 4l3 3 5-6M5 4l3 3 4-7" stroke="#53BDEB" strokeWidth="1.2" fill="none" /></svg>
            </div>
          </div>
        </div>

        {/* Mensagem da Sora */}
        <div className="flex justify-start">
          <div className="relative max-w-[85%] px-2 py-1.5 rounded-lg rounded-tl-sm text-[9px] leading-snug shadow-sm"
               style={{ background: '#202C33' }}>
            Anotei! <span style={{ color: '#61ce70' }}>💸 R$ 50,00</span> em Mercado.
            <br />
            Você já gastou R$ 487 esse mês nessa categoria.
            <div className="text-[7px] text-white/45 text-right mt-0.5">9:41</div>
          </div>
        </div>

        {/* Mensagem enviada com áudio */}
        <div className="flex justify-end">
          <div className="max-w-[80%] px-2 py-1.5 rounded-lg rounded-tr-sm flex items-center gap-2"
               style={{ background: '#005C4B' }}>
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[7px]">▶</div>
            <div className="flex items-end gap-[1px] flex-1">
              {[3, 5, 7, 4, 6, 8, 5, 7, 4, 6, 3, 5, 7, 4, 6].map((h, i) => (
                <div key={i} className="w-[1.5px] rounded-full bg-white/70" style={{ height: `${h}px` }} />
              ))}
            </div>
            <span className="text-[7px] text-white/70">0:08</span>
          </div>
        </div>

        {/* Mensagem da Sora com card */}
        <div className="flex justify-start">
          <div className="max-w-[85%] px-2 py-1.5 rounded-lg rounded-tl-sm text-[9px] leading-snug"
               style={{ background: '#202C33' }}>
            <p className="mb-1">Saldo do mês:</p>
            <div className="rounded-md p-1.5 mt-0.5" style={{ background: 'rgba(97,206,112,0.15)', border: '1px solid rgba(97,206,112,0.3)' }}>
              <p className="text-[7px] uppercase tracking-wider text-white/55">Disponível</p>
              <p className="font-bold text-[12px]" style={{ color: '#61ce70' }}>R$ 3.450,00</p>
            </div>
            <div className="text-[7px] text-white/45 text-right mt-1">9:42</div>
          </div>
        </div>

        {/* Typing indicator */}
        <div className="flex justify-start">
          <div className="px-2 py-1.5 rounded-lg rounded-tl-sm flex items-center gap-1" style={{ background: '#202C33' }}>
            <span className="w-1 h-1 rounded-full bg-white/50 animate-bounce" />
            <span className="w-1 h-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-1.5 px-1.5 py-1.5 bg-[#1F2C33]">
        <div className="flex-1 flex items-center gap-1 px-2 py-1 bg-[#2A3942] rounded-full">
          <span className="text-white/40 text-[10px]">😊</span>
          <span className="text-[9px] text-white/40 flex-1">Mensagem</span>
          <span className="text-white/40 text-[10px]">📎</span>
          <span className="text-white/40 text-[10px]">📷</span>
        </div>
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[9px]"
             style={{ background: '#00A884' }}>
          🎤
        </div>
      </div>
    </div>
  );
}
