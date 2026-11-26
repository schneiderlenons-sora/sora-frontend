// =============================================================================
// EVAL — o "vai sobrar" do SERVIDOR (sora-backend/src/services/aindaVemMes.js)
// é IGUAL ao do painel (lib/ainda-vem-mes.ts + saldo-projetado.ts)?
//
// O widget "Livre pra gastar" é alimentado pelo servidor; o painel calcula na
// tela. Se os dois divergirem, o widget e a aba Previstos mostram números
// diferentes pro mesmo mês — o defeito que a fonte única existe pra impedir.
// O PAINEL manda (nasceu primeiro e é o que o cliente vê).
//
// Compara, função a função, em milhares de casos aleatórios com semente fixa:
//   1. vezesQueAindaVem (mensal, semanal, anual, início/fim, clamp de mês)
//   2. parcelaAindaNoMes (pagamento adiantado/atrasado, data do banco)
//   3. previstosRestantesDoMes (lista inteira, sem o `ref`)
//   4. pendentesDoCaixa + calcularSaldoProjetado (o número final)
//
// Rodar:  npm run eval:ainda-vem-mes-back
// =============================================================================
import * as F from './ainda-vem-mes.ts';
import * as S from './saldo-projetado.ts';

const req = (await import('node:module')).createRequire(import.meta.url);
const B = req('../../sora-backend/src/services/aindaVemMes.js');

let semente = 20261125;
const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
const um = (l) => l[Math.floor(rnd() * l.length)];
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pad = (n) => String(n).padStart(2, '0');
const dia = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

let falhas = 0; let casos = 0;
const igual = (a, b, msg) => {
  casos += 1;
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) { falhas += 1; if (falhas <= 12) console.log(`  ✗ ${msg}\n    painel:   ${ja}\n    servidor: ${jb}`); }
};

// Datas de "agora": todo mês de 2026 e 2027, dias variados, horas que cruzam a meia-noite de SP.
const agoras = [];
for (let y = 2026; y <= 2027; y++) for (let m = 1; m <= 12; m++) for (const d of [1, 2, 14, 15, 27, 28, 29, 30, 31]) {
  for (const h of ['02:30', '15:00', '23:30']) {
    const iso = `${y}-${pad(m)}-${pad(Math.min(d, new Date(y, m, 0).getDate()))}T${h}:00Z`;
    agoras.push(new Date(iso));
  }
}

const recAleatoria = (ref) => {
  const freq = um([undefined, 'mensal', 'mensal', 'semanal', 'anual']);
  const r = {
    id: `r${int(1, 9999)}`, tipo: um(['Gasto', 'Gasto', 'Recebimento']),
    valor: um([0, 10, 99.9, 180, 1234.56]), dia_vencimento: um([0, 1, 5, 15, 28, 29, 30, 31]),
    frequencia: freq, dia_semana: freq === 'semanal' ? um([0, 1, 3, 6, null]) : null,
    mes_vencimento: freq === 'anual' ? um([1, 6, 11, 12, null]) : null,
    valor_variavel: rnd() < 0.3, modo_lancamento: um([undefined, 'lancar', 'prever', 'nao_lancar']),
    ativa: rnd() < 0.9, resolvida_no_mes: rnd() < 0.2,
    descricao: um(['Luz', null]), categoria: um(['Casa', null]),
  };
  const ym = ref.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
  const [Y, M] = ym.split('-').map(Number);
  if (rnd() < 0.3) r.data_inicio = dia(Y, M, int(1, 28));
  if (rnd() < 0.3) r.data_fim = dia(Y, M, int(1, 28));
  if (rnd() < 0.1) r.data_inicio = dia(Y, M + 1 > 12 ? 1 : M + 1, 1);
  return r;
};

const divAleatoria = (ref) => {
  const hoje = ref.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [Y, M] = hoje.split('-').map(Number);
  const d = { id: `d${int(1, 9999)}`, titulo: um(['Carro', null]), valor_parcela: um([0, 300, 729.12]),
    dia_vencimento: um([1, 5, 10, 15, 20, 28, 30, 31]), status: um(['ativa', 'ativa', 'em_atraso', 'quitada']),
    nos_previstos: um([undefined, true, false]) };
  if (rnd() < 0.5) d.ultimo_pagamento = dia(M === 1 ? Y - 1 : Y, M === 1 ? 12 : M - 1, int(1, 28));
  if (rnd() < 0.4) d.ultimo_pagamento = dia(Y, M, int(1, 28));
  if (rnd() < 0.15) d.proximo_vencimento = dia(Y, M, int(1, 28));
  if (rnd() < 0.1) d.proximo_vencimento = dia(M === 12 ? Y + 1 : Y, M === 12 ? 1 : M + 1, int(1, 28));
  return d;
};

