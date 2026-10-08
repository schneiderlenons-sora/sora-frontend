// =============================================================================
// EVAL: as cores de tema sobrevivem aos DOIS temas.
//
// `--primary` é UMA variável só, e o `globals.css` a declara igual em `:root`
// e em `.dark`. Os fundos, porém, são opostos: **#F5F6F8** no claro e
// **#0A0A0B** no black. Então uma cor nova pode ficar linda num tema e sumir
// no outro — e some em silêncio: nada quebra, nada loga, o botão continua lá,
// invisível.
//
// Este eval existe porque a leva de cores SÓBRIAS (out/2026, pedido de
// cliente: "as cores de tema são bem chamativas") anda justamente na faixa
// perigosa — escurecer "pra ficar sóbrio" é exatamente o que mata o tema
// black.
//
// WCAG 1.4.11: componente de interface (botão, ícone, borda) pede **3:1**
// contra o fundo adjacente.
//
// Rodar:  npm run eval:paletas
// =============================================================================
import { PALETAS, GRUPOS_PALETA, PALETA_PADRAO } from './theme-colors.ts';

const falhas = [];
const ok = (c, m) => { if (!c) falhas.push(m); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

// --- aritmética de contraste (WCAG 2.x) --------------------------------------
function hslParaRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
function hexParaRgb(hex) {
  const m = String(hex).replace('#', '');
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16));
}
function luminancia([r, g, b]) {
  const c = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const x = luminancia(a), y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Os fundos REAIS do app, lidos do globals.css:
//   claro  --bg: 220 20% 97%   ·   black  --bg: 240 10% 4%
const BG_CLARO = hslParaRgb(220, 20, 97);
const BG_BLACK = hslParaRgb(240, 10, 4);
const BRANCO   = [255, 255, 255];

const MIN_COMPONENTE = 3;

// ⚠️ EXCEÇÕES CONHECIDAS, não licença. As 6 vibrantes são anteriores a este
// eval e o dono decidiu mantê-las como estão (out/2026) — elas já estão na mão
// de clientes, e trocar a cor de quem escolheu seria mexer no app dos outros.
// A lista é FECHADA: cor nova NÃO entra aqui, e a seção 4 trava isso.
const DIVIDA_ACEITA = new Set(['verde', 'azul', 'roxo', 'laranja', 'rosa', 'vermelho']);

const RE_HSL = /^(\d{1,3}) (\d{1,3})% (\d{1,3})%$/;

const medida = (p) => {
  const m = String(p.hsl).match(RE_HSL);
  if (!m) return null;
  const rgb = hslParaRgb(Number(m[1]), Number(m[2]), Number(m[3]));
  return {
    rgb,
    claro: contraste(rgb, BG_CLARO),
    black: contraste(rgb, BG_BLACK),
    branco: contraste(rgb, BRANCO),
  };
};

console.log('-- 1. o formato do HSL e o que a variavel CSS recebe --');
{
  // `aplicarPaleta` faz setProperty('--primary', p.hsl) e o CSS o consome
  // dentro de `hsl(var(--primary))`. Formato torto = cor invalida = o app
  // inteiro perde o destaque, sem erro nenhum no console.
  for (const p of PALETAS) {
    ok(RE_HSL.test(p.hsl), `1 ${p.id}: hsl fora do formato "H S% L%" ("${p.hsl}")`);
    ok(/^#[0-9A-Fa-f]{6}$/.test(p.hex), `1 ${p.id}: hex invalido ("${p.hex}")`);
    ok(!!p.nome && p.nome.length <= 12, `1 ${p.id}: nome vazio ou longo demais pro botao ("${p.nome}")`);
    ok(p.tom === 'vibrante' || p.tom === 'sobrio', `1 ${p.id}: tom invalido ("${p.tom}")`);
  }
  eq(new Set(PALETAS.map((p) => p.id)).size, PALETAS.length, '1 ids duplicados');
  eq(new Set(PALETAS.map((p) => p.nome)).size, PALETAS.length, '1 nomes duplicados');
}
console.log('  ok');

console.log('-- 2. toda cor SOBRIA sobrevive aos DOIS fundos --');
{
  console.log('     cor          HSL             claro   black  branco');
  for (const p of PALETAS.filter((x) => x.tom === 'sobrio')) {
    const m = medida(p);
    console.log(
      '     ' + p.nome.padEnd(13) + p.hsl.padEnd(16) +
      m.claro.toFixed(2).padStart(5) + m.black.toFixed(2).padStart(8) + m.branco.toFixed(2).padStart(8),
    );
    ok(m.claro >= MIN_COMPONENTE, `2 ${p.id} SOME NO TEMA CLARO (${m.claro.toFixed(2)}:1, minimo ${MIN_COMPONENTE})`);
    ok(m.black >= MIN_COMPONENTE, `2 ${p.id} SOME NO TEMA BLACK (${m.black.toFixed(2)}:1, minimo ${MIN_COMPONENTE})`);
  }
}
console.log('  ok');

console.log('-- 3. texto BRANCO em cima da cor (bg-primary + text-white) --');
{
  // Dezenas de lugares do painel põem texto branco sobre `--primary` (botão
  // primário, badge, barra da sidebar). Se a cor for clara demais, o rótulo
  // do próprio botão fica ilegível.
  for (const p of PALETAS.filter((x) => x.tom === 'sobrio')) {
    const m = medida(p);
    ok(m.branco >= 4.5, `3 ${p.id}: texto branco em cima nao atinge 4,5:1 (${m.branco.toFixed(2)})`);
  }
}
console.log('  ok');

console.log('-- 4. a divida das vibrantes e FECHADA --');
{
  // Esta seção não afrouxa nada: ela MEDE as 6 antigas, deixa o número
  // registrado, e impede que uma cor nova se esconda atrás delas.
  console.log('     cor          HSL             claro   black');
  for (const p of PALETAS.filter((x) => x.tom === 'vibrante')) {
    const m = medida(p);
    const passa = m.claro >= MIN_COMPONENTE && m.black >= MIN_COMPONENTE;
    console.log(
      '     ' + p.nome.padEnd(13) + p.hsl.padEnd(16) +
      m.claro.toFixed(2).padStart(5) + m.black.toFixed(2).padStart(8) +
      (passa ? '   passa' : '   abaixo de 3:1 no claro (divida aceita)'),
    );
    ok(DIVIDA_ACEITA.has(p.id), `4 ${p.id} e vibrante e NAO esta na divida aceita: cor nova precisa passar nos dois temas`);
  }
  // Toda cor fora da lista tem de passar — inclusive uma vibrante nova.
  for (const p of PALETAS.filter((x) => !DIVIDA_ACEITA.has(x.id))) {
    const m = medida(p);
    ok(m.claro >= MIN_COMPONENTE && m.black >= MIN_COMPONENTE,
      `4 ${p.id} e cor NOVA e nao pode nascer com divida de contraste`);
  }
  // A lista não pode crescer: ela nomeia as 6 que já existiam.
  eq(DIVIDA_ACEITA.size, 6, '4 a lista de divida aceita cresceu');
}
console.log('  ok');

console.log('-- 5. os grupos do seletor --');
{
  // Grupo sem paleta = seção com título e nada embaixo. Paleta sem grupo =
  // cor que existe no código e NÃO aparece na tela pra escolher.
  const tonsComGrupo = new Set(GRUPOS_PALETA.map((g) => g.tom));
  for (const p of PALETAS) ok(tonsComGrupo.has(p.tom), `5 ${p.id}: tom "${p.tom}" nao tem grupo — a cor nao apareceria no seletor`);
  for (const g of GRUPOS_PALETA) {
    ok(PALETAS.some((p) => p.tom === g.tom), `5 grupo "${g.titulo}" ficaria VAZIO na tela`);
    ok(!!g.titulo && !!g.descricao, `5 grupo "${g.tom}" sem titulo ou descricao`);
  }
  eq(new Set(GRUPOS_PALETA.map((g) => g.tom)).size, GRUPOS_PALETA.length, '5 grupo repetido');
}
console.log('  ok');

console.log('-- 6. o padrao existe --');
{
  // `getPaletaSalva` devolve PALETA_PADRAO quando não há nada salvo. Se esse
  // id não estiver na lista, `aplicarPaleta` cai no `|| PALETAS[0]` e o app
  // abre numa cor que ninguém escolheu.
  ok(PALETAS.some((p) => p.id === PALETA_PADRAO), `6 PALETA_PADRAO ("${PALETA_PADRAO}") nao esta em PALETAS`);
  eq(PALETAS[0].id, PALETA_PADRAO, '6 o padrao deve ser o primeiro (e o fallback de aplicarPaleta)');
}
console.log('  ok');

console.log('-- 7. a AMOSTRA mostra a cor que vai ser aplicada --');
{
  // O `hex` só pinta a bolinha do seletor; quem vira tema é o `hsl`. Se os
  // dois divergirem, a pessoa escolhe uma cor e recebe outra.
  // ⚠️ DUAS ANTIGAS JÁ NASCERAM DESALINHADAS, e foi este eval que mostrou: o
  // Verde aplica #61D17B e a bolinha pinta #5BC571; o Vermelho aplica #DF3A3A
  // e pinta #DC2626. Ninguém percebe numa bolinha de 36px, e re-pintar cor que
  // já está na mão de cliente é mexer no app dos outros — mas a lista é
  // FECHADA: cor nova tem de ter a amostra IGUAL à cor que aplica.
  const AMOSTRA_DESALINHADA = new Set(['verde', 'vermelho']);
  for (const p of PALETAS) {
    const m = medida(p);
    const real = m.rgb, amostra = hexParaRgb(p.hex);
    const dist = Math.max(...real.map((v, i) => Math.abs(v - amostra[i])));
    const hexReal = '#' + real.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    const divida = AMOSTRA_DESALINHADA.has(p.id);
    if (dist > 2) console.log('     ' + p.nome.padEnd(13) + 'aplica ' + hexReal + ' / amostra ' + p.hex + '  (' + dist + ' de 255)' + (divida ? '  divida aceita' : ''));
    // 8/255 = ~3% por canal: imperceptível na bolinha, mas pega troca de cor.
    if (!divida) ok(dist <= 8, `7 ${p.id}: a amostra (${p.hex}) nao e a cor aplicada (${hexReal}) — diferenca de ${dist}/255`);
    // Se uma delas passar a bater, a lista tem de encolher — senão ela vira
    // isenção permanente e o guard deixa de guardar.
    else ok(dist > 8, `7 ${p.id} esta na divida de amostra mas JA BATE — tire da lista`);
  }
  eq(AMOSTRA_DESALINHADA.size, 2, '7 a divida de amostra cresceu');
}
console.log('  ok');

console.log('-- 8. duas cores nao podem ser a MESMA cor --');
{
  // ⚠️ ESTA SEÇÃO NASCEU DE UM DEFEITO QUE SÓ A BANCADA MOSTROU. A primeira
  // leva de sóbrias trazia Chumbo (#5B6B85) e Ardósia (#54628C): **1,11:1**
  // entre si (1,0 seria a mesma cor), 9 de 255 por canal. Na tela eram duas
  // bolinhas iguais com nomes diferentes, gastando duas das seis vagas — e
  // os 7 testes acima passavam todos, porque cada uma, sozinha, era ótima.
  //
  // Nenhum contraste contra FUNDO pega isso: o problema é a distância entre
  // as cores, não contra o papel.
  const MIN_DISTANCIA = 15; // o par ruim dava 9; o par legítimo mais próximo (Musgo x Oliva) dá 19
  let pior = { nomes: '', dist: 255 };
  for (let i = 0; i < PALETAS.length; i++) {
    for (let j = i + 1; j < PALETAS.length; j++) {
      const a = hexParaRgb(PALETAS[i].hex), b = hexParaRgb(PALETAS[j].hex);
      const dist = Math.max(...a.map((v, k) => Math.abs(v - b[k])));
      if (dist < pior.dist) pior = { nomes: `${PALETAS[i].nome} x ${PALETAS[j].nome}`, dist };
      ok(dist >= MIN_DISTANCIA,
        `8 ${PALETAS[i].id} e ${PALETAS[j].id} sao praticamente a MESMA cor (${dist} de 255 por canal) — duas vagas do seletor pro mesmo tom`);
    }
  }
  console.log(`     par mais parecido: ${pior.nomes} (${pior.dist} de 255, minimo ${MIN_DISTANCIA})`);
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`x ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  .', f));
  process.exit(1);
}
console.log(`OK paletas: ${PALETAS.length} cores, todas as novas legiveis no tema claro E no black`);
process.exit(0);
