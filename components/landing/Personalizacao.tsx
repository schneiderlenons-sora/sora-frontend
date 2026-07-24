'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, ZoomIn, X, Palette } from 'lucide-react';
import Link from 'next/link';

// Seção "Personalizado por você" — mostra o MESMO painel em várias cores.
// Coloque os prints (1 por cor) em: public/landing/cores/<id>.png
// id/hex ficam aqui; o nome de cada cor vem do catálogo (personalizacao.cores).
const COR_STYLE = [
  { id: 'verde',    hex: '#61ce70' },
  { id: 'azul',     hex: '#3b82f6' },
  { id: 'roxo',     hex: '#7c3aed' },
  { id: 'rosa',     hex: '#ec4899' },
  { id: 'vermelho', hex: '#ef4444' },
  { id: 'laranja',  hex: '#f97316' },
  { id: 'black',    hex: '#18181b' },
];

export default function Personalizacao({ ctaHref = '#pricing' }: { ctaHref?: string } = {}) {
  const t = useTranslations('personalizacao');
  const nomes = t.raw('cores') as string[];
  const CORES = COR_STYLE.map((c, i) => ({ ...c, nome: nomes[i], img: `/landing/cores/${c.id}.png` }));
  const [idx, setIdx]   = useState(0);
  const [zoom, setZoom] = useState(false);
  const [imgError, setImgError] = useState<Set<string>>(new Set());
  const ativo = CORES[idx];
  const touchStartX = useRef<number | null>(null);

  const falhou    = (id: string) => imgError.has(id);
  const onImgError = (id: string) => setImgError((s) => new Set(s).add(id));

  const prev = () => setIdx((i) => (i === 0 ? CORES.length - 1 : i - 1));
  const next = () => setIdx((i) => (i === CORES.length - 1 ? 0 : i + 1));

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) prev();
    else if (dx < -50) next();
    touchStartX.current = null;
  }

  // Teclado: setas navegam, ESC fecha o zoom.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setZoom(false);
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Trava o scroll do body enquanto o zoom está aberto.
  useEffect(() => {
    if (!zoom) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [zoom]);

  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">

      {/* BG glow — tinge com a cor ativa */}
      <div aria-hidden className="absolute inset-0 pointer-events-none transition-colors duration-700">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[600px] opacity-25 dark:opacity-15 transition-all duration-700"
             style={{ background: `radial-gradient(ellipse, ${ativo.hex}40 0%, transparent 60%)` }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            <Palette size={13} style={{ color: ativo.hex }} className="transition-colors duration-500" /> {t('label')}
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            {t('tituloL1')}<br />
            <span className="text-transparent bg-clip-text transition-all duration-700"
                  style={{ backgroundImage: `linear-gradient(135deg, ${ativo.hex} 0%, ${ativo.hex}99 100%)` }}>
              {t('tituloL2')}
            </span>
          </h2>
          <p className="mt-5 text-base lg:text-lg text-zinc-600 dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
            {t.rich('subtitulo', { b: (c) => <span className="text-zinc-900 dark:text-white font-medium">{c}</span> })}
          </p>
        </div>

        {/* Display principal — janela de navegador + screenshot */}
        <div
          className="relative rounded-3xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-900 dark:bg-black overflow-hidden mb-6 transition-shadow duration-500 touch-pan-y"
          style={{ boxShadow: `0 30px 90px -30px ${ativo.hex}66` }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Browser chrome */}
          <div className="px-4 py-3 flex items-center gap-2 border-b border-zinc-800 dark:border-white/[0.06] bg-zinc-900 dark:bg-zinc-950">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <span className="w-3 h-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="ml-3 px-3 py-1 rounded-md bg-white/5 text-[11px] font-mono text-white/60 inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full transition-colors duration-500" style={{ background: ativo.hex }} />
              forsora.com<span className="text-white/30">/dashboard</span>
            </div>

            {/* Setas de navegação no chrome */}
            <div className="ml-auto flex items-center gap-1">
              <button onClick={prev} aria-label={t('corAnterior')}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                <ArrowLeft size={14} />
              </button>
              <button onClick={next} aria-label={t('proximaCor')}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Screenshot — clique pra ampliar */}
          <button
            onClick={() => setZoom(true)}
            aria-label={t('ampliarTema', { nome: ativo.nome })}
            className="group relative aspect-[1919/864] w-full overflow-hidden bg-zinc-950 block cursor-zoom-in"
          >
            {falhou(ativo.id) ? (
              <PlaceholderTema cor={ativo.hex} nome={ativo.nome} temaLabel={t('tema', { nome: ativo.nome })} emBreve={t('printEmBreve')} />
            ) : (
              <img
                key={ativo.id}
                src={ativo.img}
                alt={t('painelTema', { nome: ativo.nome })}
                onError={() => onImgError(ativo.id)}
                className="absolute inset-0 w-full h-full object-cover object-top animate-[fade-in_500ms_ease-out_both]"
                loading="lazy"
                draggable={false}
              />
            )}

            {/* Hint de zoom */}
            <span className="absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md bg-black/50 border border-white/15 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn size={13} /> {t('cliqueAmpliar')}
            </span>

            {/* Caption flutuante — só desktop */}
            <span className="hidden sm:flex absolute bottom-5 left-5 items-center gap-2 px-4 py-2.5 rounded-xl backdrop-blur-md bg-black/60 border border-white/10 text-white shadow-2xl">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: ativo.hex }} />
              <span className="font-bold text-sm">{t('tema', { nome: ativo.nome })}</span>
            </span>
          </button>
        </div>

        {/* Caption mobile */}
        <div className="sm:hidden mb-4 px-1 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: ativo.hex }} />
          <p className="font-bold text-base">{t('tema', { nome: ativo.nome })}</p>
        </div>

        {/* Seletor de cores — swatches */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          {CORES.map((c, i) => {
            const ativa = idx === i;
            return (
              <button
                key={c.id}
                onClick={() => setIdx(i)}
                aria-label={t('tema', { nome: c.nome })}
                aria-pressed={ativa}
                title={c.nome}
                className={`relative w-8 h-8 sm:w-11 sm:h-11 rounded-full transition-all duration-200 ${
                  ativa ? 'scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                }`}
                style={{
                  background: c.hex,
                  boxShadow: ativa ? `0 0 0 3px var(--swatch-ring), 0 6px 18px -4px ${c.hex}` : 'none',
                  // anel na cor de fundo da página pra "flutuar" o contorno
                  ['--swatch-ring' as any]: ativa ? c.hex : 'transparent',
                }}
              >
                {/* contorno externo pra separar do fundo */}
                <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15" />
              </button>
            );
          })}
        </div>

        {/* Contador */}
        <div className="flex items-center justify-center gap-2 mt-5 text-xs text-zinc-500 dark:text-white/40">
          <span className="font-mono">{String(idx + 1).padStart(2, '0')} / {String(CORES.length).padStart(2, '0')}</span>
          <span>·</span>
          <span className="font-semibold" style={{ color: ativo.hex }}>{ativo.nome}</span>
        </div>

        {/* Fechamento + CTA */}
        <div className="mt-20 lg:mt-28 text-center">
          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] leading-[1.05]">
            {t('fechamentoL1')}<br />
            <span className="text-transparent bg-clip-text transition-all duration-700"
                  style={{ backgroundImage: `linear-gradient(135deg, ${ativo.hex} 0%, ${ativo.hex}99 100%)` }}>
              {t('fechamentoL2')}
            </span>
          </h3>
          <p className="mt-4 text-base lg:text-lg text-zinc-600 dark:text-white/60 max-w-xl mx-auto leading-relaxed">
            {t('fechamentoSub')}
          </p>
          <Link href={ctaHref}
                className="inline-flex items-center gap-2 mt-7 px-5 py-3 text-sm font-bold text-white rounded-xl shadow-md hover:-translate-y-0.5 transition-all"
                style={{ background: `linear-gradient(135deg, ${ativo.hex} 0%, ${ativo.hex}cc 100%)` }}>
            {t('cta')}
          </Link>
        </div>
      </div>

      {/* ── LIGHTBOX (zoom) ── */}
      {zoom && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 animate-[fade-in_200ms_ease-out_both]"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={t('temaAmpliado', { nome: ativo.nome })}
        >
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" />

          {/* Fechar */}
          <button onClick={() => setZoom(false)} aria-label={t('fechar')}
                  className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors">
            <X size={20} />
          </button>

          {/* Setas */}
          <button onClick={(e) => { e.stopPropagation(); prev(); }} aria-label={t('corAnterior')}
                  className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors">
            <ArrowLeft size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); next(); }} aria-label={t('proximaCor')}
                  className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 text-white backdrop-blur transition-colors">
            <ArrowRight size={20} />
          </button>

          {/* Imagem ampliada */}
          <div className="relative max-w-6xl w-full" onClick={(e) => e.stopPropagation()}>
            {falhou(ativo.id) ? (
              <div className="w-full aspect-[1919/864] max-h-[85dvh] rounded-2xl overflow-hidden ring-1 ring-white/10">
                <PlaceholderTema cor={ativo.hex} nome={ativo.nome} />
              </div>
            ) : (
              <img
                key={ativo.id}
                src={ativo.img}
                alt={t('painelTema', { nome: ativo.nome })}
                onError={() => onImgError(ativo.id)}
                className="w-full h-auto max-h-[85dvh] object-contain rounded-2xl shadow-2xl ring-1 ring-white/10"
                draggable={false}
              />
            )}
            <div className="mt-3 flex items-center justify-center gap-2 text-white/80">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: ativo.hex }} />
              <span className="text-sm font-semibold">{t('tema', { nome: ativo.nome })}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// Placeholder exibido enquanto o print da cor ainda não foi adicionado
// (evita "imagem quebrada" no ar antes do upload dos arquivos).
function PlaceholderTema({ cor, temaLabel, emBreve }: { cor: string; nome: string; temaLabel: string; emBreve: string }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-6"
      style={{ background: `linear-gradient(135deg, ${cor}26 0%, ${cor}0a 60%, transparent 100%)` }}
    >
      <span className="w-10 h-10 rounded-full" style={{ background: cor }} />
      <p className="text-sm font-bold text-white/90">{temaLabel}</p>
      <p className="text-[11px] text-white/50">{emBreve}</p>
    </div>
  );
}
