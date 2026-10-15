// =============================================================================
// Importar FATURA / EXTRATO em PDF.
//
// Pedido de cliente (Marcio, out/2026): "como lançar fatura de cartão? Enviei o
// PDF e não aceita." O importador lia OFX e planilha, mas PDF ficava "em breve".
//
// ⚠️ PDF DE EXTRATO É APROXIMADO — cada banco diagrama de um jeito e o PDF não
// tem estrutura de dados, só texto posicionado. Então a regra aqui é
// CONSERVADORA e o usuário CONFERE tudo na tela de revisão antes de salvar
// (igual OFX/CSV): nada entra automático. Melhor trazer de menos (o cliente
// completa à mão) do que inventar lançamento errado.
//
// Divisão: a extração das LINHAS do PDF roda no SERVIDOR (app/api/importar/pdf —
// pdf.js em Node, onde o `require("canvas")` é preguiçoso e nunca dispara na
// extração de texto; no navegador o Turbopack quebra tentando empacotar o
// canvas). `parsePdfLinhas` (PURO, testável) vira as linhas em lançamentos, no
// client. Eval: npm run eval:importar-pdf
// =============================================================================

import { TxParsed, parseData, parseValor } from './importar-tabela';

// Valor em real: 1.234,56 · 150,00 · R$ 150,00 · -150,00 · 150,00 D/C.
// Captura o SINAL (-) e o sufixo D/C (débito/crédito) quando houver.
const TOKEN_VALOR = /(-)?\s*R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})\s*([DC])?\b/gi;
// Data no começo/meio da linha: DD/MM, DD/MM/AA ou DD/MM/AAAA.
const RE_DATA = /(?:^|\s)(\d{2})\/(\d{2})(?:\/(\d{2,4}))?(?=\s|$)/;

// Crédito/estorno (não é compra): vira Recebimento pra não contar como gasto.
const KW_CREDITO = /(pagamento|pgto|pagto|estorno|estornad|cr[eé]dito|reembolso|devolu[cç]|ressarc|cashback)/i;
// Linhas que NUNCA são transação (cabeçalho/total/resumo da fatura).
const KW_IGNORAR = /(saldo\s+anterior|limite\s+(?:total|dispon|de\s+cr[eé]dito|utilizado)|total\s+(?:da\s+fatura|a\s+pagar|dos\s+lan)|pagamento\s+m[ií]nimo|valor\s+m[ií]nimo|^total\b|^subtotal\b|encargos|juros\s+(?:rotativ|contratad)|data\s+valor\s+)/i;

function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Ano de referência pra datas SEM ano (DD/MM). Procura uma data completa
 * (DD/MM/AAAA) ou um ano solto (20xx) no texto — o cabeçalho da fatura quase
 * sempre tem. Sem achar, usa o ano atual.
 */
function anoDeReferencia(linhas: string[], hoje: Date): number {
  for (const l of linhas) {
    const m = l.match(/\b\d{2}\/\d{2}\/(20\d{2})\b/) || l.match(/\b(20\d{2})\b/);
    if (m) { const a = +m[1]; if (a >= 2015 && a <= hoje.getFullYear() + 1) return a; }
  }
  return hoje.getFullYear();
}

/**
 * PURA. Linhas de texto do PDF → lançamentos. Uma linha vira transação só
 * quando tem DATA **e** VALOR **e** uma descrição real entre os dois.
 *
 * @param linhas  linhas já reconstruídas do PDF (ver extrairLinhasPdf)
 * @param hojeISO 'YYYY-MM-DD' (pra testar determinístico; default = hoje)
 */
export function parsePdfLinhas(linhas: string[], hojeISO?: string): TxParsed[] {
  const hoje = hojeISO ? new Date(`${hojeISO}T12:00:00`) : new Date();
  const hojeStr = isoDia(hoje);
  const anoRef = anoDeReferencia(linhas || [], hoje);
  const out: TxParsed[] = [];

  for (const raw of linhas || []) {
    const linha = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!linha || KW_IGNORAR.test(linha)) continue;

    const md = linha.match(RE_DATA);
    if (!md) continue;                                   // sem data → não é transação

    const valores = [...linha.matchAll(TOKEN_VALOR)];
    if (!valores.length) continue;
    const ultimo = valores[valores.length - 1];
    const valorNum = parseValor(ultimo[2]);
    if (!(valorNum > 0)) continue;

    // Descrição = o que está ENTRE a data e o último valor.
    const iniDesc = (md.index ?? 0) + md[0].length;
    const fimDesc = ultimo.index ?? linha.length;
    const desc = linha.slice(iniDesc, fimDesc)
      .replace(/\s+/g, ' ').trim().replace(/^[-–·.\s]+|[-–·.\s]+$/g, '');
    if (desc.length < 2 || !/[a-zA-ZÀ-ÿ]/.test(desc)) continue;  // sem texto real → pula

    // Data: ano explícito vence; sem ano, usa o de referência e, se cair no
    // FUTURO, volta um ano (fatura de dez vista em jan, etc.).
    let ano = md[3] ? (md[3].length === 2 ? 2000 + +md[3] : +md[3]) : anoRef;
    let dataISO = parseData(`${md[1]}/${md[2]}/${ano}`);
    if (!dataISO) continue;
    if (!md[3] && dataISO > hojeStr) {
      ano -= 1;
      dataISO = parseData(`${md[1]}/${md[2]}/${ano}`) || dataISO;
    }

    // Tipo: compra (Gasto) por padrão; crédito/estorno/pagamento ou valor
    // negativo/sufixo "C" vira Recebimento (não conta como gasto).
    const negativo = !!ultimo[1];
    const credito = (ultimo[3] || '').toUpperCase() === 'C' || KW_CREDITO.test(desc);
    const tipo: 'Gasto' | 'Recebimento' = (negativo || credito) ? 'Recebimento' : 'Gasto';

    out.push({ data: dataISO, observacao: desc.slice(0, 120), valor: valorNum, tipo });
  }

  return out;
}
