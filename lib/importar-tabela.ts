// =============================================================================
// Importar PLANILHA (CSV ou Excel) — de qualquer banco ou de outro app.
//
// POR QUE EXISTE (set/2026). Um cliente tentou trazer o histórico do
// GestorMoney e esbarrou em três coisas: o arquivo era .xlsx (a tela só lia
// CSV, mesmo mandando "exportar CSV/Excel"), e o parser antigo errava do jeito
// silencioso — importava, só que errado:
//
//   1. VALOR COM PONTO DECIMAL virava 100× maior: ele apagava TODO ponto
//      ("1234.56" → 123456). Exportação de app costuma sair assim.
//   2. COLUNA "TIPO" COM VALOR POSITIVO (Despesa/Receita) — o formato mais comum
//      de app de finanças — fazia TODA despesa entrar como RECEITA: o parser só
//      olhava o sinal do número.
//   3. Colunas SEPARADAS de entrada e saída ("Crédito"/"Débito"): só a primeira
//      era lida.
//
// Aqui tudo vira LINHAS DE CÉLULAS antes de interpretar — o CSV é quebrado em
// linhas, o Excel já chega assim —, então os dois formatos passam pela MESMA
// regra. Travado em `npm run eval:importar-tabela`.
// =============================================================================

export interface TxParsed {
  data:       string;          // YYYY-MM-DD
  observacao: string;
  valor:      number;          // positivo
  tipo:       'Gasto' | 'Recebimento';
  fitid?:     string;          // id único do OFX (dedup)
}

/** Uma célula como chega do CSV (texto) ou do Excel (número, data, booleano). */
export type Celula = string | number | boolean | Date | null | undefined;

const semAcento = (s: unknown) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// ── DATA ────────────────────────────────────────────────────────────────────
/** Célula → 'YYYY-MM-DD', ou null. */
export function parseData(c: Celula): string | null {
  if (c == null || c === '') return null;
  // ⚠️ O Excel não tem fuso: a data chega como meia-noite UTC. Ler com
  // getDate() local jogaria tudo pro DIA ANTERIOR no Brasil (UTC−3).
  if (c instanceof Date) {
    if (isNaN(c.getTime())) return null;
    return `${c.getUTCFullYear()}-${String(c.getUTCMonth() + 1).padStart(2, '0')}-${String(c.getUTCDate()).padStart(2, '0')}`;
  }
  // Número de série do Excel (célula sem formato de data): dias desde 30/12/1899.
  // A faixa corta número que não é data (um valor de R$ 50 não vira 1900).
  if (typeof c === 'number') {
    if (c < 20000 || c > 80000) return null;
    return parseData(new Date(Date.UTC(1899, 11, 30) + Math.round(c) * 86400000));
  }
  const t = String(c).trim();
  let m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/);   // DD/MM/AAAA ou DD/MM/AA
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    const dia = +m[1], mes = +m[2];
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  m = t.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);                  // AAAA-MM-DD
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  return null;
}

// ── VALOR ───────────────────────────────────────────────────────────────────
/**
 * Célula → número COM SINAL, ou NaN. Entende "1.234,56" (BR), "1,234.56" e
 * "1234.56" (exportação de app), "R$ -50", "(50,00)" e "50,00-".
 */
