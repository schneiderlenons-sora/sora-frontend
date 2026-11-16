// =============================================================================
// EVAL: categorias do Sora Negócios no painel (migration 196).
//
// O que trava:
//   1. a CHAVE é igual à do backend (senão a tela marcaria uma categoria e o
//      servidor gravaria outra);
//   2. as categorias PADRÃO são as mesmas nos dois lados (o backend recusa
//      categoria própria com nome de padrão — listas diferentes deixariam
//      passar "Aluguel" duplicado);
//   3. os ÍCONES escolhíveis são os mesmos (o backend recusa nome fora da
//      lista; a tela não pode oferecer um que ele recusa) e todo ícone usado
//      tem desenho;
//   4. a lista do seletor: padrão primeiro, próprias em ordem, oculta fora
//      (menos a do próprio lançamento);
//   5. o "Outra" reaproveita a que já existe em vez de criar outra grafia.
//
// Rodar:  npm run eval:categorias-negocio
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chaveCategoria, opcoesCategoria, categoriaExistente, iconeDaCategoria } from './categorias-negocio.ts';
import { CATEGORIAS_ENTRADA, CATEGORIAS_SAIDA } from './lancamentos.ts';

const require = createRequire(import.meta.url);
const back = require(path.resolve(process.cwd(), '../sora-backend/src/services/categoriasNegocio.js'));

const falhas = [];
let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };

console.log('── 1. chave = backend ──');
for (const s of ['Conveniência', '  CONVENIENCIA ', 'Lanche   da tarde', 'uso_pessoal', 'Luz / Água', 'Ação & Cia', '', null, 'ÇÃO ñ']) {
  eq(chaveCategoria(s), back.chave(s), `chave igual nos dois lados: ${JSON.stringify(s)}`);
}

console.log('── 2. padrão = backend ──');
eq(CATEGORIAS_ENTRADA.map((c) => [c.v, c.label]), back.FIXAS.entrada.map((c) => [c.v, c.label]), 'entradas padrão iguais');
eq(CATEGORIAS_SAIDA.map((c) => [c.v, c.label]), back.FIXAS.saida.map((c) => [c.v, c.label]), 'saídas padrão iguais');

console.log('── 3. ícones = backend ──');
const tsx = fs.readFileSync(path.resolve(process.cwd(), 'components/negocios/IconeCategoria.tsx'), 'utf8');
const bloco = (ini) => { const i = tsx.indexOf(ini); return tsx.slice(i, tsx.indexOf(']', i)); };
const escolhiveis = [...bloco('export const ICONES_CATEGORIA = [').matchAll(/'([A-Za-z0-9]+)'/g)].map((m) => m[1]);
eq(escolhiveis, back.ICONES, 'mesma lista e mesma ordem de ícones escolhíveis');
const mapa = tsx.slice(tsx.indexOf('const MAPA'), tsx.indexOf('};', tsx.indexOf('const MAPA')));
const noMapa = new Set([...mapa.matchAll(/\b([A-Z][A-Za-z0-9]+)\b/g)].map((m) => m[1]));
const semDesenho = [...escolhiveis, ...CATEGORIAS_ENTRADA.map((c) => c.icone), ...CATEGORIAS_SAIDA.map((c) => c.icone)]
  .filter((n) => !noMapa.has(n));
eq(semDesenho, [], 'todo ícone (escolhível ou das padrão) tem desenho');
const rotulos = tsx.slice(tsx.indexOf('export const ROTULO_ICONE'), tsx.indexOf('};', tsx.indexOf('export const ROTULO_ICONE')));
eq(escolhiveis.filter((n) => !new RegExp(`\\b${n}:`).test(rotulos)), [], 'todo ícone escolhível tem nome em português');
const lucide = require('lucide-react');
eq(escolhiveis.filter((n) => !lucide[n]), [], 'todos existem na versão instalada do Lucide');

console.log('── 4. lista do seletor ──');
const P = (tipo, nome, extra = {}) => ({ tipo, nome, chave: chaveCategoria(nome), icone: null, natureza: null, oculta: false, registrada: true, usos: 1, grafias: [nome], ...extra });
const proprias = [
  P('saida', 'Sistema', { icone: 'Code' }), P('saida', 'Embalagens'), P('saida', 'Antiga', { oculta: true }),
  P('entrada', 'Delivery', { icone: 'Bike' }),
];
const op = opcoesCategoria('saida', proprias);
eq(op.slice(0, CATEGORIAS_SAIDA.length).map((c) => c.v), CATEGORIAS_SAIDA.map((c) => c.v), 'padrão primeiro, na ordem de sempre');
eq(op.slice(CATEGORIAS_SAIDA.length).map((c) => [c.v, c.icone, c.propria]), [['Embalagens', null, true], ['Sistema', 'Code', true]],
  'próprias depois, em ordem alfabética, só do tipo, sem a oculta');
eq(opcoesCategoria('saida', proprias, 'ANTIGA').some((c) => c.v === 'Antiga'), true, 'a oculta aparece se é a do próprio lançamento');
eq(opcoesCategoria('entrada', proprias).filter((c) => c.propria).map((c) => c.v), ['Delivery'], 'entrada só vê as de entrada');
eq(opcoesCategoria('saida', []).length, CATEGORIAS_SAIDA.length, 'sem próprias = lista de sempre');

console.log('── 5. "Outra" reaproveita ──');
eq(categoriaExistente('saida', 'aluguel', proprias), 'aluguel', 'padrão pelo valor');
eq(categoriaExistente('saida', 'LUZ / ÁGUA', proprias), 'energia', 'padrão pelo rótulo → grava o valor');
eq(categoriaExistente('saida', 'sistema', proprias), 'Sistema', 'própria sem caixa → nome guardado');
eq(categoriaExistente('saida', 'Delivery', proprias), null, 'própria de OUTRO tipo não serve');
eq(categoriaExistente('saida', 'Padaria', proprias), null, 'nova');
eq(categoriaExistente('saida', '   ', proprias), null, 'vazio');

console.log('── 6. ícone de cada lançamento ──');
eq(iconeDaCategoria('saida', 'aluguel', proprias), 'Home', 'padrão');
eq(iconeDaCategoria('saida', 'SISTEMA', proprias), 'Code', 'própria por chave');
eq(iconeDaCategoria('saida', 'Embalagens', proprias), null, 'própria sem ícone');
eq(iconeDaCategoria('saida', null, proprias), null, 'sem categoria');

console.log(`\n${total - falhas.length}/${total} ok`);
if (falhas.length) { console.log('\nFALHAS:\n - ' + falhas.join('\n - ')); process.exit(1); }
