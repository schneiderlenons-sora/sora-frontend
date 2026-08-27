'use client';

// ═════════════════════════════════════════════════════════════════════════
// "Controle absoluto sobre seus cartões" — 3 cards com mini-mockups do painel.
//
// ⚠️ O AJUSTE DE TEMA CLARO É O TRABALHO DESTE ARQUIVO. Na /kit os mockups
// eram desenhados só com branco translúcido (`bg-white/[0.02]`,
// `border-white/[0.07]`, `text-white/55`) porque lá o fundo é preto fixo. No
// tema claro da forsora.com isso vira branco sobre branco: card invisível,
// borda invisível, texto ilegível.
//
// A correção NÃO é trocar branco por preto translúcido. `bg-black/[0.02]` num
// fundo claro dá um cinza sujo, e a "tela do app" dentro do card — que no
// escuro é um retângulo #0d0d0d que lê como monitor — sumiria por completo.
// Cada superfície ganhou par próprio:
//
//   card externo   → branco sólido + borda cinza (claro) · branco 2% (escuro)
//   "tela" interna → cinza-50 + borda (claro)            · #0d0d0d (escuro)
//   texto/traços   → zinc-900/600/400 (claro)            · white/85/55/30
//
// Assim a metáfora do card (moldura + tela do app dentro) sobrevive nos dois.
// ═════════════════════════════════════════════════════════════════════════

import { Check, ChevronDown, Sparkles } from 'lucide-react';

const BRAND = '#61ce70';

// Tokens repetidos nos 3 mockups — um lugar só pra ajustar o par claro/escuro.
const LINHA   = 'rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.03]';
const LINHA_2 = 'rounded-lg border border-zinc-200/70 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02]';
const FRACO   = 'text-zinc-500 dark:text-white/55';
const TENUE   = 'text-zinc-400 dark:text-white/30';

const FluxoMock = (
  <div>
    <div className="flex items-start justify-between mb-3 gap-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-white/40">Fluxo de caixa</p>
        <p className="text-xl font-bold text-zinc-900 dark:text-white mt-1 tabular-nums">
          <span style={{ color: BRAND }}>R$</span> 4.250,00
        </p>
      </div>
      <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] text-[10px] flex-shrink-0">
        <span className={`px-2 py-1 rounded-md ${FRACO}`}>Realizado</span>
        <span className="px-2 py-1 rounded-md bg-zinc-900 dark:bg-white/10 text-white font-semibold">Projetado</span>
      </div>
    </div>
    <div className="flex gap-2">
      <div className={`flex flex-col justify-between text-[9px] ${TENUE} py-0.5`}>
        <span>R$ 5k</span><span>R$ 2k</span><span>R$ 0</span>
      </div>
      <div className="flex-1 min-w-0">
        <svg viewBox="0 0 300 90" className="w-full h-[86px]" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="fluxoCartoesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={BRAND} stopOpacity="0.35" />
              <stop offset="100%" stopColor={BRAND} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0,62 C30,55 45,66 70,60 C100,52 120,38 150,42 C185,47 205,22 235,28 C262,33 285,42 300,38 L300,90 L0,90 Z" fill="url(#fluxoCartoesGrad)" />
          <path d="M0,62 C30,55 45,66 70,60 C100,52 120,38 150,42 C185,47 205,22 235,28 C262,33 285,42 300,38" fill="none" stroke={BRAND} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className={`flex justify-between text-[9px] ${TENUE} mt-1`}>
          <span>01/mai</span><span>10/mai</span><span>20/mai</span><span>30/mai</span>
        </div>
      </div>
    </div>
  </div>
);

