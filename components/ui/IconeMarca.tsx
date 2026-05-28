'use client';

import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// Mapa nome (normalizado) → marca.
// Estratégia de renderização (em ordem de prioridade):
//   1. local:  PNG/SVG circular hospedado em /public/brands/{nome}.png
//              (preenche o círculo inteiro, sem wrapper extra)
//   2. si:     cdn.simpleicons.org/{slug} (SVG monocromático)
//   3. domain: cdn.brandfetch.io/{domain} (logo oficial colorido)
//   4. fallback: emoji
//
// Campos:
//   local:  caminho (absoluto, começando com '/') para imagem circular
//           pré-fabricada. Quando definida, o CategoriaIcon a renderiza
//           full-bleed (a transparência do PNG dá o efeito circular).
//   si:     slug Simple Icons
//   domain: brandfetch.io domain (fallback)
// ─────────────────────────────────────────────────────────────
export type Marca = { local?: string; si?: string; domain?: string };

const MARCAS: Record<string, Marca> = {
  // ── Streaming / Assinaturas ──
  spotify:           { local: '/brands/spotify.png',       si: 'spotify' },
  netflix:           { local: '/brands/netflix.png',       si: 'netflix' },
  'disney plus':     { local: '/brands/disney-plus.png',   si: 'disneyplus', domain: 'disneyplus.com' },
  'disney+':         { local: '/brands/disney-plus.png',   si: 'disneyplus', domain: 'disneyplus.com' },
  disneyplus:        { local: '/brands/disney-plus.png',   si: 'disneyplus', domain: 'disneyplus.com' },
  disney:            { local: '/brands/disney-plus.png',   si: 'disneyplus', domain: 'disneyplus.com' },
  // Max (ex HBO Max)
  'hbo max':         { local: '/brands/hbo-max.png',       si: 'max', domain: 'play.max.com' },
  hbomax:            { local: '/brands/hbo-max.png',       si: 'max', domain: 'play.max.com' },
  hbo:               { local: '/brands/hbo-max.png',       si: 'max', domain: 'play.max.com' },
  max:               { local: '/brands/hbo-max.png',       si: 'max', domain: 'play.max.com' },
  'prime video':     { local: '/brands/prime-video.png',   si: 'primevideo', domain: 'primevideo.com' },
  'amazon prime':    { local: '/brands/prime-video.png',   si: 'primevideo', domain: 'primevideo.com' },
  primevideo:        { local: '/brands/prime-video.png',   si: 'primevideo', domain: 'primevideo.com' },
  'globo play':      { local: '/brands/globo-play.png',    domain: 'globoplay.com' },
  globoplay:         { local: '/brands/globo-play.png',    domain: 'globoplay.com' },
  globo:             { local: '/brands/globo-play.png',    domain: 'globoplay.com' },
  'apple music':     { si: 'applemusic' },
  applemusic:        { si: 'applemusic' },
  'apple tv':        { local: '/brands/apple-tv.png',      si: 'appletv' },
  'apple tv+':       { local: '/brands/apple-tv.png',      si: 'appletv' },
  appletv:           { local: '/brands/apple-tv.png',      si: 'appletv' },
  deezer:            { si: 'deezer' },
  'youtube music':   { si: 'youtubemusic' },
  youtubemusic:      { si: 'youtubemusic' },
  youtube:           { local: '/brands/youtube-premium.png', si: 'youtube' },
  'youtube premium': { local: '/brands/youtube-premium.png', si: 'youtube' },
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
  nubank:            { local: '/brands/nubank.png',           si: 'nubank', domain: 'nubank.com.br' },
  bradesco:          { local: '/brands/bradesco.png',         si: 'bradesco', domain: 'bradesco.com.br' },
  itau:              { local: '/brands/itau.png',             si: 'itau', domain: 'itau.com.br' },
  'itaú':            { local: '/brands/itau.png',             si: 'itau', domain: 'itau.com.br' },
  santander:         { local: '/brands/santander.png',        si: 'santander', domain: 'santander.com.br' },
  'banco do brasil': { local: '/brands/banco-do-brasil.png',  si: 'bancodobrasil', domain: 'bb.com.br' },
  bb:                { local: '/brands/banco-do-brasil.png',  si: 'bancodobrasil', domain: 'bb.com.br' },
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
  amazon:            { local: '/brands/amazon.png',         si: 'amazon' },
  'mercado livre':   { local: '/brands/mercado-livre.png',  si: 'mercadolivre', domain: 'mercadolivre.com.br' },
  mercadolivre:      { local: '/brands/mercado-livre.png',  si: 'mercadolivre', domain: 'mercadolivre.com.br' },
  aliexpress:        { local: '/brands/aliexpress.png',     si: 'aliexpress' },
  shopee:            { local: '/brands/shopee.png',         si: 'shopee' },
  shein:             { local: '/brands/shein.png',          domain: 'shein.com' },
  magalu:            { si: 'magazineluiza',   domain: 'magalu.com.br' },
  'magazine luiza':  { si: 'magazineluiza',   domain: 'magalu.com.br' },
  americanas:        { domain: 'americanas.com.br' },
  submarino:         { domain: 'submarino.com.br' },

  // ── Roupa / Esporte ──
  nike:              { local: '/brands/nike.png',           si: 'nike', domain: 'nike.com' },
  adidas:            { local: '/brands/adidas.png',         si: 'adidas', domain: 'adidas.com' },
  puma:              { si: 'puma',            domain: 'puma.com' },
  zara:              { si: 'zara',            domain: 'zara.com' },
  'new balance':     { si: 'newbalance',      domain: 'newbalance.com' },
  reserva:           { domain: 'usereserva.com' },
  riachuelo:         { domain: 'riachuelo.com.br' },
  renner:            { domain: 'lojasrenner.com.br' },

  // ── Mobilidade / Delivery ──
  uber:              { local: '/brands/uber.png',           si: 'uber' },
  '99':              { si: '99' },
  '99 pop':          { si: '99' },
  cabify:            { si: 'cabify' },
  ifood:             { local: '/brands/ifood.png',          si: 'ifood', domain: 'ifood.com.br' },
  rappi:             { si: 'rappi' },

  // ── Telecom ──
  vivo:              { local: '/brands/vivo.png',           si: 'vivo' },
  claro:             { local: '/brands/claro.png',          si: 'claro' },
  tim:               { local: '/brands/tim.png',            si: 'tim' },
  oi:                { si: 'oi' },

  // ── Educação ──
  duolingo:          { si: 'duolingo' },
  udemy:             { si: 'udemy' },
  coursera:          { si: 'coursera' },
  qconcursos:        { local: '/brands/qconcursos.png' },
  'q concursos':     { local: '/brands/qconcursos.png' },

  // ── Design / Criação ──
  canva:             { local: '/brands/canva.png',          si: 'canva' },

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
  // Cor do logo Simple Icons SEM '#' (ex: 'ffffff') — útil quando o logo
  // monocromático precisa contrastar com um fundo.
  color?:     string;
}

