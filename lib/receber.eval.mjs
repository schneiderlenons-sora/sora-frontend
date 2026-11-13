// =============================================================================
// EVAL: contas a receber do Sora Negócios — situação, por cliente e CSV.
//
// Pedido de cliente (nov/2026): exportar o A receber para Excel e ver a
// inadimplência agrupada por cliente. O que este eval trava:
//   1. situação pela data (vencida / hoje / a vencer / sem data), sem fuso;
//   2. "João Silva" e "joao  silva" são o MESMO cliente;
//   3. somas por cliente fecham com o total da lista, centavo a centavo;
//   4. ordem: quem deve vencido primeiro, "sem cliente" no fim;
//   5. CSV: Excel em português (";", vírgula decimal, sem milhar), aspas
//      escapadas e texto que começa com "=" não vira fórmula;
//   6. o resumo por cliente tem linha de TOTAL que bate com a lista.
//
// Rodar:  npm run eval:receber
// =============================================================================
import {
  diasAte, situacaoReceber, rotuloSituacao, ordenarPorUrgencia, chaveCliente,
  agruparPorCliente, SEM_CLIENTE, celulaTexto, celulaValor, celulaData,
  csvCobrancas, csvPorCliente, nomeArquivo,
} from './receber.ts';

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};

const HOJE = '2026-11-12';
let seq = 0;
const lanc = (valor, vencimento, contraparte, extra = {}) => ({
  id: `l${++seq}`, empresa_id: 'e1', tipo: 'entrada', status: 'pendente',
  descricao: extra.descricao || `Serviço ${seq}`, valor, data: extra.data || '2026-11-01',
  vencimento, contraparte, categoria: extra.categoria ?? 'servicos', observacao: extra.observacao ?? null,
});

console.log('── 1. situação ──');
eq(diasAte('2026-11-10', HOJE), -2, 'venceu há 2 dias');
eq(diasAte('2026-11-12', HOJE), 0, 'vence hoje');
eq(diasAte('2026-12-12', HOJE), 30, 'vence em 30 dias (cruza o mês)');
eq(diasAte('2026-11-12T23:30:00+00:00', HOJE), 0, 'timestamp com hora: conta o DIA, não o instante');
eq(diasAte(null, HOJE), null, 'sem vencimento');
eq(diasAte('lixo', HOJE), null, 'data inválida não vira número inventado');
eq(diasAte('2027-03-01', '2027-02-28'), 1, 'fim de fevereiro');
eq(situacaoReceber('2026-11-11', HOJE).grupo, 'vencida', 'ontem = vencida');
eq(situacaoReceber('2026-11-12', HOJE).grupo, 'hoje', 'hoje = vence hoje (não vencida)');
eq(situacaoReceber('2026-11-13', HOJE).grupo, 'futura', 'amanhã = a vencer');
eq(situacaoReceber(undefined, HOJE).grupo, 'sem_data', 'sem data');
eq(rotuloSituacao(situacaoReceber('2026-11-11', HOJE)), 'Vencida há 1 dia', 'singular');
eq(rotuloSituacao(situacaoReceber('2026-11-02', HOJE)), 'Vencida há 10 dias', 'plural');
eq(rotuloSituacao(situacaoReceber('2026-11-12', HOJE)), 'Vence hoje', 'hoje');
eq(rotuloSituacao(situacaoReceber('2026-11-15', HOJE)), 'Vence em 3 dias', 'a vencer');
eq(rotuloSituacao(situacaoReceber(null, HOJE)), 'Sem vencimento', 'sem data');

console.log('── 2. ordem de urgência ──');
const ord = ordenarPorUrgencia([
  lanc(100, null, 'A', { descricao: 'sem data' }),
  lanc(100, '2026-11-20', 'A', { descricao: 'futura longe' }),
  lanc(100, '2026-11-12', 'A', { descricao: 'hoje' }),
  lanc(100, '2026-11-01', 'A', { descricao: 'vencida antiga' }),
  lanc(100, '2026-11-14', 'A', { descricao: 'futura perto' }),
  lanc(100, '2026-11-10', 'A', { descricao: 'vencida recente' }),
], HOJE).map(l => l.descricao);
eq(ord, ['vencida antiga', 'vencida recente', 'hoje', 'futura perto', 'futura longe', 'sem data'],
  'mais atrasada primeiro; a vencer pela data; sem data no fim');

