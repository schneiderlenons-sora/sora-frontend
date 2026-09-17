// =============================================================================
// Moeda da carteira — catálogo e formatação do painel.
//
// ESPELHA sora-backend/src/services/moeda.js (catálogo e `normalizarMoeda`).
// Mexeu num, mexa no outro.
//
// ⚠️ A CONVERSÃO NÃO MORA AQUI, DE PROPÓSITO. O backend manda `saldo_brl`
// pronto em cada carteira. Se o painel buscasse câmbio por conta própria, as 5
// telas que somam saldo teriam cada uma a sua cotação e divergiriam entre si —
// exatamente o tipo de "fatura zerada no zap × R$ 146,89 no painel" que este
// projeto já pagou caro pra resolver.
// =============================================================================

export type Moeda = 'BRL' | 'USD' | 'EUR' | 'GBP' | 'CHF' | 'CAD' | 'AUD' | 'JPY' | 'ARS' | 'MXN' | 'CLP' | 'NOK';

// `casas` é opcional: só as moedas SEM centavos (iene, peso chileno) a
// declaram. Quem não declara segue em 2.
export const MOEDAS: Record<Moeda, { nome: string; simbolo: string; bandeira: string; casas?: number }> = {
  BRL: { nome: 'Real',              simbolo: 'R$',  bandeira: '🇧🇷' },
  USD: { nome: 'Dólar americano',   simbolo: 'US$', bandeira: '🇺🇸' },
  EUR: { nome: 'Euro',              simbolo: '€',   bandeira: '🇪🇺' },
  GBP: { nome: 'Libra',             simbolo: '£',   bandeira: '🇬🇧' },
  CHF: { nome: 'Franco suíço',      simbolo: 'CHF', bandeira: '🇨🇭' },
  CAD: { nome: 'Dólar canadense',   simbolo: 'C$',  bandeira: '🇨🇦' },
  AUD: { nome: 'Dólar australiano', simbolo: 'A$',  bandeira: '🇦🇺' },
  JPY: { nome: 'Iene',              simbolo: '¥', casas: 0,   bandeira: '🇯🇵' },
  ARS: { nome: 'Peso argentino',    simbolo: 'AR$', bandeira: '🇦🇷' },
  MXN: { nome: 'Peso mexicano',     simbolo: 'MX$', bandeira: '🇲🇽' },
  CLP: { nome: 'Peso chileno',      simbolo: 'CLP$', casas: 0, bandeira: '🇨🇱' },
  NOK: { nome: 'Coroa norueguesa',  simbolo: 'kr',  bandeira: '🇳🇴' },
};

export const MOEDA_PADRAO: Moeda = 'BRL';

/** Normaliza o código. Vazio/desconhecido → 'BRL'. Espelha o backend. */
export function normalizarMoeda(m?: string | null): Moeda {
  const s = String(m || '').trim().toUpperCase();
  return (MOEDAS as Record<string, unknown>)[s] ? (s as Moeda) : MOEDA_PADRAO;
}

/**
 * A moeda é diferente da base do grupo? Sem `base`, compara com o real — o
 * comportamento de antes da migration 168.
 */
export function ehEstrangeira(m?: string | null, base?: string | null): boolean {
  return normalizarMoeda(m) !== normalizarMoeda(base);
}

/**
 * Formata NA MOEDA informada, sempre com a grafia numérica pt-BR.
 * Ex.: (6834.56, 'USD') → "US$ 6.834,56"
 *
 * ⚠️ Número em pt-BR com símbolo estrangeiro é intencional: o usuário é
 * brasileiro e lê "6.834,56". Trocar pra "6,834.56" no meio do painel em
 * português faz o valor parecer outro.
 */
