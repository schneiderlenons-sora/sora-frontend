'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Sora Negócios — a seção que faltava na landing.
//
// O painel de Negócios (loja física/digital, caixa, DRE, estoque, equipe
// multiusuário) não aparecia em forsora.com — feature paga, invisível. Esta
// seção conta a história em uma imagem: a frase no WhatsApp VIRA número no DRE.
//
// ⚠️ MOCKUP 100% EM CÓDIGO, zero imagem: nenhum peso de download, nítido em
// qualquer tela, e o mesmo conteúdo em PT/ES pelo catálogo. A animação é
// ONE-SHOT quando a seção entra na viewport (não loop): bolhas entram
// escalonadas, os números do DRE sobem uma vez e a barra de margem cresce por
// `transform` (nunca width). Respeita `prefers-reduced-motion` — aí tudo já
// nasce no estado final, sem movimento.
//
// Abaixo da dobra, então não concorre com o LCP; só JS é um IntersectionObserver
// e um rAF curto de contagem. Light/dark adaptativo como as outras seções.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Store, FileBarChart, Users, Boxes, Check, ArrowUpRight, ArrowDownRight, Equal } from 'lucide-react';

const BRAND = '#61ce70';

// Valores do DRE mockado (em reais). A margem é o que a barra desenha.
const DRE = { receita: 24800, cmv: 9100, lucro: 15700, margem: 63 };
const brl = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR');

