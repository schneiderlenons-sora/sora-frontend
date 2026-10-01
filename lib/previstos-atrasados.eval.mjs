// =============================================================================
// EVAL — previsões de meses anteriores em aberto.
//
// Pedido do cliente (Vander, cobrado em 01/10/2026 após meses sem resposta):
// "conseguir apontar que um determinado pagamento se refere a uma previsão
// NAQUELE MÊS" — e, no mesmo e-mail, "penso seriamente em parar de usar este
// recurso da previsão do mês".
//
// O Extrato Futuro começa sempre em HOJE, então a conta fixa de setembro que
// ninguém deu baixa some em 1º de outubro: não foi paga, não foi pulada, e não
// existe mais em tela nenhuma para receber o pagamento atrasado.
//
// Rodar:  npm run eval:previstos-atrasados
// =============================================================================
import { pendenciasAnteriores, totalPendente } from './previstos-atrasados.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

const HOJE = '2026-10';

// Contas fixas no formato real da conta dele (Internet, Luz, Gás…).
const INTERNET = { id: 'r1', descricao: 'Internet Residencial', tipo: 'Gasto', valor: 169.90, dia_vencimento: 25 };
const LUZ      = { id: 'r2', descricao: 'Conta de Luz', tipo: 'Gasto', valor: 320, dia_vencimento: 28, valor_variavel: true };
const SALARIO  = { id: 'r3', descricao: 'Salário', tipo: 'Recebimento', valor: 8000, dia_vencimento: 5 };

console.log('── 1. o caso do relato ──');
{
  // Nada pago, nada pulado: as três aparecem nos 3 meses anteriores.
  const r = pendenciasAnteriores({ recorrencias: [INTERNET, LUZ, SALARIO], hojeYm: HOJE });
  eq(r.length, 9, '§1 3 contas × 3 meses');
  // ⚠️ O MÊS CORRENTE NÃO ENTRA — ele já está no Extrato Futuro.
  eq(r.some((p) => p.competencia === HOJE), false, '⚠️ §1 outubro NÃO entra (já está no extrato)');
  eq(r.every((p) => p.competencia < HOJE), true, '§1 só competências anteriores');
  // Da mais antiga para a mais recente: é a ordem em que se resolve.
  eq(r[0].competencia, '2026-07', '§1 começa pela mais antiga');
  eq(r[r.length - 1].competencia, '2026-09', '§1 termina na mais recente');
  eq(r[0].mesesAtras, 3, '§1 diz quantos meses atrás');
}
console.log('  ok');

console.log('── 2. ⚠️ PAGA OU PULADA NÃO É PENDÊNCIA ──');
{
  const r = pendenciasAnteriores({
    recorrencias: [INTERNET],
    hojeYm: HOJE,
    quitacoes: [{ recorrenciaId: 'r1', competencia: '2026-09' }],
    ajustes: [{ recorrenciaId: 'r1', competencia: '2026-08', status: 'pulado' }],
  });
  eq(r.length, 1, '§2 sobra só julho');
  eq(r[0].competencia, '2026-07', '§2 …e é julho mesmo');
}
console.log('  ok');

console.log('── 3. ⚠️ ADIADA TAMBÉM SAI ──');
{
  // "movido" mudou a data: a conta passa a viver na data nova. Cobrá-la aqui
  // faria a mesma conta aparecer em dois lugares.
  const r = pendenciasAnteriores({
    recorrencias: [INTERNET],
    hojeYm: HOJE,
    ajustes: [{ recorrenciaId: 'r1', competencia: '2026-09', status: 'movido' }],
  });
  eq(r.some((p) => p.competencia === '2026-09'), false, '⚠️ §3 competência adiada não vira pendência');
  eq(r.length, 2, '§3 as outras duas ficam');

  // Status desconhecido NÃO resolve nada — na dúvida a conta continua visível.
  const outro = pendenciasAnteriores({
    recorrencias: [INTERNET], hojeYm: HOJE,
    ajustes: [{ recorrenciaId: 'r1', competencia: '2026-09', status: 'sei_la' }],
  });
  eq(outro.length, 3, '⚠️ §3 status desconhecido não some com a conta');
}
console.log('  ok');

