// =============================================================================
// EVAL de `formatarDinheiro` — o formatador único do painel (Fase 1 da moeda
// base, docs/PLANO-MOEDA-BASE.md).
//
// O erro caro aqui é INVISÍVEL NO CÓDIGO e visível em TODA tela: 43 arquivos do
// painel trocam o formatador de uma vez. Se a saída em BRL mudar um caractere
// que seja — o espaço inquebrável virar espaço comum, o sinal de menos trocar
// de lado —, todo valor do painel muda junto. Por isso a seção 1 compara contra
// a expressão EXATA que os arquivos usam hoje, em dezenas de valores.
//
// Rodar:  npm run eval:dinheiro
// =============================================================================
import { formatarDinheiro, simboloMoeda } from './moeda.ts';

const falhas = [];
const eq = (a, b, m) => {
  if (a === b) return;
  const ver = (s) => JSON.stringify(s).replace(/ /g, '⍽');
  falhas.push(`${m}\n      esperado: ${ver(b)}\n      recebido: ${ver(a)}`);
};

// A expressão que os arquivos do painel usam HOJE, copiada como está.
const painelHoje = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const viagensHoje = (n) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

const VALORES = [
  0, -0, 1, -1, 0.01, -0.01, 0.005, 0.1, 10, 99.99, 100, 999.999,
  1250.5, -1250.5, 12345.678, -12345.678, 1000000, 1234567.89, -1234567.89,
  2 ** 31, 0.1 + 0.2, 1e-7, 987654321.12,
  NaN, Infinity, -Infinity,
];

// ── 1. BRL: IDÊNTICO ao painel de hoje ─────────────────────────────────────
console.log('── 1. em BRL, a saída é a de sempre ──');
{
  for (const v of VALORES) {
    eq(formatarDinheiro(v, 'BRL'), painelHoje(v), `BRL ${v}`);
    // Moeda ausente/lixo cai em BRL e também tem de sair igual.
    eq(formatarDinheiro(v, null), painelHoje(v), `moeda null ${v}`);
    eq(formatarDinheiro(v, undefined), painelHoje(v), `moeda undefined ${v}`);
    eq(formatarDinheiro(v, 'xyz'), painelHoje(v), `moeda desconhecida ${v}`);
  }
  // O espaço inquebrável tem de estar lá — é ele que impede "R$" de quebrar
  // de linha sozinho num card estreito.
  eq(formatarDinheiro(10, 'BRL').includes(' '), true, 'mantém o espaço inquebrável');
  eq(formatarDinheiro(-5, 'BRL').startsWith('-R$'), true, 'sinal de menos antes do símbolo');
}
console.log('  ok');

// ── 2. A variação sem centavos (Viagens) ───────────────────────────────────
console.log('── 2. maximoCasas: 0 igual ao de hoje ──');
{
  for (const v of VALORES) {
    eq(formatarDinheiro(v, 'BRL', { maximoCasas: 0 }), viagensHoje(v), `viagens ${v}`);
  }
}
console.log('  ok');

// ── 3. As moedas do MVP (USD e NOK) ────────────────────────────────────────
console.log('── 3. USD e NOK ──');
{
  // ⚠️ Grafia pt-BR com o símbolo do catálogo: moeda é do grupo, idioma é do
  // usuário. O Intl escreveria "NOK" — a Sora escreve "kr", igual no WhatsApp.
  eq(formatarDinheiro(20000, 'NOK'), 'kr 20.000,00', 'NOK 20 mil');
  eq(formatarDinheiro(-20000, 'NOK'), '-kr 20.000,00', 'NOK negativo');
  eq(formatarDinheiro(1250.5, 'USD'), 'US$ 1.250,50', 'USD');
  eq(formatarDinheiro(-0.01, 'USD'), '-US$ 0,01', 'USD negativo pequeno');
  eq(formatarDinheiro(0, 'NOK'), 'kr 0,00', 'NOK zero');

  // Nenhuma moeda do MVP pode sair com o símbolo do real.
  for (const v of VALORES.filter(Number.isFinite)) {
    eq(formatarDinheiro(v, 'USD').includes('R$'), false, `USD ${v} não pode ter R$`);
    eq(formatarDinheiro(v, 'NOK').includes('R$'), false, `NOK ${v} não pode ter R$`);
  }
}
console.log('  ok');

// ── 4. Moedas sem centavos: o Intl já sabe ─────────────────────────────────
console.log('── 4. iene e peso chileno sem centavos ──');
{
  eq(formatarDinheiro(1250, 'JPY'), '¥ 1.250', 'JPY sem casas');
  eq(formatarDinheiro(1250, 'CLP'), 'CLP$ 1.250', 'CLP sem casas');
  eq(formatarDinheiro(1250.7, 'JPY'), '¥ 1.251', 'JPY arredonda');
}
console.log('  ok');

// ── 5. Símbolos: o catálogo manda, em todas as moedas ─────────────────────
console.log('── 5. símbolo do catálogo em todas as moedas ──');
{
  const esperado = {
    BRL: 'R$', USD: 'US$', EUR: '€', GBP: '£', CHF: 'CHF', CAD: 'C$',
    AUD: 'A$', JPY: '¥', ARS: 'AR$', MXN: 'MX$', CLP: 'CLP$', NOK: 'kr',
  };
  for (const [m, s] of Object.entries(esperado)) {
    eq(simboloMoeda(m), s, `símbolo de ${m}`);
    const saida = formatarDinheiro(7, m);
    eq(saida.startsWith(s + ' '), true, `${m} começa com "${s}⍽" (veio ${JSON.stringify(saida)})`);
  }
}
console.log('  ok');

// ── 6. Cache de formatador não mistura moedas ──────────────────────────────
console.log('── 6. alternar moedas não contamina ──');
{
  const seq = ['BRL', 'NOK', 'BRL', 'USD', 'NOK', 'BRL'];
  const esperado = ['R$', 'kr', 'R$', 'US$', 'kr', 'R$'];
  seq.forEach((m, i) => eq(formatarDinheiro(1, m).startsWith(esperado[i]), true, `passo ${i} (${m})`));
  // Com e sem maximoCasas na mesma moeda: chaves de cache distintas.
  eq(formatarDinheiro(9.99, 'BRL', { maximoCasas: 0 }), viagensHoje(9.99), 'sem casas depois');
  eq(formatarDinheiro(9.99, 'BRL'), painelHoje(9.99), 'com casas depois');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.log(`❌ ${falhas.length} falha(s):`);
  for (const f of falhas) console.log('   · ' + f);
  process.exit(1);
}
console.log('✅ formatarDinheiro: tudo passou');
