// ─────────────────────────────────────────────────────────────────────────────
// "Esta sessão está rodando dentro do app Android (TWA)?"
//
// Serve pra duas coisas, e as duas são consequência da política do Google Play:
//   1. decidir se o cadastro cai na sequência de demonstrações (só no app);
//   2. decidir se o card final mostra PREÇO. Dentro do app, não pode — a
//      política exige Play Billing pra vender assinatura e proíbe levar o
//      usuário a outro meio de pagamento. Brasil não está na lista de billing
//      alternativo (só Índia, Coreia do Sul e EEE).
//
// ⚠️ `display-mode: standalone` NÃO SERVE, e é a armadilha óbvia aqui. Ele casa
// IGUAL na PWA instalada e no TWA — os dois abrem sem barra de endereço. É o
// que `components/pwa/InstallPwa.tsx` usa pra saber "está instalado", e é
// exatamente por isso que ele não responde ESTA pergunta.
//
// ⚠️ E O `document.referrer` SÓ EXISTE NA PRIMEIRA NAVEGAÇÃO. O Android expõe
// `android-app://<pacote>` como referrer da start_url e mais nada depois disso;
// na segunda tela ele já é a nossa própria origem. Por isso o resultado é
// PERSISTIDO — sem isso a detecção valeria por um clique só.
// ─────────────────────────────────────────────────────────────────────────────

import { PACOTE_ANDROID } from './play-store';

export type Origem = 'android' | 'web';

// ⚠️ A CHAVE MUDOU DE NOME DE PROPÓSITO (era `sora-origem`). A regra antiga
// aceitava QUALQUER app Android como referrer (ver `referrerEhDoApp`) e
// gravou "android" em navegadores que nunca abriram o app — e a marca é
// permanente. Trocar a chave descarta essas marcas erradas de uma vez; quem
// está de fato no app volta a ser marcado no próximo lançamento, pelo
// `?fonte=android` do startUrl ou pelo referrer certo.
const CHAVE = 'sora-origem-v2';
const CHAVE_ANTIGA = 'sora-origem';

/**
 * O referrer diz que a página foi aberta pelo APP DA SORA?
 *
 * ⚠️ TEM DE SER O NOSSO PACOTE, não qualquer app. O Chrome do Android marca
 * como `android-app://<pacote>/` todo link aberto a partir de um app — um
 * link da Sora tocado no WhatsApp chega com `android-app://com.whatsapp/`,
 * no Gmail com `android-app://com.google.android.gm/`. A regra antiga era
 * só `startsWith('android-app://')`, e para um produto que vive no WhatsApp
 * esse é o caminho de entrada MAIS comum: a sessão do navegador passava a
 * ser tratada como "dentro do app" para sempre — escondendo itens da barra
 * lateral, bloqueando a aba Saúde, mudando o cadastro e sumindo com o
 * convite da Play Store justamente de quem ainda não instalou.
 *
 * ⚠️ `(/|$)` e não `startsWith`: senão `com.forsora.app.qualquercoisa`
 * passaria por prefixo.
 */
export function referrerEhDoApp(referrer: string | null | undefined): boolean {
  const escapado = PACOTE_ANDROID.replace(/\./g, '\\.');
  return new RegExp(`^android-app://${escapado}(/|$)`).test(String(referrer || ''));
}

/** O parâmetro que o `startUrl` do twa-manifest.json carrega. */
export const PARAM_ANDROID = 'fonte';
export const VALOR_ANDROID = 'android';

/**
 * Lê e MEMORIZA a origem. Chamar cedo — idealmente no primeiro render do app.
 *
 * Duas fontes, porque cada uma falha de um jeito:
 *  · o parâmetro da URL sobrevive a recarregamento e é o que controlamos, mas
 *    some assim que a pessoa navega;
 *  · o referrer é dado do sistema (não dá pra forjar de fora), mas vale só na
 *    primeira navegação e é vazio no ChromeOS.
 * Uma cobre a outra, e o localStorage cobre as duas dali em diante.
 */
export function detectarOrigem(): Origem {
  if (typeof window === 'undefined') return 'web';   // SSR

  try {
    const url = new URL(window.location.href);
    const porParam = url.searchParams.get(PARAM_ANDROID) === VALOR_ANDROID;
    const porReferrer = referrerEhDoApp(document.referrer);
    // Limpa a marca da regra antiga (ver CHAVE). Barato e idempotente.
    localStorage.removeItem(CHAVE_ANTIGA);

    if (porParam || porReferrer) {
      localStorage.setItem(CHAVE, 'android');
      return 'android';
    }
    return localStorage.getItem(CHAVE) === 'android' ? 'android' : 'web';
  } catch {
    // Modo privado, storage bloqueado, URL malformada. Cair em 'web' é o lado
    // seguro: no máximo alguém no app vê o fluxo da web — que funciona — em vez
    // de alguém na web ver um app sem forma de assinar.
    return 'web';
  }
}

/** Só lê o que já foi memorizado. Não grava nada. */
export function origemMemorizada(): Origem {
  if (typeof window === 'undefined') return 'web';
  try {
    return localStorage.getItem(CHAVE) === 'android' ? 'android' : 'web';
  } catch {
    return 'web';
  }
}

export function ehAndroid(): boolean {
  return detectarOrigem() === 'android';
}

/**
 * Limpa a marca. Existe pra teste — `?fonte=web` no navegador devolve a sessão
 * ao comportamento normal sem precisar mexer no storage na mão.
 */
export function esquecerOrigem(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(CHAVE); localStorage.removeItem(CHAVE_ANTIGA); } catch { /* storage bloqueado */ }
}
