// =============================================================================
// EVAL do saldo em BRL — a regra que decide se o número do painel é dinheiro
// de verdade ou o valor estrangeiro com um "R$" na frente.
//
// POR QUE EXISTE: relato de 06/09/2026 — "na aba Dashboard o valor totalizado
// está errado, está usando o valor em moeda estrangeira como se fosse R$".
//
// O que a investigação achou foi PIOR que o relato: o TOTAL do card já
// convertia (usava `saldoBRL`), mas a lista "Saldo por conta" e a barra de
// composição logo abaixo liam `w.saldo` cru. As duas metades do MESMO card
// discordavam, e a lista não somava o total que estava em cima dela.
//
// Rodar:  npm run eval:moeda
// =============================================================================
import {
  saldoBRL, somarSaldosBRL, saldoNaBase, somarSaldosNaBase, taxaParaBase, ehEstrangeira, normalizarMoeda,
  cartaoForaDaBase, valorDoCartaoNaBase, faturaNaBase,
} from './moeda.ts';
import { fatiasDeContas, saldoPorContaDe } from '../components/dashboard/stat-visuais.tsx';

const falhas = [];
const eq = (a, b, m) => {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  falhas.push(`${m}\n      esperado: ${JSON.stringify(b)}\n      recebido: ${JSON.stringify(a)}`);
};

// ── 1. O backend mandou `saldo_brl`: é ele que vale ─────────────────────────
console.log('── 1. saldo_brl do backend ──');
{
  eq(saldoBRL({ saldo: 4090.34, moeda: 'NOK', saldo_brl: 2251 }), 2251,
    'converte pelo que o backend calculou, não pelo nativo');
  eq(saldoBRL({ saldo: 100, moeda: 'BRL', saldo_brl: 100 }), 100, 'em real, os dois são iguais');
  // ⚠️ null é CÂMBIO FORA DO AR, não zero. Zero some com o dinheiro.
  eq(saldoBRL({ saldo: 4090.34, moeda: 'NOK', saldo_brl: null }), null,
    'câmbio indisponível devolve null, nunca 0');
}
console.log('  ok');

// ── 2. ⚠️ SEM `saldo_brl` — o buraco por onde o defeito entrava ─────────────
//
// O SSR (`walletsDireto`) lê a wallet crua do Supabase e não anexa `saldo_brl`.
// O fallback antigo devolvia `saldo`, então uma conta em coroa aparecia como
// "R$ 4.090,34" na primeira pintura da tela.
console.log('── 2. sem saldo_brl ──');
{
  eq(saldoBRL({ saldo: 4090.34, moeda: 'NOK' }), null,
    'conta estrangeira sem câmbio NÃO vira R$ 4.090,34');
  eq(saldoBRL({ saldo: 1500, moeda: 'BRL' }), 1500, 'conta em real segue normal');
  // ⚠️ Payload ANTIGO (pré-144) e cache do SWR não têm `moeda`, e ali `saldo`
  //    JÁ é BRL — este caso é o que impede a correção de quebrar o comum.
  eq(saldoBRL({ saldo: 1500 }), 1500, 'sem o campo moeda, continua sendo real');
  eq(saldoBRL({ saldo: 1500, moeda: null }), 1500, 'moeda null idem');
  eq(saldoBRL({ saldo: 1500, moeda: 'XYZ' }), 1500, 'moeda desconhecida cai em real, como o backend');
}
console.log('  ok');

// ── 3. A soma se declara incompleta ─────────────────────────────────────────
console.log('── 3. soma parcial ──');
{
  const r = somarSaldosBRL([
    { saldo: 1373.34, moeda: 'BRL' },
    { saldo: 4090.34, moeda: 'NOK' },     // sem câmbio
    { saldo: 2600, moeda: 'BRL' },
  ]);
  eq(r.total, 3973.34, 'só o que dá pra converter entra');
  eq(r.semCambio, 1, 'e o que não dá é contado, pra a tela avisar');
}
console.log('  ok');

