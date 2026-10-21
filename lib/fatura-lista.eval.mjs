// eval:fatura-lista — a LISTA da fatura (lib/fatura-lista.ts).
//
// §1 regressão zero: compara `selecionarDaFatura` com uma CÓPIA CONGELADA da
//    lógica que vivia inline no DetalhesCartaoModal (com o `of_bill_id` da
//    competência = null, que é o que o modal de fato usava ao abrir).
// §2 casos de borda escritos à mão (ciclo, nome, dedup, ordem, crédito, OF).
import assert from 'node:assert/strict';
import { selecionarDaFatura, mesesDoCiclo, ehDoCartao } from './fatura-lista.ts';
import { cicloPorCompetencia, criterioDaFatura, pertenceAFatura } from './ciclo-fatura.ts';

let ok = 0;
const caso = (nome, fn) => { fn(); ok++; };

// ── CÓPIA CONGELADA (DetalhesCartaoModal, antes de 21/10/2026) ─────────────
function antigo(rs, cartao, ciclo, ehFaturaEmCurso, billDaComp) {
  const vistas = new Set();
  const todas = rs.flatMap((r) => r?.transacoes || [])
    .filter((t) => (t?.id && vistas.has(t.id) ? false : (vistas.add(t?.id), true)));
  const nomeCartao = (cartao.nome || '').trim().toLowerCase();
  const minhas = todas.filter(
    (t) => t.wallet_id === cartao.id ||
      (t.carteira_nome || '').trim().toLowerCase() === nomeCartao);
  const criterio = criterioDaFatura(minhas, cartao, ehFaturaEmCurso, ciclo, billDaComp);
  const doCartao = minhas.filter(
    (t) => pertenceAFatura(t, cartao, ciclo, ehFaturaEmCurso, criterio, billDaComp));
  doCartao.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return doCartao;
}

// ── Gerador determinístico ──────────────────────────────────────────────────
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const pad = (n) => String(n).padStart(2, '0');

function gerarCaso() {
  const cartao = {
    id: 'c1', nome: pick(['Nubank', 'Itaú Uniclass', ' nubank ']),
    dia_fechamento: pick([null, 1, 4, 5, 25, 28, 30, 31]),
    dia_vencimento: pick([5, 8, 10, 15]),
    of_bill_atual: pick([null, null, 'b-atual']),
  };
  const comp = `2026-${pad(pick([1, 2, 3, 6, 10, 11, 12]))}`;
  const ciclo = cicloPorCompetencia(cartao, comp);
  const n = Math.floor(rnd() * 25);
  const txs = [];
  for (let i = 0; i < n; i++) {
    const mes = pick([ciclo.ini.slice(0, 7), ciclo.fim.slice(0, 7), '2025-12', '2026-09']);
    const data = `${mes}-${pad(1 + Math.floor(rnd() * 28))}` + pick(['', 'T00:00:00+00:00', 'T14:22:10.123+00:00']);
    txs.push({
      id: pick([`t${i}`, `t${i}`, `t${Math.floor(i / 2)}`, undefined]),
      data, valor: Math.round(rnd() * 50000) / 100,
      tipo: pick(['Gasto', 'Gasto', 'Recebimento']),
      transferencia: pick([false, false, true]),
      carteira_nome: pick(['Nubank', 'nubank', 'Itaú Uniclass', 'Outro', ' NUBANK ']),
      wallet_id: pick([undefined, undefined, 'c1', 'c2']),
      of_bill_id: pick([null, null, 'b-atual', 'b-outra']),
      of_bill_post_date: pick([null, null, `${mes}-${pad(1 + Math.floor(rnd() * 28))}`]),
      parcela_num: pick([null, 1, 2, 3]),
    });
  }
  // Divide em 1 a 3 "respostas" (mês A, mês B, fatura aberta), com sobreposição.
  const rs = [{ transacoes: txs.filter(() => rnd() < 0.7) }, { transacoes: txs.filter(() => rnd() < 0.5) }];
  if (rnd() < 0.3) rs.push(null);
  return { cartao, ciclo, rs, ehAtual: rnd() < 0.5 };
}

// §1 — regressão zero contra a lógica antiga (billId null)
caso('§1 4.000 casos idênticos à lógica antiga do modal', () => {
  for (let i = 0; i < 4000; i++) {
    const { cartao, ciclo, rs, ehAtual } = gerarCaso();
    const velho = antigo(rs, cartao, ciclo, ehAtual, null);
    const novo = selecionarDaFatura(rs.map((r) => r?.transacoes || []), cartao, ciclo, ehAtual);
    assert.deepEqual(novo, velho, `caso ${i}`);
  }
});

// §2 — casos à mão
const cartao = { id: 'c1', nome: 'Itaú Uniclass', dia_fechamento: 5, dia_vencimento: 10 };
const nov = cicloPorCompetencia(cartao, '2026-11');

