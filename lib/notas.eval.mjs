// =============================================================================
// EVAL: Notas do Drive (lib/notas.ts) — busca, cadernos, ordem e o cartão.
// Rodar:  npm run eval:notas
// =============================================================================
import {
  chave, ordenarNotas, casaBusca, filtrarNotas, cadernos, cabecalhoDaNota,
  contarPalavras, comNota, semNota, quandoMudou,
} from './notas.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};

const n = (id, extra = {}) => ({ id, titulo: null, texto: '', categoria: null, created_at: '2026-11-01T10:00:00Z', ...extra });

// 1. chave e busca
eq(chave('  Reunião   com  João '), 'reuniao com joao', 'chave sem acento, caixa nem espaço sobrando');
eq(casaBusca(n('a', { titulo: 'Reunião', texto: 'pauta do mês' }), 'REUNIAO'), true, 'busca ignora acento e caixa');
eq(casaBusca(n('a', { titulo: 'Reunião', texto: 'pauta do mês' }), 'pauta mes'), true, 'todas as palavras, em qualquer lugar');
eq(casaBusca(n('a', { titulo: 'Reunião', texto: 'pauta' }), 'pauta viagem'), false, 'falta uma palavra: não casa');
eq(casaBusca(n('a', { categoria: 'Fazenda' }), 'fazenda'), true, 'busca também no caderno');
eq(casaBusca(n('a'), '   '), true, 'busca vazia mostra tudo');

// 2. filtro
const lista = [
  n('1', { categoria: 'Trabalho', texto: 'a' }),
  n('2', { categoria: 'trabalho ', texto: 'b', fixada: true }),
  n('3', { categoria: 'Casa', texto: 'c' }),
  n('4', { texto: 'sem caderno' }),
];
eq(filtrarNotas(lista, { caderno: 'TRABALHO' }).map((x) => x.id), ['1', '2'], 'caderno casa sem caixa e espaço');
eq(filtrarNotas(lista, { soFixadas: true }).map((x) => x.id), ['2'], 'só fixadas');
eq(filtrarNotas(lista, { caderno: 'Casa', termo: 'c' }).map((x) => x.id), ['3'], 'caderno + busca juntos');
eq(filtrarNotas(lista, {}).length, 4, 'sem filtro, todas');

// 3. cadernos
eq(cadernos([...lista, n('5', { categoria: 'Trabalho' })]),
  [{ nome: 'Trabalho', quantidade: 3 }, { nome: 'Casa', quantidade: 1 }],
  '"Trabalho" e "trabalho " são o mesmo caderno; nome = grafia mais usada; mais cheio primeiro');
eq(cadernos([n('x')]), [], 'nota sem caderno não cria caderno');

// 4. ordem (mesma do servidor)
eq(ordenarNotas([
  n('a', { created_at: '2026-11-01T10:00:00Z' }),
  n('b', { fixada: true, created_at: '2026-10-01T10:00:00Z' }),
  n('c', { created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-20T10:00:00Z' }),
]).map((x) => x.id), ['b', 'c', 'a'], 'fixadas primeiro, depois a mexida mais recente');

// 5. cartão
eq(cabecalhoDaNota({ titulo: 'Ideias', texto: 'linha 1\nlinha 2' }), { titulo: 'Ideias', previa: 'linha 1\nlinha 2' }, 'com título');
eq(cabecalhoDaNota({ titulo: null, texto: '\n\nPrimeira linha\nresto do texto\n' }), { titulo: 'Primeira linha', previa: 'resto do texto' },
  'sem título: 1ª linha com texto vira o título e não se repete na prévia');
eq(cabecalhoDaNota({ titulo: '  ', texto: '   ' }), { titulo: 'Nota sem título', previa: '' }, 'nota vazia');

// 6. palavras
eq(contarPalavras('  uma  frase\ncom   quatro '), 4, 'conta palavras com quebras e espaços');
eq(contarPalavras(''), 0, 'vazio');

// 7. lista depois de salvar/apagar
const base = [n('1', { created_at: '2026-11-01T10:00:00Z' }), n('2', { created_at: '2026-11-02T10:00:00Z' })];
eq(comNota(base, n('1', { texto: 'editada', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-26T10:00:00Z' })).map((x) => [x.id, x.texto]),
  [['1', 'editada'], ['2', '']], 'editar troca a nota e sobe pro topo (sem duplicar)');
eq(comNota(undefined, n('9')).map((x) => x.id), ['9'], 'lista ainda vazia');
eq(semNota(base, '1').map((x) => x.id), ['2'], 'apagar');

// 8. "quando"
const AGORA = new Date('2026-11-26T15:00:00Z'); // 12h em SP
eq(quandoMudou('2026-11-26T14:59:40Z', AGORA), 'agora', 'segundos');
eq(quandoMudou('2026-11-26T14:30:00Z', AGORA), 'há 30 min', 'minutos');
eq(quandoMudou('2026-11-26T05:00:00Z', AGORA), 'há 10 h', 'horas');
eq(quandoMudou('2026-11-25T12:00:00Z', AGORA), 'ontem', 'ontem (dia de SP)');
eq(quandoMudou('2026-11-10T12:00:00Z', AGORA), '10/11', 'mesmo ano: dia/mês');
eq(quandoMudou('2025-12-10T12:00:00Z', AGORA), '10/12/2025', 'outro ano: com o ano');
eq(quandoMudou('lixo', AGORA), '', 'data ilegível');

console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }
