// =============================================================================
// EVAL — em que pé está a conexão de Open Finance.
//
// Relato de cliente (Thiago, 30/09/2026): "minha conta padrão na aba CONTAS não
// atualiza o valor após receber os valores". O print mostrava R$ 74,33 no card
// do Santander, um PIX de R$ 1.666,66 recebido no MESMO dia logo abaixo, e a
// linha "Saldo do banco · atualizado há 2 h".
//
// ⚠️ O CLIENTE ESTAVA CERTO E A TELA MENTIA. Medido na base naquele dia:
// **70 das 74 conexões** (todas as vivas) estavam com
// `status = 'error'` e o mesmo `ultimo_erro`:
//
//     Celcoin GET /consents/<id>/accounts → 402
//     "É necessário possuir um plano ativo para acessar este recurso."
//
// `/accounts` é a chamada que traz o `balance`. Sem ela o sync inteiro cai no
// catch — e o catch grava `status`/`ultimo_erro` SEM tocar em `ultima_sync`
// (de propósito: a data é do último sucesso). A tela lia só a data e anunciava
// frescor que não existia.
//
// Números REAIS da conta do relato, usados abaixo:
//   consentimento .... 01a04909-1c0b-709e-b4e1-4cd168a0a921
//   ultima_sync ...... 2026-09-30T13:39:09Z  (último SUCESSO)
//   status ........... error
//
// Rodar:  npm run eval:status-conexao
// =============================================================================
import { estadoConexao, podeAnunciarFrescor, STATUS_VIVO } from './status-conexao-of.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

const CONSENT = '01a04909-1c0b-709e-b4e1-4cd168a0a921';
const SYNC_OK = '2026-09-30T13:39:09.252+00:00';

// Atalho: carteira do banco, lista já carregada.
const est = (conexao, extra = {}) => estadoConexao({
  doBanco: true, pronto: true, consentId: CONSENT, conexao, ...extra,
});

// ── §1. O CASO DO RELATO ─────────────────────────────────────────────────────
// Status de erro com data de sucesso guardada: é exatamente a combinação que
// produzia "atualizado há 2 h" com o saldo congelado.
{
  const e = est({ status: 'error', ultima_sync: SYNC_OK });
  eq(e, 'falhando', '§1 conexão com status=error é "falhando"');
  eq(podeAnunciarFrescor(e), false, '§1 ⚠️ NÃO pode anunciar "atualizado há X" com sync falhando');
}

// ── §2. O CAMINHO FELIZ NÃO PODE REGREDIR ────────────────────────────────────
// Esta é a regressão mais cara: marcar de amarelo quem está funcionando faria
// a base inteira duvidar de bancos saudáveis.
for (const s of STATUS_VIVO) {
  const e = est({ status: s, ultima_sync: SYNC_OK });
  eq(e, 'ok', `§2 status vivo "${s}" é "ok"`);
  eq(podeAnunciarFrescor(e), true, `§2 status vivo "${s}" pode anunciar frescor`);
}
// 'updating' é sync EM CURSO, não falha — se virasse alerta, todo card piscaria
// amarelo durante a sincronização normal.
eq(est({ status: 'updating', ultima_sync: SYNC_OK }), 'ok', '§2 "updating" (em curso) não é falha');

// ── §3. NUNCA AFIRMAR SEM O DADO ─────────────────────────────────────────────
// Alarme falso mandaria o cliente reconectar um banco que funciona — e cada
// reconexão cria um consentimento novo que o agregador nos cobra.
eq(estadoConexao({ doBanco: true, pronto: false, consentId: CONSENT, conexao: undefined }),
   'indefinido', '§3 lista ainda não chegou → indefinido (não chama de encerrada)');
eq(estadoConexao({ doBanco: false, pronto: true, consentId: null, conexao: undefined }),
   'indefinido', '§3 conta manual → indefinido');

