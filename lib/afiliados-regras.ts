// =============================================================================
// PROGRAMA DE AFILIADOS — as regras de dinheiro, puras (eval:afiliados).
//
// 30% da primeira cobrança, 15% de cada renovação por até 24 meses, 30% do
// vitalício. A base é o valor LÍQUIDO repassado pela loja (depois da taxa do
// Stripe/Mercado Pago), como dizem as regras aceitas na candidatura. A
// comissão libera 30 dias depois da cobrança (reembolso/contestação).
//
// Tudo em CENTAVOS.
// =============================================================================

export const COMISSAO_PRIMEIRA = 30;
export const COMISSAO_RENOVACAO = 15;
export const COMISSAO_VITALICIO = 30;
export const MESES_RENOVACAO = 24;
export const DIAS_CARENCIA = 30;
export const DESCONTO_PADRAO = 10;
export const COOKIE_AFILIADO = 'sora_af';
export const PARAM_AFILIADO = 'af';
export const DIAS_COOKIE = 60;

const DIA = 86400000;

// ── Código ───────────────────────────────────────────────────────────────────

export function normalizarCodigoAfiliado(c?: string | null): string {
  return String(c || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * ⚠️ "SORA…" é reservado pros cupons da casa, e um código que já é cupom do
 * checkout faria o afiliado receber por um desconto que não é dele.
 */
export function motivoCodigoInvalido(codigo: string, reservados: string[] = []): string | null {
  if (!/^[A-Z][A-Z0-9]{2,19}$/.test(codigo)) return 'Use de 3 a 20 letras e números, começando com letra.';
  if (codigo.startsWith('SORA')) return 'Códigos que começam com SORA são reservados.';
  if (reservados.includes(codigo)) return 'Esse código já é um cupom da Sora.';
  return null;
}

export function sugerirCodigo(nome?: string | null): string {
  const primeiro = normalizarCodigoAfiliado(String(nome || '').trim().split(/\s+/)[0]).replace(/^[0-9]+/, '').slice(0, 16);
  return primeiro.length >= 3 && !primeiro.startsWith('SORA') ? primeiro : 'PARCEIRO';
}

/** Preço com o desconto — mesma conta dos cupons do vitalício (lib/cupons). */
export function comDesconto(valor: number, pct: number): number {
  return Math.max(0, Math.round(valor * (1 - pct / 100) * 100) / 100);
}

// ── Quem pode ser atribuído ──────────────────────────────────────────────────

export type ClienteAf = {
  id: string; email?: string | null; plano?: string | null;
  vitalicio?: boolean | null; stripe_subscription_id?: string | null;
};
export type DonoAf = { user_id: string; email?: string | null; ativo: boolean };

/**
 * Por que este cliente NÃO conta pro afiliado (null = conta).
 *
 * `jaPagou` = o código foi usado no próprio checkout, que o Stripe só aceita na
 * primeira compra: ali a assinatura que aparece na conta é a que acabou de
 * nascer, então ela não pode desqualificar.
 */
export function motivoNaoAtribuir(
  cliente: ClienteAf | null, dono: DonoAf | null,
  { temComissao = false, noCheckout = false }: { temComissao?: boolean; noCheckout?: boolean } = {},
): 'inativo' | 'proprio' | 'ja_cliente' | null {
  if (!cliente || !dono || !dono.ativo) return 'inativo';
  const mail = (e?: string | null) => String(e || '').trim().toLowerCase();
  if (cliente.id === dono.user_id || (mail(cliente.email) && mail(cliente.email) === mail(dono.email))) return 'proprio';
  if (temComissao || cliente.vitalicio) return 'ja_cliente';
  if (noCheckout) return null;
  if (cliente.stripe_subscription_id) return 'ja_cliente';
  if (!['', 'inativo', 'gratis'].includes(String(cliente.plano || ''))) return 'ja_cliente';
  return null;
}

// ── As comissões de um cliente ───────────────────────────────────────────────

export type Pagamento = {
  referencia: string;
  origem: 'stripe' | 'mercadopago';
  tipo: 'assinatura' | 'vitalicio';
  pagoEm: number;        // ms
  valorPago: number;     // o que o cliente pagou
  reembolsado: number;
  liquido: number;       // repassado pela loja (depois da taxa)
  contestado?: boolean;
};

export type Tipo = 'primeira' | 'renovacao' | 'vitalicio';

export type Esperada = {
  referencia: string; origem: 'stripe' | 'mercadopago'; tipo: Tipo;
  pagoEm: number; base: number; pct: number; valor: number;
};

/** Líquido que sobrou: reembolso parcial reduz na proporção; contestação zera. */
export function baseDaComissao(p: Pagamento): number {
  if (p.contestado || !(p.valorPago > 0)) return 0;
  const fica = 1 - Math.min(Math.max(p.reembolsado || 0, 0), p.valorPago) / p.valorPago;
  return Math.max(0, Math.round(p.liquido * fica));
}

export function valorDaComissao(base: number, pct: number): number {
  return Math.round((base * pct) / 100);
}

export function somarMeses(ms: number, meses: number): number {
  const d = new Date(ms);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return d.getTime();
}

/**
 * O que este cliente deve render, olhando TODAS as cobranças dele.
 * `gravadas` mantém o tipo e o percentual de quem já foi contado (um estorno
 * não "promove" uma renovação antiga a primeira cobrança).
 */
export function comissoesDoCliente(
  pagamentos: Pagamento[],
  { atribuidoEm, gravadas = new Map<string, { tipo: Tipo; pct: number }>() }:
    { atribuidoEm: number; gravadas?: Map<string, { tipo: Tipo; pct: number }> },
): Esperada[] {
  // 1 dia de folga: a atribuição é gravada no checkout, instantes antes.
  const validos = pagamentos
    .filter((p) => p.pagoEm >= atribuidoEm - DIA && p.valorPago > 0)
    .sort((a, b) => a.pagoEm - b.pagoEm || a.referencia.localeCompare(b.referencia));
  const saida: Esperada[] = [];
  let temPrimeira = false;
  let inicio: number | null = null;
  for (const p of validos) {
    const base = baseDaComissao(p);
    const ja = gravadas.get(p.referencia);
    let tipo: Tipo; let pct: number;
    if (p.tipo === 'vitalicio') {
      tipo = 'vitalicio'; pct = ja ? ja.pct : COMISSAO_VITALICIO;
    } else {
      if (inicio === null) inicio = p.pagoEm;
      if (ja) { tipo = ja.tipo; pct = ja.pct; }
      else if (!temPrimeira) { tipo = 'primeira'; pct = COMISSAO_PRIMEIRA; }
      else {
        if (p.pagoEm >= somarMeses(inicio, MESES_RENOVACAO)) continue;
        tipo = 'renovacao'; pct = COMISSAO_RENOVACAO;
      }
      if (base > 0) temPrimeira = true;
    }
    saida.push({
      referencia: p.referencia, origem: p.origem, tipo, pct,
      pagoEm: p.pagoEm, base, valor: valorDaComissao(base, pct),
    });
  }
  return saida;
}

// ── Do esperado pro banco ────────────────────────────────────────────────────

export type Linha = {
  id: string; referencia: string; ajuste_n: number; tipo: Tipo; pct: number;
  base_centavos: number; valor_centavos: number;
  status: 'pendente' | 'paga' | 'cancelada';
  pago_em: string; liberada_em: string;
};

export type Nova = Omit<Linha, 'id'> & { origem: 'stripe' | 'mercadopago' };
export type Mudanca = { id: string; campos: Partial<Pick<Linha, 'base_centavos' | 'valor_centavos' | 'status'>> };

export const liberadaEm = (pagoEm: number) => pagoEm + DIAS_CARENCIA * DIA;

/**
 * Compara o que deveria existir com o que está gravado.
 *
 * ⚠️ Comissão JÁ PAGA nunca é reescrita: a diferença vira uma linha de ajuste
 * (negativa num estorno), descontada do próximo repasse. E referência que não
 * veio na leitura fica como está — falha de leitura não cancela nada.
 */
export function planejarAtualizacao(esperadas: Esperada[], linhas: Linha[], agora = Date.now()) {
  const inserir: Nova[] = [];
  const atualizar: Mudanca[] = [];
  for (const e of esperadas) {
    const doRef = linhas.filter((l) => l.referencia === e.referencia).sort((a, b) => a.ajuste_n - b.ajuste_n);
    if (!doRef.length) {
      if (e.valor > 0) {
        inserir.push({
          referencia: e.referencia, origem: e.origem, ajuste_n: 0, tipo: e.tipo, pct: e.pct,
          base_centavos: e.base, valor_centavos: e.valor, status: 'pendente',
          pago_em: new Date(e.pagoEm).toISOString(), liberada_em: new Date(liberadaEm(e.pagoEm)).toISOString(),
        });
      }
      continue;
    }
    const pagas = doRef.filter((l) => l.status === 'paga');
    if (!pagas.length) {
      const l = doRef[0];
      if (e.valor <= 0) {
        if (l.status !== 'cancelada') atualizar.push({ id: l.id, campos: { status: 'cancelada' } });
      } else if (l.valor_centavos !== e.valor || l.status === 'cancelada') {
        atualizar.push({ id: l.id, campos: { base_centavos: e.base, valor_centavos: e.valor, status: 'pendente' } });
      }
      continue;
    }
    const soma = doRef.filter((l) => l.status !== 'cancelada').reduce((s, l) => s + l.valor_centavos, 0);
    const falta = e.valor - soma;
    if (!falta) continue;
    const aberta = doRef.find((l) => l.status === 'pendente');
    if (aberta) {
      const novo = aberta.valor_centavos + falta;
      atualizar.push({ id: aberta.id, campos: novo === 0 ? { status: 'cancelada' } : { valor_centavos: novo } });
    } else {
      inserir.push({
        referencia: e.referencia, origem: e.origem,
        ajuste_n: doRef[doRef.length - 1].ajuste_n + 1, tipo: e.tipo, pct: e.pct,
        base_centavos: 0, valor_centavos: falta, status: 'pendente',
        pago_em: new Date(e.pagoEm).toISOString(), liberada_em: new Date(agora).toISOString(),
      });
    }
  }
  return { inserir, atualizar };
}

// ── Os totais ────────────────────────────────────────────────────────────────

type ParaSomar = Pick<Linha, 'valor_centavos' | 'status' | 'liberada_em'> & { id?: string };

/** Pendente já liberada — e todo desconto (negativo), que vale na hora. */
export function podePagar(l: ParaSomar, agora = Date.now()): boolean {
  return l.status === 'pendente' && (l.valor_centavos < 0 || new Date(l.liberada_em).getTime() <= agora);
}

export function resumirComissoes(linhas: ParaSomar[], agora = Date.now()) {
  let aReceber = 0, emCarencia = 0, recebido = 0;
  for (const l of linhas) {
    if (l.status === 'paga') recebido += l.valor_centavos;
    else if (podePagar(l, agora)) aReceber += l.valor_centavos;
    else if (l.status === 'pendente') emCarencia += l.valor_centavos;
  }
  return { aReceber, emCarencia, recebido };
}
