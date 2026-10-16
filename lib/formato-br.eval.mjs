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
import { parseValorBR, nomeMesCurto, parseNumeroDigitado, numeroParaCampo } from './formato-br.ts';

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

console.log('-- 4. VIRGULA OU PONTO: nenhum formato grava valor errado --');
{
  const d = (t) => parseNumeroDigitado(t);                       // dinheiro
  const q = (t) => parseNumeroDigitado(t, { dinheiro: false });  // quantidade, peso, %
  // O relato (Vander): o mesmo valor nos dois formatos.
  eq(d('2911,60'), 2911.6, '§4 vírgula decimal');
  eq(d('2911.60'), 2911.6, '§4 PONTO decimal (antes ×100 = 291160)');
  eq(d('2.911,60'), 2911.6, '§4 milhar + vírgula (antes cortava em 2,911)');
  eq(d('2,911.60'), 2911.6, '§4 formato americano');
  eq(d('R$ 2.911,60'), 2911.6, '§4 com o símbolo da moeda');
  eq(d('1.234.567,89'), 1234567.89, '§4 milhar repetido + decimal');
  eq(d('1.234.567'), 1234567, '§4 milhar repetido sem decimal');
  eq(d('1,234,567'), 1234567, '§4 milhar repetido com vírgula');
  eq(d('2911.6'), 2911.6, '§4 uma casa');
  eq(d('2911,6'), 2911.6, '§4 uma casa com vírgula');
  eq(d('100'), 100, '§4 inteiro');
  eq(d('0,50'), 0.5, '§4 centavos');
  eq(d('.50'), 0.5, '§4 sem zero à esquerda');
  eq(d('-50,00'), -50, '§4 negativo');
  // ⚠️ dinheiro: 1-3 dígitos + separador + 3 dígitos = MILHAR (como se escreve no BR)
  eq(d('1.234'), 1234, '§4 "1.234" em dinheiro é milhar');
  eq(d('12.500'), 12500, '§4 "12.500" em dinheiro é milhar');
  eq(d('1,234'), 1234, '§4 "1,234" em dinheiro é milhar (simétrico)');
  // ...mas não quando não pode ser milhar
  eq(d('0.125'), 0.125, '§4 "0.125" não é milhar');
  eq(d('2911.605'), 2911.605, '§4 4 dígitos antes: não é milhar');
  // fora de dinheiro, um separador é sempre decimal
  eq(q('72,5'), 72.5, '§4 peso com vírgula');
  eq(q('72.5'), 72.5, '§4 peso com ponto');
  eq(q('0,125'), 0.125, '§4 cotas fracionadas');
  eq(q('1.234'), 1.234, '§4 quantidade: ponto é decimal');
  eq(q('12,5'), 12.5, '§4 taxa %');
  // lixo é NaN, nunca um número inventado
  for (const lixo of ['', '  ', 'abc', '12a', '1,2,3.4', '1.2.3', ',', '.', '-', null, undefined, '1.23.456,7', '1,23.4.5']) {
    eq(Number.isNaN(d(lixo)), true, `§4 '${lixo}' -> NaN`);
  }
  eq(d(2911.6), 2911.6, '§4 número passa direto');
  eq(Number.isNaN(d(NaN)), true, '§4 NaN segue NaN');
  // parseValorBR agora é a mesma regra (antes "2911.60" → 291160)
  eq(parseValorBR('2911.60'), 2911.6, '§4 parseValorBR com ponto');
}
console.log('  ok');

console.log('-- 5. numero pro campo (BR) --');
{
  eq(numeroParaCampo(2911.6, 2), '2911,60', '§5 dinheiro com 2 casas');
  eq(numeroParaCampo('2911.6', 2), '2911,60', '§5 aceita string do banco');
  eq(numeroParaCampo(72.5), '72,5', '§5 sem casas fixas');
  eq(numeroParaCampo(100, 2), '100,00', '§5 inteiro');
  eq(numeroParaCampo(null, 2), '', '§5 null vazio');
  eq(numeroParaCampo(NaN), '', '§5 NaN vazio');
  // ida e volta: o que o campo mostra, o conversor lê igual
  for (const v of [0.01, 9.9, 169.9, 2911.6, 1234567.89]) {
    eq(parseNumeroDigitado(numeroParaCampo(v, 2)), v, `§5 ida e volta ${v}`);
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