console.log('── 3. chave do cliente ──');
eq(chaveCliente('  João   Silva '), 'joao silva', 'acento, caixa e espaço');
eq(chaveCliente('JOÃO SILVA'), chaveCliente('joao silva'), 'mesma pessoa');
eq(chaveCliente(null), '', 'sem cliente');
eq(chaveCliente('   '), '', 'só espaço = sem cliente');

console.log('── 4. agrupamento por cliente ──');
const lista = [
  lanc(150000, '2026-11-02', 'João Silva'),     // vencida 10d
  lanc(50000,  '2026-11-12', 'joao  silva'),    // hoje
  lanc(25050,  '2026-12-01', 'JOÃO SILVA'),     // a vencer
  lanc(30000,  '2026-11-08', 'Maria Souza'),    // vencida 4d
  lanc(30000,  '2026-11-11', 'Maria Souza'),    // vencida 1d
  lanc(999999, '2026-12-20', 'Empresa Grande'), // a vencer, maior total, nada vencido
  lanc(1000,   null,         ''),               // sem cliente
  lanc(2000,   '2026-10-01', null),             // sem cliente, vencida
  lanc(7000,   null,         'Pedro'),          // só sem data
];
const g = agruparPorCliente(lista, HOJE);
eq(g.map(x => x.nome), ['João Silva', 'Maria Souza', 'Empresa Grande', 'Pedro', SEM_CLIENTE],
  'vencido maior primeiro; depois total; sem cliente no fim (mesmo com vencido)');
const joao = g[0];
eq([joao.quantidade, joao.total, joao.vencido, joao.venceHoje, joao.aVencer, joao.semData],
  [3, 225050, 150000, 50000, 25050, 0], 'João: 3 grafias viram um cliente, somas por situação');
eq([joao.qtdVencidas, joao.maiorAtraso, joao.proximoVencimento], [1, 10, '2026-11-12'],
  'João: 1 vencida, 10 dias de atraso, próximo vencimento = hoje');
const maria = g[1];
eq([maria.qtdVencidas, maria.maiorAtraso, maria.proximoVencimento], [2, 4, null],
  'Maria: maior atraso é o da mais antiga; nada a vencer');
eq([g[2].vencido, g[2].maiorAtraso], [0, 0], 'sem nada vencido: zero de atraso');
eq([g[3].semData, g[3].proximoVencimento], [7000, null], 'só sem data');
const sem = g[4];
eq([sem.semCliente, sem.quantidade, sem.vencido, sem.semData], [true, 2, 2000, 1000], 'sem cliente agrupa vazio e null');
const soma = (k) => g.reduce((s, x) => s + x[k], 0);
const totalLista = lista.reduce((s, l) => s + l.valor, 0);
eq(soma('total'), totalLista, 'soma dos clientes = total da lista');
eq(soma('vencido') + soma('venceHoje') + soma('aVencer') + soma('semData'), totalLista,
  'situações somadas = total (nenhum centavo em dois lugares nem fora)');
eq(soma('quantidade'), lista.length, 'nenhuma cobrança perdida nem repetida');
eq(joao.itens.map(l => l.vencimento), ['2026-11-02', '2026-11-12', '2026-12-01'], 'itens do cliente em ordem de urgência');
// Grafia mais usada vence; empate decidido de forma estável.
const grafias = agruparPorCliente([
  lanc(1, '2026-12-01', 'ana costa'), lanc(1, '2026-12-01', 'Ana Costa'), lanc(1, '2026-12-01', 'Ana Costa'),
], HOJE);
eq(grafias[0].nome, 'Ana Costa', 'nome exibido = grafia mais usada');
const emp1 = agruparPorCliente([lanc(1, null, 'bia'), lanc(1, null, 'Bia')], HOJE)[0].nome;
const emp2 = agruparPorCliente([lanc(1, null, 'Bia'), lanc(1, null, 'bia')], HOJE)[0].nome;
eq(emp1, emp2, 'empate de grafia não depende da ordem que chegou');
eq(agruparPorCliente([], HOJE), [], 'lista vazia');

