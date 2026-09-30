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
import { indexarMarcas, indexarRenomes, acharLogo, normalizarMarca } from './marca-custom.ts';

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

console.log('── 7. o RENAME da regra não pode apagar a logo ──');
{
  // Relato do MESMO cliente (27/09/2026): "recebo um lançamento com a string
  // 'UnisuperUniao', peço pra associar com uma logo e mudar a descrição pra
  // 'Supermercado União'. O App muda a descrição e, com isso, a associação da
  // logo deixa de funcionar."
  //
  // Marcas e regras abaixo são as REAIS da conta dele.
  const idx = indexarMarcas([
    { id: '1', termo: 'UnisuperUniao', logo_url: 'LOGO_UNIAO' },
    { id: '2', termo: 'SEM PARAR',     logo_url: 'LOGO_SEMPARAR' },
    { id: '3', termo: 'BAPTISTELLA',   logo_url: 'LOGO_BAPTISTELLA' },
    { id: '4', termo: 'OBA HORTIFRUTI', logo_url: 'LOGO_OBA' },
  ]);
  const renomes = indexarRenomes([
    { termo: 'unisuperuniao', renomear_para: 'Supermercado União' },
    { termo: 'sem parar',     renomear_para: 'Sem Parar: Crédito para TAG' },
    { termo: 'baptistella',   renomear_para: 'Auto Posto Baptistella' },
    { termo: 'oba hortifruti', renomear_para: 'Oba Hortifruti' },
    // Duas regras diferentes renomeando PRO MESMO nome — caso real dele.
    { termo: 'cozinha chic atibaia', renomear_para: 'Restaurante Oasis' },
    { termo: 'oasis',                renomear_para: 'Restaurante Oasis' },
    { termo: 'mary help',     renomear_para: null }, // regra só de categoria
  ]);

  // ⚠️ O CASO DO RELATO.
  eq(acharLogo(idx, 'Supermercado União'), null,
    '⚠️ SEM os renomes a logo some — é exatamente o bug relatado');
  eq(acharLogo(idx, 'Supermercado União', renomes), 'LOGO_UNIAO',
    '⚠️ COM os renomes a logo volta pelo termo original');

  // A outra colisão medida na base.
  eq(acharLogo(idx, 'Sem Parar: Crédito para TAG', renomes), 'LOGO_SEMPARAR',
    'a segunda colisão real da base também volta');

  // ⚠️ REGRESSÃO ZERO: nas outras 24 regras dele o nome novo CONTÉM o termo,
  // então a logo já vinha pelo passo 1 e tem de continuar vindo.
  eq(acharLogo(idx, 'Auto Posto Baptistella', renomes), 'LOGO_BAPTISTELLA',
    'nome novo que contém o termo continua casando direto');
  eq(acharLogo(idx, 'Oba Hortifruti', renomes), 'LOGO_OBA', 'rename idêntico ao termo segue igual');

  // Sem renomes (grupo que não usa a feature) nada muda.
  eq(acharLogo(idx, 'SEM PARAR', renomes), 'LOGO_SEMPARAR', 'descrição crua segue casando');
  eq(acharLogo(idx, 'SEM PARAR'), 'LOGO_SEMPARAR', 'chamada sem o 3º argumento continua válida');
  eq(acharLogo(idx, 'Padaria do Zé', renomes), null, 'texto sem marca continua sem logo');

  // ⚠️ A VOLTA É POR IGUALDADE EXATA. "Supermercado" sozinho não pode herdar a
  // logo do União só por ser parte do nome renomeado.
  eq(acharLogo(idx, 'Supermercado', renomes), null,
    '⚠️ pedaço do nome renomeado NÃO puxa a logo (a volta é exata, não "contém")');
  eq(acharLogo(idx, 'Compra no Supermercado União hoje', renomes), null,
    '⚠️ nome renomeado embutido em outro texto também não puxa');

  // Duas origens pro mesmo destino: qualquer uma que tenha logo serve.
  eq(acharLogo(idx, 'Restaurante Oasis', renomes), null,
    'destino sem marca em nenhuma das origens segue sem logo');

  // Regra sem rename não entra no índice.
  eq(indexarRenomes([{ termo: 'x', renomear_para: null }]).size, 0, 'regra sem rename é ignorada');
  eq(indexarRenomes([{ termo: 'Oba Hortifruti', renomear_para: 'oba hortifruti' }]).size, 0,
    'rename que só muda a caixa não vira entrada (já casa pelo passo 1)');
  eq(indexarRenomes([]).size, 0, 'lista vazia não quebra');

  // Duas regras pro mesmo destino guardam AS DUAS origens.
  {
    const m = indexarRenomes([
      { termo: 'cozinha chic atibaia', renomear_para: 'Restaurante Oasis' },
      { termo: 'oasis', renomear_para: 'Restaurante Oasis' },
    ]);
    eq(m.get('restaurante oasis')?.length, 2, '⚠️ duas origens pro mesmo destino: guarda as duas');
  }

  // ⚠️ A DESCRIÇÃO ATUAL TEM PRECEDÊNCIA. Se o texto na tela já casa com uma
  // marca, é ela que vale — o desvio pelo nome antigo não passa na frente.
  // Aqui as DUAS casam: a atual por igualdade e a antiga também por igualdade.
  // Só a ordem decide, e ela tem de favorecer o que o usuário está lendo.
  {
    const idx2 = indexarMarcas([
      { id: '1', termo: 'UnisuperUniao', logo_url: 'LOGO_ANTIGA' },
      { id: '2', termo: 'Supermercado União', logo_url: 'LOGO_ATUAL' },
    ]);
    eq(acharLogo(idx2, 'Supermercado União', renomes), 'LOGO_ATUAL',
      '⚠️ marca que casa com o texto VISÍVEL ganha da que casa com o antigo');
  }

  // ⚠️ NA VOLTA TAMBÉM VALE PALAVRA INTEIRA. Este é o mesmo perigo que o
  // `palavraInteiraMarca` existe pra impedir, só que pela porta dos fundos:
  // se a origem fosse comparada por "contém", a marca "gol" acharia a si mesma
  // dentro de "google pagamentos" e carimbaria a logo errada num lançamento
  // que nada tem a ver com ela.
  // A marca "SKINA" é real na conta dele (o posto "Cinco Skina"). Uma regra
  // para outro estabelecimento cujo nome apenas CONTÉM essas letras não pode
  // arrastar a logo do posto.
  {
    const idxSkina = indexarMarcas([{ id: '1', termo: 'SKINA', logo_url: 'LOGO_SKINA' }]);
    const renEstetica = indexarRenomes([
      { termo: 'skinacare estetica', renomear_para: 'Tratamento de pele' },
    ]);
    eq(acharLogo(idxSkina, 'Tratamento de pele', renEstetica), null,
      '⚠️ "skina" NÃO pode casar dentro de "skinacare" na volta');
    // E a volta legítima, por palavra inteira, continua funcionando.
    const renPosto = indexarRenomes([
      { termo: 'cinco skina', renomear_para: 'Abastecimento do mês' },
    ]);
    eq(acharLogo(idxSkina, 'Abastecimento do mês', renPosto), 'LOGO_SKINA',
      '…mas "skina" como palavra inteira na origem casa normalmente');
  }
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ marca personalizada: todos os casos passaram');
