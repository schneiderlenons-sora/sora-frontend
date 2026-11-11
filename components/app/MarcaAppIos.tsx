'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Dentro do APP DE IPHONE, troca "Sora" por "ForSora" em todo texto da tela.
// A regra (e o porquê — recusa da Apple pela 4.1a) está em lib/marca-app-ios.ts.
//
// ⚠️ SÓ DEPOIS DA HIDRATAÇÃO. Mexer no texto que o servidor mandou ANTES de o
// React hidratá-lo dá "hydration mismatch", e o React refaz aquele pedaço da
// tela do zero. Por isso o 1º passe espera o `load` + o navegador ficar ocioso
// (a hidratação é trabalho em fila; ocioso = acabou). Dali em diante, o que o
// React desenhar de novo (navegação, modal, lista que carrega) é pego pelo
// observador na hora.
//
// ⚠️ Só a TELA muda — nunca o dado. Campo de texto (input/textarea) e área
// editável ficam de fora: o valor deles é o que vai pro servidor. Uma
// transação chamada "Assinatura Sora" aparece "ForSora" na lista, mas continua
// "Sora" no banco e no campo de edição.
//
// Devolve null e não embrulha nada: wrapper em volta do app quebraria
// `position: fixed` (mesma razão do ThemeColorSync).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { ehAppIos } from '@/lib/app-ios';
import { trocarMarca } from '@/lib/marca-app-ios';

const PULAR = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE']);
const ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'alt'];

function podeMexer(el: Element | null): boolean {
  for (let e = el; e; e = e.parentElement) {
    if (PULAR.has(e.tagName)) return false;
    if ((e as HTMLElement).isContentEditable) return false;
  }
  return true;
}

function trocarTexto(no: Text) {
  const v = no.nodeValue;
  if (!v || v.indexOf('Sora') < 0 && v.indexOf('SORA') < 0) return;
  if (!podeMexer(no.parentElement)) return;
  const novo = trocarMarca(v);
  if (novo !== v) no.nodeValue = novo;
}

function trocarAtributos(el: Element) {
  if (PULAR.has(el.tagName) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
  for (const a of ATRIBUTOS) {
    const v = el.getAttribute(a);
    if (v && (v.indexOf('Sora') >= 0 || v.indexOf('SORA') >= 0)) {
      const novo = trocarMarca(v);
      if (novo !== v) el.setAttribute(a, novo);
    }
  }
}

function varrer(raiz: Node) {
  if (raiz.nodeType === Node.TEXT_NODE) { trocarTexto(raiz as Text); return; }
  if (raiz.nodeType !== Node.ELEMENT_NODE) return;
  trocarAtributos(raiz as Element);
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) trocarTexto(n as Text);
    else trocarAtributos(n as Element);
  }
}

function trocarTitulo() {
  const t = document.title;
  const novo = trocarMarca(t);
  if (novo !== t) document.title = novo;
}

export default function MarcaAppIos() {
  useEffect(() => {
    if (!ehAppIos()) return;

    let obs: MutationObserver | null = null;
    let cancelado = false;
    let idle: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const comecar = () => {
      if (cancelado) return;
      varrer(document.body);
      trocarTitulo();
      obs = new MutationObserver((muts) => {
        for (const m of muts) {
          if (m.type === 'characterData') trocarTexto(m.target as Text);
          else if (m.type === 'attributes') trocarAtributos(m.target as Element);
          else m.addedNodes.forEach(varrer);
        }
        trocarTitulo();
      });
      obs.observe(document.body, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ATRIBUTOS,
      });
    };

    // Ocioso depois do `load` = hidratação terminada (ver o cabeçalho).
    const agendar = () => {
      const w = window as any;
      if (typeof w.requestIdleCallback === 'function') idle = w.requestIdleCallback(comecar, { timeout: 800 });
      else timer = setTimeout(comecar, 300);
    };
    if (document.readyState === 'complete') agendar();
    else window.addEventListener('load', agendar, { once: true });

    return () => {
      cancelado = true;
      window.removeEventListener('load', agendar);
      if (idle != null) (window as any).cancelIdleCallback?.(idle);
      if (timer) clearTimeout(timer);
      obs?.disconnect();
    };
  }, []);

  return null;
}
