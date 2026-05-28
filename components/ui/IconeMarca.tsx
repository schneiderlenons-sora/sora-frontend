'use client';

import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// Mapa nome (normalizado) → { si?: slug Simple Icons, domain?: brandfetch.io domain }
// Estratégia:
//   1. Tenta cdn.simpleicons.org/{slug}  (SVG monocromático colorido)
//   2. Se 404, tenta cdn.brandfetch.io/{domain}/w/64/h/64  (logo oficial colorido)
//   3. Se ainda falhar, renderiza o fallback do componente (emoji)
// ─────────────────────────────────────────────────────────────
type Marca = { si?: string; domain?: string };

const MARCAS: Record<string, Marca> = {
  // ── Streaming / Assinaturas ──
  spotify:           { si: 'spotify' },
  netflix:           { si: 'netflix' },
  'disney plus':     { domain: 'disneyplus.com' },  // Simple Icons removeu (trademark)
  'disney+':         { domain: 'disneyplus.com' },
  disneyplus:        { domain: 'disneyplus.com' },
  disney:            { domain: 'disneyplus.com' },
  // Max (ex HBO Max) — Simple Icons removeu por trademark; brandfetch
  // resolve melhor pelo domínio play.max.com (logo colorido oficial).
  'hbo max':         { domain: 'play.max.com' },
  hbomax:            { domain: 'play.max.com' },
  hbo:               { domain: 'play.max.com' },
  max:               { domain: 'play.max.com' },
  'prime video':     { domain: 'primevideo.com' },
  'amazon prime':    { domain: 'primevideo.com' },
  primevideo:        { domain: 'primevideo.com' },
  'globo play':      { domain: 'globoplay.com' },
  globoplay:         { domain: 'globoplay.com' },
  globo:             { domain: 'globoplay.com' },
  'apple music':     { si: 'applemusic' },
  applemusic:        { si: 'applemusic' },
  'apple tv':        { si: 'appletv' },
  'apple tv+':       { si: 'appletv' },
  appletv:           { si: 'appletv' },
  deezer:            { si: 'deezer' },
  'youtube music':   { si: 'youtubemusic' },
  youtubemusic:      { si: 'youtubemusic' },
  youtube:           { si: 'youtube' },
  'youtube premium': { si: 'youtube' },
  twitch:            { si: 'twitch' },
  paramount:         { si: 'paramountplus' },
  'paramount+':      { si: 'paramountplus' },
  crunchyroll:       { si: 'crunchyroll' },
  tidal:             { si: 'tidal' },
  pandora:           { si: 'pandora' },

  // ── Produtividade / SaaS ──
  notion:            { si: 'notion' },
  figma:             { si: 'figma' },
  slack:             { si: 'slack' },
  dropbox:           { si: 'dropbox' },
  'google one':      { si: 'googleone' },
  'google drive':    { si: 'googledrive' },
  icloud:            { si: 'icloud' },
  '1password':       { si: '1password' },
  bitwarden:         { si: 'bitwarden' },
  github:            { si: 'github' },
  vercel:            { si: 'vercel' },
  openai:            { si: 'openai' },
  chatgpt:           { si: 'openai' },
  claude:            { si: 'anthropic' },
  anthropic:         { si: 'anthropic' },

  // ── Bancos brasileiros ──
  nubank:            { si: 'nubank',          domain: 'nubank.com.br' },
  bradesco:          { si: 'bradesco',        domain: 'bradesco.com.br' },
  itau:              { si: 'itau',            domain: 'itau.com.br' },
  'itaú':            { si: 'itau',            domain: 'itau.com.br' },
  santander:         { si: 'santander',       domain: 'santander.com.br' },
  'banco do brasil': { si: 'bancodobrasil',   domain: 'bb.com.br' },
  bb:                { si: 'bancodobrasil',   domain: 'bb.com.br' },
  caixa:             { domain: 'caixa.gov.br' },
  'caixa economica': { domain: 'caixa.gov.br' },
  inter:             { domain: 'inter.co' },
  'banco inter':     { domain: 'inter.co' },
  'c6 bank':         { domain: 'c6bank.com.br' },
  c6:                { domain: 'c6bank.com.br' },
  c6bank:            { domain: 'c6bank.com.br' },
  'banco safra':     { si: 'safra',           domain: 'safra.com.br' },
  safra:             { si: 'safra',           domain: 'safra.com.br' },
  'banco do nordeste': { domain: 'bnb.gov.br' },
  bnb:               { domain: 'bnb.gov.br' },
  // Fintechs e bancos digitais
  'btg pactual':     { domain: 'btgpactual.com' },
  btg:               { domain: 'btgpactual.com' },
  'xp investimentos':{ domain: 'xpi.com.br' },
  xp:                { domain: 'xpi.com.br' },
  xpi:               { domain: 'xpi.com.br' },
  'banco original':  { domain: 'original.com.br' },
  original:          { domain: 'original.com.br' },
  next:              { domain: 'next.me' },
  'banco next':      { domain: 'next.me' },
  neon:              { domain: 'neon.com.br' },
  'banco neon':      { domain: 'neon.com.br' },
  'banco pan':       { domain: 'bancopan.com.br' },
  pan:               { domain: 'bancopan.com.br' },
  pagbank:           { domain: 'pagbank.com.br' },
  pagseguro:         { domain: 'pagseguro.com.br' },
  stone:             { domain: 'stone.com.br' },
  'will bank':       { domain: 'willbank.com.br' },
  willbank:          { domain: 'willbank.com.br' },
  will:              { domain: 'willbank.com.br' },
  sicredi:           { domain: 'sicredi.com.br' },
  sicoob:            { domain: 'sicoob.com.br' },
  '99pay':           { domain: '99pay.com.br' },
  banrisul:          { domain: 'banrisul.com.br' },
  'banco daycoval':  { domain: 'daycoval.com.br' },
  daycoval:          { domain: 'daycoval.com.br' },
  'banco bmg':       { domain: 'bancobmg.com.br' },
  bmg:               { domain: 'bancobmg.com.br' },
  bv:                { domain: 'bv.com.br' },
  'banco bv':        { domain: 'bv.com.br' },

  // ── Pagamentos / Carteira digital ──
  'mercado pago':    { si: 'mercadopago',     domain: 'mercadopago.com.br' },
  mercadopago:       { si: 'mercadopago',     domain: 'mercadopago.com.br' },
  picpay:            { si: 'picpay',          domain: 'picpay.com' },
  paypal:            { si: 'paypal' },
  stripe:            { si: 'stripe' },
  visa:              { si: 'visa' },
  mastercard:        { si: 'mastercard' },
  pix:               { si: 'pix' },
  amex:              { si: 'americanexpress' },
  'american express':{ si: 'americanexpress' },
  elo:               { si: 'elo' },
  hipercard:         { si: 'hipercard' },

  // ── Marketplaces / Compras ──
  amazon:            { si: 'amazon' },
  'mercado livre':   { si: 'mercadolivre',    domain: 'mercadolivre.com.br' },
  mercadolivre:      { si: 'mercadolivre',    domain: 'mercadolivre.com.br' },
  aliexpress:        { si: 'aliexpress' },
  shopee:            { si: 'shopee' },
  shein:             { domain: 'shein.com' },                 // Simple Icons removeu
  magalu:            { si: 'magazineluiza',   domain: 'magalu.com.br' },
  'magazine luiza':  { si: 'magazineluiza',   domain: 'magalu.com.br' },
  americanas:        { domain: 'americanas.com.br' },
  submarino:         { domain: 'submarino.com.br' },

  // ── Roupa / Esporte ──
  nike:              { si: 'nike',            domain: 'nike.com' },
  adidas:            { si: 'adidas',          domain: 'adidas.com' },
  puma:              { si: 'puma',            domain: 'puma.com' },
  zara:              { si: 'zara',            domain: 'zara.com' },
  'new balance':     { si: 'newbalance',      domain: 'newbalance.com' },
  reserva:           { domain: 'usereserva.com' },
  riachuelo:         { domain: 'riachuelo.com.br' },
  renner:            { domain: 'lojasrenner.com.br' },

  // ── Mobilidade / Delivery ──
  uber:              { si: 'uber' },
  '99':              { si: '99' },
  '99 pop':          { si: '99' },
  cabify:            { si: 'cabify' },
  ifood:             { si: 'ifood',           domain: 'ifood.com.br' },
  rappi:             { si: 'rappi' },

  // ── Telecom ──
  vivo:              { si: 'vivo' },
  claro:             { si: 'claro' },
  tim:               { si: 'tim' },
  oi:                { si: 'oi' },

  // ── Educação ──
  duolingo:          { si: 'duolingo' },
  udemy:             { si: 'udemy' },
  coursera:          { si: 'coursera' },

  // ── Combustível ──
  shell:             { si: 'shell' },
  petrobras:         { si: 'petrobras' },
  ipiranga:          { si: 'ipiranga' },
};