// ── 4. A LISTA E A BARRA TÊM DE FALAR A MESMA LÍNGUA QUE O TOTAL ───────────
//
// ⚠️ Este é o bloco do relato. Os números são os do print: Revolut 4.090,34 NOK
// e Coroa 1.730,00 NOK convivendo com contas em real, sob um total que já vinha
// convertido.
console.log('── 4. lista e barra × total ──');
{
  const wallets = [
    { nome: 'Cofrinho - PicPay', saldo: 7200, moeda: 'BRL', saldo_brl: 7200 },
    { nome: 'Revolut Noruega', saldo: 4090.34, moeda: 'NOK', saldo_brl: 2251 },
    { nome: 'Coroa norueguesa', saldo: 1730, moeda: 'NOK', saldo_brl: 952.05 },
  ];
  const contas = wallets.map(w => ({ nome: w.nome, saldo: saldoBRL(w) }));

  const total = somarSaldosBRL(wallets).total;
  const somaDaLista = saldoPorContaDe(contas).reduce((s, c) => s + (c.saldo ?? 0), 0);
  eq(Number(somaDaLista.toFixed(2)), Number(total.toFixed(2)),
    'a lista tem de somar exatamente o total exibido acima dela');

  // O erro antigo, escrito por extenso pra não voltar disfarçado.
  const somaCrua = wallets.reduce((s, w) => s + w.saldo, 0);
  eq(Number(somaCrua.toFixed(2)), 13020.34, 'a soma CRUA (o defeito) dava 13.020,34');
  eq(Number(total.toFixed(2)), 10403.05, 'a soma certa dá 10.403,05');

  // A barra usa as mesmas proporções — não as do valor nativo.
  const f = fatiasDeContas(contas);
  eq(f.map(x => x.nome), ['Cofrinho - PicPay', 'Revolut Noruega', 'Coroa norueguesa'],
    'ordem pela grandeza EM REAL');
  eq(Number(f[0].pct.toFixed(1)), 69.2, 'a maior fatia é 69,2% do total convertido');
}
console.log('  ok');

// ── 5. Conta sem câmbio some da barra, não da lista ─────────────────────────
//
// ⚠️ A barra é composição: sem saber a fatia, a conta não pode ocupar espaço.
// A LISTA é extrato — some de lá e o usuário perde de vista que a conta existe.
console.log('── 5. sem câmbio: fora da barra, dentro da lista ──');
{
  const contas = [
    { nome: 'PicPay', saldo: 2000 },
    { nome: 'Revolut', saldo: null },
  ];
  eq(fatiasDeContas(contas).map(f => f.nome), ['PicPay'], 'a barra ignora a sem câmbio');
  eq(fatiasDeContas(contas)[0].pct, 100, 'e as porcentagens fecham em 100 sem ela');
  eq(saldoPorContaDe(contas).map(c => c.nome), ['PicPay', 'Revolut'], 'a lista mostra as duas');
}
console.log('  ok');

// ── 6. Bordas ───────────────────────────────────────────────────────────────
console.log('── 6. bordas ──');
{
  eq(ehEstrangeira('BRL'), false, 'real não é estrangeira');
  eq(ehEstrangeira('nok'), true, 'minúscula também casa');
  eq(normalizarMoeda('  usd '), 'USD', 'apara e sobe a caixa');
  eq(saldoBRL({ saldo: null, moeda: 'BRL' }), 0, 'saldo null em real é 0');
  eq(fatiasDeContas([]), [], 'sem conta, sem barra');
  eq(fatiasDeContas([{ nome: 'a', saldo: -50 }]), [], 'só negativa não desenha barra');
}
console.log('  ok');

