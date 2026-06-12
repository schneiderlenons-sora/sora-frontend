'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft, ChevronRight, Share2, Loader2, Download, Check } from 'lucide-react';
import type { WrappedDeck } from '@/lib/wrapped/themes';
import { SlideView } from './slides';

const AUTO_MS = 6000;

export default function WrappedPlayer({ deck, voltarHref = '/dashboard', onClose }: { deck: WrappedDeck; voltarHref?: string; onClose?: () => void }) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const [share, setShare] = useState<'idle' | 'working' | 'done'>('idle');
  const cardRef = useRef<HTMLDivElement>(null);

  const n = deck.slides.length;
  const last = idx === n - 1;
  const go = useCallback((d: number) => { setAutoplay(false); setIdx(i => Math.max(0, Math.min(n - 1, i + d))); }, [n]);
  const fechar = useCallback(() => { if (onClose) onClose(); else router.push(voltarHref); }, [router, voltarHref, onClose]);

  // autoplay
  useEffect(() => {
    if (!autoplay || last) return;
    const t = setTimeout(() => setIdx(i => Math.min(n - 1, i + 1)), AUTO_MS);
    return () => clearTimeout(t);
  }, [idx, autoplay, last, n]);

  // teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') fechar();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, fechar]);

  // compartilhar — captura o slide atual como PNG e abre a folha nativa
  async function compartilhar() {
    if (!cardRef.current || share === 'working') return;
    setAutoplay(false);
    setShare('working');
    try {
      const { toBlob } = await import('html-to-image');
      const blob = await toBlob(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        // story 1080x1920
        canvasWidth: 1080, canvasHeight: 1920,
      });
      if (!blob) throw new Error('sem imagem');
      const file = new File([blob], `sora-wrapped-${deck.periodoLabel}.png`, { type: 'image/png' });

      const navAny = navigator as any;
      if (navAny.canShare?.({ files: [file] })) {
        await navAny.share({ files: [file], title: `Meu ${deck.marca}`, text: `Meu resumo na Sora — ${deck.periodoLabel} ✨` });
      } else {
        // fallback: baixa a imagem
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
      }
      setShare('done');
      setTimeout(() => setShare('idle'), 1800);
    } catch {
      setShare('idle');
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white overflow-hidden select-none" style={{ touchAction: 'pan-y' }}>
      {/* barras de progresso (estilo Stories) */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 p-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 0.75rem)' }}>
        {deck.slides.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.25)' }}>
            <div className="h-full bg-white"
              style={{
                width: i < idx ? '100%' : i === idx ? (autoplay ? '100%' : '60%') : '0%',
                transition: i === idx && autoplay ? `width ${AUTO_MS}ms linear` : 'none',
              }} />
          </div>
        ))}
      </div>

      {/* fechar */}
      <button onClick={fechar} aria-label="Fechar"
        className="absolute top-3 right-4 z-30 w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"
        style={{ marginTop: 'calc(env(safe-area-inset-top,0px) + 0.5rem)' }}>
        <X size={17} />
      </button>

      {/* card 9:16 */}
      <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4">
        <div className="relative w-full h-full max-w-[min(440px,calc((100dvh-1rem)*9/16))] aspect-[9/16] rounded-[28px] overflow-hidden shadow-2xl">
          {/* re-monta a cada slide → replay das animações */}
          <div key={idx} ref={cardRef} className="absolute inset-0 motion-safe:animate-[wr-pop_500ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <SlideView slide={deck.slides[idx]} deck={deck} />
          </div>

          {/* zonas de toque */}
          <button onClick={() => go(-1)} aria-label="Anterior" className="absolute left-0 top-0 bottom-0 w-[32%] z-10" />
          <button onClick={() => go(1)} aria-label="Próximo" className="absolute right-0 top-0 bottom-[16%] w-[68%] z-10" />

          {/* compartilhar (no último slide, em destaque) */}
          {last && (
            <div className="absolute inset-x-0 bottom-0 z-20 p-5 flex justify-center">
              <button onClick={compartilhar} disabled={share === 'working'}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[15px] font-bold text-black bg-white shadow-xl transition-transform active:scale-95 disabled:opacity-80">
                {share === 'working' ? <><Loader2 size={16} className="animate-spin" /> Gerando imagem…</>
                  : share === 'done' ? <><Check size={16} /> Pronto!</>
                  : <><Share2 size={16} /> Compartilhar no story</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* setas desktop */}
      <button onClick={() => go(-1)} disabled={idx === 0}
        className="hidden sm:flex absolute left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-all disabled:opacity-25">
        <ChevronLeft size={18} />
      </button>
      <button onClick={() => go(1)} disabled={last}
        className="hidden sm:flex absolute right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-all disabled:opacity-25">
        <ChevronRight size={18} />
      </button>

      {/* botão compartilhar persistente (slides não-finais) */}
      {!last && (
        <button onClick={compartilhar} disabled={share === 'working'} aria-label="Compartilhar"
          className="absolute bottom-5 right-5 z-20 w-12 h-12 rounded-full bg-white/12 hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors"
          style={{ marginBottom: 'env(safe-area-inset-bottom,0px)' }}>
          {share === 'working' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
        </button>
      )}
    </div>
  );
}
