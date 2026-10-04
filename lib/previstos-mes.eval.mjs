// =============================================================================
// EVAL — o card "Previstos de <mês>": que mês mostra e em que estado está cada
// conta.
//
// Caso real (out/2026, cliente vnsposito): a recorrência ATIVA "Plano de Saúde"
// em modo `prever` tinha a transação de 2026-10 com `pago = false` — a previsão
// materializada — e o card a exibia com selo "✓ pago", num dia em que a conta
// (dia 6) nem tinha vencido. O mesmo card ignorava a navegação de mês.
//
// Rodar: node evals/previstos-mes.eval.mjs
// =============================================================================
import {
  posicaoDoMes, venceuNoMes, estadoDasOcorrencias, contaNoTotal, valorNoMes,
} from './previstos-mes.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

const HOJE_MES = '2026-10';

console.log('-- 1. onde o mes exibido esta em relacao a hoje --');
{
  eq(posicaoDoMes('2026-09', HOJE_MES), 'passado', '§1 setembro é passado');
  eq(posicaoDoMes('2026-10', HOJE_MES), 'corrente', '§1 outubro é corrente');
  eq(posicaoDoMes('2026-11', HOJE_MES), 'futuro', '§1 novembro é futuro');
  eq(posicaoDoMes('2025-12', HOJE_MES), 'passado', '§1 atravessa o ano pra trás');
  eq(posicaoDoMes('2027-01', HOJE_MES), 'futuro', '§1 e pra frente');
  // Sem mês válido o card tem de se comportar como hoje, nunca quebrar.
  for (const lixo of ['', null, undefined, 'outubro', '2026', '2026-1']) {
    eq(posicaoDoMes(lixo, HOJE_MES), 'corrente', `§1 '${lixo}' cai em corrente`);
  }
  // 'YYYY-MM-DD' tambem serve (a pagina pode passar a data inteira)
  eq(posicaoDoMes('2026-11-30', HOJE_MES), 'futuro', '§1 aceita data inteira');
}
console.log('  ok');

console.log('-- 2. "ja venceu" depende do MES, nao so do dia --');
{
  // o caso do print: dia 6, hoje e 4 de outubro -> ainda NAO venceu
  eq(venceuNoMes(6, '2026-10', HOJE_MES, 4), false, '§2 dia 6 com hoje=4 nao venceu');
  eq(venceuNoMes(2, '2026-10', HOJE_MES, 4), true, '§2 dia 2 com hoje=4 venceu');
  // ⚠️ o erro antigo: o mesmo dia 20 em JULHO ja passou faz tempo
  eq(venceuNoMes(20, '2026-07', HOJE_MES, 4), true, '§2 mes PASSADO: tudo venceu');
  eq(venceuNoMes(2, '2026-11', HOJE_MES, 4), false, '§2 mes FUTURO: nada venceu');
  eq(venceuNoMes(31, '2026-09', HOJE_MES, 4), true, '§2 passado vence ate o dia 31');
  eq(venceuNoMes(null, '2026-09', HOJE_MES, 4), false, '§2 sem dia, nao afirma');
  eq(venceuNoMes(0, '2026-09', HOJE_MES, 4), false, '§2 dia 0 nao afirma');
}
console.log('  ok');

console.log('-- 3. TRANSACAO PENDENTE NAO E PAGAMENTO (o bug do relato) --');
{
  const q = [{ recorrenciaId: 'r1', competencia: '2026-10', transacaoId: 't1', valor: 2051.68, pago: false }];
  const m = estadoDasOcorrencias('2026-10', q, []);
  eq(m.get('r1').situacao, 'lancada', '§3 pago=false -> lancada, NAO paga');
  eq(m.get('r1').valor, 2051.68, '§3 e carrega o valor REAL do lancamento');
  eq(contaNoTotal(m.get('r1')), true, '§3 lancada CONTINUA no total (ainda vai sair)');
}
{
  const q = [{ recorrenciaId: 'r1', competencia: '2026-10', transacaoId: 't1', valor: 1962.78, pago: true }];
  const m = estadoDasOcorrencias('2026-10', q, []);
  eq(m.get('r1').situacao, 'paga', '§3 pago=true -> paga');
  eq(contaNoTotal(m.get('r1')), false, '§3 paga sai do total');
}
console.log('  ok');