// ⚠️ QUEM MANDA É `of_conta_id`, NÃO o consentimento. Uma carteira manual num
// grupo que tem Open Finance pode chegar aqui com consentimento por tabela e
// uma conexão viva ao lado — sem este guarda ela sairia como "ok" e o card de
// uma conta digitada à mão anunciaria "Saldo do banco · atualizado há X",
// exatamente a promessa de frescor que este arquivo existe pra impedir.
eq(estadoConexao({ doBanco: false, pronto: true, consentId: CONSENT,
                   conexao: { status: 'updated', ultima_sync: SYNC_OK } }),
   'indefinido', '§3 carteira SEM of_conta_id nunca fala do banco, mesmo com conexão viva');
eq(estadoConexao({ doBanco: false, pronto: true, consentId: CONSENT,
                   conexao: { status: 'error', ultima_sync: SYNC_OK } }),
   'indefinido', '§3 …e também não herda o alerta de falha');
eq(estadoConexao({ doBanco: true, pronto: true, consentId: null, conexao: undefined }),
   'indefinido', '§3 trilho legado (sem of_consent_id) → indefinido');

// ⚠️ Conexão recém-criada: existe na lista, status ainda vazio. Chamar de falha
// marcaria de vermelho justamente quem acabou de conectar.
eq(est({ status: null, ultima_sync: null }), 'indefinido', '§3 conexão nova sem status → indefinido');
eq(est({ status: '', ultima_sync: null }), 'indefinido', '§3 status vazio → indefinido');

// ── §4. ENCERRADA CONTINUA SENDO ENCERRADA (caso do BTG) ─────────────────────
// A carteira aponta pra um consentimento que não está mais na lista.
eq(est(undefined), 'encerrada', '§4 consentimento fora da lista → encerrada');
eq(podeAnunciarFrescor('encerrada'), false, '§4 encerrada não anuncia frescor');

// ── §5. EXPIRADA É OUTRA COISA — E SÓ ELA PEDE RECONEXÃO ─────────────────────
// Medido na mesma base: 4 conexões em 'expired'. Ali reconectar RESOLVE; em
// 'falhando' não resolve, e mandar reconectar joga o cliente num laço caro.
{
  const e = est({ status: 'expired', ultima_sync: null });
  eq(e, 'expirada', '§5 status=expired → expirada (texto próprio, com CTA)');
  eq(podeAnunciarFrescor(e), false, '§5 expirada não anuncia frescor');
  if (e === est({ status: 'error', ultima_sync: SYNC_OK })) {
    falhas.push('§5 ⚠️ expirada e falhando não podem ser o mesmo estado — os textos diferem');
  }
}

// ── §6. STATUS DESCONHECIDO CAI NO LADO SEGURO ───────────────────────────────
// Se o backend passar a gravar um status novo, o pior que acontece é a tela
// pedir conferência. O contrário — jurar que o saldo é de agora — é o defeito
// que este arquivo existe pra impedir.
eq(est({ status: 'sei_la_o_que', ultima_sync: SYNC_OK }), 'falhando',
   '§6 status desconhecido → falhando (nunca "ok")');
eq(est({ status: 'ERROR', ultima_sync: SYNC_OK }), 'falhando', '§6 comparação ignora caixa');
eq(est({ status: 'UPDATED', ultima_sync: SYNC_OK }), 'ok', '§6 status vivo em maiúscula ainda é vivo');

// ── §7. UM ESTADO SÓ, SEMPRE ─────────────────────────────────────────────────
// A tela renderiza um texto por estado; dois verdadeiros ao mesmo tempo
// empilhariam mensagens que se contradizem — foi a queixa do cliente do BTG.
{
  const casos = [
    undefined,
    { status: 'error', ultima_sync: SYNC_OK },
    { status: 'expired', ultima_sync: null },
    { status: 'updated', ultima_sync: SYNC_OK },
    { status: null, ultima_sync: null },
  ];
  const validos = ['ok', 'encerrada', 'expirada', 'falhando', 'indefinido'];
  for (const c of casos) {
    const e = est(c);
    if (!validos.includes(e)) falhas.push(`§7 estado fora do contrato: ${e}`);
  }
}

// ── Resultado ────────────────────────────────────────────────────────────────
if (falhas.length) {
  console.error(`\n❌ ${falhas.length} falha(s):\n` + falhas.map((f) => '  - ' + f).join('\n') + '\n');
  process.exit(1);
}
console.log('✅ status-conexao-of: todos os casos passaram');
