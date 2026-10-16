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
 * Número DIGITADO num campo do painel → number, aceitando VÍRGULA ou PONTO.
 *
 * Relato (Vander, out/2026): "por que aqui tenho de digitar com ponto, sendo
 * que nas outras partes é com vírgula?". Medido no código: cada formulário
 * convertia de um jeito, e cada jeito errava EM SILÊNCIO num dos formatos:
 *   · `parseFloat(x.replace(',', '.'))`  → "2.911,60" virava 2,911 (R$ 2,91);
 *   · "tira os pontos, vírgula vira ponto" → "2911.60" virava 291160 (×100).
 * Esta é a regra única, e nenhum dos dois formatos erra:
 *   · com vírgula E ponto, o ÚLTIMO separador é o decimal
 *     ("2.911,60" e "2,911.60" → 2911.6);
 *   · separador REPETIDO só pode ser milhar ("1.234.567" → 1234567);
 *   · um separador só é DECIMAL ("2911,60", "2911.60", "72,5") — exceto em
 *     DINHEIRO quando vêm 1 a 3 dígitos, o separador e EXATAMENTE 3 dígitos
 *     ("1.234", "12.500"): é assim que se escreve milhar no Brasil, e
 *     dinheiro não tem 3 casas decimais. "0.125" e "2911.605" seguem decimais.
 *
 * ⚠️ VAZIO OU LIXO É NaN, NUNCA ZERO: `Number('')` devolve 0, e "campo em
 * branco" não pode virar "a pessoa digitou 0". Letra no meio também é NaN —
 * recusar e pedir de novo é melhor do que adivinhar um valor de dinheiro.
 *
 * Eval: npm run eval:formato-br
 */
export function parseNumeroDigitado(
  texto: string | number | null | undefined,
  { dinheiro = true }: { dinheiro?: boolean } = {},
): number {
  if (typeof texto === 'number') return Number.isFinite(texto) ? texto : NaN;
  let s = String(texto ?? '').replace(/R\$|[\s ]/g, '');
  if (!s) return NaN;
  let negativo = false;
  if (s.startsWith('-')) { negativo = true; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return NaN;

  const ultVirgula = s.lastIndexOf(',');
  const ultPonto = s.lastIndexOf('.');
  let inteiro = s;
  let decimal = '';

  if (ultVirgula >= 0 && ultPonto >= 0) {
    // Os dois: o que vem por ÚLTIMO é o decimal; o outro, milhar.
    const sepDec = ultVirgula > ultPonto ? ',' : '.';
    const sepMil = sepDec === ',' ? '.' : ',';
    const i = s.lastIndexOf(sepDec);
    decimal = s.slice(i + 1);
    const antes = s.slice(0, i);
    if (antes.includes(sepDec) || decimal.includes(sepMil)) return NaN; // "1,2,3.4"
    const grupos = antes.split(sepMil);
    // Milhar de verdade: grupos de 3 depois do primeiro ("1.234.567,8").
    if (!grupos.slice(1).every((g) => g.length === 3)) return NaN;
    inteiro = grupos.join('');
  } else if (ultVirgula >= 0 || ultPonto >= 0) {
    const sep = ultVirgula >= 0 ? ',' : '.';
    const partes = s.split(sep);
    if (partes.length > 2) {
      // Repetido → só pode ser milhar.
      if (!partes.slice(1).every((g) => g.length === 3) || !partes[0]) return NaN;
      inteiro = partes.join('');
    } else {
      const [a, b] = partes;
      const pareceMilhar = dinheiro && b.length === 3 && a.length >= 1 && a.length <= 3 && a !== '0';
      if (pareceMilhar) inteiro = a + b;
      else { inteiro = a; decimal = b; }
    }
  }

  const n = Number(`${inteiro || '0'}.${decimal || '0'}`);
  if (!Number.isFinite(n)) return NaN;
  return negativo ? -n : n;
}

/**
 * '1.234,56' → 1234.56. Mantido pelo nome (já usado em telas), agora pela
 * regra única acima — antes "2911.60" virava 291160.
 */
export function parseValorBR(texto: string | number | null | undefined): number {
  return parseNumeroDigitado(texto, { dinheiro: true });
}

/**
 * number → texto pro campo, no formato BR ("2911,60"). `casas` fixa os
 * centavos em dinheiro; sem ela, mostra o número como está ("72,5").
 */
export function numeroParaCampo(n: number | string | null | undefined, casas?: number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (v == null || !Number.isFinite(v)) return '';
  return (casas != null ? v.toFixed(casas) : String(v)).replace('.', ',');
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
