'use client';

/**
 * Conteúdo do iPhone 2 — preview do painel Sora (versão mobile do dashboard).
 * Mostra: saldo, métricas, hábitos, gastos por categoria.
 */
export default function HeroPhoneSora() {
  const BRAND = '#61ce70';

  return (
    <div className="relative w-full h-full bg-gradient-to-br from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900 flex flex-col"
         style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* Status bar */}
      <div className="flex items-center justify-between px-5 pt-2 pb-1 text-[8px] font-semibold text-zinc-950 dark:text-white">
        <span>9:41</span>
        <span>●●●  📶  100%</span>
      </div>

      {/* Header app */}
      <div className="px-3 pt-2 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[8px] text-zinc-500 dark:text-white/50 uppercase tracking-wider font-bold">Bom dia,</p>
          <p className="text-[11px] font-bold text-zinc-950 dark:text-white">Lenon</p>
        </div>
        <div className="w-6 h-6 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
             style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
          L
        </div>
      </div>

      <div className="flex-1 px-3 space-y-2 overflow-hidden">

        {/* Card saldo (hero card) */}
        <div className="relative rounded-xl p-3 overflow-hidden text-white"
             style={{ background: 'linear-gradient(135deg, #1a1a1e 0%, #0a0a0c 100%)' }}>
          {/* Glow */}
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-30"
               style={{ background: `radial-gradient(circle, ${BRAND}, transparent 70%)` }} />
          <p className="text-[8px] uppercase tracking-wider opacity-60 font-bold mb-1">Saldo disponível</p>
          <p className="text-[18px] font-bold tabular-nums leading-none">R$ 3.450,00</p>
          <div className="flex items-center justify-between mt-2 text-[8px]">
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(97,206,112,0.2)', color: BRAND }}>
              ↑ 12.4%
            </span>
            <span className="opacity-50">vs mês anterior</span>
          </div>

          {/* Mini sparkline */}
          <svg viewBox="0 0 100 18" preserveAspectRatio="none" className="w-full h-4 mt-1">
            <path d="M0,12 L10,10 L20,11 L30,8 L40,9 L50,6 L60,7 L70,4 L80,5 L90,2 L100,3"
                  fill="none" stroke={BRAND} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* 2 KPI cards */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-lg p-2 bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06]">
            <p className="text-[7px] uppercase tracking-wider text-zinc-500 dark:text-white/50 font-bold">Hábitos</p>
            <p className="text-[12px] font-bold text-zinc-950 dark:text-white tabular-nums mt-0.5">12<span className="text-[8px] text-zinc-400">/15</span></p>
            <div className="mt-1 h-1 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: '80%', background: BRAND }} />
            </div>
          </div>
          <div className="rounded-lg p-2 bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06]">
            <p className="text-[7px] uppercase tracking-wider text-zinc-500 dark:text-white/50 font-bold">Meta viagem</p>
            <p className="text-[12px] font-bold text-zinc-950 dark:text-white tabular-nums mt-0.5">67<span className="text-[8px] text-zinc-400">%</span></p>
            <div className="mt-1 h-1 bg-zinc-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: '67%', background: BRAND }} />
            </div>
          </div>
        </div>

        {/* Lista de transações */}
        <div className="rounded-lg p-2 bg-white dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06]">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[8px] uppercase tracking-wider text-zinc-500 dark:text-white/50 font-bold">Últimas</p>
            <span className="text-[7px] text-zinc-400">ver tudo →</span>
          </div>
          <div className="space-y-1.5">
            <Transacao emoji="🛒" titulo="Mercado Extra" valor="-R$ 87,50" />
            <Transacao emoji="🏃" titulo="Corrida (hábito)" valor="+1 streak" verde />
            <Transacao emoji="💊" titulo="Losartana 8h" valor="✓ tomado" verde />
            <Transacao emoji="📚" titulo="Estudo cálculo" valor="2h" />
          </div>
        </div>

        {/* Bottom tab bar fake */}
        <div className="mt-auto" />
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-around py-2 border-t border-zinc-200 dark:border-white/[0.06]">
        {['🏠', '💸', '🎯', '👤'].map((emoji, i) => (
          <div key={i} className={`text-[12px] ${i === 0 ? '' : 'opacity-40'}`}>{emoji}</div>
        ))}
      </div>

      {/* Home indicator iOS */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-[30%] h-0.5 rounded-full bg-zinc-950 dark:bg-white/40" />
    </div>
  );
}

function Transacao({ emoji, titulo, valor, verde }: { emoji: string; titulo: string; valor: string; verde?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px]">{emoji}</span>
      <p className="text-[8px] flex-1 text-zinc-700 dark:text-white/80 truncate">{titulo}</p>
      <p className={`text-[8px] font-bold tabular-nums ${verde ? '' : 'text-zinc-950 dark:text-white'}`}
         style={verde ? { color: '#61ce70' } : {}}>
        {valor}
      </p>
    </div>
  );
}
