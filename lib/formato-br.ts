// =============================================================================
// Dois helpers de formato BR que o painel repetia inline — e que não podiam
// ficar sem teste.
//
// ⚠️ ESTE ARQUIVO NASCEU DE UM ERRO REAL. Escritos direto no componente, os
// dois regex foram corrompidos no caminho: `/\./g` virou `/./g` (que casa
// QUALQUER caractere e apagaria o texto inteiro, devolvendo NaN) e `/^\d{4}/`
// virou `/^d{4}/` (que nunca casa). O TypeScript aceitou os dois — são
// sintaticamente válidos — e o defeito só apareceria na mão do usuário, com o
// botão "Salvar valor" morto em todo valor de quatro dígitos.
// =============================================================================

/**
 * '1.234,56' → 1234.56
 *
 * ⚠️ O SEPARADOR DE MILHAR SAI ANTES de a vírgula virar ponto. Na ordem
 * inversa, '1.234,56' viraria '1.234.56' e o `Number` devolveria NaN.
 */
export function parseValorBR(texto: string | number | null | undefined): number {
  if (typeof texto === 'number') return texto;
  const cru = String(texto ?? '').trim();
  // ⚠️ VAZIO É NaN, NÃO ZERO. `Number('')` devolve 0, e isso faria "campo em
  // branco" ser indistinguível de "a pessoa digitou 0" — dois estados
  // diferentes, e só um deles é um valor que ela escolheu.
  if (!cru) return NaN;
  const n = Number(cru.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * 'out' a partir de 'YYYY-MM' ou 'YYYY-MM-DD'.
 *
 * ⚠️ `new Date('2026-10')` é interpretado como UTC e, à noite no Brasil, cai no
 * mês ANTERIOR — o rótulo diria "set" numa linha de outubro. O dia 15 ao
 * meio-dia fica longe das duas bordas, então nenhum fuso desloca o mês.
 */
export function nomeMesCurto(ym?: string | null): string {
  const m = String(ym || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(m)) return 'este mês';
  return new Date(`${m}-15T12:00:00`)
    .toLocaleDateString('pt-BR', { month: 'short' })
    .replace('.', '');
}