type Stage = 'local' | 'si' | 'bf' | 'falhou';

export default function IconeMarca({ nome, size = 24, className = '', fallback = null, color }: Props) {
  const marca = marcaDe(nome);
  const inicial: Stage = marca?.local
    ? 'local'
    : marca?.si
      ? 'si'
      : marca?.domain ? 'bf' : 'falhou';
  const [stage, setStage] = useState<Stage>(inicial);

  useEffect(() => { setStage(inicial); /* eslint-disable-next-line */ }, [nome]);

  if (!marca || stage === 'falhou') return <>{fallback}</>;

  let src: string;
  let fit: 'cover' | 'contain' = 'contain';
  if (stage === 'local' && marca.local) {
    src = marca.local;
    fit = 'cover'; // PNG circular pré-fabricado deve preencher 100% do círculo
  } else if (stage === 'si' && marca.si) {
    src = `https://cdn.simpleicons.org/${marca.si}${color ? `/${color}` : ''}`;
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
      style={{ objectFit: fit }}
      onError={() => {
        // local falhou → tenta Simple Icons; SI falhou → Brandfetch; BF falhou → fallback
        if (stage === 'local' && marca.si) setStage('si');
        else if (stage === 'local' && marca.domain) setStage('bf');
        else if (stage === 'si' && marca.domain) setStage('bf');
        else setStage('falhou');
      }}
    />
  );
}