caso('§2a fatura de novembro (fecha 5, vence 10) = compras de 06/10 a 05/11', () => {
  assert.equal(nov.ini, '2026-10-06');
  assert.equal(nov.fim, '2026-11-05');
  assert.deepEqual(mesesDoCiclo(nov), ['2026-10', '2026-11']);
  const txs = [
    { id: 'a', data: '2026-10-05', carteira_nome: 'Itaú Uniclass', tipo: 'Gasto', valor: 1 }, // fatura de outubro
    { id: 'b', data: '2026-10-06', carteira_nome: 'Itaú Uniclass', tipo: 'Gasto', valor: 2 }, // 1º dia
    { id: 'c', data: '2026-11-05', carteira_nome: 'Itaú Uniclass', tipo: 'Gasto', valor: 3 }, // último dia
    { id: 'd', data: '2026-11-06', carteira_nome: 'Itaú Uniclass', tipo: 'Gasto', valor: 4 }, // fatura de dezembro
  ];
  assert.deepEqual(selecionarDaFatura([txs], cartao, nov, false).map((t) => t.id), ['c', 'b']);
});

caso('§2b só o cartão certo (nome sem caixa/espaço, ou wallet_id)', () => {
  const txs = [
    { id: 'a', data: '2026-10-10', carteira_nome: '  itaú uniclass ' },
    { id: 'b', data: '2026-10-11', carteira_nome: 'Nubank' },
    { id: 'c', data: '2026-10-12', carteira_nome: 'Nubank', wallet_id: 'c1' },
  ];
  assert.deepEqual(selecionarDaFatura([txs], cartao, nov, false).map((t) => t.id), ['c', 'a']);
  assert.equal(ehDoCartao({ carteira_nome: 'Itaú Uniclass 2' }, cartao), false);
});

caso('§2c a mesma transação vinda por duas buscas aparece UMA vez', () => {
  const t = { id: 'x', data: '2026-10-20', carteira_nome: 'Itaú Uniclass' };
  assert.equal(selecionarDaFatura([[t], [{ ...t }]], cartao, nov, false).length, 1);
});

caso('§2d crédito (estorno) entra na lista; outro cartão não', () => {
  const txs = [
    { id: 'e', data: '2026-10-20', carteira_nome: 'Itaú Uniclass', tipo: 'Recebimento', transferencia: true, valor: 40 },
    { id: 'f', data: '2026-10-20', carteira_nome: 'Outro', tipo: 'Gasto', valor: 40 },
  ];
  assert.deepEqual(selecionarDaFatura([txs], cartao, nov, false).map((t) => t.id), ['e']);
});

caso('§2e Open Finance: lançamento que o banco postou 1 dia depois do fechamento vai pra fatura seguinte', () => {
  const t = { id: 'g', data: '2026-11-05', of_bill_post_date: '2026-11-06', carteira_nome: 'Itaú Uniclass' };
  assert.equal(selecionarDaFatura([[t]], cartao, nov, false).length, 0);
  const dez = cicloPorCompetencia(cartao, '2026-12');
  assert.equal(selecionarDaFatura([[t]], cartao, dez, false).length, 1);
});

caso('§2f o of_bill_id de OUTRA fatura não tira a linha do ciclo (sem híbrido)', () => {
  const t = { id: 'h', data: '2026-10-20', of_bill_id: 'qualquer', carteira_nome: 'Itaú Uniclass' };
  assert.equal(selecionarDaFatura([[t]], cartao, nov, false).length, 1);
});

caso('§2g fatura em curso com o vínculo do banco: segue o vínculo', () => {
  const c = { ...cartao, of_bill_atual: 'b1' };
  const txs = [
    { id: 'i', data: '2026-10-20', of_bill_id: 'b1', carteira_nome: 'Itaú Uniclass' },
    { id: 'j', data: '2026-10-21', carteira_nome: 'Itaú Uniclass' },        // sem vínculo → fora
    { id: 'k', data: '2026-09-15', of_bill_id: 'b1', carteira_nome: 'Itaú Uniclass' }, // parcela antiga vinculada → dentro
  ];
  assert.deepEqual(selecionarDaFatura([txs], c, nov, true).map((t) => t.id).sort(), ['i', 'k']);
  // Fora da fatura em curso, o vínculo não vale: volta ao ciclo.
  assert.deepEqual(selecionarDaFatura([txs], c, nov, false).map((t) => t.id).sort(), ['i', 'j']);
});

caso('§2h ordem: mais nova primeiro, mesmo vindo em buscas separadas', () => {
  const a = { id: 'a', data: '2026-10-07', carteira_nome: 'Itaú Uniclass' };
  const b = { id: 'b', data: '2026-11-02', carteira_nome: 'Itaú Uniclass' };
  assert.deepEqual(selecionarDaFatura([[a], [b]], cartao, nov, false).map((t) => t.id), ['b', 'a']);
});

console.log(`eval:fatura-lista — ${ok} casos ok`);