// Normaliza pra match: lowercase, sem acento, sem emoji
function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\p{Emoji}/gu, '')
    .trim();
}

export function marcaDe(nome: string): Marca | null {
  const key = normalizar(nome);
  if (!key) return null;
  if (MARCAS[key]) return MARCAS[key];
  for (const [k, v] of Object.entries(MARCAS)) {
    if (key.includes(k) || k.includes(key)) return v;
  }
  return null;
}

export function slugDaMarca(nome: string): string | null {
  const m = marcaDe(nome);
  return m?.si || m?.domain || null;
}

export function temMarcaConhecida(nome: string): boolean {
  return marcaDe(nome) !== null;
}

interface Props {
  nome:       string;
  size?:      number;
  className?: string;
  fallback?:  React.ReactNode;
  wrap?:      (icon: React.ReactNode) => React.ReactNode;
}

type Stage = 'si' | 'bf' | 'falhou';

export default function IconeMarca({ nome, size = 24, className = '', fallback = null }: Props) {
  const marca = marcaDe(nome);
  const inicial: Stage = marca?.si ? 'si' : (marca?.domain ? 'bf' : 'falhou');
  const [stage, setStage] = useState<Stage>(inicial);

  // Reset stage quando o nome muda
  useEffect(() => { setStage(inicial); /* eslint-disable-next-line */ }, [nome]);

  if (!marca || stage === 'falhou') return <>{fallback}</>;

  let src: string;
  if (stage === 'si' && marca.si) {
    src = `https://cdn.simpleicons.org/${marca.si}`;
  } else if (marca.domain) {
    src = `https://cdn.brandfetch.io/${marca.domain}/w/${size * 2}/h/${size * 2}`;
  } else {
    return <>{fallback}</>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={nome}
      width={size}
      height={size}
      loading="lazy"
      className={className}
      style={{ objectFit: 'contain' }}
      onError={() => {
        // Simple Icons falhou → tenta Brandfetch
        if (stage === 'si' && marca.domain) setStage('bf');
        else setStage('falhou');
      }}
    />
  );
}