const fatAleatoria = (ref) => {
  const hoje = ref.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [Y, M] = hoje.split('-').map(Number);
  const mm = um([M, M, M + 1, M - 1]);
  const y = mm > 12 ? Y + 1 : mm < 1 ? Y - 1 : Y;
  const m = ((mm - 1 + 12) % 12) + 1;
  return { cartao_id: `c${int(1, 99)}`, nome: um(['Nubank', null]), restante: um([0, 0.005, 120.5, 2000]),
    venc: rnd() < 0.9 ? dia(y, m, int(1, 28)) : null, nos_previstos: um([undefined, true, false]) };
};

const semRef = (l) => l.map(({ ref, ...x }) => x);

console.log('── 1. vezesQueAindaVem ──');
for (const ag of agoras) for (let k = 0; k < 6; k++) {
  const it = S.itemPrevistoDe(recAleatoria(ag));
  igual(S.vezesQueAindaVem(it, ag), B.vezesQueAindaVem(B.itemPrevistoDe(it), ag), `vezes ${JSON.stringify(it)} @ ${ag.toISOString()}`);
}

console.log('── 2. parcelaAindaNoMes ──');
for (const ag of agoras) for (let k = 0; k < 4; k++) {
  const d = divAleatoria(ag);
  igual(F.parcelaAindaNoMes(d, ag), B.parcelaAindaNoMes(d, ag), `parcela ${JSON.stringify(d)} @ ${ag.toISOString()}`);
}

console.log('── 3. previstosRestantesDoMes ──');
for (const ag of agoras) for (let k = 0; k < 3; k++) {
  const recs = Array.from({ length: int(0, 6) }, () => recAleatoria(ag));
  const divs = Array.from({ length: int(0, 3) }, () => divAleatoria(ag));
  const fats = Array.from({ length: int(0, 3) }, () => fatAleatoria(ag));
  const a = F.previstosRestantesDoMes({ recorrencias: recs, dividas: divs, faturas: fats, agora: ag });
  const b = B.previstosRestantesDoMes({ recorrencias: recs, dividas: divs, faturas: fats, agora: ag });
  igual(semRef(a), semRef(b), `restantes @ ${ag.toISOString()}`);
}

console.log('── 4. pendentes + saldo projetado (o número do widget) ──');
for (const ag of agoras) for (let k = 0; k < 3; k++) {
  const wallets = Array.from({ length: int(1, 4) }, (_, i) => ({ nome: um(['Nubank', 'Itaú', 'Dinheiro', `Conta ${i}`]), tipo: um(['Corrente', 'Crédito', 'Poupança', undefined]), saldo: um([0, 150.25, -80, 5000]) }));
  const txs = Array.from({ length: int(0, 6) }, () => ({ tipo: um(['Gasto', 'Recebimento', 'Transferência']), valor: um([10, 99.9, 300]),
    pago: rnd() < 0.5, transferencia: rnd() < 0.15, carteira_nome: um(['Nubank', 'Itaú', 'Dinheiro', ' nubank ']) }));
  const recs = Array.from({ length: int(0, 6) }, () => recAleatoria(ag));
  const divs = Array.from({ length: int(0, 3) }, () => divAleatoria(ag));
  const fats = Array.from({ length: int(0, 3) }, () => fatAleatoria(ag));

  const pa = F.pendentesDoCaixa(txs, F.nomesDeCartao(wallets));
  const pb = B.pendentesDoCaixa(txs, B.nomesDeCartao(wallets));
  igual(pa, pb, 'pendentes');
  const ra = F.previstosRestantesDoMes({ recorrencias: recs, dividas: divs, faturas: fats, agora: ag });
  const rb = B.previstosRestantesDoMes({ recorrencias: recs, dividas: divs, faturas: fats, agora: ag });
  const sa = S.calcularSaldoProjetado(wallets, F.itensDoSaldoProjetado(ra, pa), [], ag);
  const sb = B.calcularSaldoProjetado(wallets, B.itensDoSaldoProjetado(rb, pb), [], ag);
  igual(sa, sb, `saldo projetado @ ${ag.toISOString()}`);
}

console.log(`\n${casos} comparações · ${falhas ? `${falhas} DIFERENÇAS` : 'painel e servidor iguais em todas'}`);
if (falhas) process.exit(1);
