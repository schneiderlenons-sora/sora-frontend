'use client';

import { useEffect, useRef } from 'react';
import { Check, Pause, Sparkles } from 'lucide-react';
import type { Agente } from '@/lib/agentes';

// =============================================================================
// Card de um agente — a animação toca UMA VEZ e congela no último frame.
//
// É o mesmo comportamento do vídeo do dashboard mobile (`HeroVideoBg`): sem
// `loop`, o <video> para sozinho no último frame e vira a "foto" do agente.
// Loop infinito em 6 cards lado a lado viraria um letreiro piscando.
//
// DECISÕES QUE NÃO PODEM REGREDIR:
// · `aspect-square` (os vídeos são 1:1) reserva a altura ANTES do vídeo
//   carregar. Sem isso a faixa inteira pula quando o primeiro frame chega (CLS).
// · A animação começa quando o card ENTRA NA TELA e recomeça do zero se ele
//   sair e voltar — é o "abriu, animou" que o usuário pediu. Fora da tela nada
//   toca: 6 vídeos simultâneos derrubam o frame rate no mobile.
// · `prefers-reduced-motion` → nunca dá play; fica no primeiro frame, como uma
//   foto. É requisito de acessibilidade, não enfeite.
// · Agente sem vídeo ainda (Jacques, Aurora) cai no gradiente com a inicial —
//   estado desenhado de propósito, não falha.
// · O CARD (borda arredondada) é só a capa: vídeo + nome sobreposto embaixo,
//   igual desktop. É UM botão — o interruptor NÃO fica aqui dentro: botão
//   dentro de botão é HTML inválido e o clique dispara os dois (o mesmo bug
//   que já aconteceu no /admin com button dentro de label).
// · MOBILE: descrição/contagem ficam FORA do card (abaixo, sem a borda), não
//   mais empilhadas dentro dele — só o nome mora dentro, sobre o vídeo, como
//   no desktop. Motivo: nome+descrição+contagem espremidos dentro dos 190px
//   de largura tornavam tudo ilegível junto (queixa real).
// =============================================================================

interface Props {
  agente: Agente;
  ativo: boolean;
  ligados: number;
  total: number;
  onAbrir: () => void;
  delay?: number;
}

