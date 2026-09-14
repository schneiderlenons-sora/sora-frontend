'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mail, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { detectarOrigem } from '@/lib/origem-app';
import { LINK_TESTE_PLAY } from '@/lib/play-store';

// ─────────────────────────────────────────────────────────────────────────────
// Barra de convite pro app Android — o cabeçalho colorido no topo do painel.
//
// QUEM VÊ:
//   · celular ANDROID, no navegador. iPhone não instala app da Play Store, e
//     mostrar o convite ali seria mandar a pessoa pra um link que não abre;
//   · que ainda NÃO abriu a Sora dentro do app — nem neste aparelho (origem
//     local) nem em nenhum outro (`perfil.app_android_em`, migration 166).
// Dentro do próprio app a barra nunca aparece.
//
// ⚠️ "BAIXAR" NÃO VAI DIRETO PRO LINK — ABRE UM CARD ANTES. O app está em teste
// FECHADO: a Play Store só libera a instalação pra conta Google que está na
// lista de testadores, e a lista é feita com o e-mail de CADASTRO na Sora.
// Quem entra na Play Store com outro e-mail recebe "app não disponível" sem
// explicação nenhuma — e conclui que o app não existe. O card mostra o e-mail
// certo e diz como trocar de conta ANTES de a pessoa bater nesse muro.
//
// ⚠️ ELA EMPURRA O TOPO DO PAINEL, e três coisas dependiam de "onde começa o
// topo": o padding do <main>, o círculo de tema (FIXO no canto superior
// direito — ficaria em cima do botão "Baixar") e o hero de vídeo do dashboard
// (também fixo em top: 0). Os três leem duas variáveis globais:
//
//   --sora-barra-altura   altura desta barra (0px sem ela)
//   --sora-topo-safe      safe-area do topo (0px com ela, porque ESTA barra já
//                         a absorve — senão o espaço do notch contaria 2 vezes)
//
// ⚠️ SEM A BARRA, OS VALORES SÃO EXATAMENTE OS DE ANTES: as variáveis só são
// escritas enquanto ela está na tela, e os padrões em `globals.css` reproduzem
// a conta antiga. iPhone, desktop e quem já está no app não sentem diferença.
//
// ⚠️ SEM BOTÃO DE FECHAR NA BARRA, de propósito: o pedido é que ela saia quando
// a pessoa BAIXAR. Se incomodar, o lugar de um "agora não" é aqui.
//
// Teste sem celular Android: `?barraplay=1` força a exibição.
// ─────────────────────────────────────────────────────────────────────────────

const TEXTO = '#2B1700';
const FUNDO = 'linear-gradient(135deg, #FFB547 0%, #FF9A3C 100%)';

function IconePlay({ tamanho }: { tamanho: number }) {
  // Triângulo do Play, monocromático — sem as quatro cores da marca brigando
  // com o fundo âmbar.
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} fill={TEXTO} aria-hidden>
      <path d="M5 3.6v16.8a1.1 1.1 0 0 0 1.66.95l14.5-8.4a1.1 1.1 0 0 0 0-1.9L6.66 2.65A1.1 1.1 0 0 0 5 3.6z" />
    </svg>
  );
}