// ── 7. Moeda BASE do grupo (migration 168) ─────────────────────────────────
//
// As telas passaram a somar `saldoNaBase(w, base)`. Num grupo em REAL isso tem
// de dar o `saldoBRL` de antes em TODA forma de payload que o painel recebe:
// backend novo, backend antigo, cache do SWR e SSR com ou sem cotação.
console.log('── 7. saldo na moeda base ──');
{
  const formas = [
    { saldo: 1500 }, { saldo: 1500, moeda: null }, { saldo: '12.5', moeda: 'BRL' }, { saldo: null, moeda: 'BRL' },
    { saldo: 1500, moeda: 'XYZ' },
    // backend antigo / cache do SWR (sem saldo_base)
    { saldo: 4090.34, moeda: 'NOK', saldo_brl: 2255.82 }, { saldo: 4090.34, moeda: 'NOK', saldo_brl: null },
    { saldo: 4090.34, moeda: 'NOK' },                           // SSR sem cotação
    // backend novo, grupo em real
    { saldo: 1000, moeda: 'BRL', saldo_brl: 1000, moeda_base: 'BRL', saldo_base: 1000 },
    { saldo: 4090.34, moeda: 'NOK', saldo_brl: 2255.82, moeda_base: 'BRL', saldo_base: 2255.82 },
    { saldo: 4090.34, moeda: 'NOK', saldo_brl: null, moeda_base: 'BRL', saldo_base: null },
  ];
  for (const w of formas) {
    eq(saldoNaBase(w, 'BRL'), saldoBRL(w), `base real = saldoBRL: ${JSON.stringify(w)}`);
    eq(saldoNaBase(w, undefined), saldoBRL(w), `sem base = saldoBRL: ${JSON.stringify(w)}`);
  }
  eq(somarSaldosNaBase(formas, 'BRL'), somarSaldosBRL(formas), 'a soma em base real é a soma em BRL de antes');

  // Grupo em DÓLAR.
  eq(saldoNaBase({ saldo: 1000, moeda: 'USD', saldo_brl: 5143.5, moeda_base: 'USD', saldo_base: 1000 }, 'USD'), 1000,
    'grupo em dólar lê saldo_base, não saldo_brl');
  eq(saldoNaBase({ saldo: 5143.5, moeda: 'BRL', saldo_brl: 5143.5, moeda_base: 'USD', saldo_base: 1000 }, 'USD'), 1000,
    'conta em real num grupo em dólar entra convertida');
  eq(saldoNaBase({ saldo: 5143.5, moeda: 'BRL', saldo_brl: 5143.5 }, 'USD'), null,
    '⚠️ payload antigo num grupo em dólar: a conta em real NÃO entra como dólar');
  eq(saldoNaBase({ saldo: 1000, moeda: 'USD', saldo_brl: 5143.5 }, 'USD'), 1000,
    'payload antigo: a conta que já está na base entra pelo nativo');
  eq(saldoNaBase({ saldo: 1000, moeda: 'NOK', moeda_base: 'BRL', saldo_base: 551.5 }, 'USD'), null,
    '⚠️ saldo_base calculado pra OUTRA base (cache de antes de trocar) é descartado');
  eq(somarSaldosNaBase([
    { saldo: 1000, moeda: 'USD', moeda_base: 'USD', saldo_base: 1000 },
    { saldo: 7, moeda: 'CHF', moeda_base: 'USD', saldo_base: null },
  ], 'USD'), { total: 1000, semCambio: 1 }, 'sem câmbio fica de fora e é contado');
  // A taxa do "≈" em Nova transação e Conta fixa.
  for (const w of [undefined, null, {}, { taxa_brl: 0.5515 }, { taxa_brl: null }, { taxa_brl: '0.55' },
                   { taxa_brl: 0.5515, taxa_base: 0.5515, moeda_base: 'BRL' }, { taxa_brl: null, taxa_base: null, moeda_base: 'BRL' }]) {
    const antes = w?.taxa_brl;   // o que as duas telas liam: Number(w?.taxa_brl)
    const t = taxaParaBase(w, 'BRL');
    eq(Number.isFinite(Number(t)) && Number(t) > 0 ? Number(t) : null,
       Number.isFinite(Number(antes)) && Number(antes) > 0 ? Number(antes) : null, `taxa em base real = taxa_brl: ${JSON.stringify(w)}`);
  }
  eq(taxaParaBase({ taxa_brl: 0.5515, taxa_base: 0.1072, moeda_base: 'USD' }, 'USD'), 0.1072, 'grupo em dólar usa taxa_base');
  eq(taxaParaBase({ taxa_brl: 0.5515 }, 'USD'), null, '⚠️ payload antigo num grupo em dólar: sem taxa, nunca a taxa em real');
  eq([ehEstrangeira('USD', 'USD'), ehEstrangeira('BRL', 'USD'), ehEstrangeira(null, 'USD')], [false, true, true],
    'estrangeira é relativo à base (moeda nula é real)');
}
console.log('  ok');

