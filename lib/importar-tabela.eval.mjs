// =============================================================================
// EVAL: importar PLANILHA (CSV ou Excel) — de banco ou de outro app.
//
// Caso real (set/2026): cliente tentou trazer o histórico do GestorMoney (.xlsx)
// e a tela só lia CSV. Medindo o parser antigo apareceram dois erros que
// IMPORTAVAM ERRADO em silêncio — os piores:
//   • "1234.56" (ponto decimal, comum em exportação de app) virava 123456;
//   • coluna "Tipo" = Despesa com valor POSITIVO entrava como RECEITA.
//
// O que este eval trava:
//   1. REGRESSÃO ZERO no extrato de banco que já funcionava (compara com a
//      cópia congelada do parser antigo);
//   2. os dois erros acima, corrigidos;
//   3. entrada/saída em colunas separadas, título antes do cabeçalho, aspas;
//   4. célula do Excel (Date em UTC, número, número de série);
//   5. "tipo" que é FORMA DE PAGAMENTO (Pix, cartão) não decide o sinal.
//
// Rodar:  npm run eval:importar-tabela
// =============================================================================
import { parseCSV, parseTabela, parseValor, parseData, csvParaLinhas } from './importar-tabela.ts';

const falhas = [];
const eq = (a, b, m) => { const x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) falhas.push(`${m}\n      esperado ${y}\n      veio     ${x}`); };

// ── Cópia CONGELADA do parser antigo (components/transacoes/ImportarModal.tsx) ──
function antigoLinha(line, sep) { const o = []; let c = '', q = false; for (const ch of line) { if (ch === '"') { q = !q; continue; } if (ch === sep && !q) { o.push(c); c = ''; continue; } c += ch; } o.push(c); return o.map((s) => s.trim()); }
function antigoData(s) { if (!s) return null; const t = s.trim(); let m = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; m = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/); if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; return null; }
function antigoCSV(text) {
  const lines = text.replace(/^﻿/, '').trim().split(/\r?\n/); if (lines.length < 2) return [];
  const first = lines[0]; const sep = (first.match(/;/g)?.length || 0) > (first.match(/,/g)?.length || 0) ? ';' : ',';
  const h = antigoLinha(first, sep).map((x) => x.toLowerCase()); const f = (re) => h.findIndex((x) => re.test(x));
  const cD = f(/\b(data|date|dt)\b/), cDe = f(/(descri|histor|memo|name|titulo|estabel)/), cV = f(/(valor|amount|amt|montante|debit|credit|saida|entrada)/);
  const out = [];
  for (let i = 1; i < lines.length; i++) { const c = antigoLinha(lines[i], sep); if (c.length < Math.max(cD, cV) + 1) continue; const d = antigoData(c[cD]); if (!d) continue;
    const v = parseFloat(c[cV].replace(/R\$|\s/g, '').replace(/\./g, '').replace(',', '.')); if (isNaN(v) || v === 0) continue;
    out.push({ data: d, observacao: ((cDe >= 0 ? c[cDe] : 'Transação importada') || 'Transação').slice(0, 200), valor: Math.abs(v), tipo: v < 0 ? 'Gasto' : 'Recebimento' }); }
  return out;
}

console.log('── 1. regressão zero no extrato de banco que já funcionava ──');
const bancos = [
  'Data;Descrição;Valor\n01/09/2026;Mercado Extra;-50,00\n02/09/2026;Salário;3.500,00\n03/09/2026;Aluguel;-1.234,56',
  'data,descricao,valor\n"05/09/2026","Padaria, do João","-12,90"\n06/09/2026,Pix recebido,200',
  'Data;Descricao;Valor (R$)\n2026-09-10;COMPRA CARTAO;R$ -89,90\n2026-09-11;PIX;R$ 150,00',
];
for (const csv of bancos) eq(parseCSV(csv), antigoCSV(csv), `mesmo resultado do parser antigo: ${csv.split('\n')[0]}`);

// ⚠️ O antigo NÃO achava a coluna "Histórico": comparava COM acento ("histór"
// não casa /histor/), e a descrição saía "Transação importada". É melhora.
{
  const hist = 'Data;Histórico;Valor (R$)\n2026-09-10;COMPRA CARTAO;R$ -89,90';
  eq(antigoCSV(hist)[0].observacao, 'Transação importada', '(prova) o antigo perdia a descrição da coluna Histórico');
  eq(parseCSV(hist).map((t) => [t.observacao, t.valor, t.tipo]), [['COMPRA CARTAO', 89.9, 'Gasto']], 'coluna Histórico (com acento) vira a descrição');
}

