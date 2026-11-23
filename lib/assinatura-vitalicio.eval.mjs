// =============================================================================
// EVAL: lib/assinatura-vitalicio.ts — vitalício × assinatura do Stripe.
// Rodar: npm run eval:assinatura-vitalicio
// =============================================================================
const { assinaturaDoPlano, assinaturaDefineOPlano, assinaturasAEncerrarNoVitalicio } = await import('./assinatura-vitalicio.ts');

const falhas = [];
let casos = 0;
const eq = (a, b, m) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };
const seg = (iso) => Math.floor(Date.parse(iso) / 1000);
const sub = (id, status, criada, extra = {}) => ({ id, status, criadaEm: seg(criada), addon: false, cancelaNoFim: false, ...extra });

// ── 1. O caso real que motivou: assinante Premium desde 08/07, vitalício em
// 20/08. A assinatura ANTIGA não pode mandar no plano (era ela que o sync usava
// pra regravar a validade, e a conta virava inativa quando a data passava).
const cesar = { vitalicio: true, vitalicio_em: '2026-08-20T17:21:19.104+00:00' };
const premiumAntiga = sub('sub_premium', 'active', '2026-07-08T03:12:30Z');
eq(assinaturaDefineOPlano(cesar, premiumAntiga), false, '1. assinatura de ANTES do vitalício não define o plano');
// E, ao virar vitalício, ela para de cobrar (no fim do período pago); a conexão fica.
const conexao = sub('sub_conexao', 'active', '2026-08-21T10:00:00Z', { addon: true });
eq(assinaturasAEncerrarNoVitalicio([conexao, premiumAntiga]), [{ id: 'sub_premium', como: 'no_fim' }], '1. vitalício para a assinatura de plano e mantém a da conexão');

// ── 2. A troca deliberada (vitalício → assinatura pela /planos): a assinatura
// nasce DEPOIS do vitalício e passa a mandar no plano.
const danilo = { vitalicio: true, vitalicio_em: '2026-10-17T14:20:00Z' };
eq(assinaturaDefineOPlano(danilo, sub('s1', 'active', '2026-10-18T22:29:00Z')), true, '2. assinatura de DEPOIS do vitalício define o plano');
const diozef = { vitalicio: true, vitalicio_em: '2026-11-23T14:43:33.14+00:00' };
eq(assinaturaDefineOPlano(diozef, sub('s2', 'active', '2026-11-24T09:00:00Z')), true, '2. o cliente do chamado, ao assinar o mensal, troca o vitalício');
eq(assinaturaDefineOPlano(diozef, sub('s3', 'active', '2026-11-23T14:43:33Z')), false, '2. no mesmo segundo do vitalício não conta como depois');
eq(assinaturaDefineOPlano(diozef, sub('s4', 'active', '2026-11-23T14:43:34Z')), true, '2. um segundo depois já conta');
eq(assinaturaDefineOPlano({ vitalicio: true, vitalicio_em: '2026-11-23T14:43:33.000Z' }, sub('s5', 'active', '2026-11-23T14:43:33Z')), false, '2. empate exato: na dúvida, protege o vitalício');

// ── 3. Conta que não é vitalícia: nada muda (toda assinatura define o plano).
eq(assinaturaDefineOPlano({ vitalicio: false, vitalicio_em: '2026-10-17T14:20:00Z' }, premiumAntiga), true, '3. ex-vitalício (já convertido) segue a assinatura');
eq(assinaturaDefineOPlano({ vitalicio: null }, premiumAntiga), true, '3. vitalicio nulo = não vitalício');
eq(assinaturaDefineOPlano(null, premiumAntiga), true, '3. sem conta = regra antiga');

// ── 4. Vitalício sem data confiável: na dúvida, protege o vitalício.
eq(assinaturaDefineOPlano({ vitalicio: true, vitalicio_em: null }, sub('x', 'active', '2030-01-01T00:00:00Z')), false, '4. vitalício sem data não é sobrescrito');
eq(assinaturaDefineOPlano({ vitalicio: true, vitalicio_em: 'lixo' }, sub('x', 'active', '2030-01-01T00:00:00Z')), false, '4. data inválida não é sobrescrita');

