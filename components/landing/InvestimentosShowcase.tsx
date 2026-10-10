'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Sora Investimentos — a carteira que se atualiza sozinha.
//
// A aba de Investimentos (cotação da B3 pela brapi, cripto pelo Mercado Bitcoin,
// reserva de emergência, patrimônio somado) não aparecia em forsora.com. Esta
// seção mostra o produto numa imagem: a carteira com o patrimônio subindo, as
// posições com a variação do dia e a reserva de emergência protegida.
//
// ⚠️ MESMO CONTRATO do NegociosShowcase: mockup 100% em código (zero imagem),
// animação ONE-SHOT quando entra na viewport (não loop), só transform/opacity +
// um rAF curto de contagem. A sparkline desenha por stroke-dashoffset e a barra
// da reserva cresce por scaleX (nunca width). `prefers-reduced-motion` → tudo já
// nasce no estado final. Abaixo da dobra, não concorre com o LCP. Light/dark
// adaptativo como as outras seções.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw, Shield, LineChart, Layers, Wallet, ArrowUpRight } from 'lucide-react';

const BRAND = '#61ce70';

// Posições mockadas (em reais). A soma é o patrimônio que o número conta.
const POSICOES = [
  { nome: 'PETR4',        tipoKey: 'tAcoes',  cor: '#34d399', valor: 12400, varia: '+1,8%', sobe: true },
  { nome: 'MXRF11',       tipoKey: 'tFiis',   cor: '#38bdf8', valor: 9800,  varia: '+0,4%', sobe: true },
  { nome: 'Bitcoin',      tipoKey: 'tCripto', cor: '#f59e0b', valor: 6300,  varia: '−2,1%', sobe: false },
  { nome: 'CDB 110% CDI', tipoKey: 'tRenda',  cor: '#a78bfa', valor: 19750, varia: '+0,9%', sobe: true },
];
const TOTAL = POSICOES.reduce((s, p) => s + p.valor, 0); // 48.250
const RESERVA_MESES = 6;        // "6 meses protegidos"
const RESERVA_FRAC  = 6 / 8;    // sobre a meta de 8 meses → barra em 75%
const brl = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');

// Caminho da sparkline (viewBox 100×32). Subida com um respiro no meio.
const SPARK = 'M0 26 L14 22 L28 24 L42 15 L56 18 L70 10 L84 12 L100 3';
const SPARK_LEN = 150; // comprimento aproximado p/ o traço desenhar