console.log('── 5. células do CSV ──');
eq(celulaValor(123456), '1234,56', 'sem separador de milhar (Excel lê como número)');
eq(celulaValor(5), '0,05', 'centavos com zero à esquerda');
eq(celulaValor(100), '1,00', 'inteiro');
eq(celulaValor(0), '0,00', 'zero');
eq(celulaValor(-2550), '-25,50', 'negativo');
eq(celulaValor(1999.6), '20,00', 'arredonda centavo fracionado');
eq(celulaData('2026-11-02'), '02/11/2026', 'data BR');
eq(celulaData('2026-11-02T00:00:00+00:00'), '02/11/2026', 'timestamp à meia-noite UTC não volta um dia');
eq(celulaData(null), '', 'sem data');
eq(celulaTexto('Serviço "premium"'), '"Serviço ""premium"""', 'aspas escapadas');
eq(celulaTexto('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`, 'fórmula vira texto');
eq(celulaTexto('+5521999'), `"'+5521999"`, '+ no começo não vira fórmula');
eq(celulaTexto('@soma'), `"'@soma"`, '@ no começo não vira fórmula');
eq(celulaTexto('linha1\nlinha2'), '"linha1 linha2"', 'quebra de linha não quebra a planilha');
eq(celulaTexto(null), '""', 'nulo vira vazio');

console.log('── 6. CSV de cobranças ──');
const csv = csvCobrancas([
  lanc(150000, '2026-11-02', 'João Silva', { descricao: 'Manutenção', data: '2026-10-20' }),
  lanc(25050, '2026-12-01', '', { descricao: 'Instalação; parte 2', observacao: 'pagar no pix' }),
], HOJE).split('\r\n');
eq(csv.length, 3, 'cabeçalho + 2 linhas');
eq(csv[0].split(';').length, 9, '9 colunas no cabeçalho');
eq(csv[1], '"João Silva";"Manutenção";"Serviços";1500,00;20/10/2026;02/11/2026;"Vencida há 10 dias";10;""',
  'linha completa da cobrança vencida');
eq(csv[2].startsWith(`"${SEM_CLIENTE}";"Instalação; parte 2";`), true, '";" dentro do texto fica entre aspas');
eq(csv[2].endsWith(';"Vence em 19 dias";0;"pagar no pix"'), true, 'a vencer: 0 dias de atraso + observação');
const clientesCsv = csvCobrancas(lista, HOJE).split('\r\n').slice(1).map(l => l.split(';')[0]);
eq([...new Set(clientesCsv)].sort(), ['"Construtora Alfa"', '"Empresa Grande"', '"João Silva"', '"Maria Souza"', '"Pedro"', `"${SEM_CLIENTE}"`].filter(n => clientesCsv.includes(n)).sort(),
  'coluna Cliente usa o nome unificado (as 3 grafias do João viram uma)');
eq(clientesCsv.filter(n => n === '"João Silva"').length, 3, 'as 3 cobranças do João saem como "João Silva"');
for (const l of csv) {
  // ";" fora de aspas tem de dar sempre 9 colunas.
  const cols = l.match(/("([^"]|"")*"|[^;]*)(;|$)/g).filter((x, i, a) => !(i === a.length - 1 && x === ''));
  eq(cols.length, 9, `toda linha tem 9 colunas: ${l.slice(0, 30)}…`);
}

console.log('── 7. CSV por cliente ──');
const pc = csvPorCliente(lista, HOJE).split('\r\n');
eq(pc.length, 1 + g.length + 1, 'cabeçalho + 1 por cliente + TOTAL');
eq(pc[1], '"João Silva";3;2250,50;1500,00;500,00;250,50;0,00;1;10;12/11/2026', 'linha do João');
eq(pc[pc.length - 1], `"TOTAL";${lista.length};${celulaValor(totalLista)};${celulaValor(soma('vencido'))};${celulaValor(soma('venceHoje'))};${celulaValor(soma('aVencer'))};${celulaValor(soma('semData'))};${soma('qtdVencidas')};;`,
  'linha de TOTAL bate com a lista');
eq(csvPorCliente([], HOJE).split('\r\n').length, 2, 'lista vazia: cabeçalho + total zerado');

console.log('── 8. nome do arquivo ──');
eq(nomeArquivo('a-receber', 'Loja do João / Centro', HOJE), 'a-receber-loja-do-joao-centro-2026-11-12.csv', 'slug seguro');
eq(nomeArquivo('a-receber', null, HOJE), 'a-receber-2026-11-12.csv', 'sem empresa');

console.log(`\n${total - falhas.length}/${total} ok`);
if (falhas.length) { console.log('\nFALHAS:\n - ' + falhas.join('\n - ')); process.exit(1); }
