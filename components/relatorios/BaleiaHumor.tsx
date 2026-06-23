'use client';

// =====================================================================
// Baleia-mascote da Sora que reage ao mês financeiro do usuário.
// Expressão muda conforme o humor (economizou → radiante / gastou demais →
// preocupada). SVG inline (sem assets), animações leves e respeitando
// prefers-reduced-motion. Acessível via aria-label com o humor.
// =====================================================================

export type HumorBaleia = 'radiante' | 'feliz' | 'neutro' | 'preocupado' | 'triste';

// Decide o humor a partir das finanças do mês.
// Com meta: ritmo de gasto vs meta (proporcional ao dia do mês).
// Sem meta: taxa de economia (saldo / receitas).
export function humorPorFinancas(opts: {
  receitas: number; gastos: number; meta?: number; diaDoMes?: number; diasNoMes?: number;
}): HumorBaleia {
  const { receitas = 0, gastos = 0, meta = 0, diaDoMes = 31, diasNoMes = 31 } = opts;

  if (meta && meta > 0) {
    const usoMeta = gastos / meta;
    if (usoMeta > 1) return 'triste';                 // estourou a meta
    const pace = diasNoMes ? Math.min(1, diaDoMes / diasNoMes) : 1;
    const esperado = meta * pace || meta;
    const ritmo = gastos / esperado;                  // >1 = gastando rápido demais
    if (ritmo > 1.25) return 'preocupado';
    if (ritmo < 0.7)  return 'radiante';
    if (ritmo < 0.95) return 'feliz';
    return 'neutro';
  }

  if (receitas > 0) {
    const taxa = (receitas - gastos) / receitas;      // taxa de economia
    if (taxa >= 0.25)  return 'radiante';
    if (taxa >= 0.10)  return 'feliz';
    if (taxa >= 0)     return 'neutro';
    if (taxa >= -0.15) return 'preocupado';
    return 'triste';
  }

  return 'neutro';
}

const META: Record<HumorBaleia, { cor: string; legenda: string }> = {
  radiante:   { cor: '#16a34a', legenda: 'Economizando muito! 🎉' },
  feliz:      { cor: '#22c55e', legenda: 'No caminho certo 💚' },
  neutro:     { cor: '#0ea5e9', legenda: 'Mês equilibrado' },
  preocupado: { cor: '#f59e0b', legenda: 'Atenção aos gastos' },
  triste:     { cor: '#ef4444', legenda: 'Gastos altos esse mês' },
};

export default function BaleiaHumor({ estado, size = 104 }: { estado: HumorBaleia; size?: number }) {
  const { cor, legenda } = META[estado];
  const feliz = estado === 'radiante' || estado === 'feliz';

  return (
    <div className="flex flex-col items-center gap-1.5 select-none" role="img"
         aria-label={`Baleia da Sora: ${legenda}`}>
      <style>{CSS}</style>
      <div className="relative" style={{ width: size, height: size }}>
        {/* halo de humor */}
        <div className="absolute inset-0 rounded-full blur-2xl opacity-30"
             style={{ background: cor }} aria-hidden />
        <svg viewBox="0 0 120 124" width={size} height={size} className="relative bw-float" aria-hidden>
          <defs>
            <linearGradient id="bwBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7cc4f2" />
              <stop offset="100%" stopColor="#4a96d6" />
            </linearGradient>
          </defs>

          {/* esguicho (só nos humores bons) */}
          {feliz && (
            <g className="bw-spout">
              <circle cx="60" cy="14" r="3.2" fill={cor} />
              <circle cx="54" cy="9"  r="2.2" fill={cor} opacity="0.8" />
              <circle cx="66" cy="9"  r="2.2" fill={cor} opacity="0.8" />
              <circle cx="60" cy="4"  r="1.8" fill={cor} opacity="0.7" />
            </g>
          )}

          {/* cauda */}
          <path d="M96,96 q14,-6 20,4 q-10,2 -10,8 q-8,-6 -10,-12 Z" fill="#4a96d6" />
          {/* corpo */}
          <ellipse cx="58" cy="68" rx="46" ry="40" fill="url(#bwBody)" />
          {/* barriga */}
          <path d="M22,76 q36,30 72,0 q-4,26 -36,26 q-32,0 -36,-26 Z" fill="#eaf6ff" opacity="0.9" />
          {/* nadadeira */}
          <path d="M40,96 q6,14 20,12 q-8,-10 -7,-18 Z" fill="#3f8ccb" />

          {/* rosto por humor */}
          {Rosto(estado, cor)}
        </svg>
      </div>

      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ color: cor, background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        {legenda}
      </span>
    </div>
  );
}

