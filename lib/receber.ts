// =============================================================================
// Contas a RECEBER do Sora Negócios — situação, visão por cliente e exportação.
//
// Fonte única da regra que a tela A receber e os dois CSVs usam. Se a tela
// dissesse "vencida" e o arquivo "a vencer" pro mesmo lançamento, o dono não
// saberia em qual confiar. Travado em `npm run eval:receber`.
//
// - Recebível = `lancamentos_negocio` com tipo 'entrada' e status 'pendente'
//   (ver o cabeçalho de app/negocios/receber/page.tsx).
// - O CLIENTE é o campo `contraparte` (texto). A venda grava ali o nome do
//   cliente cadastrado; no lançamento manual é o que a pessoa digitou. Por isso
//   o agrupamento ignora caixa, acento e espaço repetido: "João Silva" e
//   "joao  silva" são a mesma pessoa.
// - Valores em CENTAVOS (como no banco); só viram reais na saída.
// =============================================================================

import { labelCategoria, type Lancamento } from './lancamentos';

export type GrupoReceber = 'vencida' | 'hoje' | 'futura' | 'sem_data';

export interface Situacao {
  grupo: GrupoReceber;
  /** Dias até o vencimento (negativo = venceu há N dias); null sem data. */
  dias: number | null;
}

const ORDEM_GRUPO: Record<GrupoReceber, number> = { vencida: 0, hoje: 1, futura: 2, sem_data: 3 };