console.log('── 4. ⚠️ CONTA QUE NÃO EXISTIA NAQUELE MÊS NÃO VIRA DÍVIDA RETROATIVA ──');
{
  // Cadastrada em setembro: não pode "dever" julho e agosto.
  const nova = { ...INTERNET, id: 'r9', data_inicio: '2026-09-10' };
  const r = pendenciasAnteriores({ recorrencias: [nova], hojeYm: HOJE });
  eq(r.length, 1, '⚠️ §4 só o mês em que já existia');
  eq(r[0].competencia, '2026-09', '§4 …e é setembro');

  // Encerrada em agosto: setembro não conta.
  const fim = { ...INTERNET, id: 'r8', data_fim: '2026-08-31' };
  const rf = pendenciasAnteriores({ recorrencias: [fim], hojeYm: HOJE });
  eq(rf.some((p) => p.competencia === '2026-09'), false, '§4 conta encerrada não gera pendência depois');
}
console.log('  ok');

console.log('── 5. frequência diferente de mensal ──');
{
  // Anual que vence em março: nenhum dos 3 meses anteriores a outubro.
  const ipva = { id: 'rA', descricao: 'IPVA', tipo: 'Gasto', valor: 1200, frequencia: 'anual', mes_vencimento: 3, dia_vencimento: 10 };
  eq(pendenciasAnteriores({ recorrencias: [ipva], hojeYm: HOJE }).length, 0,
    '§5 anual fora da janela não aparece');

  // Semanal cai VÁRIAS vezes no mês — o valor acompanha.
  const diarista = { id: 'rS', descricao: 'Diarista', tipo: 'Gasto', valor: 150, frequencia: 'semanal', dia_semana: 3 };
  const rs = pendenciasAnteriores({ recorrencias: [diarista], hojeYm: HOJE, meses: 1 });
  eq(rs.length, 1, '§5 um registro por mês');
  eq(rs[0].valor > 150, true, '⚠️ §5 semanal soma as ocorrências do mês, não uma só');
}
console.log('  ok');

console.log('── 6. bordas ──');
{
  eq(pendenciasAnteriores({ recorrencias: [], hojeYm: HOJE }).length, 0, '§6 sem contas');
  eq(pendenciasAnteriores({ recorrencias: null, hojeYm: HOJE }).length, 0, '§6 null não quebra');
  // Sem `id` não há como quitar — não adianta mostrar.
  eq(pendenciasAnteriores({ recorrencias: [{ ...INTERNET, id: undefined }], hojeYm: HOJE }).length, 0,
    '⚠️ §6 sem id não vira pendência (não haveria como dar baixa)');
  eq(pendenciasAnteriores({ recorrencias: [{ ...INTERNET, valor: 0 }], hojeYm: HOJE }).length, 0,
    '§6 valor zero fica de fora');
  // Janela configurável.
  eq(pendenciasAnteriores({ recorrencias: [INTERNET], hojeYm: HOJE, meses: 1 }).length, 1, '§6 janela de 1 mês');
  eq(pendenciasAnteriores({ recorrencias: [INTERNET], hojeYm: HOJE, meses: 6 }).length, 6, '§6 janela de 6 meses');
  // Vira o ano sem tropeçar.
  const vira = pendenciasAnteriores({ recorrencias: [INTERNET], hojeYm: '2027-01', meses: 2 });
  eq(vira.map((p) => p.competencia).join(','), '2026-11,2026-12', '§6 atravessa o ano');
}
console.log('  ok');

console.log('── 7. o total separa quem paga de quem recebe ──');
{
  const r = pendenciasAnteriores({ recorrencias: [INTERNET, SALARIO], hojeYm: HOJE, meses: 2 });
  const t = totalPendente(r);
  eq(t.quantidade, 4, '§7 duas contas × dois meses');
  eq(t.aPagar, 339.80, '§7 soma o que falta pagar');
  eq(t.aReceber, 16000, '⚠️ §7 receita vai em separado — não abate a despesa');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ previstos-atrasados: todos os casos passaram');
