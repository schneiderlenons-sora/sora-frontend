// ─────────────────────────────────────────────────────────────────────────────
// No APP DE IPHONE a marca é "ForSora", não "Sora" (nov/2026).
//
// A Apple recusou o app pela regra 4.1(a) ("Copycats"): "Sora" é o nome do app
// de vídeo da OpenAI, e o revisor leu o nosso como associação enganosa. Na
// loja o app virou "ForSora - Controle Financeiro"; dentro dele, o site ainda
// dizia "Sora" em centenas de textos. Reescrever cada texto com uma condição
// seria mexer em ~100 arquivos e criar duas versões de tudo — então a troca é
// feita NA TELA, só quando a sessão é do app (`MarcaAppIos`).
//
// Web, Android e WhatsApp continuam "Sora". Esta função é a regra; o
// componente só a aplica nos nós de texto.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Troca a palavra "Sora" INTEIRA por "ForSora".
 * ⚠️ Palavra inteira, e só com a grafia da marca: "ForSora" (sem fronteira
 * antes do S), "SoraApp-iOS", "forsora.com" e "sora-theme" ficam como estão —
 * por isso a troca é idempotente, e o observador pode passar quantas vezes
 * quiser pelo mesmo texto.
 */
export function trocarMarca(texto: string): string {
  if (!texto || texto.indexOf('Sora') < 0 && texto.indexOf('SORA') < 0) return texto;
  return texto
    .replace(/(^|[^A-Za-zÀ-ÿ0-9_])Sora(?![A-Za-zÀ-ÿ0-9_])/g, '$1ForSora')
    .replace(/(^|[^A-Za-zÀ-ÿ0-9_])SORA(?![A-Za-zÀ-ÿ0-9_])/g, '$1FORSORA');
}
