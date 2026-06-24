'use client';

// =====================================================================
// Baleia-mascote da Sora que reage ao mês financeiro do usuário.
// Perfil lateral (estilo 🐳): cabeça à esquerda, cauda em V atrás, esguicho
// em cima. Expressão muda pelo humor (economizou → radiante / gastou demais →
// preocupada). SVG inline, animações leves, respeita prefers-reduced-motion.
// =====================================================================

export type HumorBaleia = 'radiante' | 'feliz' | 'neutro' | 'preocupado' | 'triste';

// Decide o humor a partir das finanças do mês.
// Com receita lançada → taxa de economia (quanto sobrou do que entrou).
// Sem receita → quanto do dinheiro disponível no banco já foi gasto (fica
// triste ao passar do saldo). Assim reage mesmo pra quem só lança gastos.
export function humorPorFinancas(opts: {
  receitas: number; gastos: number; saldoBanco?: number;
}): HumorBaleia {
  const { receitas = 0, gastos = 0, saldoBanco = 0 } = opts;

  if (receitas > 0) {
    const taxa = (receitas - gastos) / receitas;
    if (taxa >= 0.25)  return 'radiante';
    if (taxa >= 0.10)  return 'feliz';
    if (taxa >= 0)     return 'neutro';
    if (taxa >= -0.15) return 'preocupado';
    return 'triste';
  }

  // disponível ≈ saldo atual do banco + o que já saiu (saldo antes de gastar).
  const disponivel = saldoBanco + gastos;
  if (disponivel > 0) {
    const usado = gastos / disponivel;
    if (usado <= 0.35) return 'radiante';
    if (usado <= 0.60) return 'feliz';
    if (usado <= 0.85) return 'neutro';
    if (usado <= 1.00) return 'preocupado';
    return 'triste';
  }
  if (saldoBanco < 0) return 'triste';
  return gastos > 0 ? 'neutro' : 'feliz';
}

const META: Record<HumorBaleia, { cor: string; legenda: string }> = {
  radiante:   { cor: '#16a34a', legenda: 'Economizando muito! 🎉' },
  feliz:      { cor: '#22c55e', legenda: 'No caminho certo 💚' },
  neutro:     { cor: '#0ea5e9', legenda: 'Mês equilibrado' },
  preocupado: { cor: '#f59e0b', legenda: 'Atenção aos gastos' },
  triste:     { cor: '#ef4444', legenda: 'Gastos altos esse mês' },
};

export default function BaleiaHumor({ estado, size = 108 }: { estado: HumorBaleia; size?: number }) {
  const { cor, legenda } = META[estado];
  const feliz = estado === 'radiante' || estado === 'feliz';

  return (
    <div className="flex flex-col items-center gap-1.5 select-none" role="img"
         aria-label={`Baleia da Sora: ${legenda}`}>
      <style>{CSS}</style>
      <div className="relative" style={{ width: size, height: size }}>
        <div className="absolute inset-0 rounded-full blur-2xl opacity-25"
             style={{ background: cor }} aria-hidden />
        <svg viewBox="0 0 140 120" width={size} height={size} className="relative bw-float" aria-hidden>
          <defs>
            <linearGradient id="bwBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#7cc4f2" />
              <stop offset="100%" stopColor="#4a92d4" />
            </linearGradient>
          </defs>

          {/* esguicho (humores bons) */}
          {feliz && (
            <g className="bw-spout">
              <circle cx="44" cy="26" r="3.4" fill={cor} />
              <circle cx="38" cy="19" r="2.4" fill={cor} opacity="0.85" />
              <circle cx="50" cy="19" r="2.4" fill={cor} opacity="0.85" />
              <circle cx="44" cy="12" r="2"   fill={cor} opacity="0.7" />
            </g>
          )}

          {/* cauda (flukes em V) */}
          <path d="M102,60 C117,50 126,46 137,40 C131,51 131,60 137,72 C127,65 117,67 104,74 Z"
                fill="#3f8ccb" />

          {/* corpo (cabeça à esquerda, afina pra cauda) */}
          <path d="M16,64 C14,43 38,34 64,37 C92,40 106,51 110,64 C106,81 86,90 60,90 C34,90 18,83 16,64 Z"
                fill="url(#bwBody)" />

          {/* barriga clara */}
          <path d="M22,74 C46,91 82,91 104,74 C96,86 64,92 44,88 C33,86 26,80 22,74 Z"
                fill="#eaf6ff" opacity="0.92" />

          {/* nadadeira peitoral */}
          <path d="M54,84 C58,95 70,95 78,90 C70,86 66,80 66,74 C60,77 56,80 54,84 Z"
                fill="#3f8ccb" />

          {/* linha da boca (mandíbula) + rosto por humor */}
          {Rosto(estado)}
        </svg>
      </div>

      <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ color: cor, background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        {legenda}
      </span>
    </div>
  );
}

// Olho (cabeça, à esquerda ~x44) + boca/mandíbula + extras por humor.
function Rosto(estado: HumorBaleia) {
  const INK = '#16324a';
  const olhoFeliz  = <path d="M38,58 q6,-8 12,0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />;
  const olhoNormal = (
    <g>
      <circle cx="44" cy="59" r="5" fill={INK} className="bw-blink" />
      <circle cx="45.6" cy="57" r="1.6" fill="#fff" />
    </g>
  );
  const sobrancelha = <path d="M37,50 q7,-3 14,0" stroke={INK} strokeWidth="2.6" fill="none" strokeLinecap="round" />;

  switch (estado) {
    case 'radiante':
      return (
        <g>
          {olhoFeliz}
          <circle cx="32" cy="70" r="5" fill="#ff8fab" opacity="0.5" />
          {/* sorrisão aberto na mandíbula */}
          <path d="M26,72 q16,16 34,2 q-17,8 -34,-2 Z" fill={INK} />
          <path d="M33,77 q9,6 18,1 Z" fill="#ff6b81" />
        </g>
      );
    case 'feliz':
      return (
        <g>
          {olhoFeliz}
          <path d="M28,72 q15,12 30,1" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'neutro':
      return (
        <g>
          {olhoNormal}
          <path d="M30,75 q14,4 26,0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'preocupado':
      return (
        <g>
          {sobrancelha}
          {olhoNormal}
          <path d="M30,77 q13,-7 26,0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* gota de suor */}
          <path className="bw-sweat" d="M58,50 q3,5 0,8 q-3,-3 0,-8 Z" fill="#7cc4f2" />
        </g>
      );
    case 'triste':
      return (
        <g>
          {sobrancelha}
          {olhoNormal}
          {/* lágrima */}
          <path className="bw-sweat" d="M44,66 q2.6,5 0,8 q-2.6,-3 0,-8 Z" fill="#7cc4f2" />
          <path d="M28,80 q15,-13 30,0" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
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