console.log('── 2. os dois erros do relato ──');
{
  const us = 'Date,Description,Amount\n2026-09-01,Groceries,-1234.56\n2026-09-02,Refund,19.9';
  eq(antigoCSV(us)[0].valor, 123456, '(prova do bug) o parser antigo lia -1234.56 como 123456');
  eq(parseCSV(us).map((t) => [t.valor, t.tipo]), [[1234.56, 'Gasto'], [19.9, 'Recebimento']], '⚠️ ponto decimal lido como decimal');

  const app = 'Data;Descrição;Categoria;Tipo;Valor\n01/09/2026;Mercado;Alimentação;Despesa;150,00\n05/09/2026;Salário;Salário;Receita;3000,00\n07/09/2026;Uber;Transporte;Despesa;23,50';
  eq(antigoCSV(app).map((t) => t.tipo), ['Recebimento', 'Recebimento', 'Recebimento'], '(prova do bug) o parser antigo virava toda despesa em receita');
  eq(parseCSV(app).map((t) => [t.observacao, t.valor, t.tipo]),
    [['Mercado', 150, 'Gasto'], ['Salário', 3000, 'Recebimento'], ['Uber', 23.5, 'Gasto']],
    '⚠️ coluna Tipo com valor positivo decide despesa × receita');
}

console.log('── 3. formatos de planilha ──');
eq(parseCSV('Data;Histórico;Entrada;Saída\n01/09/2026;Salário;3.000,00;\n02/09/2026;Luz;;180,40\n03/09/2026;Troca;50,00;50,00')
  .map((t) => [t.observacao, t.valor, t.tipo]),
  [['Salário', 3000, 'Recebimento'], ['Luz', 180.4, 'Gasto']],
  'entrada e saída em colunas separadas (e linha que zera é ignorada)');

eq(parseCSV('Extrato de conta corrente\nPeríodo: 01/09/2026 a 30/09/2026\n\nData;Lançamento;Valor\n01/09/2026;Farmácia;-30,00\nTotal;;-30,00')
  .map((t) => [t.data, t.observacao, t.valor]),
  [['2026-09-01', 'Farmácia', 30]],
  'título e período antes do cabeçalho; linha de total sem data ignorada');

eq(parseCSV('Data\tDescrição\tValor\n01/09/2026\tPosto\t-200,00').map((t) => t.valor), [200], 'separado por TAB');
eq(parseCSV('Data;Descrição;Valor\n01/09/2026;"Loja ""Boa""; centro";-10,00').map((t) => t.observacao), ['Loja "Boa"; centro'], 'aspas com separador e aspas escapadas dentro');

eq(parseCSV('Data;Descrição;Tipo;Valor\n01/09/2026;Mercado;Pix;-80,00\n02/09/2026;Cliente;Pix;120,00').map((t) => t.tipo),
  ['Gasto', 'Recebimento'], '"Tipo" que é FORMA DE PAGAMENTO não decide o sinal');

eq(parseCSV('01/09/2026;Algo sem cabeçalho;-15,00\n02/09/2026;Outro;30,00').map((t) => [t.valor, t.tipo]),
  [[15, 'Gasto'], [30, 'Recebimento']], 'sem cabeçalho: 1ª coluna data, última valor');

console.log('── 4. célula do Excel ──');
{
  const linhas = [
    ['Minhas finanças'],
    ['Data', 'Descrição', 'Tipo', 'Valor'],
    [new Date(Date.UTC(2026, 8, 1)), 'Mercado', 'Despesa', 150],
    [46283, 'Salário', 'Receita', 3000.5],              // número de série = 18/09/2026
    [new Date(Date.UTC(2026, 8, 3)), 'Uber', 'despesas', 23.4],
    [null, 'Total', null, 3174],
  ];
  eq(parseTabela(linhas).map((t) => [t.data, t.observacao, t.valor, t.tipo]),
    [['2026-09-01', 'Mercado', 150, 'Gasto'], ['2026-09-18', 'Salário', 3000.5, 'Recebimento'], ['2026-09-03', 'Uber', 23.4, 'Gasto']],
    '⚠️ Date em UTC (não pode cair no dia anterior), número de série e tipo por palavra');
}

console.log('── 5. peças ──');
eq(['-50,00', '1.234,56', '1,234.56', '1234.56', '(50,00)', '50,00-', 'R$ -1.000,00', '1.500', '12', '', 'abc'].map(parseValor),
  [-50, 1234.56, 1234.56, 1234.56, -50, -50, -1000, 1500, 12, NaN, NaN], 'parseValor em todos os formatos');
eq(['01/09/2026', '1/9/26', '2026-09-01', '31/13/2026', '15/09/2026 14:30', 'ontem'].map(parseData),
  ['2026-09-01', '2026-09-01', '2026-09-01', null, '2026-09-15', null], 'parseData (mês 13 é recusado)');
eq(parseData(50), null, 'número pequeno (um valor) não vira data de 1900');
eq(csvParaLinhas('﻿a;b\n\n1;2').length, 2, 'BOM e linhas vazias saem');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  for (const f of falhas) console.error('   · ' + f);
  process.exit(1);
}
console.log('✅ importar planilha: tudo passou');