console.log('-- 4. backend ANTIGO (sem o campo pago) nao pode apagar o selo --');
{
  // Durante o deploy a rota pode ainda nao mandar `pago`. Antes desta mudanca
  // TODA quitacao significava paga — inverter isso tiraria o selo de quem pagou.
  for (const p of [undefined, null]) {
    const m = estadoDasOcorrencias('2026-10', [{ recorrenciaId: 'r1', competencia: '2026-10', pago: p }], []);
    eq(m.get('r1').situacao, 'paga', `§4 pago=${p} -> paga (compatibilidade)`);
  }
}
console.log('  ok');

console.log('-- 5. so a competencia PEDIDA conta --');
{
  const q = [
    { recorrenciaId: 'r1', competencia: '2026-09', pago: true },
    { recorrenciaId: 'r2', competencia: '2026-10', pago: true },
  ];
  const m = estadoDasOcorrencias('2026-10', q, []);
  eq(m.has('r1'), false, '§5 quitacao de setembro NAO entra em outubro');
  eq(m.get('r2').situacao, 'paga', '§5 a de outubro entra');
}
console.log('  ok');

console.log('-- 6. PAGA vence LANCADA e vence PULADA --');
{
  // Duas transacoes na mesma competencia: a prevista e a que o banco trouxe.
  const q = [
    { recorrenciaId: 'r1', competencia: '2026-10', valor: 100, pago: false },
    { recorrenciaId: 'r1', competencia: '2026-10', valor: 103, pago: true },
  ];
  eq(estadoDasOcorrencias('2026-10', q, []).get('r1').situacao, 'paga', '§6 paga vence, em qualquer ordem');
  eq(estadoDasOcorrencias('2026-10', [q[1], q[0]], []).get('r1').situacao, 'paga', '§6 ordem inversa idem');
}
{
  const q = [{ recorrenciaId: 'r1', competencia: '2026-10', pago: true }];
  const a = [{ recorrenciaId: 'r1', competencia: '2026-10', status: 'pulado' }];
  eq(estadoDasOcorrencias('2026-10', q, a).get('r1').situacao, 'paga', '§6 pulou e depois pagou -> paga');
}
{
  const a = [{ recorrenciaId: 'r1', competencia: '2026-10', status: 'pulado' }];
  const m = estadoDasOcorrencias('2026-10', [], a);
  eq(m.get('r1').situacao, 'pulada', '§6 pulada sem quitacao');
  eq(contaNoTotal(m.get('r1')), false, '§6 pulada sai do total');
}
console.log('  ok');

console.log('-- 7. valor ajustado a mao (a sugestao do cliente) --');
{
  const a = [{ recorrenciaId: 'r1', competencia: '2026-10', status: 'valor', novoValor: 250 }];
  const m = estadoDasOcorrencias('2026-10', [], a);
  eq(m.get('r1').situacao, 'aberta', '§7 so ajustar valor NAO quita');
  eq(valorNoMes(m.get('r1'), 191.77), 250, '§7 e o valor ajustado vence o da regra');
}
{
  // ⚠️ ajuste de valor NAO pode apagar um pagamento ja registrado
  const q = [{ recorrenciaId: 'r1', competencia: '2026-10', valor: 191.77, pago: true }];
  const a = [{ recorrenciaId: 'r1', competencia: '2026-10', status: 'valor', novoValor: 250 }];
  eq(estadoDasOcorrencias('2026-10', q, a).get('r1').situacao, 'paga', '§7 pagamento vence o ajuste');
}
console.log('  ok');

console.log('-- 8. o total do mes --');
{
  eq(valorNoMes(undefined, 169.9), 169.9, '§8 sem registro: valor da regra');
  eq(valorNoMes(undefined, 150, 4), 600, '§8 semanal multiplica as ocorrencias');
  eq(valorNoMes({ situacao: 'paga', valor: 100, transacaoId: null }, 169.9), 0, '§8 paga nao pesa');
  eq(valorNoMes({ situacao: 'pulada', valor: null, transacaoId: null }, 169.9), 0, '§8 pulada nao pesa');
  // ⚠️ o numero REAL vence a estimativa quando o lancamento ja existe
  eq(valorNoMes({ situacao: 'lancada', valor: 2051.68, transacaoId: 't1' }, 1962.78), 2051.68, '§8 lancada usa o valor real');
  // valor ausente no lancamento cai na regra, nunca em zero
  eq(valorNoMes({ situacao: 'lancada', valor: null, transacaoId: 't1' }, 1962.78), 1962.78, '§8 sem valor, usa a regra');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`x ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('OK previstos-mes: o mes exibido manda, e pendente nao e pago');
process.exit(0);
