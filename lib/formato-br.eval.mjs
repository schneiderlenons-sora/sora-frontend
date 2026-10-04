// =============================================================================
// EVAL — parseValorBR / nomeMesCurto.
//
// ⚠️ ESTES DOIS JÁ NASCERAM QUEBRADOS UMA VEZ. Escritos inline no componente,
// `/\./g` virou `/./g` (casa qualquer caractere → NaN em todo valor) e
// `/^\d{4}/` virou `/^d{4}/` (nunca casa). O `tsc` aceitou os dois: são
// sintaticamente válidos. Só um teste de COMPORTAMENTO pega isso.
//
// Rodar: npx tsx lib/formato-br.eval.mjs
// =============================================================================
import { parseValorBR, nomeMesCurto } from './formato-br.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

console.log('-- 1. valor no formato BR --');
{
  eq(parseValorBR('169,90'), 169.9, '§1 centavos com vírgula');
  // ⚠️ O caso que a versão quebrada perdia: milhar + centavos.
  eq(parseValorBR('1.234,56'), 1234.56, '§1 MILHAR + centavos');
  eq(parseValorBR('2.051,68'), 2051.68, '§1 o valor real do relato');
  eq(parseValorBR('12.345.678,90'), 12345678.9, '§1 vários separadores de milhar');
  eq(parseValorBR('100'), 100, '§1 inteiro sem separador');
  eq(parseValorBR(' 250,00 '), 250, '§1 ignora espaços nas bordas');
  eq(parseValorBR(1234.56), 1234.56, '§1 número passa direto');
}
console.log('  ok');

console.log('-- 2. entrada invalida vira NaN, nunca um numero errado --');
{
  // O botão de salvar testa `> 0`, então NaN desabilita — que é o certo.
  for (const lixo of ['', '   ', 'abc', null, undefined]) {
    eq(Number.isNaN(parseValorBR(lixo)), true, `§2 '${lixo}' -> NaN`);
  }
  eq(parseValorBR('0') > 0, false, '§2 zero não habilita o salvar');
}
console.log('  ok');

console.log('-- 3. nome curto do mes --');
{
  eq(nomeMesCurto('2026-10'), 'out', '§3 outubro');
  eq(nomeMesCurto('2026-01'), 'jan', '§3 janeiro');
  eq(nomeMesCurto('2026-12'), 'dez', '§3 dezembro');
  eq(nomeMesCurto('2026-10-06'), 'out', '§3 aceita data inteira');
  // ⚠️ a versão quebrada caía SEMPRE aqui
  for (const lixo of ['', null, undefined, '2026', 'outubro', '2026-1']) {
    eq(nomeMesCurto(lixo), 'este mês', `§3 '${lixo}' -> fallback`);
  }
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`x ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('OK formato-br: milhar + centavos e mes curto sem deslocar o fuso');
process.exit(0);
