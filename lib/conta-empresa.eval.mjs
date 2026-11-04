// =============================================================================
// EVAL — conta "só da empresa" fora do painel PESSOAL (nov/2026, relato do Robert)
//
// O que não pode acontecer:
//   · o saldo da conta da empresa somar no "Saldo em contas" pessoal;
//   · uma conta SEM a marca (backend antigo, leitura que falhou) sumir do saldo
//     — o lado seguro é mostrar dinheiro;
//   · a lista de Transações esconder um "não considerar" que NÃO é da empresa.
//
// Rodar: npm run eval:conta-empresa
// =============================================================================
import { contasDoPessoal, contasDaEmpresa, ehContaDaEmpresa, ehLancamentoDaEmpresa } from './conta-empresa.ts';
import { calcularSaldoProjetado } from './saldo-projetado.ts';

const falhas = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

// As contas do print do Robert (R$ 1.547,02 no "Saldo em contas").
const ws = [
  { id: 'a', nome: 'Mercado Pago (OF)', tipo: 'Corrente', saldo: 844.56, da_empresa: { conta_id: 'cn1', empresa_id: 'e1', empresa_nome: 'Vida Mais' } },
  { id: 'b', nome: 'Mercado Pago', tipo: 'Corrente', saldo: 667.69, da_empresa: null },
  { id: 'c', nome: 'Banco do Brasil', tipo: 'Corrente', saldo: 21.55, da_empresa: null },
  { id: 'd', nome: 'Itaú', tipo: 'Corrente', saldo: 7.17 },               // sem o campo (backend antigo)
  { id: 'e', nome: 'Banco do Brasil Poupança', tipo: 'Poupança', saldo: 6.05, da_empresa: null },
  { id: 'f', nome: 'Mercado Pago Crédito', tipo: 'Crédito', saldo: -2021.33, da_empresa: null },
];
const soma = (l) => Math.round(l.filter((w) => w.tipo !== 'Crédito').reduce((s, w) => s + w.saldo, 0) * 100) / 100;

console.log('§1 o saldo pessoal sai sem a conta da empresa');
eq(soma(ws), 1547.02, '§1 o número do print (com a conta da empresa)');
eq(soma(contasDoPessoal(ws)), 702.46, '§1 sem ela: só o dinheiro da pessoa');
eq(contasDaEmpresa(ws).map((w) => w.nome), ['Mercado Pago (OF)'], '§1 a da empresa é a única separada');
eq(calcularSaldoProjetado(contasDoPessoal(ws), []).saldoHoje, 702.46, '§1 a projeção parte do mesmo saldo pessoal');

console.log('§2 sem a marca, a conta é PESSOAL (nunca some dinheiro)');
eq(ehContaDaEmpresa({ nome: 'X' }), false, '§2 campo ausente');
eq(ehContaDaEmpresa({ nome: 'X', da_empresa: null }), false, '§2 campo nulo');
eq(ehContaDaEmpresa(null), false, '§2 carteira nula');
eq(contasDoPessoal(null), [], '§2 lista nula');
eq(contasDoPessoal(ws.map(({ da_empresa, ...w }) => w)).length, ws.length, '§2 backend antigo: todas seguem no saldo');

console.log('§3 só a marca "empresa" esconde lançamento');
eq(ehLancamentoDaEmpresa({ ignorar_em: 'empresa' }), true, '§3 lançamento da conta da empresa');
eq(ehLancamentoDaEmpresa({ ignorar_em: 'tudo' }), false, '§3 "não considerar" da pessoa continua visível');
eq(ehLancamentoDaEmpresa({ ignorar_em: null }), false, '§3 lançamento comum');
eq(ehLancamentoDaEmpresa(undefined), false, '§3 nulo');
const nomes = new Set(contasDaEmpresa(ws).map((w) => w.nome));
eq(ehLancamentoDaEmpresa({ ignorar_em: 'tudo', carteira_nome: 'Mercado Pago (OF)' }, nomes), true, '§3 na carteira da empresa, mesmo com outra marca');
eq(ehLancamentoDaEmpresa({ ignorar_em: null, wallet_nome: 'Mercado Pago (OF)' }, nomes), true, '§3 recém-chegado na carteira da empresa');
eq(ehLancamentoDaEmpresa({ ignorar_em: 'tudo', carteira_nome: 'Mercado Pago' }, nomes), false, '§3 conta pessoal de nome parecido não é da empresa');
eq(ehLancamentoDaEmpresa({ ignorar_em: null, carteira_nome: 'Mercado Pago (OF)' }, null), false, '§3 sem a lista de contas, só a marca decide');

if (falhas.length) {
  console.error(`\n✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('\n✓ conta da empresa fora do painel pessoal: todos os casos passaram');
