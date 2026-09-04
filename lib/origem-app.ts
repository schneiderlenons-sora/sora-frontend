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

export type Origem = 'android' | 'web';

const CHAVE = 'sora-origem';

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
    const porReferrer = String(document.referrer || '').startsWith('android-app://');

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
  try { localStorage.removeItem(CHAVE); } catch { /* storage bloqueado */ }
}
