// =============================================================================
// Casamento das MARCAS PERSONALIZADAS (logo de loja que o usuário sobe).
//
// Relato de cliente (26/09/2026): subiu a logo do "SEM PARAR", a marca ficou
// gravada, as 71 transações têm `observacao` exatamente "SEM PARAR" — e a logo
// não aparecia. ⚠️ O CASAMENTO NUNCA FOI O PROBLEMA: quem errava era a decisão
// ANTERIOR a ele, nas telas (ver `useTemMarca` no MarcasCustomContext).
//
// Vive aqui, fora do contexto React, porque é regra pura e testável — dentro
// do `.tsx` só daria pra verificar por cópia no eval, e cópia que diverge é o
// defeito que este projeto mais paga caro.
// =============================================================================

export type MarcaCustom = { id: string; termo: string; logo_url: string };

/** Mesma normalização do IconeMarca: minúsculas, sem acento, símbolo vira espaço. */
export function normalizarMarca(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * `trecho` aparece como palavra inteira dentro de `texto`.
 *
 * ⚠️ Palavra INTEIRA, não "contém": sem isso um termo curto como "gol" casaria
 * dentro de "google" e a loja do usuário roubaria o ícone de outra coisa.
 */
export function palavraInteiraMarca(texto: string, trecho: string): boolean {
  const escaped = trecho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(texto);
}

/**
 * Índice das marcas, do termo mais LONGO pro mais curto.
 *
 * ⚠️ A ordem importa: com "posto" e "posto shell" cadastrados, o mais
 * específico tem de ganhar, senão toda transação de "posto shell" pegaria a
 * logo genérica de "posto".
 */
export function indexarMarcas(marcas: MarcaCustom[]) {
  return (marcas || [])
    .map((m) => ({ logo: m.logo_url, norm: normalizarMarca(m.termo) }))
    // Termo de 1 caractere casaria em quase tudo.
    .filter((m) => m.norm.length >= 2)
    .sort((a, b) => b.norm.length - a.norm.length);
}

/** A logo da marca personalizada que casa com este texto, ou `null`. */
export function acharLogo(
  idx: ReturnType<typeof indexarMarcas>,
  nome: string,
): string | null {
  const key = normalizarMarca(nome);
  if (!key) return null;
  // Igualdade exata primeiro — é o caso mais comum e o mais seguro.
  for (const m of idx) if (m.norm === key) return m.logo;
  for (const m of idx) if (palavraInteiraMarca(key, m.norm)) return m.logo;
  return null;
}
