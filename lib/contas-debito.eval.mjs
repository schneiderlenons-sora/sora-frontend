// =============================================================================
// EVAL: quais contas aparecem no seletor "Conta de pagamento".
//
// ⚠️ ESTE EVAL NASCEU DE UM BUG QUE FUI EU QUE ESCREVI, e que chegou ao cliente
// como "ainda não está funcionando". O campo lia `resposta.wallets` e a API
// devolve um **ARRAY**: `undefined → []`, e o seletor ficava com a opção "—" e
// nada mais. Para TODOS os usuários.
//
// Medido na base em 08/10/2026: **1 de 170 dívidas ativas** tinha conta
// vinculada — e essa única veio pelo OUTRO caminho (tocar na linha do Extrato).
// O campo nasceu morto.
//
// A lista vazia é o modo de falha caro aqui: o campo PARECE pronto, abre, tem
// borda, tem rótulo — só não tem o que escolher. Nada quebra, nada loga.
//
// Rodar:  npm run eval:contas-debito
// =============================================================================
import { contasQuePagam } from './contas-debito.ts';

const falhas = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };
const ok = (c, m) => { if (!c) falhas.push(m); };

const NU   = { id: 'w1', nome: 'Nubank',      tipo: 'Corrente' };
const INTER= { id: 'w2', nome: 'Inter PF',    tipo: 'Poupança' };
const CARD = { id: 'w3', nome: 'Nubank Cred', tipo: 'Crédito' };
const VELHA= { id: 'w4', nome: 'Antiga',      tipo: 'Corrente', arquivada: true };

console.log('-- 1. o formato REAL da API: um array --');
{
  // É isto que `api.wallets.listar` devolve hoje (`req<any[]>`, e o backend
  // faz `res.json(await comSaldoNaBase(data, ...))`).
  const r = contasQuePagam([NU, INTER, CARD]);
  eq(r.map((c) => c.nome), ['Nubank', 'Inter PF'], '1 array direto');
  ok(r.length > 0, '1 A LISTA NAO PODE SAIR VAZIA — era o bug');
}
console.log('  ok');

console.log('-- 2. o formato que o codigo ERRADO esperava --');
{
  // ⚠️ Aceito de propósito. Várias rotas desta API embrulham (`{ faturas }`,
  // `{ dividas }`), então o dia em que esta mudar o seletor não volta a
  // esvaziar EM SILÊNCIO.
  const r = contasQuePagam({ wallets: [NU, CARD] });
  eq(r.map((c) => c.nome), ['Nubank'], '2 objeto embrulhado tambem vale');
}
console.log('  ok');

console.log('-- 3. cartao de credito NAO paga parcela --');
{
  // Ele GERA a fatura; quem paga é uma conta de débito. Deixá-lo na lista
  // ofereceria vincular a parcela ao próprio cartão.
  eq(contasQuePagam([CARD]).length, 0, '3 so cartao -> lista vazia');
  eq(contasQuePagam([NU, CARD, INTER]).map((c) => c.id), ['w1', 'w2'], '3 filtra o cartao');
}
console.log('  ok');

console.log('-- 4. conta ARQUIVADA nao recebe vinculo novo --');
{
  eq(contasQuePagam([NU, VELHA]).map((c) => c.id), ['w1'], '4 arquivada fora');
}
console.log('  ok');

console.log('-- 5. entradas degeneradas devolvem lista, nunca estouram --');
{
  // O seletor renderiza `.map()` em cima disto. `undefined` quebraria a tela
  // inteira do modal, não só o campo.
  for (const lixo of [null, undefined, {}, { wallets: null }, { wallets: 'x' }, 0, '', 'texto', NaN]) {
    const r = contasQuePagam(lixo);
    ok(Array.isArray(r), `5 ${JSON.stringify(lixo)} devia dar array`);
    eq(r.length, 0, `5 ${JSON.stringify(lixo)} -> vazio`);
  }
  // Item quebrado no meio da lista não derruba os bons.
  eq(contasQuePagam([null, NU, undefined, 'x', INTER]).map((c) => c.id), ['w1', 'w2'], '5 pula item invalido');
  // Sem id não dá pra vincular (o value do <option> seria vazio).
  eq(contasQuePagam([{ nome: 'Sem id', tipo: 'Corrente' }]).length, 0, '5 sem id fora');
}
console.log('  ok');

console.log('-- 6. tipo ausente CONTA como debito --');
{
  // ⚠️ A guarda é contra 'Crédito', não a favor de uma lista de tipos. Conta
  // vinda do Open Finance pode chegar com `tipo` null, e excluí-la deixaria
  // justamente quem conectou o banco sem opção nenhuma.
  eq(contasQuePagam([{ id: 'w9', nome: 'Banco' }]).map((c) => c.nome), ['Banco'], '6 sem tipo entra');
  eq(contasQuePagam([{ id: 'w9', nome: 'Banco', tipo: null }]).length, 1, '6 tipo null entra');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`x ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  .', f));
  process.exit(1);
}
console.log('OK contas-debito: o seletor recebe as contas, nos dois formatos, e nunca sai vazio por engano');
process.exit(0);
