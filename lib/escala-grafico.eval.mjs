// =============================================================================
// EVAL da escala do eixo do gráfico de previstos.
//
// É a única parte do gráfico com aritmética de verdade: todo o resto é CSS. E
// errar aqui não estoura — desenha um eixo com rótulo esquisito ("53,7") ou uma
// barra que passa do topo do quadro e some.
//
// Rodar:  npm run eval:escala
// =============================================================================
import { escala, fmtEixo } from '../components/previstos/GraficoMeses.tsx';

const falhas = [];
const eq = (a, b, m) => {
  if (JSON.stringify(a) === JSON.stringify(b)) return;
  falhas.push(`${m}\n      esperado: ${JSON.stringify(b)}\n      recebido: ${JSON.stringify(a)}`);
};

// ── 1. Os três casos das telas de referência ────────────────────────────────
//
// ⚠️ São números reais, tirados das capturas que definiram o desenho. Se a
// escala mudar, é aqui que se vê antes de ir pra tela.
console.log('── 1. casos de referência ──');
{
  eq(escala(53.7).ticks, [0, 20, 40, 60], 'gasto de R$ 53,70 → 0/20/40/60');
  eq(escala(200).ticks, [0, 50, 100, 150, 200], 'receita de R$ 200 → 0/50/100/150/200');
  eq(escala(1966).ticks, [0, 500, 1000, 1500, 2000], 'patrimônio de R$ 1.966 → 0/500/…/2,0k');
}
console.log('  ok');

// ── 2. O topo NUNCA fica abaixo do maior valor ──────────────────────────────
//
// ⚠️ É o teste que importa: barra mais alta que o quadro é barra CORTADA, e o
// mês mais caro do ano vira o mais barato aos olhos.
console.log('── 2. o topo cobre o maior valor ──');
{
  let piores = 0;
  for (let v = 1; v <= 200000; v += 7) {
    const { topo } = escala(v);
    if (topo < v) { piores += 1; if (piores <= 3) falhas.push(`topo ${topo} < valor ${v}`); }
  }
  eq(piores, 0, '28.572 valores conferidos, nenhum estoura o quadro');
  console.log(`  28572 valores · ${piores} estouros`);
}
console.log('  ok');

// ── 3. O topo é sempre múltiplo do passo (senão a última linha fica solta) ──
console.log('── 3. grade fecha no topo ──');
{
  let soltos = 0;
  for (let v = 1; v <= 50000; v += 13) {
    const { topo, passo, ticks } = escala(v);
    if (Math.abs(topo / passo - Math.round(topo / passo)) > 1e-9) soltos += 1;
    if (ticks[ticks.length - 1] !== topo) soltos += 1;
    if (ticks[0] !== 0) soltos += 1;
  }
  eq(soltos, 0, 'todo eixo começa em 0 e termina no topo, em passos iguais');
}
console.log('  ok');

// ── 4. Bordas ───────────────────────────────────────────────────────────────
console.log('── 4. bordas ──');
{
  eq(escala(0).ticks, [0], 'período zerado: só a linha do chão, sem um "1" solto');
  eq(escala(-5).ticks, [0], 'valor negativo não inventa eixo');
  // ⚠️ Passo de 0,10 é redondo — a expectativa de 0,5 aqui é que estava
  //    errada. O que o eval encontrou de verdade foi no RÓTULO: os cinco
  //    saíam como "0" porque o formatador arredondava.
  eq(escala(0.4).topo, 0.4, 'centavos ganham escala de 0,10');
  eq(escala(0.4).ticks.map(fmtEixo), ['0', '0,10', '0,20', '0,30', '0,40'],
    'e os rótulos mostram a casa decimal em vez de cinco zeros');
  // ⚠️ 3 a 6 divisões: menos vira eixo sem referência, mais vira grade riscada.
  for (const v of [7, 53.7, 200, 999, 1966, 12400, 87500]) {
    const n = escala(v).ticks.length - 1;
    if (n < 3 || n > 6) falhas.push(`escala(${v}) deu ${n} divisões`);
  }
}
console.log('  ok');

// ── 5. Rótulo do eixo ───────────────────────────────────────────────────────
console.log('── 5. rótulos ──');
{
  eq(fmtEixo(0), '0', 'zero');
  eq(fmtEixo(60), '60', 'dezenas inteiras');
  eq(fmtEixo(500), '500', 'centenas inteiras');
  eq(fmtEixo(1000), '1,0k', 'mil vira k com vírgula (não ponto — é pt-BR)');
  eq(fmtEixo(1500), '1,5k', 'e mantém a casa decimal');
  eq(fmtEixo(12000), '12,0k', 'dezenas de milhar');
  eq(fmtEixo(1200000), '1,2M', 'milhão vira M');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.slice(0, 10).forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ escala do gráfico: todos os casos passaram');
