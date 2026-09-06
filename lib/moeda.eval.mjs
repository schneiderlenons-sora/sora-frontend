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
import { saldoBRL, somarSaldosBRL, ehEstrangeira, normalizarMoeda } from './moeda.ts';
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

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.slice(0, 10).forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ saldo em moeda estrangeira: todos os casos passaram');