/** Dias entre `hoje` e o vencimento, contados em dia de calendário. */
export function diasAte(vencimento: string | null | undefined, hoje: string): number | null {
  if (!vencimento) return null;
  const v = String(vencimento).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const a = Date.parse(`${v}T12:00:00Z`);
  const b = Date.parse(`${hoje.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86400000);
}

export function situacaoReceber(vencimento: string | null | undefined, hoje: string): Situacao {
  const dias = diasAte(vencimento, hoje);
  if (dias === null) return { grupo: 'sem_data', dias: null };
  if (dias < 0) return { grupo: 'vencida', dias };
  if (dias === 0) return { grupo: 'hoje', dias };
  return { grupo: 'futura', dias };
}

/** Texto da situação, igual pra tela e pro arquivo. */
export function rotuloSituacao(s: Situacao): string {
  if (s.grupo === 'sem_data') return 'Sem vencimento';
  if (s.grupo === 'hoje') return 'Vence hoje';
  const n = Math.abs(s.dias!);
  if (s.grupo === 'vencida') return `Vencida há ${n} dia${n === 1 ? '' : 's'}`;
  return `Vence em ${n} dia${n === 1 ? '' : 's'}`;
}

/** Urgência primeiro (vencida → hoje → a vencer → sem data), depois a data. */
export function ordenarPorUrgencia(lista: Lancamento[], hoje: string): Lancamento[] {
  return [...lista].sort((x, y) => {
    const sx = situacaoReceber(x.vencimento, hoje), sy = situacaoReceber(y.vencimento, hoje);
    if (sx.grupo !== sy.grupo) return ORDEM_GRUPO[sx.grupo] - ORDEM_GRUPO[sy.grupo];
    if (sx.dias !== sy.dias) return (sx.dias ?? 0) - (sy.dias ?? 0);
    return (x.descricao || '').localeCompare(y.descricao || '', 'pt-BR');
  });
}

// ── Por cliente ──────────────────────────────────────────────────────────────

export const SEM_CLIENTE = 'Sem cliente informado';

/** Chave do cliente: sem acento, sem caixa, espaços colapsados. '' = sem cliente. */
export function chaveCliente(nome: string | null | undefined): string {
  return String(nome || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Quão "bem escrita" está a grafia: mistura de maiúscula/minúscula e acentos. */
function capricho(s: string): number {
  const misto = /[a-zà-ÿ]/.test(s) && /[A-ZÀ-Þ]/.test(s) ? 2 : 0;
  const temAcento = /[̀-ͯ]/.test(s.normalize('NFD'));
  return misto + (temAcento ? 1 : 0);
}

export interface ResumoCliente {
  chave: string;
  /** Nome como a pessoa mais escreveu (ou SEM_CLIENTE). */
  nome: string;
  semCliente: boolean;
  quantidade: number;
  total: number;
  vencido: number;
  venceHoje: number;
  aVencer: number;
  semData: number;
  qtdVencidas: number;
  /** Maior atraso em dias (0 quando nada venceu). */
  maiorAtraso: number;
  /** Vencimento mais próximo ainda não vencido (hoje incluído), YYYY-MM-DD. */
  proximoVencimento: string | null;
  /** Cobranças do cliente, em ordem de urgência. */
  itens: Lancamento[];
}

/**
 * Posição de recebíveis por cliente. Ordem: quem deve VENCIDO primeiro (maior
 * valor vencido), depois o maior total; "sem cliente" sempre no fim — não é
 * alguém pra cobrar, é um lançamento sem nome pra completar.
 */
export function agruparPorCliente(lista: Lancamento[], hoje: string): ResumoCliente[] {
  const mapa = new Map<string, { itens: Lancamento[]; grafias: Map<string, number> }>();
  for (const l of lista) {
    const k = chaveCliente(l.contraparte);
    let g = mapa.get(k);
    if (!g) { g = { itens: [], grafias: new Map() }; mapa.set(k, g); }
    g.itens.push(l);
    const grafia = String(l.contraparte || '').replace(/\s+/g, ' ').trim();
    if (grafia) g.grafias.set(grafia, (g.grafias.get(grafia) || 0) + 1);
  }

  const resumos: ResumoCliente[] = [];
  for (const [chave, g] of mapa) {
    // Grafia mais usada; no empate, a mais bem escrita ("João Silva" vence
    // "joao silva" e "JOÃO SILVA") e, persistindo, a alfabética — determinístico,
    // não depende da ordem em que o servidor mandou.
    let nome = SEM_CLIENTE;
    let melhor = -1;
    let melhorCapricho = -1;
    for (const [grafia, n] of g.grafias) {
      const cap = capricho(grafia);
      const ganha = n > melhor
        || (n === melhor && cap > melhorCapricho)
        || (n === melhor && cap === melhorCapricho && grafia.localeCompare(nome, 'pt-BR') < 0);
      if (ganha) { nome = grafia; melhor = n; melhorCapricho = cap; }
    }
    const r: ResumoCliente = {
      chave, nome: chave ? nome : SEM_CLIENTE, semCliente: !chave,
      quantidade: g.itens.length, total: 0, vencido: 0, venceHoje: 0, aVencer: 0, semData: 0,
      qtdVencidas: 0, maiorAtraso: 0, proximoVencimento: null,
      itens: ordenarPorUrgencia(g.itens, hoje),
    };
    for (const l of g.itens) {
      const v = Number(l.valor) || 0;
      const s = situacaoReceber(l.vencimento, hoje);
      r.total += v;
      if (s.grupo === 'vencida') {
        r.vencido += v; r.qtdVencidas += 1;
        r.maiorAtraso = Math.max(r.maiorAtraso, -s.dias!);
      } else if (s.grupo === 'hoje') r.venceHoje += v;
      else if (s.grupo === 'futura') r.aVencer += v;
      else r.semData += v;
      if (s.grupo === 'hoje' || s.grupo === 'futura') {
        const venc = String(l.vencimento).slice(0, 10);
        if (!r.proximoVencimento || venc < r.proximoVencimento) r.proximoVencimento = venc;
      }
    }
    resumos.push(r);
  }

  return resumos.sort((a, b) => {
    if (a.semCliente !== b.semCliente) return a.semCliente ? 1 : -1;
    if (a.vencido !== b.vencido) return b.vencido - a.vencido;
    if (a.total !== b.total) return b.total - a.total;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

// ── CSV ──────────────────────────────────────────────────────────────────────
// Separador ";" e vírgula decimal: é o que o Excel em português abre direto,
// com cada coluna no lugar e o valor como NÚMERO (dá pra somar).

/** Célula de TEXTO: aspas escapadas e sem virar fórmula no Excel. */
export function celulaTexto(v: unknown): string {
  let s = String(v ?? '').replace(/\r?\n/g, ' ');
  // Texto digitado começando com = + - @ seria executado como fórmula ao
  // abrir o arquivo. O apóstrofo o mantém como texto.
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Centavos → "1234,56" (sem milhar, pro Excel ler como número). */
export function celulaValor(centavos: number): string {
  const n = Math.round(Number(centavos) || 0);
  const neg = n < 0;
  const abs = Math.abs(n);
  return `${neg ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** YYYY-MM-DD → dd/mm/aaaa ('' sem data). */
export function celulaData(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

const linha = (cels: string[]) => cels.join(';');

/** Uma cobrança por linha, em ordem de urgência. */
export function csvCobrancas(lista: Lancamento[], hoje: string): string {
  const cab = ['Cliente', 'Descrição', 'Categoria', 'Valor (R$)', 'Lançado em', 'Vencimento',
    'Situação', 'Dias em atraso', 'Observação'];
  // O nome UNIFICADO da visão por cliente, não a grafia de cada linha: senão
  // "João Silva", "joao  silva" e "JOÃO SILVA" virariam três clientes no
  // filtro ou na tabela dinâmica do Excel.
  const nomes = new Map(agruparPorCliente(lista, hoje).map(g => [g.chave, g.nome]));
  const linhas = [linha(cab.map(celulaTexto))];
  for (const l of ordenarPorUrgencia(lista, hoje)) {
    const s = situacaoReceber(l.vencimento, hoje);
    linhas.push(linha([
      celulaTexto(nomes.get(chaveCliente(l.contraparte)) || SEM_CLIENTE),
      celulaTexto(l.descricao),
      celulaTexto(labelCategoria('entrada', l.categoria)),
      celulaValor(l.valor),
      celulaData(l.data),
      celulaData(l.vencimento),
      celulaTexto(rotuloSituacao(s)),
      s.grupo === 'vencida' ? String(-s.dias!) : '0',
      celulaTexto(l.observacao || ''),
    ]));
  }
  return linhas.join('\r\n');
}

/** Posição por cliente + linha de total. */
export function csvPorCliente(lista: Lancamento[], hoje: string): string {
  const grupos = agruparPorCliente(lista, hoje);
  const cab = ['Cliente', 'Cobranças em aberto', 'Total em aberto (R$)', 'Vencido (R$)',
    'Vence hoje (R$)', 'A vencer (R$)', 'Sem vencimento (R$)', 'Cobranças vencidas',
    'Maior atraso (dias)', 'Próximo vencimento'];
  const linhas = [linha(cab.map(celulaTexto))];
  const t = { q: 0, total: 0, venc: 0, hoje: 0, aVencer: 0, sem: 0, qv: 0 };
  for (const g of grupos) {
    linhas.push(linha([
      celulaTexto(g.nome), String(g.quantidade), celulaValor(g.total), celulaValor(g.vencido),
      celulaValor(g.venceHoje), celulaValor(g.aVencer), celulaValor(g.semData),
      String(g.qtdVencidas), String(g.maiorAtraso), celulaData(g.proximoVencimento),
    ]));
    t.q += g.quantidade; t.total += g.total; t.venc += g.vencido; t.hoje += g.venceHoje;
    t.aVencer += g.aVencer; t.sem += g.semData; t.qv += g.qtdVencidas;
  }
  linhas.push(linha([
    celulaTexto('TOTAL'), String(t.q), celulaValor(t.total), celulaValor(t.venc),
    celulaValor(t.hoje), celulaValor(t.aVencer), celulaValor(t.sem), String(t.qv), '', '',
  ]));
  return linhas.join('\r\n');
}

/** Nome de arquivo seguro: "a-receber-loja-do-joao-2026-11-12.csv". */
export function nomeArquivo(prefixo: string, empresa: string | null | undefined, hoje: string): string {
  const slug = chaveCliente(empresa).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${prefixo}${slug ? `-${slug}` : ''}-${hoje.slice(0, 10)}.csv`;
}