export default function BarraPlayStore() {
  const { user, perfil } = useAuth();
  const [visivel, setVisivel] = useState(false);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const continuarRef = useRef<HTMLAnchorElement>(null);
  const jaInstalou = !!perfil?.app_android_em;

  // ⚠️ Decidido em EFEITO: o servidor não conhece o aparelho, e decidir no
  // primeiro render daria hydration mismatch.
  useEffect(() => {
    if (!user) { setVisivel(false); return; }
    let forcar = false;
    try { forcar = new URLSearchParams(window.location.search).get('barraplay') === '1'; } catch { /* URL estranha */ }
    if (forcar) { setVisivel(true); return; }

    const android = /Android/i.test(navigator.userAgent);
    const dentroDoApp = detectarOrigem() === 'android';
    setVisivel(android && !dentroDoApp && !jaInstalou && !!LINK_TESTE_PLAY);
  }, [user, jaInstalou]);

  // Publica a altura real (ResizeObserver: a frase quebra em 2 linhas em tela
  // estreita, e no tablet o `md:hidden` a zera).
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    const limpar = () => {
      raiz.style.removeProperty('--sora-barra-altura');
      raiz.style.removeProperty('--sora-topo-safe');
    };
    const el = ref.current;
    if (!visivel || !el) { limpar(); return; }

    const aplicar = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) {
        raiz.style.setProperty('--sora-barra-altura', `${h}px`);
        raiz.style.setProperty('--sora-topo-safe', '0px');
      } else {
        // Escondida pelo breakpoint: devolve os valores de antes, senão o
        // tablet com notch perderia a safe-area do topo.
        limpar();
      }
    };
    aplicar();
    const ro = new ResizeObserver(aplicar);
    ro.observe(el);
    return () => { ro.disconnect(); limpar(); };
  }, [visivel]);

  // Card: Esc fecha, o foco entra no botão principal e volta pro "Baixar".
  useEffect(() => {
    if (!aberto) return;
    const t = setTimeout(() => continuarRef.current?.focus(), 60);
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false); };
    window.addEventListener('keydown', aoTeclar);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', aoTeclar);
      botaoRef.current?.focus();
    };
  }, [aberto]);

  if (!visivel) return null;

  const email = String(perfil?.email || user?.email || '').trim();
  const ehGmail = /@(gmail|googlemail)\.com$/i.test(email);

  return (
    <>
      <div
        ref={ref}
        role="region"
        aria-label="Convite para o app da Sora na Play Store"
        className="md:hidden relative z-[35] flex-shrink-0"
        style={{ background: FUNDO, paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Mais fina a pedido: ~56px contra os 79px da primeira versão. */}
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <span
            aria-hidden
            className="grid place-items-center w-9 h-9 rounded-lg flex-shrink-0"
            style={{ background: 'rgba(43, 23, 0, 0.10)' }}
          >
            <IconePlay tamanho={16} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold leading-tight" style={{ color: TEXTO }}>
              A Sora chegou na Play Store
            </p>
            <p className="text-[12px] leading-snug" style={{ color: 'rgba(43, 23, 0, 0.78)' }}>
              Teste o app antes de todo mundo
            </p>
          </div>

          {/* ⚠️ Botão visual de 36px, mas a ÁREA DE TOQUE continua 44px: o
              `after:-inset-1` estende o alvo sem engordar a barra. */}
          <button
            ref={botaoRef}
            type="button"
            onClick={() => setAberto(true)}
            aria-haspopup="dialog"
            className="relative flex-shrink-0 inline-flex items-center justify-center h-9 px-3.5 rounded-full
                       text-[13px] font-bold motion-safe:active:scale-[0.97] transition-transform
                       after:content-[''] after:absolute after:-inset-1"
            style={{ background: TEXTO, color: '#FFB547' }}
          >
            Baixar
          </button>
        </div>
      </div>

      {/* ⚠️ PORTAL: modal `fixed` renderizado dentro da árvore pode ficar preso
          num ancestral com transform/backdrop-filter (memória do projeto). */}
      {aberto && createPortal(
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="play-card-titulo"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setAberto(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />

          <div
            className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl border border-border/60 bg-card shadow-2xl
                       motion-safe:animate-[slide-up_280ms_cubic-bezier(0.22,1,0.36,1)_both]"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />

            <div className="px-5 pt-6">
              <span className="grid place-items-center w-12 h-12 rounded-2xl" style={{ background: FUNDO }} aria-hidden>
                <IconePlay tamanho={22} />
              </span>

              <h2 id="play-card-titulo" className="mt-4 text-lg font-bold text-foreground leading-tight">
                Antes de baixar, confira o e-mail
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                O app está em teste e a Play Store só libera a instalação para quem já é usuário da Sora.
                Entre na Play Store com a <strong className="text-foreground">mesma conta do seu cadastro</strong>:
              </p>

              {email && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/40 px-3.5 py-3">
                  <Mail size={16} className="text-muted-foreground flex-shrink-0" aria-hidden />
                  <span className="text-sm font-semibold text-foreground break-all">{email}</span>
                </div>
              )}

              <ul className="mt-3 space-y-2 text-[13px] text-muted-foreground leading-snug">
                <li className="flex gap-2">
                  <span aria-hidden>•</span>
                  <span>Usa outro e-mail na Play Store? Abra a Play Store, toque na sua foto no canto superior e troque para essa conta antes de continuar.</span>
                </li>
                {/* Só pra quem não é Gmail: é o caso que mais falha (e-mail que
                    não é conta Google não entra na lista de testadores). */}
                {email && !ehGmail && (
                  <li className="flex gap-2">
                    <span aria-hidden>•</span>
                    <span>Seu e-mail não é Gmail: ele precisa estar ligado a uma conta Google para a Play Store aceitar.</span>
                  </li>
                )}
              </ul>
            </div>

            <div className="px-5 pt-5 flex flex-col gap-2">
              <a
                ref={continuarRef}
                href={LINK_TESTE_PLAY}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAberto(false)}
                className="h-12 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold
                           motion-safe:active:scale-[0.98] transition-transform"
                style={{ background: FUNDO, color: TEXTO }}
              >
                Continuar para a Play Store <ExternalLink size={15} aria-hidden />
              </a>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="h-11 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
