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
