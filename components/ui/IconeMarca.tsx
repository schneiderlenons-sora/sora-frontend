'use client';

import { useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────
// Mapa nome (normalizado) → marca.
// Estratégia de renderização:
//   1. Tenta cdn.simpleicons.org/{slug}[/{color}]  (SVG monocromático)
//   2. Se 404, tenta cdn.brandfetch.io/{domain}     (logo oficial colorido)
//   3. Se ainda falhar, renderiza o fallback (emoji)
//
// Campos:
//   si:     slug Simple Icons
//   domain: brandfetch.io domain (fallback)
//   bg:     cor de fundo oficial da marca — quando definida o CategoriaIcon
//           pinta o círculo nessa cor e força o logo em branco; assim o
//           ícone preenche 100% (estilo App Store / Linear).
// ─────────────────────────────────────────────────────────────
export type Marca = { si?: string; domain?: string; bg?: string };

const MARCAS: Record<string, Marca> = {
  // ── Streaming / Assinaturas ──
  spotify:           { si: 'spotify',         bg: '#1DB954' },
  netflix:           { si: 'netflix',         bg: '#E50914' },
  'disney plus':     { si: 'disneyplus',      domain: 'disneyplus.com', bg: '#0E47BB' },
  'disney+':         { si: 'disneyplus',      domain: 'disneyplus.com', bg: '#0E47BB' },
  disneyplus:        { si: 'disneyplus',      domain: 'disneyplus.com', bg: '#0E47BB' },
  disney:            { si: 'disneyplus',      domain: 'disneyplus.com', bg: '#0E47BB' },
  // Max (ex HBO Max)
  'hbo max':         { si: 'max',             domain: 'play.max.com',   bg: '#000000' },
  hbomax:            { si: 'max',             domain: 'play.max.com',   bg: '#000000' },
  hbo:               { si: 'max',             domain: 'play.max.com',   bg: '#000000' },
  max:               { si: 'max',             domain: 'play.max.com',   bg: '#000000' },
  'prime video':     { si: 'primevideo',      domain: 'primevideo.com', bg: '#00A8E1' },
  'amazon prime':    { si: 'primevideo',      domain: 'primevideo.com', bg: '#00A8E1' },
  primevideo:        { si: 'primevideo',      domain: 'primevideo.com', bg: '#00A8E1' },
  'globo play':      { domain: 'globoplay.com', bg: '#FF503C' },
  globoplay:         { domain: 'globoplay.com', bg: '#FF503C' },
  globo:             { domain: 'globoplay.com', bg: '#FF503C' },
  'apple music':     { si: 'applemusic',      bg: '#FA243C' },
  applemusic:        { si: 'applemusic',      bg: '#FA243C' },
  'apple tv':        { si: 'appletv',         bg: '#000000' },
  'apple tv+':       { si: 'appletv',         bg: '#000000' },
  appletv:           { si: 'appletv',         bg: '#000000' },
  deezer:            { si: 'deezer',          bg: '#000000' },
  'youtube music':   { si: 'youtubemusic',    bg: '#FF0000' },
  youtubemusic:      { si: 'youtubemusic',    bg: '#FF0000' },
  youtube:           { si: 'youtube',         bg: '#FF0000' },
  'youtube premium': { si: 'youtube',         bg: '#FF0000' },
  twitch:            { si: 'twitch',          bg: '#9146FF' },
  paramount:         { si: 'paramountplus',   bg: '#0064FF' },
  'paramount+':      { si: 'paramountplus',   bg: '#0064FF' },
  crunchyroll:       { si: 'crunchyroll',     bg: '#F47521' },
  tidal:             { si: 'tidal',           bg: '#000000' },
  pandora:           { si: 'pandora',         bg: '#005483' },

  // ── Produtividade / SaaS ──
  notion:            { si: 'notion',          bg: '#000000' },
  figma:             { si: 'figma',           bg: '#000000' },
  slack:             { si: 'slack',           bg: '#4A154B' },
  dropbox:           { si: 'dropbox',         bg: '#0061FF' },
  'google one':      { si: 'googleone',       bg: '#4285F4' },
  'google drive':    { si: 'googledrive',     bg: '#4285F4' },
  icloud:            { si: 'icloud',          bg: '#3693F3' },
  '1password':       { si: '1password',       bg: '#0572EC' },
  bitwarden:         { si: 'bitwarden',       bg: '#175DDC' },
  github:            { si: 'github',          bg: '#181717' },
  vercel:            { si: 'vercel',          bg: '#000000' },
  openai:            { si: 'openai',          bg: '#412991' },
  chatgpt:           { si: 'openai',          bg: '#412991' },
  claude:            { si: 'anthropic',       bg: '#D97757' },
  anthropic:         { si: 'anthropic',       bg: '#D97757' },

  // ── Bancos brasileiros ──
  nubank:            { si: 'nubank',          domain: 'nubank.com.br',    bg: '#820AD1' },
  bradesco:          { si: 'bradesco',        domain: 'bradesco.com.br',  bg: '#CC092F' },
  itau:              { si: 'itau',            domain: 'itau.com.br',      bg: '#EC7000' },
  'itaú':            { si: 'itau',            domain: 'itau.com.br',      bg: '#EC7000' },
  santander:         { si: 'santander',       domain: 'santander.com.br', bg: '#EC0000' },
  'banco do brasil': { si: 'bancodobrasil',   domain: 'bb.com.br',        bg: '#FFEF38' },
  bb:                { si: 'bancodobrasil',   domain: 'bb.com.br',        bg: '#FFEF38' },
  caixa:             { domain: 'caixa.gov.br',                            bg: '#0070AF' },
  'caixa economica': { domain: 'caixa.gov.br',                            bg: '#0070AF' },
  inter:             { domain: 'inter.co',                                bg: '#FF7A00' },
  'banco inter':     { domain: 'inter.co',                                bg: '#FF7A00' },
  'c6 bank':         { domain: 'c6bank.com.br',                           bg: '#000000' },
  c6:                { domain: 'c6bank.com.br',                           bg: '#000000' },
  c6bank:            { domain: 'c6bank.com.br',                           bg: '#000000' },
  'banco safra':     { si: 'safra',           domain: 'safra.com.br',     bg: '#003B70' },
  safra:             { si: 'safra',           domain: 'safra.com.br',     bg: '#003B70' },
  'banco do nordeste': { domain: 'bnb.gov.br' },
  bnb:               { domain: 'bnb.gov.br' },
  // Fintechs e bancos digitais
  'btg pactual':     { domain: 'btgpactual.com',                          bg: '#102C4B' },
  btg:               { domain: 'btgpactual.com',                          bg: '#102C4B' },
  'xp investimentos':{ domain: 'xpi.com.br',                              bg: '#000000' },
  xp:                { domain: 'xpi.com.br',                              bg: '#000000' },
  xpi:               { domain: 'xpi.com.br',                              bg: '#000000' },
  'banco original':  { domain: 'original.com.br',                         bg: '#00FF6F' },
  original:          { domain: 'original.com.br',                         bg: '#00FF6F' },
  next:              { domain: 'next.me',                                 bg: '#00FF5F' },
  'banco next':      { domain: 'next.me',                                 bg: '#00FF5F' },
  neon:              { domain: 'neon.com.br',                             bg: '#00E0A4' },
  'banco neon':      { domain: 'neon.com.br',                             bg: '#00E0A4' },
  'banco pan':       { domain: 'bancopan.com.br',                         bg: '#00A859' },
  pan:               { domain: 'bancopan.com.br',                         bg: '#00A859' },
  pagbank:           { domain: 'pagbank.com.br',                          bg: '#00B176' },
  pagseguro:         { domain: 'pagseguro.com.br',                        bg: '#FAB81B' },
  stone:             { domain: 'stone.com.br',                            bg: '#00D26A' },
  'will bank':       { domain: 'willbank.com.br',                         bg: '#A6FF00' },
  willbank:          { domain: 'willbank.com.br',                         bg: '#A6FF00' },
  will:              { domain: 'willbank.com.br',                         bg: '#A6FF00' },
  sicredi:           { domain: 'sicredi.com.br',                          bg: '#3FA535' },
  sicoob:            { domain: 'sicoob.com.br',                           bg: '#003F66' },
  '99pay':           { domain: '99pay.com.br',                            bg: '#FFD800' },
  banrisul:          { domain: 'banrisul.com.br',                         bg: '#1A4794' },
  'banco daycoval':  { domain: 'daycoval.com.br',                         bg: '#003366' },
  daycoval:          { domain: 'daycoval.com.br',                         bg: '#003366' },
  'banco bmg':       { domain: 'bancobmg.com.br',                         bg: '#F47920' },
  bmg:               { domain: 'bancobmg.com.br',                         bg: '#F47920' },
  bv:                { domain: 'bv.com.br',                               bg: '#FF6600' },
  'banco bv':        { domain: 'bv.com.br',                               bg: '#FF6600' },

  // ── Pagamentos / Carteira digital ──
  'mercado pago':    { si: 'mercadopago',     domain: 'mercadopago.com.br', bg: '#00AAEF' },
  mercadopago:       { si: 'mercadopago',     domain: 'mercadopago.com.br', bg: '#00AAEF' },
  picpay:            { si: 'picpay',          domain: 'picpay.com',         bg: '#21C25E' },
  paypal:            { si: 'paypal',          bg: '#003087' },
  stripe:            { si: 'stripe',          bg: '#635BFF' },
  visa:              { si: 'visa',            bg: '#1A1F71' },
  mastercard:        { si: 'mastercard',      bg: '#EB001B' },
  pix:               { si: 'pix',             bg: '#32BCAD' },
  amex:              { si: 'americanexpress', bg: '#2E77BC' },
  'american express':{ si: 'americanexpress', bg: '#2E77BC' },
  elo:               { si: 'elo',             bg: '#000000' },
  hipercard:         { si: 'hipercard',       bg: '#822124' },

  // ── Marketplaces / Compras ──
  amazon:            { si: 'amazon',          bg: '#232F3E' },
  'mercado livre':   { si: 'mercadolivre',    domain: 'mercadolivre.com.br', bg: '#FFE600' },
  mercadolivre:      { si: 'mercadolivre',    domain: 'mercadolivre.com.br', bg: '#FFE600' },
  aliexpress:        { si: 'aliexpress',      bg: '#E62E04' },
  shopee:            { si: 'shopee',          bg: '#EE4D2D' },
  shein:             { domain: 'shein.com',                               bg: '#000000' },
  magalu:            { si: 'magazineluiza',   domain: 'magalu.com.br',    bg: '#0086FF' },
  'magazine luiza':  { si: 'magazineluiza',   domain: 'magalu.com.br',    bg: '#0086FF' },
  americanas:        { domain: 'americanas.com.br',                       bg: '#E60014' },
  submarino:         { domain: 'submarino.com.br',                        bg: '#F2C200' },

  // ── Roupa / Esporte ──
  nike:              { si: 'nike',            domain: 'nike.com',         bg: '#000000' },
  adidas:            { si: 'adidas',          domain: 'adidas.com',       bg: '#000000' },
  puma:              { si: 'puma',            domain: 'puma.com',         bg: '#000000' },
  zara:              { si: 'zara',            domain: 'zara.com',         bg: '#000000' },
  'new balance':     { si: 'newbalance',      domain: 'newbalance.com',   bg: '#CF0A2C' },
  reserva:           { domain: 'usereserva.com',                          bg: '#000000' },
  riachuelo:         { domain: 'riachuelo.com.br',                        bg: '#E32026' },
  renner:            { domain: 'lojasrenner.com.br',                      bg: '#000000' },

  // ── Mobilidade / Delivery ──
  uber:              { si: 'uber',            bg: '#000000' },
  '99':              { si: '99',              bg: '#FFD800' },
  '99 pop':          { si: '99',              bg: '#FFD800' },
  cabify:            { si: 'cabify',          bg: '#7E33EB' },
  ifood:             { si: 'ifood',           domain: 'ifood.com.br',     bg: '#EA1D2C' },
  rappi:             { si: 'rappi',           bg: '#FF441F' },

  // ── Telecom ──
  vivo:              { si: 'vivo',            bg: '#660099' },
  claro:             { si: 'claro',           bg: '#DA291C' },
  tim:               { si: 'tim',             bg: '#0072CE' },
  oi:                { si: 'oi',              bg: '#F9A11B' },

  // ── Educação ──
  duolingo:          { si: 'duolingo',        bg: '#58CC02' },
  udemy:             { si: 'udemy',           bg: '#A435F0' },
  coursera:          { si: 'coursera',        bg: '#0056D2' },

  // ── Combustível ──
  shell:             { si: 'shell',           bg: '#FFD500' },
  petrobras:         { si: 'petrobras',       bg: '#008542' },
  ipiranga:          { si: 'ipiranga',        bg: '#003DA5' },
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
  // Cor do logo Simple Icons SEM '#' (ex: 'ffffff'). Usado quando renderizamos
  // sobre fundo colorido da marca — logo branco fica legível sobre Spotify
  // verde, Nubank roxo, etc.
  color?:     string;
}

type Stage = 'si' | 'bf' | 'falhou';

export default function IconeMarca({ nome, size = 24, className = '', fallback = null, color }: Props) {
  const marca = marcaDe(nome);
  const inicial: Stage = marca?.si ? 'si' : (marca?.domain ? 'bf' : 'falhou');
  const [stage, setStage] = useState<Stage>(inicial);

  // Reset stage quando o nome muda
  useEffect(() => { setStage(inicial); /* eslint-disable-next-line */ }, [nome]);

  if (!marca || stage === 'falhou') return <>{fallback}</>;

  let src: string;
  if (stage === 'si' && marca.si) {
    // Quando há `bg` da marca, força logo branco para contraste sobre o fundo colorido.
    const corSlug = color || (marca.bg ? 'ffffff' : null);
    src = `https://cdn.simpleicons.org/${marca.si}${corSlug ? `/${corSlug}` : ''}`;
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