export default function InvestimentosShowcase() {
  const t = useTranslations('investimentos');
  const ref = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(false);
  const [total, setTotal] = useState(0);

  // Dispara UMA vez quando a seção se aproxima. Reduced-motion → estado final na hora.
  useEffect(() => {
    const reduz = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduz) { setAtivo(true); setTotal(TOTAL); return; }

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setAtivo(true); setTotal(TOTAL); return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setAtivo(true);
      const t0 = performance.now(), dur = 850;
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e2 = 1 - Math.pow(1 - p, 3);
        setTotal(TOTAL * e2);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { rootMargin: '0px 0px -15% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const beneficios = [
    { Icon: RefreshCw, t: t('b1t'), d: t('b1d') },
    { Icon: Shield,    t: t('b2t'), d: t('b2d') },
    { Icon: LineChart, t: t('b3t'), d: t('b3d') },
    { Icon: Layers,    t: t('b4t'), d: t('b4d') },
  ];

  // ⚠. DELAY por STYLE inline: Tailwind não gera utilitário de valor dinâmico.
  const entra = () =>
    `transition-all duration-500 ease-out ${ativo ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`;
  const atraso = (ms: number) => ({ transitionDelay: `${ms}ms` });

  return (
    <section className="relative py-24 lg:py-32 border-t border-zinc-200/50 dark:border-white/[0.04]">
      {/* glow da marca, igual às outras seções */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[900px] h-[600px] max-w-full opacity-20 dark:opacity-15"
          style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
        {/* Cabeçalho */}
        <div className="text-center max-w-3xl mx-auto">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            {t('eyebrow')}
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] tracking-[-0.03em] text-zinc-900 dark:text-white">
            {t('titulo')}
          </h2>
          <p className="mt-5 text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
            {t('desc')}
          </p>
        </div>

        {/* Conteúdo: mockup + benefícios. No mobile o mockup vem primeiro. */}
        <div className="mt-14 lg:mt-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">

          {/* ── MOCKUP (device escuro em qualquer tema) ── */}
          <div ref={ref} className="order-1" role="img" aria-label={t('mockupAlt')}>
            <div className="relative mx-auto max-w-[400px] rounded-[26px] p-3 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.55)]
                            bg-zinc-900 ring-1 ring-white/10">
              {/* barra do topo */}
              <div className="flex items-center gap-2 px-2 pb-3 pt-1">
                <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: `${BRAND}22` }}>
                  <Wallet size={14} style={{ color: BRAND }} />
                </span>
                <span className="text-[12px] font-semibold text-white/90">{t('mockHeader')}</span>
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium text-white/40">
                  <RefreshCw size={10} /> {t('atualizado')}
                </span>
              </div>

              {/* patrimônio — o número SOBE e a sparkline desenha */}
              <div className="rounded-2xl bg-zinc-950/60 p-3.5">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{t('patrimonio')}</p>
                    <p className="mt-0.5 text-[26px] leading-none font-bold text-white tabular-nums">{brl(total)}</p>
                  </div>
                  <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-1 rounded-full ${entra()}`}
                        style={{ background: `${BRAND}1f`, color: BRAND, ...atraso(500) }}>
                    <ArrowUpRight size={12} /> +3,2%
                  </span>
                </div>
                {/* sparkline */}
                <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="mt-2.5 w-full h-9">
                  <path d={SPARK} fill="none" stroke={BRAND} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                        strokeDasharray={SPARK_LEN}
                        strokeDashoffset={ativo ? 0 : SPARK_LEN}
                        style={{ transition: 'stroke-dashoffset 1100ms ease-out 250ms' }} />
                </svg>
              </div>

              {/* posições — entram escalonadas */}
              <div className="mt-2.5 rounded-2xl bg-zinc-950/60 p-2 space-y-0.5">
                {POSICOES.map((p, i) => (
                  <div key={p.nome}
                       className={`flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl transition-all duration-500 ease-out ${ativo ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}
                       style={{ transitionDelay: `${360 + i * 90}ms` }}>
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.cor }} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-white leading-tight truncate">{p.nome}</p>
                      <p className="text-[10px] text-white/45 leading-tight">{t(p.tipoKey)}</p>
                    </div>
                    <span className="ml-auto text-[12.5px] font-semibold text-white/90 tabular-nums">{brl(p.valor)}</span>
                    <span className="w-12 text-right text-[11px] font-bold tabular-nums shrink-0"
                          style={{ color: p.sobe ? BRAND : '#f87171' }}>
                      {p.varia}
                    </span>
                  </div>
                ))}
              </div>

              {/* reserva de emergência — a barra cresce por scaleX */}
              <div className="mt-2.5 rounded-2xl bg-zinc-950/60 p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/70">
                    <Shield size={12} style={{ color: BRAND }} /> {t('reserva')}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: BRAND }}>
                    {t('reservaMeses', { n: RESERVA_MESES })}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full origin-left transition-transform duration-[900ms] ease-out [transition-delay:700ms]"
                       style={{ background: `linear-gradient(90deg, ${BRAND}, #34d399)`,
                                transform: `scaleX(${ativo ? RESERVA_FRAC : 0})` }} />
                </div>
              </div>

              {/* chips das classes */}
              <div className="mt-2.5 flex flex-wrap gap-1.5 px-1 pb-1">
                {[t('tAcoes'), t('tFiis'), t('tCripto'), t('chipTesouro'), t('chipReserva')].map((c, i) => (
                  <span key={c} style={atraso(780 + i * 60)}
                        className={`text-[10.5px] font-medium px-2.5 py-1 rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/10 ${entra()}`}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── BENEFÍCIOS ── */}
          <ul className="order-2 space-y-5 lg:space-y-7">
            {beneficios.map(({ Icon, t: titulo, d }, i) => (
              <li key={titulo} style={atraso(120 + i * 90)} className={`flex gap-4 ${entra()}`}>
                <span className="shrink-0 w-11 h-11 rounded-2xl grid place-items-center ring-1 ring-zinc-200 dark:ring-white/10"
                      style={{ background: `${BRAND}1a` }}>
                  <Icon size={19} style={{ color: BRAND }} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-bold text-zinc-900 dark:text-white leading-snug">{titulo}</h3>
                  <p className="mt-1 text-[13.5px] text-zinc-600 dark:text-white/55 leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
