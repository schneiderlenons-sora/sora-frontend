'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────
// Mapa nome (normalizado) → slug do Simple Icons
// CDN público: https://cdn.simpleicons.org/{slug} retorna SVG colorido oficial.
// Se a marca não existir no CDN, o componente cai pra render do fallback.
// ─────────────────────────────────────────────────────────────
const MARCAS: Record<string, string> = {
  // ── Streaming / Assinaturas ──
  spotify:           'spotify',
  netflix:           'netflix',
  'disney plus':     'disneyplus',
  'disney+':         'disneyplus',
  disneyplus:        'disneyplus',
  disney:            'disneyplus',
  'hbo max':         'max',
  'hbo':             'hbo',
  max:               'max',
  'prime video':     'primevideo',
  'amazon prime':    'primevideo',
  primevideo:        'primevideo',
  'globo play':      'globo',
  globoplay:         'globo',
  globo:             'globo',
  'apple music':     'applemusic',
  applemusic:        'applemusic',
  'apple tv':        'appletv',
  appletv:           'appletv',
  deezer:            'deezer',
  'youtube music':   'youtubemusic',
  youtubemusic:      'youtubemusic',
  youtube:           'youtube',
  'youtube premium': 'youtube',
  twitch:            'twitch',
  paramount:         'paramountplus',
  'paramount+':      'paramountplus',
  crunchyroll:       'crunchyroll',
  tidal:             'tidal',
  pandora:           'pandora',

  // ── Apps de produtividade / SaaS ──
  notion:            'notion',
  figma:             'figma',
  slack:             'slack',
  dropbox:           'dropbox',
  'google one':      'googleone',
  'google drive':    'googledrive',
  'icloud':          'icloud',
  '1password':       '1password',
  bitwarden:         'bitwarden',
  github:            'github',
  vercel:            'vercel',
  openai:            'openai',
  'chatgpt':         'openai',
  claude:            'anthropic',
  anthropic:         'anthropic',

  // ── Bancos brasileiros ──
  nubank:            'nubank',
  'banco inter':     'intersport',  // simple-icons usa 'intersport' (clube); pode dar fallback
  inter:             'intersport',
  bradesco:          'bradesco',
  itau:              'itau',
  'itaú':            'itau',
  santander:         'santander',
  'banco do brasil': 'bancodobrasil',
  bb:                'bancodobrasil',
  caixa:             'caixa',
  'c6 bank':         'c6bank',
  c6:                'c6bank',
  'c6bank':          'c6bank',
  'banco safra':     'safra',
  safra:             'safra',
  bnb:               'bancodonordeste',

  // ── Pagamentos / Carteira digital ──
  'mercado pago':    'mercadopago',
  mercadopago:       'mercadopago',
  picpay:            'picpay',
  paypal:            'paypal',
  stripe:            'stripe',
  visa:              'visa',
  mastercard:        'mastercard',
  pix:               'pix',
  'amex':            'americanexpress',
  'american express':'americanexpress',
  elo:               'elo',
  hipercard:         'hipercard',

  // ── Marketplaces / Compras ──
  amazon:            'amazon',
  'mercado livre':   'mercadolivre',
  mercadolivre:      'mercadolivre',
  'mercado-livre':   'mercadolivre',
  aliexpress:        'aliexpress',
  shopee:            'shopee',
  shein:             'shein',
  magalu:            'magazineluiza',
  'magazine luiza':  'magazineluiza',
  americanas:        'americanas',
  submarino:         'submarino',

  // ── Mobilidade ──
  uber:              'uber',
  '99':              '99',
  '99 pop':          '99',
  cabify:            'cabify',
  ifood:             'ifood',
  rappi:             'rappi',

  // ── Telecom / Conexão ──
  vivo:              'vivo',
  claro:             'claro',
  tim:               'tim',
  oi:                'oi',
  algar:             'algar',

  // ── Educação ──
  duolingo:          'duolingo',
  udemy:             'udemy',
  coursera:          'coursera',

  // ── Combustível / Locomoção ──
  'shell':           'shell',
  'petrobras':       'petrobras',
  'ipiranga':        'ipiranga',
  'ale':             'ale',
};

// Normaliza pra match: lowercase, remove acentos e emojis
function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\p{Emoji}/gu, '')
    .trim();
}

// Retorna o slug Simple Icons pra um nome, ou null se não conhecemos
export function slugDaMarca(nome: string): string | null {
  const key = normalizar(nome);
  if (!key) return null;
  if (MARCAS[key]) return MARCAS[key];
  // Match parcial: ex "Netflix Standard" → encontra "netflix"
  for (const [k, v] of Object.entries(MARCAS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

interface Props {
  nome:       string;
  size?:      number;
  className?: string;
  /** Conteúdo de fallback se a marca não existir no CDN. Default: null (não renderiza nada). */
  fallback?:  React.ReactNode;
  /** Wrapper opcional ao redor do ícone — útil pra criar avatar com background */
  wrap?:      (icon: React.ReactNode) => React.ReactNode;
}

/**
 * Renderiza o logo oficial colorido da marca (via cdn.simpleicons.org).
 * Cai em fallback se a marca não estiver mapeada OU se o CDN responder erro.
 */
export default function IconeMarca({ nome, size = 24, className = '', fallback = null, wrap }: Props) {
  const slug = slugDaMarca(nome);
  const [erro, setErro] = useState(false);

  if (!slug || erro) return <>{fallback}</>;

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.simpleicons.org/${slug}`}
      alt={nome}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErro(true)}
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );

  return <>{wrap ? wrap(img) : img}</>;
}

/**
 * Hook utilitário pra saber se um nome tem marca conhecida (pra UI condicional)
 */
export function temMarcaConhecida(nome: string): boolean {
  return slugDaMarca(nome) !== null;
}