export default function NegociosShowcase() {
  const t = useTranslations('negocios');
  const ref = useRef<HTMLDivElement>(null);
  const [ativo, setAtivo] = useState(false);
  const [val, setVal] = useState({ receita: 0, cmv: 0, lucro: 0 });

  // Dispara UMA vez quando a seção se aproxima. Reduced-motion → estado final na hora.
  useEffect(() => {
    const reduz = typeof matchMedia !== 'undefined'
      && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduz) { setAtivo(true); setVal({ receita: DRE.receita, cmv: DRE.cmv, lucro: DRE.lucro }); return; }

    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setAtivo(true); setVal({ receita: DRE.receita, cmv: DRE.cmv, lucro: DRE.lucro }); return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      setAtivo(true);
      // Contagem curta (~750ms), ease-out, um único rAF. Barato e termina rápido.
      const t0 = performance.now(), dur = 750;
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / dur);
        const e2 = 1 - Math.pow(1 - p, 3);
        setVal({ receita: DRE.receita * e2, cmv: DRE.cmv * e2, lucro: DRE.lucro * e2 });
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { rootMargin: '0px 0px -15% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const beneficios = [
    { Icon: Store,        t: t('b1t'), d: t('b1d') },
    { Icon: FileBarChart, t: t('b2t'), d: t('b2d') },
    { Icon: Users,        t: t('b3t'), d: t('b3d') },
    { Icon: Boxes,        t: t('b4t'), d: t('b4d') },
  ];

  // Transição base das peças que entram (bolhas, chips, benefícios). ⚠️ O
  // DELAY vai por STYLE inline, não em classe: Tailwind não gera utilitário de
  // valor dinâmico em runtime, então `[transition-delay:${n}ms]` não existiria.
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

        {/* Conteúdo: mockup + benefícios. No mobile o mockup vem primeiro (a
            prova visual), depois a leitura. */}
        <div className="mt-14 lg:mt-20 grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">

          {/* ── MOCKUP (device escuro em qualquer tema) ── */}
          <div ref={ref} className="order-1 lg:order-2" role="img" aria-label={t('mockupAlt')}>
            <div className="relative mx-auto max-w-[400px] rounded-[26px] p-3 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.55)]
                            bg-zinc-900 ring-1 ring-white/10 dark:ring-white/10">
              {/* barra do topo */}
              <div className="flex items-center gap-2 px-2 pb-3 pt-1">
                <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: `${BRAND}22` }}>
                  <Store size={14} style={{ color: BRAND }} />
                </span>
                <span className="text-[12px] font-semibold text-white/90">{t('mockHeader')}</span>
                <span className="ml-auto text-[10px] font-medium text-white/40">{t('mockEmpresas')}</span>
              </div>

              {/* conversa no WhatsApp */}
              <div className="rounded-2xl bg-zinc-950/60 p-3 space-y-2">
                <div className={`ml-auto max-w-[80%] rounded-2xl rounded-br-md px-3 py-2 text-[12.5px] leading-snug text-white ${entra()}`}
                     style={{ background: 'linear-gradient(135deg, #2f6b39, #245230)', ...atraso(80) }}>
                  {t('msgUser')}
                </div>
                <div className={`mr-auto max-w-[88%] rounded-2xl rounded-bl-md px-3 py-2 bg-white/[0.06] ring-1 ring-white/10 ${entra()}`}
                     style={atraso(360)}>
                  <p className="text-[12.5px] font-semibold text-white flex items-center gap-1.5">
                    <Check size={13} style={{ color: BRAND }} /> {t('msgSora')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/55">{t('msgSoraSub')}</p>
                </div>
              </div>

              {/* DRE mini — os números SOBEM e a barra cresce */}
              <div className="mt-2.5 rounded-2xl bg-zinc-950/60 p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/45">{t('dreLabel')}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${BRAND}1f`, color: BRAND }}>
                    {t('aoVivo')}
                  </span>
                </div>

                <LinhaDre Icon={ArrowUpRight} cor="#34d399" rotulo={t('receita')} valor={brl(val.receita)} delay={420} ativo={ativo} />
                <LinhaDre Icon={ArrowDownRight} cor="#f87171" rotulo={t('cmv')} valor={'− ' + brl(val.cmv)} delay={520} ativo={ativo} />
                <div className="my-2 h-px bg-white/10" />
                <LinhaDre Icon={Equal} cor={BRAND} rotulo={t('lucro')} valor={brl(val.lucro)} forte delay={620} ativo={ativo} />

                {/* barra de margem — cresce por scaleX (transform, não width) */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-white/45 mb-1">
                    <span>{t('margem')}</span>
                    <span className="tabular-nums font-semibold" style={{ color: BRAND }}>{DRE.margem}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full origin-left transition-transform duration-[900ms] ease-out [transition-delay:700ms]"
                         style={{ background: `linear-gradient(90deg, ${BRAND}, #34d399)`,
                                  transform: `scaleX(${ativo ? DRE.margem / 100 : 0})` }} />
                  </div>
                </div>
              </div>

              {/* chips das capacidades */}
              <div className="mt-2.5 flex flex-wrap gap-1.5 px-1 pb-1">
                {[t('chipCaixa'), t('chipEstoque'), t('chipEquipe'), t('chipDre')].map((c, i) => (
                  <span key={c} style={atraso(760 + i * 60)}
                        className={`text-[10.5px] font-medium px-2.5 py-1 rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/10 ${entra()}`}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── BENEFÍCIOS ── */}
          <ul className="order-2 lg:order-1 space-y-5 lg:space-y-7">
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

function LinhaDre({ Icon, cor, rotulo, valor, valor2, forte, delay, ativo }:
  { Icon: any; cor: string; rotulo: string; valor: string; valor2?: string; forte?: boolean; delay: number; ativo: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 py-1 transition-all duration-500 ease-out ${ativo ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`}
         style={{ transitionDelay: `${delay}ms` }}>
      <Icon size={14} style={{ color: cor }} className="shrink-0" />
      <span className={`text-[12.5px] ${forte ? 'font-bold text-white' : 'text-white/70'}`}>{rotulo}</span>
      <span className={`ml-auto tabular-nums ${forte ? 'text-[15px] font-bold' : 'text-[13px] font-semibold text-white/85'}`}
            style={forte ? { color: cor } : undefined}>
        {valor2 || valor}
      </span>
    </div>
  );
}