// Olhos + boca + extras conforme o humor.
function Rosto(estado: HumorBaleia, cor: string) {
  const olhoFeliz = (cx: number) => (
    <path d={`M${cx - 6},62 q6,-8 12,0`} stroke="#16324a" strokeWidth="3" fill="none" strokeLinecap="round" />
  );
  const olhoNormal = (cx: number) => (
    <g>
      <circle cx={cx} cy={61} r="5" fill="#16324a" className="bw-blink" />
      <circle cx={cx + 1.6} cy={59} r="1.6" fill="#fff" />
    </g>
  );
  const sobrancelha = (cx: number, dir: 1 | -1) => (
    <path d={`M${cx - 6},${52} q6,${dir * -3} 12,0`} stroke="#16324a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  );

  switch (estado) {
    case 'radiante':
      return (
        <g>
          {olhoFeliz(40)}{olhoFeliz(70)}
          {/* bochechas */}
          <circle cx="34" cy="72" r="5" fill="#ff8fab" opacity="0.55" />
          <circle cx="80" cy="72" r="5" fill="#ff8fab" opacity="0.55" />
          {/* sorrisão aberto */}
          <path d="M44,76 q11,16 22,0 q-11,7 -22,0 Z" fill="#16324a" />
          <path d="M48,80 q7,6 14,0 Z" fill="#ff6b81" />
        </g>
      );
    case 'feliz':
      return (
        <g>
          {olhoFeliz(40)}{olhoFeliz(70)}
          <path d="M46,77 q11,11 20,0" stroke="#16324a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'neutro':
      return (
        <g>
          {olhoNormal(40)}{olhoNormal(70)}
          <path d="M48,80 h16" stroke="#16324a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'preocupado':
      return (
        <g>
          {sobrancelha(38, 1)}{sobrancelha(68, 1)}
          {olhoNormal(40)}{olhoNormal(70)}
          {/* boca preocupada */}
          <path d="M48,82 q8,-8 16,0" stroke="#16324a" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* gota de suor */}
          <path className="bw-sweat" d="M86,54 q3,5 0,8 q-3,-3 0,-8 Z" fill="#7cc4f2" />
        </g>
      );
    case 'triste':
      return (
        <g>
          {sobrancelha(38, 1)}{sobrancelha(68, 1)}
          {olhoNormal(40)}{olhoNormal(70)}
          {/* lágrima */}
          <path className="bw-sweat" d="M40,68 q2.6,5 0,8 q-2.6,-3 0,-8 Z" fill="#7cc4f2" />
          {/* boca triste */}
          <path d="M46,84 q12,-12 24,0" stroke="#16324a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
  }
}

const CSS = `
@keyframes bw-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
@keyframes bw-blink { 0%,92%,100% { transform: scaleY(1) } 96% { transform: scaleY(0.1) } }
@keyframes bw-spout { 0% { opacity:0; transform: translateY(6px) scale(.6) } 30% { opacity:1 } 100% { opacity:0; transform: translateY(-8px) scale(1) } }
@keyframes bw-sweat { 0% { opacity:0; transform: translateY(-2px) } 30% { opacity:1 } 100% { opacity:0; transform: translateY(8px) } }
.bw-float { animation: bw-float 3.4s ease-in-out infinite; transform-origin: center; }
.bw-blink { animation: bw-blink 4.2s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
.bw-spout { animation: bw-spout 2.6s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
.bw-sweat { animation: bw-sweat 2.8s ease-in-out infinite; transform-origin: center; transform-box: fill-box; }
@media (prefers-reduced-motion: reduce) {
  .bw-float, .bw-blink, .bw-spout, .bw-sweat { animation: none !important; }
}
`;
