// =============================================================================
// EVAL: ordem e situação dos chamados no painel admin.
//
// Pedido do dono (nov/2026): abertos primeiro, finalizado vai pro FIM, e saber
// quando o cliente respondeu. O que este eval trava:
//   1. situação sai da CONVERSA (cliente falou por último = precisa de você);
//   2. resolvido vai sempre pro fim, mesmo sendo o mais recente;
//   3. resposta NÃO LIDA do cliente fura a fila dos que precisam de resposta;
//   4. dentro de "precisa de resposta", o que espera há mais tempo vem antes;
//   5. melhoria sem resposta não acende o contador (sugestão não espera retorno).
//
// Rodar:  npm run eval:chamados-admin
// =============================================================================
import { situacaoDoChamado, ordenarChamados } from './chamados-admin.ts';

const falhas = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

const ch = (id, status, created_at, tipo = 'problema') => ({ id, status, tipo, created_at });
const msg = (autor, created_at, lida_em = null) => ({ autor, created_at, lida_em });

console.log('── 1. situação pela conversa ──');
eq(situacaoDoChamado(ch('a', 'aberto', '2026-11-01'), []).situacao, 'precisa_resposta', 'novo sem resposta precisa de você');
eq(situacaoDoChamado(ch('a', 'em_andamento', '2026-11-01'), [msg('suporte', '2026-11-02')]).situacao, 'aguardando_cliente', 'você respondeu por último → aguardando o cliente');
const voltou = situacaoDoChamado(ch('a', 'em_andamento', '2026-11-01'), [msg('suporte', '2026-11-02'), msg('usuario', '2026-11-03')]);
eq(voltou.situacao, 'precisa_resposta', 'cliente respondeu depois de você → precisa de você (mesmo "em andamento")');
eq(voltou.nao_lidas, 1, 'a resposta do cliente conta como não lida');
eq(voltou.ultima_atividade, '2026-11-03', 'última atividade é a resposta do cliente');
const lida = situacaoDoChamado(ch('a', 'em_andamento', '2026-11-01'), [msg('suporte', '2026-11-02'), msg('usuario', '2026-11-03', '2026-11-03T10:00')]);
eq([lida.situacao, lida.nao_lidas], ['precisa_resposta', 0], 'lida, mas o cliente falou por último: ainda precisa de você, sem selo de nova');
eq(situacaoDoChamado(ch('a', 'resolvido', '2026-11-01'), [msg('usuario', '2026-11-03')]).situacao, 'resolvido', 'resolvido é resolvido, diga a conversa o que disser');

console.log('── 2. melhoria ──');
eq(situacaoDoChamado(ch('m', 'aberto', '2026-11-01', 'melhoria'), []).situacao, 'aguardando_cliente', 'melhoria sem resposta não acende o contador');
eq(situacaoDoChamado(ch('m', 'aberto', '2026-11-01', 'melhoria'), [msg('suporte', '2026-11-02'), msg('usuario', '2026-11-04')]).situacao, 'precisa_resposta', 'mas se o cliente responder numa melhoria, acende');

console.log('── 3. ordem ──');
const lista = [
  situacaoDoChamado(ch('resolvido-novo', 'resolvido', '2026-11-09'), []),
  situacaoDoChamado(ch('aguardando', 'em_andamento', '2026-11-01'), [msg('suporte', '2026-11-05')]),
  situacaoDoChamado(ch('novo-recente', 'aberto', '2026-11-08'), []),
  situacaoDoChamado(ch('novo-antigo', 'aberto', '2026-10-02'), []),
  situacaoDoChamado(ch('respondeu', 'em_andamento', '2026-10-20'), [msg('suporte', '2026-10-21'), msg('usuario', '2026-11-09')]),
  situacaoDoChamado(ch('resolvido-velho', 'resolvido', '2026-09-01'), []),
  situacaoDoChamado(ch('aguardando-recente', 'em_andamento', '2026-11-02'), [msg('suporte', '2026-11-07')]),
];
eq(ordenarChamados(lista).map((c) => c.id), [
  'respondeu',          // resposta não lida fura a fila
  'novo-antigo',        // depois, quem espera há mais tempo
  'novo-recente',
  'aguardando-recente', // aguardando: o mais recente primeiro
  'aguardando',
  'resolvido-novo',     // resolvidos no FIM, do mais novo pro mais velho
  'resolvido-velho',
], 'ordem completa');
eq(ordenarChamados([lista[0], lista[2]]).map((c) => c.id), ['novo-recente', 'resolvido-novo'], 'resolvido mais recente ainda fica atrás de um aberto');

if (falhas.length) { console.log(`\n✗ ${falhas.length} falha(s):\n  - ` + falhas.join('\n  - ')); process.exit(1); }
console.log('\n✓ chamados-admin: todos os casos passaram');
