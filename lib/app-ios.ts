// ─────────────────────────────────────────────────────────────────────────────
// "Esta sessão está dentro do APP DE IPHONE (App Store)?"
//
// O app é uma casca Capacitor (`ios-app/`) que abre www.forsora.com e acrescenta
// `SoraApp-iOS` ao User-Agent (`ios.appendUserAgent` no capacitor.config.json).
// ⚠️ Mudou a marca lá, mude aqui.
//
// Por que isto existe, e por que NÃO reaproveita o `ehAndroid`:
//  · NADA SE VENDE no app de iPhone (Apple 3.1.1: assinatura digital só pela
//    cobrança da Apple, e ela ainda não foi ligada). No Android a venda existe
//    — pela Google Play —, então as duas regras divergem de propósito.
//  · O Pixel do Facebook e os eventos de anúncio ficam DESLIGADOS: na
//    Privacidade do app declaramos "não rastreia". Com eles ligados a Apple
//    exigiria a janela de permissão de rastreamento (ATT).
//  · A aba Saúde é bloqueada no Android por regra do GOOGLE, não da Apple —
//    então no iPhone ela continua aberta.
//
// ⚠️ É PELO USER-AGENT, não persistido. Ao contrário do TWA (cujo referrer só
// existe na 1ª navegação), a marca vem em TODA requisição e TODA página do app,
// e nunca aparece no Safari — não há como "vazar" pro navegador.
// ─────────────────────────────────────────────────────────────────────────────

export const MARCA_APP_IOS = 'SoraApp-iOS';

export function uaEhAppIos(ua: string | null | undefined): boolean {
  return String(ua || '').includes(MARCA_APP_IOS);
}

/** No cliente. No servidor (sem `navigator`) responde `false`. */
export function ehAppIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return uaEhAppIos(navigator.userAgent);
}

/**
 * Páginas de VENDA (landings com preço, funis, checkout). Dentro do app de
 * iPhone elas não abrem: o middleware manda pro painel. Sem isso, um revisor
 * da Apple chega nelas saindo da tela de login (logo → "/") e vê "Assinar".
 *
 * ⚠️ `/planos` NÃO está aqui: é item do menu do painel. Lá ela mostra o plano
 * atual sem vender (ver `app/(app)/planos/page.tsx`).
 */
export const ROTAS_DE_VENDA_IOS = ['/oferta', '/kit', '/checkout-vitalicio', '/financas', '/chat', '/quiz', '/es'];

export function rotaDeVendaNoAppIos(pathname: string): boolean {
  if (pathname === '/') return true;
  return ROTAS_DE_VENDA_IOS.some((r) => pathname === r || pathname.startsWith(r + '/'));
}
