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
import {
  formatarDinheiro, simboloMoeda,
  casasDaMoeda, valorDasUnidades, unidadesDoValor, textoDasUnidades,
} from './moeda.ts';

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

// ── 7. Os HOOKS que as telas usam, renderizados de verdade ─────────────────
//
// A migração trocou cada `const fmt = (v) => Intl….format(<expr>)` do módulo
// por `useDinheiro({ entrada })` dentro do componente. O que prova que ela não
// mudou nada é cada modo de `entrada` reproduzir EXATAMENTE a expressão que
// substituiu — inclusive em NaN e Infinity, onde os três divergem.
console.log('── 7. useDinheiro/useComSimbolo renderizados ──');
{
  const { createElement: h } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { MoedaBaseProvider, useDinheiro, useComSimbolo, useSimboloMoeda } = await import('./moeda-base.tsx');

  // Renderiza um componente que só chama o hook e devolve a função pra fora.
  const pegar = (moeda, usar) => {
    let f;
    const Sonda = () => { f = usar(); return null; };
    renderToStaticMarkup(moeda === undefined ? h(Sonda) : h(MoedaBaseProvider, { moeda }, h(Sonda)));
    return f;
  };

  const substituidas = [
    ['cru',          {},                                 (v) => painelHoje(v)],
    ['ouZero',       { entrada: 'ouZero' },              (v) => painelHoje(v || 0)],
    ['finitoOuZero', { entrada: 'finitoOuZero' },        (v) => painelHoje(Number.isFinite(v) ? v : 0)],
    ['viagens',      { entrada: 'ouZero', maximoCasas: 0 }, (v) => viagensHoje(v || 0)],
  ];
  for (const [nome, opts, antes] of substituidas) {
    const fBRL = pegar('BRL', () => useDinheiro(opts));
    const fSem = pegar(undefined, () => useDinheiro(opts)); // fora do provider (negócios, onboarding)
    for (const v of VALORES) {
      eq(fBRL(v), antes(v), `${nome} ${v}`);
      eq(fSem(v), antes(v), `${nome} sem provider ${v}`);
    }
  }
  // NaN continua denunciando dado quebrado no modo cru (não vira zero calado).
  eq(pegar('BRL', () => useDinheiro())(NaN).includes('NaN'), true, 'cru não esconde NaN');

  // O RatearModal trabalha em centavos: dinheiro(c / 100).
  const cent = pegar('BRL', () => useDinheiro());
  for (const c of [0, 1, 99, 12345, -250]) eq(cent(c / 100), painelHoje(c / 100), `centavos ${c}`);

  // Compacto de eixo: em BRL, idêntico ao que cravava "R$".
  const compactoAntes = (v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : v > 0 ? `R$${v}` : 'R$0';
  const compactoNovo = (v, s) => v >= 1000 ? `${s}${(v / 1000).toFixed(0)}k` : v > 0 ? `${s}${v}` : `${s}0`;
  const eixoBRL = pegar('BRL', () => useComSimbolo(compactoNovo));
  for (const v of [0, -3, 5, 999, 1000, 1499, 25000]) eq(eixoBRL(v), compactoAntes(v), `compacto ${v}`);
  eq(pegar('NOK', () => useComSimbolo(compactoNovo))(1500), 'kr2k', 'compacto em NOK');

  // Grupo em coroa: nada de "R$" em lugar nenhum.
  eq(pegar('NOK', () => useDinheiro())(20000), 'kr 20.000,00', 'hook em NOK');
  eq(pegar('USD', () => useSimboloMoeda()), 'US$', 'símbolo em USD');
  eq(pegar('lixo', () => useSimboloMoeda()), 'R$', 'moeda inválida no provider cai em BRL');
}
console.log('  ok');

// ── 8. Campo de valor digitado (Fase 2) ─────────────────────────────────────
//
// Os 12 campos do painel liam os dígitos com `parseInt(raw) / 100` e escreviam
// com `toLocaleString('pt-BR', { min: 2, max: 2 })` (a Conta fixa sem o
// máximo). Em BRL os helpers têm de dar EXATAMENTE isso — é o valor que vai
// pro banco.
console.log('── 8. campo de valor: unidades × casas da moeda ──');
{
  const digitos = [
    '0', '1', '5', '9', '10', '99', '100', '101', '199', '1000', '1999', '12345',
    '125050', '999999', '1000000', '2999990', '12345678', '99999999999', '007', '0000',
  ];
  const lerAntes = (raw) => parseInt(raw, 10) / 100;
  const textoAntes = (raw) => (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const textoFixaAntes = (c) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  for (const raw of digitos) {
    const u = parseInt(raw, 10);
    for (const m of ['BRL', undefined, null, 'USD', 'NOK', 'EUR']) {
      eq(valorDasUnidades(u, m), lerAntes(raw), `ler ${raw} em ${m}`);
      eq(textoDasUnidades(u, m), textoAntes(raw), `texto ${raw} em ${m}`);
    }
    eq(textoDasUnidades(u, 'BRL'), textoFixaAntes(u), `texto da conta fixa ${raw}`);
  }
  // Ida e volta que os campos de edição fazem: valor gravado → dígitos → valor.
  const valores = [0, 0.01, 0.1, 0.29, 1.005, 12.5, 19.99, 79.86, 1250.5, 4018.54, 12345.67, 99999.99];
  for (const v of valores) {
    eq(unidadesDoValor(v, 'BRL'), Math.round(v * 100), `unidades de ${v}`);
    eq(valorDasUnidades(unidadesDoValor(v, 'BRL'), 'BRL'), Math.round(v * 100) / 100, `ida e volta ${v}`);
  }
  // A armadilha que isto existe pra impedir: moeda sem centavos.
  eq(casasDaMoeda('BRL'), 2, 'BRL 2 casas');
  eq(casasDaMoeda('USD'), 2, 'USD 2 casas');
  eq(casasDaMoeda('NOK'), 2, 'NOK 2 casas');
  eq(casasDaMoeda('JPY'), 0, 'JPY sem casas');
  eq(casasDaMoeda('xyz'), 2, 'desconhecida cai em BRL');
  eq(valorDasUnidades(1250, 'JPY'), 1250, 'iene digitado 1250 é 1.250, não 12,50');
  eq(textoDasUnidades(1250, 'CLP'), '1.250', 'peso chileno sem vírgula');
  eq(unidadesDoValor(1250.4, 'JPY'), 1250, 'iene arredonda na unidade');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.log(`❌ ${falhas.length} falha(s):`);
  for (const f of falhas) console.log('   · ' + f);
  process.exit(1);
}
console.log('✅ formatarDinheiro: tudo passou');