export function formatarMoeda(valor: number | null | undefined, m?: string | null): string {
  const cod = normalizarMoeda(m);
  const n = Number(valor) || 0;
  // ⚠️ ESPELHO do services/moeda.js do backend — mexeu num, mexa no outro.
  // `casas` só existe nas moedas SEM centavos (iene e peso chileno): fixar 2
  // pra todo mundo mostrava ¥ 1.250,00 e CLP$ 1.250,00, valores que não
  // existem nesses países.
  const casas = MOEDAS[cod].casas ?? 2;
  const txt = n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${MOEDAS[cod].simbolo} ${txt}`;
}

// ── Dinheiro do PAINEL, na moeda base do grupo (migration 168) ──────────────
//
// ⚠️ NÃO É O `formatarMoeda` ACIMA, e não pode ser. Medido: o painel inteiro
// formata com `Intl.NumberFormat('pt-BR', { style: 'currency' })`, que produz
// `-R$⍽1.250,50` — sinal ANTES do símbolo e ESPAÇO INQUEBRÁVEL (U+00A0) entre
// o símbolo e o número. O `formatarMoeda` produz `R$ -1.250,50` com espaço
// comum. Trocar os 43 arquivos do painel por ele mudaria TODO valor da tela, e
// o espaço comum deixaria o "R$" quebrar de linha sozinho em card estreito.
// Ele fica como está: é o espelho do `formatar` do WhatsApp.
//
// Este usa o MESMO motor do painel e troca só o símbolo pelo do catálogo — o
// Intl em pt-BR escreve "NOK" e "JP¥" onde a Sora escreve "kr" e "¥" (no
// WhatsApp inclusive). Em BRL o símbolo trocado é o mesmo "R$", então a saída é
// idêntica caractere por caractere; `eval:dinheiro` trava isso.
//
// ⚠️ A GRAFIA DOS NÚMEROS SEGUE O IDIOMA DO PAINEL (pt-BR), NÃO A MOEDA. Moeda
// é do grupo; idioma é do usuário — são eixos separados. Um brasileiro com o
// grupo em coroa lê "kr 20.000,00", não "kr 20 000,00".
//
// ⚠️ SEM `casas` DO CATÁLOGO AQUI: o Intl já conhece as casas de cada moeda
// (iene e peso chileno saem sem centavos sozinhos). Passar mínimo/máximo só
// quando a tela pede explicitamente (`maximoCasas`), senão a saída em BRL
// deixaria de ser a de sempre.

const cacheFormatadores = new Map<string, Intl.NumberFormat>();

function formatadorIntl(moeda: Moeda, maximoCasas?: number): Intl.NumberFormat {
  const chave = `${moeda}|${maximoCasas ?? ''}`;
  let nf = cacheFormatadores.get(chave);
  if (!nf) {
    nf = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: moeda,
      ...(maximoCasas !== undefined ? { maximumFractionDigits: maximoCasas } : {}),
    });
    cacheFormatadores.set(chave, nf);
  }
  return nf;
}

/** Símbolo da moeda como a Sora escreve (R$, US$, kr…). */
export function simboloMoeda(m?: string | null): string {
  return MOEDAS[normalizarMoeda(m)].simbolo;
}

/**
 * Formata dinheiro no painel, na moeda informada.
 *
 * NÃO normaliza a entrada: `NaN` sai como antes (`R$ NaN`). Quem zerava valor
 * inválido continua zerando antes de chamar — ver `useDinheiro({ entrada })`.
 */
export function formatarDinheiro(
  valor: number,
  m?: string | null,
  opts: { maximoCasas?: number } = {},
): string {
  const cod = normalizarMoeda(m);
  const simbolo = MOEDAS[cod].simbolo;
  return formatadorIntl(cod, opts.maximoCasas)
    .formatToParts(valor)
    .map((p) => (p.type === 'currency' ? simbolo : p.value))
    .join('');
}

// ── Campo de valor digitado só com dígitos (Fase 2 da moeda base) ──────────
//
// O painel inteiro digita valor do mesmo jeito: o teclado numérico produz só
// dígitos e a tela os lê na MENOR UNIDADE da moeda ("125050" → 1.250,50). Doze
// campos faziam isso com `/ 100` e 2 casas cravadas.
//
// ⚠️ `/ 100` SÓ É CERTO EM MOEDA COM CENTAVOS. Em iene e peso chileno (sem
// centavos) quem digita "1250" quer 1.250, e o `/ 100` gravaria 12,50 — valor
// 100× menor, calado. USD e NOK têm 2 casas, então hoje isto está dormente; os
// helpers existem pra armadilha não voltar na primeira moeda sem centavos.
//
// ⚠️ A GRAFIA É pt-BR em qualquer moeda (decisão do dono, 17/09/2026): quem
// digita é o usuário em português. Só as CASAS vêm da moeda.
//
// A moeda é a do valor que está sendo digitado: a base do grupo na maioria dos
// campos, a da CONTA em "Nova transação" e "Conta fixa" (migration 144).

/** Casas decimais da moeda: 0 em iene e peso chileno, 2 no resto. */
export function casasDaMoeda(m?: string | null): number {
  return MOEDAS[normalizarMoeda(m)].casas ?? 2;
}

/** Menor unidade → valor. `(125050, 'BRL')` → 1250.5. */
export function valorDasUnidades(unidades: number, m?: string | null): number {
  return unidades / 10 ** casasDaMoeda(m);
}

/** Valor → menor unidade, pra preencher o campo ao editar. `(1250.5, 'BRL')` → 125050. */
export function unidadesDoValor(valor: number, m?: string | null): number {
  return Math.round(valor * 10 ** casasDaMoeda(m));
}

/** Texto do campo (sem símbolo). `(125050, 'BRL')` → "1.250,50"; `(1250, 'JPY')` → "1.250". */
export function textoDasUnidades(unidades: number, m?: string | null): string {
  const casas = casasDaMoeda(m);
  return valorDasUnidades(unidades, m).toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

/** Tipo mínimo de carteira que as telas somam. */
type CarteiraLike = {
  saldo?: number | null; saldo_brl?: number | null; moeda?: string | null;
  /** Migration 168: o backend manda o saldo também na moeda BASE do grupo. */
  saldo_base?: number | null; moeda_base?: string | null;
};

/**
 * Saldo da carteira EM BRL, pra entrar em soma com as outras.
 *
 * ⚠️ Usa `saldo_brl` do backend quando existe. O fallback pra `saldo` é o que
 * mantém tudo funcionando ANTES da migration 144 e em qualquer resposta antiga
 * em cache (lib/swr-cache guarda payloads no localStorage) — ali `saldo` já é
 * BRL, então o número continua certo.
 *
 * ⚠️ `saldo_brl === null` significa CÂMBIO INDISPONÍVEL, não zero. Devolve null
 * pra quem soma poder avisar em vez de sumir com o dinheiro.
 */
export function saldoBRL(w: CarteiraLike): number | null {
  if (w?.saldo_brl === null) return null;             // câmbio falhou
  if (w?.saldo_brl !== undefined) return Number(w.saldo_brl) || 0;
  // ⚠️ SEM `saldo_brl`, SÓ DÁ PRA CONFIAR NO NÚMERO SE A CARTEIRA FOR EM REAL.
  // O fallback existe pra payload ANTIGO (pré-144) e pro cache do SWR, onde
  // `saldo` já é BRL — e ali `moeda` nem vem, então cai em BRL e nada muda.
  // Mas o SSR (`walletsDireto`) lê a wallet crua do Supabase e NÃO anexa
  // `saldo_brl`: numa conta em coroa, devolver `saldo` aqui exibe 4.090 NOK
  // como R$ 4.090 — exatamente o erro que esta função existe pra impedir.
  // Sem cotação não há conversão possível, e a resposta honesta é null, que
  // as telas já sabem mostrar como "câmbio indisponível".
  if (ehEstrangeira(w?.moeda)) return null;
  return Number(w?.saldo) || 0;                        // resposta antiga = BRL
}

/**
 * Saldo da carteira NA MOEDA BASE do grupo, pra entrar em soma com as outras.
 * É o que as telas somam desde a migration 168 — num grupo em real é
 * exatamente o `saldoBRL` (o eval `eval:moeda` §7 trava isso).
 *
 * ⚠️ `saldo_base` vem pronto do backend (`comSaldoNaBase`) e do SSR
 * (`walletsDireto`). Só vale se foi calculado PRA ESTA base: um payload em
 * cache de antes de uma troca de base traria o número em outra moeda.
 *
 * ⚠️ PAYLOAD SEM `saldo_base` (cache do SWR de antes deste campo, backend ainda
 * não publicado): em base real cai no `saldoBRL`, que é o mesmo número; em
 * outra base só confia no saldo da conta que JÁ está na base — o resto é
 * `null` (câmbio indisponível), nunca um número em moeda errada.
 */
export function saldoNaBase(w: CarteiraLike, base?: string | null): number | null {
  const b = normalizarMoeda(base);
  const doPayload = w?.saldo_base !== undefined
    && (w?.moeda_base == null || normalizarMoeda(w.moeda_base) === b);
  if (doPayload) return w.saldo_base === null ? null : Number(w.saldo_base) || 0;
  if (b === MOEDA_PADRAO) return saldoBRL(w);
  if (normalizarMoeda(w?.moeda) === b) return Number(w?.saldo) || 0;
  return null;
}

/**
 * Taxa da moeda da conta PARA a base do grupo — o `taxa_base` do backend.
 * Mesma regra de `saldoNaBase`: só vale se foi calculada pra esta base; payload
 * antigo em grupo em real usa `taxa_brl`, que é o mesmo número. `null` sem ela.
 */
export function taxaParaBase(
  w: { taxa_brl?: number | null; taxa_base?: number | null; moeda_base?: string | null } | null | undefined,
  base?: string | null,
): number | null {
  const b = normalizarMoeda(base);
  if (w?.taxa_base != null && (w.moeda_base == null || normalizarMoeda(w.moeda_base) === b)) return Number(w.taxa_base);
  if (b === MOEDA_PADRAO && w?.taxa_brl != null) return Number(w.taxa_brl);
  return null;
}

// ── Cartão numa moeda diferente da base (migration 168) ─────────────────────
//
// O caso real é o cartão do Open Finance (só fala real) num grupo em dólar. A
// fatura, o limite e os pagamentos estão NA MOEDA DO CARTÃO — é o número que o
// app do banco mostra. Só o que SOMA cartão com outra coisa converte pra base.

type CartaoLike = {
  moeda?: string | null;
  taxa_base?: number | null; moeda_base?: string | null; taxa_brl?: number | null;
};

/**
 * Pagar e antecipar pela Sora ficam travados neste cartão? Espelha
 * `cartaoForaDaBase` do backend (services/moeda.js).
 *
 * ⚠️ Grupo em REAL nunca trava — é o que mantém todo grupo que já existe
 * igual. E `moeda` AUSENTE não trava às cegas (payload antigo em cache).
 */
export function cartaoForaDaBase(cartao: CartaoLike | null | undefined, base?: string | null): boolean {
  if (!cartao || cartao.moeda === undefined) return false;
  const b = normalizarMoeda(base);
  if (b === MOEDA_PADRAO) return false;
  return normalizarMoeda(cartao.moeda) !== b;
}

/**
 * Leva um valor que está NA MOEDA DO CARTÃO pra moeda base, pra entrar em soma
 * com outros cartões. `cartao` é a carteira (/wallets) ou a fatura (/faturas) —
 * as duas trazem `taxa_base`. Cartão na base devolve o próprio valor.
 *
 * ⚠️ `moeda` ausente é tratada como a base: é payload de antes deste campo, e
 * até ele existir todo cartão nascia na moeda do grupo.
 * ⚠️ `null` = câmbio indisponível, nunca um número em moeda errada.
 */
export function valorDoCartaoNaBase(valor: number, cartao: CartaoLike | null | undefined, base?: string | null): number | null {
  const b = normalizarMoeda(base);
  if (cartao?.moeda == null || normalizarMoeda(cartao.moeda) === b) return valor;
  const t = taxaParaBase(cartao, b);
  if (t === null) return null;
  const escala = 10 ** casasDaMoeda(b);
  return Math.round((Number(valor) || 0) * t * escala) / escala;
}

/**
 * A fatura de /faturas com os valores levados pra moeda base — pra quem SOMA
 * (Previstos, pendências dos Relatórios). Cartão na base devolve o MESMO objeto.
 * `null` sem câmbio: quem chama tira a fatura da soma.
 */
export function faturaNaBase<F extends CartaoLike & {
  fatura?: number; pago?: number; restante?: number; total_previsto?: number;
  vencida?: { restante: number } | null; proxima?: { restante: number; fatura?: number } | null;
}>(f: F, base?: string | null): F | null {
  const b = normalizarMoeda(base);
  if (!f || f.moeda == null || normalizarMoeda(f.moeda) === b) return f;
  if (taxaParaBase(f, b) === null) return null;
  const n = (v: number) => valorDoCartaoNaBase(v, f, b) as number;   // a taxa existe (checada acima)
  const o = (v: number | undefined) => (typeof v === 'number' ? n(v) : v);
  return {
    ...f,
    fatura: o(f.fatura), pago: o(f.pago), restante: o(f.restante), total_previsto: o(f.total_previsto),
    vencida: f.vencida ? { ...f.vencida, restante: n(f.vencida.restante) } : f.vencida,
    proxima: f.proxima ? { ...f.proxima, restante: n(f.proxima.restante), fatura: o(f.proxima.fatura) } : f.proxima,
    moeda: b,
  } as F;
}

/** Soma saldos NA MOEDA BASE avisando o que ficou de fora. */
export function somarSaldosNaBase(ws: CarteiraLike[], base?: string | null): { total: number; semCambio: number } {
  let total = 0;
  let semCambio = 0;
  for (const w of ws || []) {
    const v = saldoNaBase(w, base);
    if (v === null) { semCambio++; continue; }
    total += v;
  }
  return { total, semCambio };
}

/**
 * Soma saldos em BRL avisando o que ficou de fora.
 * Espelha `somarSaldos` do backend.
 */
export function somarSaldosBRL(ws: CarteiraLike[]): { total: number; semCambio: number } {
  let total = 0;
  let semCambio = 0;
  for (const w of ws || []) {
    const v = saldoBRL(w);
    if (v === null) { semCambio++; continue; }
    total += v;
  }
  return { total, semCambio };
}