export function parseValor(c: Celula): number {
  if (typeof c === 'number') return c;
  if (c == null || typeof c === 'boolean' || c instanceof Date) return NaN;
  let s = String(c).replace(/[R$\s ]/g, '').replace(/[A-Za-z]/g, '');
  if (!s) return NaN;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { negativo = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negativo = !negativo; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);

  if (/,\d{1,2}$/.test(s)) {
    // Vírgula decimal (BR): o ponto é milhar.
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{1,2}$/.test(s)) {
    // Ponto decimal: a vírgula (se houver) é milhar. ⚠️ É o caso que o parser
    // antigo multiplicava por 100.
    s = s.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" sem decimal: aqui o ponto só pode ser milhar (planilha BR).
    s = s.replace(/\./g, '');
  } else if (/^\d{1,3}(,\d{3})+$/.test(s)) {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : (negativo ? -n : n);
}

// ── TIPO (quando a planilha diz com PALAVRA, não com sinal) ──────────────────
const RE_GASTO   = /^(despesas?|gastos?|saidas?|debitos?|d|pagamentos?|expenses?|out|sai)$/;
const RE_RECEITA = /^(receitas?|entradas?|creditos?|c|recebimentos?|income|in|ganhos?)$/;
const tipoDaPalavra = (c: Celula): 'Gasto' | 'Recebimento' | null => {
  const v = semAcento(c);
  if (RE_GASTO.test(v)) return 'Gasto';
  if (RE_RECEITA.test(v)) return 'Recebimento';
  return null;
};

// ── CABEÇALHO ───────────────────────────────────────────────────────────────
const RE_H_DATA    = /\b(data|date|dt|dia)\b/;
const RE_H_DESC    = /(descri|histor|memo|titulo|estabel|lancamento|nome|name|detalhe|observ)/;
const RE_H_VALOR   = /(valor|amount|amt|montante|quantia|total)/;
const RE_H_ENTRADA = /^(entradas?|creditos?|receitas?|credit|inflow)\b/;
const RE_H_SAIDA   = /^(saidas?|debitos?|despesas?|debit|outflow)\b/;
const RE_H_TIPO    = /^(tipo|type|natureza|movimentacao|operacao|tipo de (lancamento|transacao|movimentacao))$/;

interface Mapa { data: number; desc: number; valor: number; entrada: number; saida: number; tipo: number }

function mapearCabecalho(linha: Celula[]): Mapa | null {
  const h = linha.map(semAcento);
  const idx = (re: RegExp, pular: number[] = []) => h.findIndex((x, i) => x && re.test(x) && !pular.includes(i));
  const data = idx(RE_H_DATA);
  if (data < 0) return null;
  const entrada = idx(RE_H_ENTRADA, [data]);
  const saida = idx(RE_H_SAIDA, [data, entrada]);
  const valor = idx(RE_H_VALOR, [data, entrada, saida]);
  if (valor < 0 && (entrada < 0 || saida < 0)) return null;
  return {
    data, valor, entrada, saida,
    desc: idx(RE_H_DESC, [data, valor, entrada, saida]),
    tipo: idx(RE_H_TIPO, [data, valor, entrada, saida]),
  };
}

/**
 * Linhas de células → transações. O cabeçalho é PROCURADO nas 20 primeiras
 * linhas: exportação de app costuma começar com título, período e linha em
 * branco antes da tabela.
 */
export function parseTabela(linhas: Celula[][]): TxParsed[] {
  const limpas = (linhas || []).filter((l) => Array.isArray(l) && l.some((c) => c != null && String(c).trim() !== ''));
  let inicio = -1, mapa: Mapa | null = null;
  for (let i = 0; i < Math.min(20, limpas.length); i++) {
    const m = mapearCabecalho(limpas[i]);
    if (m) { inicio = i; mapa = m; break; }
  }
  if (!mapa) return tabelaSemCabecalho(limpas);

  // A coluna "tipo" só vale se o CONTEÚDO for mesmo despesa/receita — "tipo de
  // pagamento" (Pix, cartão) tem o mesmo nome e não diz o sinal.
  const corpo = limpas.slice(inicio + 1);
  let usaTipo = false;
  if (mapa.tipo >= 0) {
    const preenchidas = corpo.filter((l) => semAcento(l[mapa!.tipo]));
    const reconhecidas = preenchidas.filter((l) => tipoDaPalavra(l[mapa!.tipo]));
    usaTipo = preenchidas.length > 0 && reconhecidas.length / preenchidas.length >= 0.6;
  }

  const out: TxParsed[] = [];
  for (const l of corpo) {
    const data = parseData(l[mapa.data]);
    if (!data) continue;

    let v: number;
    if (mapa.entrada >= 0 && mapa.saida >= 0) {
      const e = parseValor(l[mapa.entrada]);
      const s = parseValor(l[mapa.saida]);
      // Saída às vezes vem com sinal, às vezes sem: vale o módulo.
      v = (isNaN(e) ? 0 : Math.abs(e)) - (isNaN(s) ? 0 : Math.abs(s));
    } else {
      v = parseValor(l[mapa.valor]);
    }
    if (isNaN(v) || v === 0) continue;

    let tipo: 'Gasto' | 'Recebimento' = v < 0 ? 'Gasto' : 'Recebimento';
    if (usaTipo) tipo = tipoDaPalavra(l[mapa.tipo]) ?? tipo;

    const desc = mapa.desc >= 0 ? String(l[mapa.desc] ?? '').trim() : '';
    out.push({ data, observacao: (desc || 'Transação importada').slice(0, 200), valor: Math.abs(v), tipo });
  }
  return out;
}

/** Sem cabeçalho reconhecível: 1ª coluna com data = data, última numérica = valor. */
function tabelaSemCabecalho(linhas: Celula[][]): TxParsed[] {
  const out: TxParsed[] = [];
  for (const l of linhas) {
    if (l.length < 2) continue;
    const data = parseData(l[0]);
    if (!data) continue;
    const v = parseValor(l[l.length - 1]);
    if (isNaN(v) || v === 0) continue;
    const desc = l.slice(1, -1).map((c) => String(c ?? '').trim()).filter(Boolean).join(' - ');
    out.push({ data, observacao: (desc || 'Transação importada').slice(0, 200), valor: Math.abs(v), tipo: v < 0 ? 'Gasto' : 'Recebimento' });
  }
  return out;
}

// ── CSV → linhas ────────────────────────────────────────────────────────────
function quebrarLinha(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '', aspas = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (aspas && line[i + 1] === '"') { cur += '"'; i++; continue; }   // "" dentro de aspas
      aspas = !aspas; continue;
    }
    if (ch === sep && !aspas) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Texto CSV → linhas. O separador é o que MAIS aparece nas primeiras linhas
 * (`;` no Excel em português, `,` no resto do mundo, TAB em alguns bancos) —
 * olhar só a 1ª linha errava quando ela era um título.
 */
export function csvParaLinhas(texto: string): string[][] {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const amostra = linhas.slice(0, 15).join('\n');
  const conta = (sep: string) => amostra.split(sep).length - 1;
  const sep = [';', ',', '\t'].reduce((a, b) => (conta(b) > conta(a) ? b : a), ';');
  return linhas.map((l) => quebrarLinha(l, sep));
}

export const parseCSV = (texto: string): TxParsed[] => parseTabela(csvParaLinhas(texto));

/** Extensão do arquivo → como ler. */
export const ehPlanilhaExcel = (nome: string) => /\.xlsx$/i.test(nome || '');