export default function AgenteCard({ agente, ativo, ligados, total, onAbrir, delay = 0 }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // Respeita quem pediu menos movimento no sistema: fica no 1º frame.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const tocarDoInicio = () => {
      v.currentTime = 0;
      v.play().catch(() => {});   // autoplay bloqueado = 1º frame, sem erro no console
    };

    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) tocarDoInicio(); },
      { threshold: 0.4 },
    );
    io.observe(v);

    // Voltou pro app depois de trocar de aba → anima de novo (igual HeroVideoBg).
    const aoVoltar = () => { if (document.visibilityState === 'visible') tocarDoInicio(); };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', aoVoltar); };
  }, []);

  return (
    // Wrapper NÃO-interativo: só carrega a largura/snap/animação de entrada da
    // faixa. O botão de verdade é só a capa (vídeo+nome), logo abaixo — mobile
    // ganha a descrição/contagem FORA dela, no fluxo normal deste wrapper.
    <div
      className="w-[190px] sm:w-[210px] flex-shrink-0 snap-start animate-[slide-up_500ms_ease-out_both]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`${agente.nome} — ${agente.tagline}. ${ativo ? 'Ativo' : 'Pausado'}. Toque para ver os avisos.`}
        className="group relative block w-full text-left rounded-2xl overflow-hidden
                   border border-border/50 transition-transform duration-200 active:scale-[0.98]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                   focus-visible:ring-offset-background"
        style={{ ['--tw-ring-color' as string]: agente.cor }}
      >
        {/* Capa 1:1 (proporção dos vídeos). Reserva o espaço e evita CLS.
            ⚠️ `isolate`: força um stacking context PRÓPRIO nesta caixa. Sem
            ele, o <video> (que o iOS promove a camada de GPU) era comparado
            com os overlays lá no contexto do card inteiro — que tem
            `overflow-hidden` + `rounded-2xl`, combinação em que o WebKit
            deixa a camada do vídeo escapar do recorte e pintar por cima.
            Era o que engolia o véu e o nome do agente. */}
        <div className="relative isolate aspect-square w-full overflow-hidden bg-muted">
          {/* Fundo de identidade — fica SOB o vídeo. Enquanto os arquivos do
              agente não existem (ou falham), é isto que aparece: gradiente na cor
              dele + inicial. Preview sem asset fica intencional, não quebrado. */}
          <div
            className="absolute inset-0 grid place-items-center"
            style={{ background: `linear-gradient(150deg, ${agente.cor} 0%, color-mix(in srgb, ${agente.cor} 35%, #0b1220) 100%)` }}
          >
            <span className="text-5xl font-black text-white/25 select-none">{agente.nome.charAt(0)}</span>
          </div>
          {/* Sem `loop`: toca uma vez e congela no último frame.
              Só monta o <video> se o arquivo existe — evita 404 pros agentes
              que ainda não têm animação. */}
          {agente.video && (
            <video
              ref={ref}
              src={agente.video}
              // `poster` + `preload="metadata"` matam o card vazio: o JPEG de
              // ~14 KB pinta na hora e o vídeo assume por cima. Como o poster é o
              // PRIMEIRO frame do próprio vídeo, a troca não tem salto.
              // `preload="none"` (o que estava aqui) só ia buscar o arquivo no
              // play, então o card ficava no gradiente até o .webm inteiro chegar.
              poster={agente.poster}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              // ⚠️ `z-0` EXPLÍCITO. No iOS o <video> vira camada de GPU própria
              // e passa a pintar POR CIMA de irmãos absolutos que não declaram
              // z-index — mesmo vindo antes no DOM. Era o que engolia o nome do
              // agente, o véu e os selos no celular (no desktop aparecia
              // normalmente, por isso passou batido).
              className="absolute inset-0 z-0 h-full w-full object-cover transition-transform duration-500
                         group-hover:scale-[1.04]"
            />
          )}
          {/* Véu só no terço de baixo: dá contraste pro nome sem cobrir o
              personagem (os vídeos são 1:1 e o bicho ocupa o quadro todo).
              `z-10` + `transform-gpu`: z-index sozinho não basta contra uma
              camada de GPU no iOS — o overlay precisa virar camada TAMBÉM
              (translate3d) pra o compositor conseguir ordená-lo acima do
              vídeo. É o par que resolve; um sem o outro não. */}
          <div className="absolute inset-x-0 bottom-0 z-10 h-[55%] transform-gpu bg-gradient-to-t from-black/92 via-black/55 to-transparent" />

          {/* Selo de estado — ícone + texto, nunca só cor (acessibilidade) */}
          <span
            className={`absolute top-2.5 left-2.5 z-10 inline-flex items-center gap-1 rounded-full px-2 py-1
                        text-[10px] font-semibold backdrop-blur-md ${
                          ativo ? 'text-white' : 'bg-black/55 text-white/80'
                        }`}
            style={ativo ? { background: `color-mix(in srgb, ${agente.cor} 85%, black)` } : undefined}
          >
            {ativo ? <Check size={11} strokeWidth={3} /> : <Pause size={11} strokeWidth={3} />}
            {ativo ? 'Ativo' : 'Pausado'}
          </span>

          {agente.emBreve && (
            <span className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1 rounded-full
                             bg-black/55 px-2 py-1 text-[10px] font-semibold text-white/85 backdrop-blur-md">
              <Sparkles size={11} /> Em breve
            </span>
          )}

          {/* MOBILE: só o NOME sobre a capa, igual desktop — a diferença é que
              descrição/contagem NÃO ficam aqui dentro (ver fora do card, mais
              abaixo): espremer as três linhas nos 190px de largura junto do
              vídeo era o que ficava ilegível. */}
          <div className="absolute inset-x-0 bottom-0 z-10 transform-gpu p-2.5 sm:hidden">
            <p className="text-[15px] font-bold leading-tight text-white drop-shadow-md">{agente.nome}</p>
          </div>

          {/* DESKTOP (sm+): sobreposição completa — ali sobra espaço e a capa
              maior aguenta as três linhas sem competir com o personagem. */}
          <div className="absolute inset-x-0 bottom-0 z-10 transform-gpu hidden p-3 sm:block">
            <p className="text-[15px] font-bold leading-tight text-white drop-shadow-sm">{agente.nome}</p>
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/75">{agente.tagline}</p>
            {!agente.emBreve && (
              <p className="mt-1.5 text-[10px] font-medium tabular text-white/60">
                {ligados} de {total} avisos · {agente.cadencia}
              </p>
            )}
          </div>
        </div>

        {/* Barra de cor do agente — dá identidade sem depender do vídeo */}
        <div
          className="h-1 w-full transition-opacity duration-200"
          style={{ background: agente.cor, opacity: ativo || agente.emBreve ? 1 : 0.3 }}
        />
      </button>

      {/* MOBILE: descrição, contagem e cadência FORA do card (sem borda, fora
          do botão) — legíveis no fluxo da página, só o nome mora dentro. */}
      <div className="px-0.5 pt-2 sm:hidden">
        <p className="line-clamp-2 text-[12px] leading-snug text-muted-foreground">{agente.tagline}</p>
        {!agente.emBreve && (
          <p className="mt-1.5 text-[11px] font-medium tabular text-muted-foreground/80">
            {ligados} de {total} avisos · {agente.cadencia}
          </p>
        )}
      </div>
    </div>
  );
}