const CategoriaMock = (
  <div>
    <p className={`text-xs ${FRACO} mb-2`}>Categoria</p>
    <div className={`flex items-center justify-between ${LINHA} px-3 py-2.5 mb-2.5`}>
      {/* Traço que representa o campo preenchido — precisa ser visível nos dois
          fundos, então não pode ser branco nem preto translúcido. */}
      <span className="h-1.5 w-28 rounded-full bg-zinc-200 dark:bg-white/[0.12]" />
      <ChevronDown size={14} className="text-zinc-400 dark:text-white/40" />
    </div>
    <div className="space-y-1.5">
      <div className={`${LINHA_2} px-3 py-2 text-sm ${FRACO}`}>Lazer</div>
      <div className="rounded-lg border px-3 py-2 text-sm font-medium text-zinc-900 dark:text-white flex items-center gap-1.5"
           style={{ borderColor: BRAND, background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}>
        <Sparkles size={13} style={{ color: BRAND }} /> Vestuário
      </div>
      <div className={`${LINHA_2} px-3 py-2 text-sm ${FRACO}`}>Utilidades</div>
    </div>
  </div>
);

const TransacaoMock = (
  <div>
    <div className="flex items-center justify-between mb-3 gap-2">
      <p className="text-xs font-semibold text-zinc-700 dark:text-white/70">Transação Identificada</p>
      <p className="text-[10px] text-zinc-400 dark:text-white/40 flex-shrink-0">Hoje, 14:30</p>
    </div>
    <div className="flex gap-2 mb-2">
      <div className={`flex-1 min-w-0 ${LINHA} px-3 py-2 text-[12px] text-zinc-900 dark:text-white truncate`}>SEPHORA STORE (8/10)</div>
      <div className={`${LINHA} px-3 py-2 text-[12px] text-zinc-900 dark:text-white tabular-nums whitespace-nowrap`}>R$ 261,12</div>
    </div>
    <div className="flex gap-2 items-center">
      <div className={`flex-1 min-w-0 flex items-center justify-between gap-1 ${LINHA} px-3 py-2 text-[12px] text-zinc-600 dark:text-white/70`}>
        Vestuário <ChevronDown size={12} className="text-zinc-400 dark:text-white/40 flex-shrink-0" />
      </div>
      <div className={`flex-1 min-w-0 flex items-center justify-between gap-1 ${LINHA} px-3 py-2 text-[12px] text-zinc-600 dark:text-white/70`}>
        A Pagar <ChevronDown size={12} className="text-zinc-400 dark:text-white/40 flex-shrink-0" />
      </div>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>
        <Check size={16} className="text-black" strokeWidth={3} />
      </div>
    </div>
  </div>
);

const CARDS = [
  { titulo: 'Cobranças recorrentes',         desc: 'Saiba quanto você já comprometeu para os próximos meses e projete seu fluxo de caixa.',                       visual: FluxoMock },
  { titulo: 'Organização Automática por IA', desc: 'Seus gastos são categorizados sozinhos. O sistema aprende com seus hábitos e automatiza sua gestão financeira.', visual: CategoriaMock },
  { titulo: 'Identificação de Lançamentos',  desc: 'Tenha clareza total sobre a origem de cada transação em seu extrato.',                                          visual: TransacaoMock },
];

export default function ControleCartoes() {
  return (
    <section className="py-16 lg:py-20 px-5 border-t border-zinc-200/50 dark:border-white/5">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Controle absoluto sobre seus cartões.</h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600 dark:text-white/60 max-w-xl mx-auto leading-relaxed">
            Tenha clareza imediata sobre cada transação e antecipe o impacto financeiro dos próximos meses.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {CARDS.map((c, i) => (
            <div key={c.titulo}
                 className="rounded-3xl border border-zinc-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] p-4 sm:p-5 flex flex-col animate-fade-in
                            shadow-[0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-none"
                 style={{ animationDelay: `${i * 80}ms` }}>
              {/* A "tela do app" dentro do card. No escuro é um retângulo quase
                  preto que lê como monitor; no claro isso viraria um buraco —
                  então ali ela é cinza-50 com borda, que continua lendo como
                  superfície embutida sem furar o card. */}
              <div className="rounded-2xl border border-zinc-200/70 dark:border-white/[0.06] bg-zinc-50 dark:bg-[#0d0d0d] p-4 mb-5 min-h-[210px] flex flex-col justify-center">
                {c.visual}
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{c.titulo}</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-white/55 leading-relaxed flex-1">{c.desc}</p>
              {/* Traços de posição. O ativo é a cor da marca (igual nos dois
                  temas); o inativo precisa de par claro/escuro, senão o cinza
                  do escuro some no card branco. */}
              <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span key={d}
                        className={`h-1.5 rounded-full transition-all ${
                          d === i ? '' : 'bg-zinc-200 dark:bg-white/15'
                        }`}
                        style={{ width: d === i ? 18 : 6, background: d === i ? BRAND : undefined }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
