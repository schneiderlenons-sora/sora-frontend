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

/**
 * VERSÃO DO APP QUE VENDE pela Apple (StoreKit). A partir do build 1.1.0 a
 * casca acrescenta `SoraCompras/<n>` ao User-Agent (capacitor.config.json) e
 * traz o plugin de compra (ios-app/ios/App/App/SoraComprasPlugin.swift).
 *
 * ⚠️ É ISTO que decide se o app de iPhone mostra paywall e planos à venda.
 * Sem venda, a aba fora do plano aparece com cadeado e só diz que não faz
 * parte do plano — sem preço, sem "Assinar", sem link pro site (3.1.1).
 *
 * ⚠️ O BUILD 1.1.0 (`SoraCompras/1`) NÃO VENDE. A Apple não entrega as
 * assinaturas no Brasil enquanto o Formulário fiscal do Brasil (CNPJ) está
 * pendente (nov/2026). O build que for à revisão JUNTO com as assinaturas sobe
 * a marca pra `SoraCompras/2`: assim a venda nunca é ligada por fora num build
 * já aprovado — "recurso escondido" é motivo de remoção (regras 2.3.1/2.5.19).
 */
export const MARCA_COMPRAS_IOS = 'SoraCompras/';
export const VERSAO_COMPRAS_QUE_VENDE = 2;

/** O `<n>` de `SoraCompras/<n>` (0 = sem a marca ou sem número). */
export function versaoComprasIos(ua: string | null | undefined): number {
  const s = String(ua || '');
  const i = s.indexOf(MARCA_COMPRAS_IOS);
  if (i < 0) return 0;
  return parseInt(s.slice(i + MARCA_COMPRAS_IOS.length), 10) || 0;
}

export function uaIosVende(ua: string | null | undefined): boolean {
  return uaEhAppIos(ua) && versaoComprasIos(ua) >= VERSAO_COMPRAS_QUE_VENDE;
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
// `/indique` e `/afiliados` ficam aqui porque falam em ganhar sobre ASSINATURA
// vendida fora da Apple: dentro do app isso é promover outro meio de pagamento.
export const ROTAS_DE_VENDA_IOS = ['/oferta', '/kit', '/checkout-vitalicio', '/financas', '/chat', '/quiz', '/es', '/indique', '/afiliados'];

export function rotaDeVendaNoAppIos(pathname: string): boolean {
  if (pathname === '/') return true;
  return ROTAS_DE_VENDA_IOS.some((r) => pathname === r || pathname.startsWith(r + '/'));
}
