// =============================================================================
// EVAL: lib/limite-cartao.ts — fatura paga sai do limite usado (cartão manual).
// Rodar: npm run eval:limite-cartao
// =============================================================================
const { limiteComprometido } = await import('./limite-cartao.ts');
const { competenciaAtual, cicloPorCompetencia, competenciaVizinha, dentroDoCiclo } = await import('./ciclo-fatura.ts');
const { somarFatura } = await import('./valor-fatura.ts');

const falhas = [];
let casos = 0;
const eq = (a, b, m) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };
const ok = (c, m) => { casos++; if (!c) falhas.push(m); };
const r2 = (v) => Math.round(v * 100) / 100;

// A conta ANTIGA, congelada (CartaoClient.comprometidoPorCartao antes da mudança).
const antigo = (w, txs, hoje) => {
  const inicio = cicloPorCompetencia(w, competenciaAtual(w, hoje)).ini;
  return somarFatura(txs.filter((t) => (t.data || '').slice(0, 10) >= inicio));
};

// ── 1. O caso real (cartão INTER do relato): fecha 20, vence 28, hoje 23/11.
const HOJE = '2026-11-23';
const INTER = { dia_fechamento: 20, dia_vencimento: 28 };
const g = (data, valor) => ({ tipo: 'Gasto', valor, data, transferencia: false });
const juhlyan = [
  g('2026-08-06T12:00:00', 17.92), g('2026-09-06T12:00:00', 17.92), g('2026-09-22T12:00:00', 12.28),
  g('2026-09-25T12:00:00', 98.75), g('2026-09-27T12:00:00', 43.66), g('2026-10-06T12:00:00', 17.92),
  g('2026-10-22T12:00:00', 12.28), g('2026-10-25T12:00:00', 98.75), g('2026-10-27T12:00:00', 43.66),
  g('2026-11-01T00:00:00', 1.78), g('2026-11-01T00:00:00', 3.76), g('2026-11-06T12:00:00', 17.92),
  g('2026-11-22T12:00:00', 12.28), g('2026-11-25T12:00:00', 98.75), g('2026-11-27T12:00:00', 43.66),
  g('2026-12-21T12:00:00', 50.03), g('2026-12-25T00:00:00', 98.75), g('2026-12-27T00:00:00', 43.66),
  g('2027-01-21T00:00:00', 49.99), g('2027-01-25T12:00:00', 98.75), g('2027-01-27T12:00:00', 43.66),
  g('2027-02-21T00:00:00', 49.99), g('2027-02-25T12:00:00', 98.75), g('2027-02-27T12:00:00', 43.66),
  g('2027-03-21T00:00:00', 49.99), g('2027-03-25T12:00:00', 98.75),
  g('2027-04-21T00:00:00', 49.99), g('2027-04-25T12:00:00', 98.75),
];
const pagoNov = { '2026-11': 178.15 };
eq(antigo(INTER, juhlyan, HOJE), 1207.56, '1. (o defeito) a conta antiga dava 1.207,56 com a fatura paga dentro');
eq(limiteComprometido(INTER, juhlyan, pagoNov, HOJE), { valor: 1029.41, abatido: 178.15 }, '1. a fatura de 178,15 paga sai do limite');
// Com as parcelas de dia 22/25/27 um ciclo antes (como o banco cobra), bate com o banco.
const menos1 = (iso) => { const d = new Date(iso.slice(0, 10) + 'T12:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); };
const corrigido = juhlyan.map((t) => (Number(t.data.slice(8, 10)) > 20 ? { ...t, data: menos1(t.data) } : t));
eq(limiteComprometido(INTER, corrigido, pagoNov, HOJE).valor, 874.72, '1. com as datas do banco: usado 874,72 (o número do banco)');
eq(r2(1900 - limiteComprometido(INTER, corrigido, pagoNov, HOJE).valor), 1025.28, '1. e disponível 1.025,28 (o número do banco)');

// ── 2. Sem pagamento: EXATAMENTE a conta antiga, em milhares de casos.
let sorte = 11;
const rnd = (n) => { sorte = (sorte * 1103515245 + 12345) % 2147483648; return sorte % n; };
const esc = (l) => l[rnd(l.length)];
const dia = () => { const Y = 2026 + rnd(2), M = 1 + rnd(12), D = 1 + rnd(28); return `${Y}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`; };
const txAleatoria = () => ({
  tipo: esc(['Gasto', 'Gasto', 'Gasto', 'Recebimento']),
  valor: r2(1 + rnd(90000) / 100),
  data: dia() + esc(['', 'T12:00:00', 'T00:00:00+00:00', 'T02:30:00.000Z']),
  transferencia: esc([false, false, true, null]),
  categoria: esc(['Compras', '💳 Fatura', 'Reembolso', null]),
  ignorar_em: esc([null, null, 'tudo', 'fluxo']),
});
let comparados = 0;
for (let k = 0; k < 3000; k++) {
  const w = { dia_fechamento: esc([null, 1, 5, 10, 20, 28, 30, 31]), dia_vencimento: 1 + rnd(31) };
  const txs = Array.from({ length: rnd(25) }, txAleatoria);
  const hoje = dia();
  const pagos = esc([undefined, null, {}, { '2020-01': 500 }, { lixo: 99 }, { [competenciaAtual(w, hoje)]: 0 }, { [competenciaAtual(w, hoje)]: -50 }]);
  const r = limiteComprometido(w, txs, pagos, hoje);
  comparados++;
  if (r.valor !== antigo(w, txs, hoje) || r.abatido !== 0) { eq(r, { valor: antigo(w, txs, hoje), abatido: 0 }, `2. regressão: ${JSON.stringify({ w, hoje, pagos })}`); break; }
}
ok(comparados === 3000, '2. comparou 3.000 cartões sem pagamento');

// ── 3. O pagamento abate SÓ a fatura dele.
const W = { dia_fechamento: 10, dia_vencimento: 17 };   // hoje 05/11 → atual vence 17/11 (11/10–10/11)
const H = '2026-11-05';
const tx3 = [g('2026-10-15', 300), g('2026-11-08', 100), g('2026-11-20', 200), g('2026-12-20', 50), g('2027-01-20', 50)];
eq(competenciaAtual(W, H), '2026-11', '3. (premissa) a fatura atual é a de novembro');
eq(limiteComprometido(W, tx3, null, H), { valor: 700, abatido: 0 }, '3. sem pagamento: tudo');
eq(limiteComprometido(W, tx3, { '2026-11': 150 }, H), { valor: 550, abatido: 150 }, '3. pagamento parcial abate o pago');
eq(limiteComprometido(W, tx3, { '2026-11': 400 }, H), { valor: 300, abatido: 400 }, '3. pagamento total da fatura');
eq(limiteComprometido(W, tx3, { '2026-11': 999 }, H), { valor: 300, abatido: 400 }, '3. pagar A MAIS não libera parcela de outro mês');
eq(limiteComprometido(W, tx3, { '2026-12': 200 }, H), { valor: 500, abatido: 200 }, '3. pagamento ADIANTADO da próxima fatura também abate');
eq(limiteComprometido(W, tx3, { '2026-12': 999 }, H), { valor: 500, abatido: 200 }, '3. ... limitado ao valor dela');
eq(limiteComprometido(W, tx3, { '2026-10': 500 }, H), { valor: 700, abatido: 0 }, '3. fatura ANTERIOR à atual não entra (não está na soma)');
eq(limiteComprometido(W, tx3, { '2026-11': 400, '2026-12': 200, '2027-01': 50, '2027-02': 50 }, H), { valor: 0, abatido: 700 }, '3. tudo pago: usado zero');
eq(limiteComprometido(W, tx3, { '2026-11': 400, '2026-12': 200, '2027-01': 50, '2027-02': 50 }, H).valor >= 0, true, '3. nunca negativo');

// ── 4. Crédito/estorno e "não considerar" continuam como antes dentro da fatura.
const estorno = { tipo: 'Recebimento', valor: 80, data: '2026-11-01', transferencia: true, categoria: 'Reembolso' };
const pagamentoNaLista = { tipo: 'Recebimento', valor: 400, data: '2026-11-02', transferencia: true, categoria: '💳 Fatura' };
eq(limiteComprometido(W, [...tx3, estorno], { '2026-11': 400 }, H), { valor: 300, abatido: 320 }, '4. estorno abate a fatura, e o pago só cobre o que sobrou dela');
eq(limiteComprometido(W, [...tx3, pagamentoNaLista], null, H).valor, 700, '4. a linha do pagamento da fatura não conta (é neutra)');
eq(limiteComprometido(W, [...tx3, { ...g('2026-11-03', 999), ignorar_em: 'tudo' }], { '2026-11': 400 }, H).valor, 300, '4. "não considerar em tudo" fica fora');

// ── 5. Cartão sem dia de fechamento (mês-calendário).
const SEM = { dia_fechamento: null, dia_vencimento: 10 };
const tx5 = [g('2026-11-02', 100), g('2026-11-28', 50), g('2026-12-05', 70)];
eq(competenciaAtual(SEM, '2026-11-20'), '2026-11', '5. (premissa) competência = mês');
eq(limiteComprometido(SEM, tx5, { '2026-11': 150 }, '2026-11-20'), { valor: 70, abatido: 150 }, '5. sem fechamento: abate o mês pago');

// ── 6. Propriedade: com tudo positivo, usado = soma, por fatura, do que falta pagar.
let prop = 0;
for (let k = 0; k < 1500; k++) {
  const w = { dia_fechamento: esc([3, 10, 15, 20, 25, 28, 31]), dia_vencimento: 1 + rnd(31) };
  const hoje = dia();
  const atual = competenciaAtual(w, hoje);
  const comps = [0, 1, 2, 3].map((i) => (i === 0 ? atual : competenciaVizinha(w, atual, i)));
  const txs = []; for (const c of comps) { const ci = cicloPorCompetencia(w, c); for (let j = 0; j < rnd(4); j++) txs.push(g(ci.ini, r2(1 + rnd(50000) / 100))); }
  const pagos = {}; for (const c of comps) if (rnd(2)) pagos[c] = r2(rnd(80000) / 100);
  const esperado = r2(comps.reduce((s, c) => {
    const fat = somarFatura(txs.filter((t) => dentroDoCiclo(t.data, cicloPorCompetencia(w, c))));
    return s + Math.max(0, fat - (pagos[c] || 0));
  }, 0));
  const r = limiteComprometido(w, txs, pagos, hoje).valor;
  if (Math.abs(r - esperado) > 0.011) { eq(r, esperado, `6. ${JSON.stringify({ w, hoje, pagos })}`); break; }
  prop++;
}
ok(prop === 1500, '6. propriedade conferida em 1.500 cartões');

// ── 6B. Estorno numa fatura futura não pode fazer o usado ficar NEGATIVO.
// Fatura atual 100 (paga) + estorno de 80 na seguinte: a soma bruta é 20 e o
// pago abate 100 → sem o piso daria −80.
const estornoFuturo = { tipo: 'Recebimento', valor: 80, data: '2026-11-20', transferencia: true, categoria: 'Reembolso' };
eq(limiteComprometido(W, [g('2026-11-08', 100), estornoFuturo], { '2026-11': 100 }, H), { valor: 0, abatido: 100 }, '6B. nunca abaixo de zero');

// ── 6C. Chave de competência torta é ignorada — mesmo perto de "hoje".
// (sem a checagem, 'lixo' cai no mês corrente dentro de cicloPorCompetencia)
const { hojeSP } = await import('./ciclo-fatura.ts');
const hojeReal = hojeSP();
eq(limiteComprometido(SEM, [g(hojeReal, 100)], { lixo: 50, '': 50 }).abatido, 0, '6C. chave que não é AAAA-MM não abate nada');
// Nota: a trava `comp < atual` é DEFENSIVA — a fatura anterior nem entra na
// soma (`minhas` começa na atual), então descontá-la abateria 0 de qualquer
// jeito. A mutação que a remove é equivalente.

// ── 7. Entrada torta não quebra.
eq(limiteComprometido(W, null, null, H), { valor: 0, abatido: 0 }, '7. sem lançamentos');
eq(limiteComprometido(W, [null, undefined, g(null, 10)], { '2026-11': 5 }, H), { valor: 0, abatido: 0 }, '7. linhas nulas e sem data');

if (falhas.length) {
  console.error(`\n❌ ${falhas.length} de ${casos} falharam:`);
  for (const f of falhas) console.error('  ·', f);
  process.exit(1);
}
console.log(`✅ limite do cartão: ${casos} verificações ok (3.000 de regressão + 1.500 de propriedade)`);
