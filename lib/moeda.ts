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

export function ehEstrangeira(m?: string | null): boolean {
  return normalizarMoeda(m) !== MOEDA_PADRAO;
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

/** Tipo mínimo de carteira que as telas somam. */
type CarteiraLike = { saldo?: number | null; saldo_brl?: number | null; moeda?: string | null };

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
