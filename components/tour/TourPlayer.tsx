'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { SLIDES, ArteSlide } from './slides';

/**
 * A sequência de demonstrações que abre o app.
 *
 * ⚠️ SEM AUTOPLAY, ao contrário do WrappedPlayer. Lá o conteúdo é sobre o
 * passado da pessoa e correr é parte da graça; aqui ela está DECIDINDO se fica.
 * Slide que troca sozinho no meio da leitura tira a decisão da mão dela — e o
 * primeiro contato com o produto é o pior lugar pra fazer isso.
 *
 * ⚠️ O SWIPE VEM DO `Carrossel.tsx` DA LANDING (limiar de 50px), e não de uma
 * lib: nenhum slider está instalado no projeto, e trazer um custaria bundle e
 * main thread numa tela que precisa abrir instantânea.
 */

const LIMIAR_SWIPE = 50;

export default function TourPlayer({ onFim }: { onFim: () => void }) {
  const [idx, setIdx] = useState(0);
  const n = SLIDES.length;
  const ultimo = idx === n - 1;
  const toqueX = useRef<number | null>(null);

  const ir = useCallback((d: number) => {
    setIdx((i) => Math.max(0, Math.min(n - 1, i + d)));
  }, [n]);

  // Teclado: mesma convenção do WrappedPlayer, pra quem usa os dois não
  // reaprender nada.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); ir(1); }
      else if (e.key === 'ArrowLeft') ir(-1);
      else if (e.key === 'Escape') onFim();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ir, onFim]);

  const slide = SLIDES[idx];

  // O título com a palavra sublinhada. Split simples: `destaque` é sempre um
  // trecho literal do título (garantido no catálogo).
  const [antes, depois] = slide.titulo.split(slide.destaque);

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden select-none text-white"
      style={{
        // Fundo próprio, independente do tema do app: a demo é uma peça de
        // apresentação e tem de ficar igual pros dois temas.
        background: 'radial-gradient(120% 80% at 50% 0%, #10231a 0%, #070a08 55%, #000 100%)',
        // `pan-y` deixa o swipe horizontal pro player e a rolagem vertical pro
        // sistema — sem isso o gesto briga com o scroll do navegador.
        touchAction: 'pan-y',
      }}
      onTouchStart={(e) => { toqueX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (toqueX.current === null) return;
        const dx = e.changedTouches[0].clientX - toqueX.current;
        if (dx > LIMIAR_SWIPE) ir(-1);
        else if (dx < -LIMIAR_SWIPE) ir(1);
        toqueX.current = null;
      }}
    >
      {/* ── Barras de progresso, estilo stories ─────────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-30 flex gap-1 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top,0px) + 0.9rem)' }}
      >
        {SLIDES.map((s, i) => (
          <div key={s.id} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/20">
            <div
              className="h-full bg-white transition-[width] duration-400 ease-out"
              style={{ width: i <= idx ? '100%' : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* ── Pular ───────────────────────────────────────────────────────────
          Sempre visível, desde o primeiro slide. Esconder a saída pra "forçar"
          a demo até o fim irrita quem já decidiu — e essa pessoa é justamente
          a que ia assinar. */}
      <button
        type="button"
        onClick={onFim}
        className="absolute right-4 z-30 h-10 px-3.5 rounded-full text-[13px] font-semibold text-white/70 hover:text-white bg-white/[0.07] hover:bg-white/15 backdrop-blur-sm transition-colors"
        style={{ top: 'calc(env(safe-area-inset-top,0px) + 1.6rem)', minHeight: 40 }}
      >
        Pular
      </button>

      {/* ── Arte ────────────────────────────────────────────────────────────
          Altura FIXA em porcentagem da tela: o espaço é reservado antes de a
          imagem chegar, então nada salta quando ela carrega (CLS). */}
      <div className={`absolute inset-x-0 top-0 h-[58%] sm:h-[60%] ${slide.arte.tipo === 'img' ? 'flex items-center justify-center px-5' : ''}`}>
        {slide.arte.tipo === 'jsx' ? (
          <div key={slide.id} className="relative w-full h-full motion-safe:animate-[fade-in_500ms_ease-out_both]">
            <ArteSlide slide={slide} prioridade={idx <= 1} />
          </div>
        ) : (
          // ⚠️ MOLDURA, NÃO SANGRIA. As telas de `public/screenshots` são
          // capturas de DESKTOP (16:9); em 390px de largura o `object-cover`
          // recortava uma fatia ilegível do meio do dashboard — visto na
          // bancada antes de mudar. Dentro de um quadro com borda e sombra a
          // imagem lê como "uma foto do app", que é o que ela é.
          <div
            key={slide.id}
            className="relative w-full max-w-[420px] aspect-[16/10] rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl motion-safe:animate-[slide-up_600ms_cubic-bezier(0.22,1,0.36,1)_both]"
          >
            <ArteSlide slide={slide} prioridade={idx <= 1} />
          </div>
        )}
      </div>

      {/* ⚠️ VÉU DE TOPO. As capturas são de tema CLARO: sem ele as barras de
          progresso e o "Pular" (ambos brancos) somem em cima da imagem. */}
      <div
        className="absolute inset-x-0 top-0 h-28 z-20 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, rgba(7,10,8,0.75), transparent)' }}
      />

      {/* ── Texto ───────────────────────────────────────────────────────── */}
      <div className="absolute inset-x-0 bottom-0 z-20 px-6 pb-5">
        <div
          key={slide.id}
          className="max-w-md mx-auto text-center motion-safe:animate-[slide-up_520ms_cubic-bezier(0.22,1,0.36,1)_both]"
        >
          <h2 className="text-[26px] sm:text-3xl font-bold leading-tight tracking-tight">
            {antes}
            <span className="relative whitespace-nowrap">
              {slide.destaque}
              {/* O traço da marca sob a palavra-chave — o mesmo recurso das
                  referências, feito com um span pra poder arredondar a ponta. */}
              <span
                className="absolute left-0 right-0 -bottom-1 h-[3px] rounded-full"
                style={{ background: '#61ce70' }}
                aria-hidden
              />
            </span>
            {depois}
          </h2>

          <p className="mt-3.5 text-[15px] leading-relaxed text-white/60">{slide.texto}</p>
        </div>

        {/* ── Navegação ─────────────────────────────────────────────────── */}
        <div
          className="mt-6 max-w-md mx-auto flex items-center justify-between gap-4"
          style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
        >
          <button
            type="button"
            onClick={() => ir(-1)}
            disabled={idx === 0}
            aria-label="Anterior"
            className="w-12 h-12 rounded-full flex items-center justify-center bg-white/[0.07] hover:bg-white/15 transition-all disabled:opacity-20 disabled:pointer-events-none"
            style={{ minHeight: 44, minWidth: 44 }}
          >
            <ChevronLeft size={20} />
          </button>

          {/* Pontos. O ativo vira pílula — a diferença de LARGURA carrega a
              informação, não só a cor. */}
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Slides">
            {SLIDES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === idx}
                aria-label={`Slide ${i + 1} de ${n}`}
                onClick={() => setIdx(i)}
                className="h-2 rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 22 : 8,
                  background: i === idx ? '#61ce70' : 'rgba(255,255,255,0.25)',
                }}
              />
            ))}
          </div>

          {ultimo ? (
            <button
              type="button"
              onClick={onFim}
              className="h-12 px-5 rounded-full inline-flex items-center gap-1.5 text-[14px] font-bold text-[#0A2A14] shadow-lg active:scale-95 transition-transform"
              style={{ background: '#61ce70', minHeight: 44 }}
            >
              Continuar <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => ir(1)}
              aria-label="Próximo"
              className="w-12 h-12 rounded-full flex items-center justify-center bg-white/[0.07] hover:bg-white/15 transition-all"
              style={{ minHeight: 44, minWidth: 44 }}
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
