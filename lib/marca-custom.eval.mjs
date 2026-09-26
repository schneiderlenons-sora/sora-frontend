// =============================================================================
// EVAL — marca personalizada (logo de loja que o usuário sobe).
//
// Relato de cliente (José Roberto, 26/09/2026): "Subi a logo do SEM PARAR para
// que a Sora, ao identificar o nome (exatamente como aparece) pudesse
// mostrá-lo. No entanto, apesar de constar a logo no sistema e o nome estar de
// acordo com os registros importados, a logo não é mostrada."
//
// ⚠️ O CASAMENTO NUNCA FOI O PROBLEMA — e este eval prova isso com os dados
// REAIS da conta dele (71 transações com `observacao` = "SEM PARAR", marca
// cadastrada com termo "SEM PARAR"). Quem errava era a decisão ANTERIOR, nas
// telas:
//
//     iconeNome = temMarcaConhecida(desc) ? desc : nomeDaCategoria
//
// `temMarcaConhecida` só conhece o catálogo EMBUTIDO (iFood, Nike, Shopee…).
// Para uma marca do USUÁRIO ela dá `false`, o ícone recebia "Pedágio" (a
// categoria) e o `matchLogo` nunca chegava a ver a descrição. A marca
// personalizada era consultada tarde demais. O fix é `useTemMarca`, que soma
// as duas fontes — e §5 abaixo trava a regra de decisão.
//
// Rodar:  npm run eval:marca-custom
// =============================================================================
import { indexarMarcas, acharLogo, normalizarMarca } from './marca-custom.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

// As duas marcas REAIS da conta do relato.
const MARCAS = [
  { id: '1', termo: 'SEM PARAR',   logo_url: 'LOGO_SEMPARAR' },
  { id: '2', termo: 'BAPTISTELLA', logo_url: 'LOGO_BAPT' },
];
const idx = indexarMarcas(MARCAS);
const logo = (nome) => acharLogo(idx, nome);

console.log('── 1. as descrições REAIS da conta do cliente ──');
{
  // Vindas do banco, sem retoque.
  eq(logo('SEM PARAR'), 'LOGO_SEMPARAR', '⚠️ "SEM PARAR" — a descrição de 71 transações dele');
  eq(logo('SEM*PARAR*ABASTECE'), 'LOGO_SEMPARAR',
    '⚠️ "SEM*PARAR*ABASTECE" — asterisco do extrato vira espaço na normalização');
  eq(logo('AUTO P BAPTISTELLA'), 'LOGO_BAPT', 'a outra marca dele, no meio da frase');
  eq(logo('Auto Posto Baptistella'), 'LOGO_BAPT', 'caixa mista casa igual');
  eq(logo('COMPRA CARTAO DEB MC   14/09 AUTO P BAPTISTELLA'), 'LOGO_BAPT',
    'descrição longa do cartão de débito, com data no meio');
}
console.log('  ok');

console.log('── 2. o que NÃO pode casar ──');
{
  eq(logo('Pedágio'), null,
    '⚠️ a CATEGORIA não casa — era ela que a tela mandava, e é por isso que a logo sumia');
  eq(logo('PAO DE ACUCAR.2373'), null, 'outra loja não rouba a logo');
  eq(logo(''), null, 'texto vazio');
  eq(logo('sem'), null, '⚠️ "sem" sozinho não casa com "sem parar" — termo parcial não vale');
  eq(logo('parar'), null, 'nem a segunda palavra sozinha');
}
console.log('  ok');

console.log('── 3. palavra INTEIRA, nunca pedaço ──');
{
  const i2 = indexarMarcas([{ id: '9', termo: 'gol', logo_url: 'L' }]);
  eq(acharLogo(i2, 'google'), null, '⚠️ "gol" não casa dentro de "google"');
  eq(acharLogo(i2, 'passagem gol 123'), 'L', 'mas casa como palavra solta');
}
console.log('  ok');

console.log('── 4. o termo mais LONGO vence ──');
{
  const i3 = indexarMarcas([
    { id: 'a', termo: 'posto',       logo_url: 'GENERICA' },
    { id: 'b', termo: 'posto shell', logo_url: 'ESPECIFICA' },
  ]);
  eq(acharLogo(i3, 'POSTO SHELL AV PAULISTA'), 'ESPECIFICA',
    '⚠️ sem a ordenação, a logo genérica roubaria toda transação da específica');
  eq(acharLogo(i3, 'POSTO IPIRANGA'), 'GENERICA', 'e a genérica segue valendo no resto');

  // Termo de 1 caractere casaria em quase tudo — fica fora do índice.
  eq(indexarMarcas([{ id: 'c', termo: 'a', logo_url: 'X' }]).length, 0, 'termo de 1 letra é descartado');
}
console.log('  ok');

console.log('── 5. A REGRA QUE ESTAVA ERRADA: de onde sai o nome do ícone ──');
{
  // Espelha `useTemMarca` + a decisão das telas. `temMarcaConhecida` é o
  // catálogo EMBUTIDO; aqui só interessa que ele NÃO conhece as do usuário.
  const temMarcaEmbutida = (s) => /ifood|nike|shopee/i.test(s || '');

  const antes = (desc, cat) => (temMarcaEmbutida(desc) ? desc : cat);
  const agora = (desc, cat) => (temMarcaEmbutida(desc) || !!logo(desc) ? desc : cat);

  eq(antes('SEM PARAR', 'Pedágio'), 'Pedágio',
    '⚠️ COMPORTAMENTO ANTIGO: o ícone recebia a categoria e a logo nunca era procurada');
  eq(logo(antes('SEM PARAR', 'Pedágio')), null, '…e por isso não aparecia nada');

  eq(agora('SEM PARAR', 'Pedágio'), 'SEM PARAR', '⚠️ AGORA o ícone recebe a descrição');
  eq(logo(agora('SEM PARAR', 'Pedágio')), 'LOGO_SEMPARAR', '…e a logo do cliente aparece');

  // Sem marca nenhuma, a categoria continua mandando — é o que preserva o
  // emoji da categoria em 99% das linhas.
  eq(agora('PAO DE ACUCAR.2373', 'Supermercado'), 'Supermercado',
    '⚠️ sem marca, NADA muda: o ícone segue vindo da categoria');
  eq(agora('iFood *Pedido', 'Alimentação'), 'iFood *Pedido', 'marca embutida segue funcionando');
}
console.log('  ok');

console.log('── 6. normalização ──');
{
  eq(normalizarMarca('SEM*PARAR*ABASTECE'), 'sem parar abastece', 'símbolo vira espaço');
  eq(normalizarMarca('  Pedágio   '), 'pedagio', 'acento sai, espaço extra some');
  eq(normalizarMarca('Açaí & Cia'), 'acai cia', 'cedilha, til e & ');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ marca personalizada: todos os casos passaram');