// ── 5. Qual assinatura é a do PLANO.
eq(assinaturaDoPlano([conexao, premiumAntiga])?.id, 'sub_premium', '5. ignora a conexão mesmo sendo a mais nova');
eq(assinaturaDoPlano([sub('a', 'canceled', '2026-11-01T00:00:00Z'), sub('b', 'trialing', '2026-10-01T00:00:00Z')])?.id, 'b', '5. trialing vale, cancelada não');
eq(assinaturaDoPlano([sub('a', 'past_due', '2026-11-01T00:00:00Z')]), null, '5. pagamento pendente não dá direito ao plano');
eq(assinaturaDoPlano([conexao]), null, '5. só a conexão = sem assinatura de plano');
eq(assinaturaDoPlano([]), null, '5. lista vazia');
eq(assinaturaDoPlano(null), null, '5. nulo');
eq(assinaturaDoPlano([sub('nova', 'active', '2026-11-02T00:00:00Z'), sub('velha', 'active', '2026-01-01T00:00:00Z')])?.id, 'nova', '5. a mais nova primeiro (ordem do Stripe)');

// ── 6. O que para quando a conta vira vitalícia.
eq(assinaturasAEncerrarNoVitalicio([sub('a', 'trialing', '2026-11-01T00:00:00Z')]), [{ id: 'a', como: 'no_fim' }], '6. em teste → no fim');
eq(assinaturasAEncerrarNoVitalicio([sub('a', 'past_due', '2026-11-01T00:00:00Z')]), [{ id: 'a', como: 'agora' }], '6. pagamento pendente → cancela já (o Stripe seguiria tentando cobrar)');
eq(assinaturasAEncerrarNoVitalicio([sub('a', 'unpaid', '2026-11-01T00:00:00Z')]), [{ id: 'a', como: 'agora' }], '6. não paga → cancela já');
eq(assinaturasAEncerrarNoVitalicio([sub('a', 'active', '2026-11-01T00:00:00Z', { cancelaNoFim: true })]), [], '6. já marcada pra cancelar: nada a fazer (repetir a ativação é inofensivo)');
for (const st of ['canceled', 'incomplete', 'incomplete_expired', 'paused']) {
  eq(assinaturasAEncerrarNoVitalicio([sub('a', st, '2026-11-01T00:00:00Z')]), [], `6. ${st} não é tocada`);
}
eq(assinaturasAEncerrarNoVitalicio([sub('c', 'past_due', '2026-11-01T00:00:00Z', { addon: true })]), [], '6. conexão nunca é tocada, nem pendente');
eq(assinaturasAEncerrarNoVitalicio(null), [], '6. sem assinaturas');
eq(assinaturasAEncerrarNoVitalicio([
  sub('p1', 'active', '2026-10-18T22:42:00Z'), sub('p2', 'active', '2026-10-18T22:29:00Z'), conexao, sub('p0', 'canceled', '2026-08-18T00:00:00Z'),
]), [{ id: 'p1', como: 'no_fim' }, { id: 'p2', como: 'no_fim' }], '6. duas de plano vivas: as duas param');

// ── 7. A linha do tempo do caso real, passo a passo, com a regra do sync.
// Antes: o sync aplicava QUALQUER assinatura ativa. Agora: só a que define o plano.
function syncAntigo(conta, subs) { const s = subs.find((x) => ['active', 'trialing'].includes(x.status)); return s ? 'regrava o plano' : 'nada'; }
function syncNovo(conta, subs) { const s = assinaturaDoPlano(subs); if (!s) return 'nada'; return assinaturaDefineOPlano(conta, s) ? 'regrava o plano' : 'nada'; }
eq(syncAntigo(cesar, [premiumAntiga]), 'regrava o plano', '7. (o defeito) o sync antigo regravava o vitalício com a assinatura velha');
eq(syncNovo(cesar, [premiumAntiga]), 'nada', '7. o sync novo deixa o vitalício em paz');
eq(syncNovo(diozef, [sub('nova', 'active', '2026-11-24T09:00:00Z')]), 'regrava o plano', '7. e continua ativando quem trocou de propósito');
eq(syncNovo({ vitalicio: false }, [conexao, premiumAntiga]), 'regrava o plano', '7. assinante comum: igual a antes, mesmo com a conexão na frente');

if (falhas.length) {
  console.error(`\n❌ ${falhas.length} de ${casos} falharam:`);
  for (const f of falhas) console.error('  ·', f);
  process.exit(1);
}
console.log(`✅ assinatura × vitalício: ${casos} verificações ok`);
