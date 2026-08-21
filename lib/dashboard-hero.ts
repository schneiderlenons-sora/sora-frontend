// Medidas do fundo em vídeo do dashboard (só mobile).
//
// Ficam AQUI, num módulo sem `'use client'`, porque quem consome são os dois
// lados: o `loading.tsx` (Server Component) e o `DashboardClient` + o
// `HeroVideoBg` (Client). Importar uma const de dentro de um arquivo
// `'use client'` num Server Component devolveria uma referência de cliente, e
// não a string — o skeleton reservaria altura errada e o layout pularia.
//
// As duas medidas andam JUNTAS: o vídeo precisa ser mais alto que o espaçador
// pra que o card do hero (opaco) comece já em cima do fim do gradiente que vem
// dentro do arquivo de vídeo. É isso que costura o vídeo com o fundo do painel.

// Calibragem (os dois arquivos são 800×800; numa tela de 390×844 a faixa fica
// ~390 de largura por ~371 de altura, então o vídeo cabe INTEIRO na vertical —
// `cover` só corta ~8% nas laterais e o gradiente do arquivo cai exatamente na
// borda de baixo da faixa):
//
//   topo do card = ESPAÇADOR + saudação (~34px, 1 linha) + gap (20px)
//
// Com os valores abaixo isso dá ~10–22px A MAIS que o fim da faixa em toda
// tela de celular — ou seja, o card começa logo depois do vídeo terminar, ou
// cobrindo só o últimos pixels dele. Nunca no meio da parte vívida (era a
// queixa nº 4) nem antes do gradiente fechar (apareceria costura).

/** Altura visível do vídeo, abaixo da safe-area. */
export const ALTURA_VIDEO = 'clamp(300px, 44vh, 400px)';

/** Altura do espaçador que empurra a saudação (e o card) pra baixo, até o fim
 *  do gradiente do vídeo. */
export const ALTURA_ESPACADOR = 'clamp(230px, 35vh, 320px)';

// ── Desktop (≥768px) ────────────────────────────────────────────────────────
//
// O arquivo do desktop é 2690×770 (≈3,4935:1) — uma faixa panorâmica, não um
// quadrado como os do mobile. Por isso a altura NÃO é um clamp de `vh`: ela sai
// da PROPORÇÃO da largura útil (viewport − a sidebar de 16rem). É o que resolve
// o tablet: com altura fixa, a 768px a faixa ficaria muito mais alta que a
// proporção e o `cover` comeria ~57% da largura — sobrava o meio (céu e mar),
// sem a casa nem a baleia.

/**
 * Altura da faixa do desktop, entre um piso e um teto.
 *
 * ⚠️ NÃO usar `aspect-ratio` no elemento. Com um `min-height` junto, a caixa
 * cresce em LARGURA pra manter a proporção — medido: virou 698px num espaço de
 * 564 e vazava pra fora da tela. Altura calculada não tem esse efeito.
 *
 * · piso 200px — abaixo disso (tablet estreito) a faixa vira uma tira fina
 *   demais pra o gradiente ter onde fechar. Aí o `cover` corta ~19% da
 *   LARGURA, e é por isso que o desktop ancora em `0% 100%` (à esquerda): o
 *   corte sai pelo lado direito e a casa, as palmeiras e a costa ficam
 *   inteiras.
 * · teto 420px — acima disso (ultrawide) o corte vira VERTICAL, e o `100%` do
 *   eixo Y come o CÉU, preservando horizonte e água — que é justamente onde o
 *   gradiente precisa encontrar o fundo do painel.
 *
 * Entre ~954px e ~1724px de viewport não há corte nenhum: a cena inteira cabe.
 */
export const ALTURA_VIDEO_DESKTOP = 'clamp(200px, calc((100vw - 16rem) / 3.4935), 420px)';

/** Espaçador do desktop. O divisor é maior que a razão de propósito: o card do
 *  hero encosta nos últimos ~20px da faixa (o rabo do gradiente) em vez de
 *  começar depois dela — mesma costura do mobile. Já conta o `md:pt-6` do
 *  <main> e o `space-y-5` do wrapper. */
export const ALTURA_ESPACADOR_DESKTOP = 'clamp(150px, calc((100vw - 16rem) / 4.3), 360px)';