// ── 8. Cartão numa moeda diferente da base (migration 168) ─────────────────
//
// A fatura vem NA MOEDA DO CARTÃO. Só quem soma converte. E pagar/antecipar
// trava só fora do real — a regra é a MESMA do backend (services/moeda.js).
console.log('── 8. cartão fora da moeda base ──');
{
  const TAXA = 1 / 5.1435;   // real → dólar
  const nuUSD = { moeda: 'BRL', moeda_base: 'USD', taxa_base: TAXA };

  // Grupo em REAL: nada muda, em NENHUMA forma de payload.
  for (const c of [undefined, null, {}, { moeda: 'BRL' }, { moeda: 'BRL', moeda_base: 'BRL', taxa_base: 1 }, { moeda: null }]) {
    eq(valorDoCartaoNaBase(514.35, c, 'BRL'), 514.35, `grupo em real: o valor do cartão é o mesmo — ${JSON.stringify(c)}`);
    eq(cartaoForaDaBase(c, 'BRL'), false, `grupo em real nunca trava — ${JSON.stringify(c)}`);
  }
  eq(cartaoForaDaBase({ moeda: 'USD' }, 'BRL'), false, '⚠️ nem cartão em dólar trava num grupo em real');
  const fatBRL = { cartao_id: 'c', moeda: 'BRL', moeda_base: 'BRL', taxa_base: 1, restante: 514.35 };
  eq(faturaNaBase(fatBRL, 'BRL') === fatBRL, true, 'grupo em real: faturaNaBase devolve o MESMO objeto (sem refazer memo)');
  const fatAntiga = { cartao_id: 'c', restante: 90 };
  eq(faturaNaBase(fatAntiga, 'USD') === fatAntiga, true, 'payload antigo (sem moeda) é da base: até este campo todo cartão nascia nela');

  // Grupo em DÓLAR.
  eq(valorDoCartaoNaBase(514.35, nuUSD, 'USD'), 100, '⚠️ R$ 514,35 do cartão em real viram US$ 100 na soma');
  eq(valorDoCartaoNaBase(40, { moeda: 'USD', moeda_base: 'USD', taxa_base: 1 }, 'USD'), 40, 'cartão em dólar: o próprio valor');
  eq(valorDoCartaoNaBase(514.35, { moeda: 'BRL' }, 'USD'), null, '⚠️ sem taxa: null, nunca R$ 514,35 somados como dólar');
  eq(valorDoCartaoNaBase(514.35, { moeda: 'BRL', moeda_base: 'NOK', taxa_base: 1.8 }, 'USD'), null, 'taxa calculada pra OUTRA base é descartada');
  eq([cartaoForaDaBase(nuUSD, 'USD'), cartaoForaDaBase({ moeda: 'USD' }, 'USD'), cartaoForaDaBase({}, 'USD')], [true, false, false],
    'trava só o cartão fora da base; sem a coluna `moeda` não trava às cegas');

  const fat = { cartao_id: 'c', ...nuUSD, fatura: 1028.7, pago: 514.35, restante: 514.35, total_previsto: 0,
    vencida: { competencia: '2026-08', restante: 514.35 }, proxima: null, venc: '2026-09-15', nos_previstos: true };
  const naBase = faturaNaBase(fat, 'USD');
  eq([naBase.fatura, naBase.pago, naBase.restante, naBase.total_previsto, naBase.vencida.restante, naBase.proxima, naBase.moeda, naBase.venc],
    [200, 100, 100, 0, 100, null, 'USD', '2026-09-15'], '⚠️ a fatura inteira vai pra dólar pra quem soma; datas e flags intactas');
  eq(fat.restante, 514.35, 'e o objeto original NÃO é alterado (o card do cartão segue em real)');
  eq(faturaNaBase({ ...fat, taxa_base: null }, 'USD'), null, 'sem câmbio: null — quem soma tira a fatura');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.slice(0, 10).forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ saldo em moeda estrangeira: todos os casos passaram');
