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
//   fundoBranco: PNG do logo circular oficial, mas com os CANTOS do quadrado
//           BRANCOS (não transparente). O CategoriaIcon força `rounded-full`
//           pra recortar os cantos e mostrar só o círculo colorido.
// ─────────────────────────────────────────────────────────────
export type Marca = { local?: string; si?: string; domain?: string; fundoBranco?: boolean };

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
  twitch:            { local: '/brands/twitch.png',        si: 'twitch', fundoBranco: true },
  paramount:         { local: '/brands/paramount.png',     si: 'paramountplus', fundoBranco: true },
  'paramount+':      { local: '/brands/paramount.png',     si: 'paramountplus', fundoBranco: true },
  crunchyroll:       { local: '/brands/crunchyroll.png',   si: 'crunchyroll', fundoBranco: true },
  'tnt sports':      { local: '/brands/tntsports.png',     fundoBranco: true },
  tntsports:         { local: '/brands/tntsports.png',     fundoBranco: true },
  tidal:             { si: 'tidal' },
  pandora:           { si: 'pandora' },

  // ── Redes sociais ──
  instagram:         { local: '/brands/instagram.png',     si: 'instagram', fundoBranco: true },
  insta:             { local: '/brands/instagram.png',     si: 'instagram', fundoBranco: true },
  facebook:          { local: '/brands/facebook.png',      si: 'facebook', fundoBranco: true },
  face:              { local: '/brands/facebook.png',      si: 'facebook', fundoBranco: true },
  facebk:            { local: '/brands/facebook.png',      si: 'facebook', fundoBranco: true }, // "FACEBK*" no extrato do cartão
  tiktok:            { local: '/brands/tiktok.png',        si: 'tiktok', fundoBranco: true },
  'tik tok':         { local: '/brands/tiktok.png',        si: 'tiktok', fundoBranco: true },
  pinterest:         { local: '/brands/pinterest.png',     si: 'pinterest', fundoBranco: true },

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
  google:            { si: 'google' },
  'google ads':      { local: '/brands/google-ads.png',      si: 'googleads' },
  'google adwords':  { local: '/brands/google-ads.png',      si: 'googleads' },
  openai:            { local: '/brands/chatgpt.png',       si: 'openai', fundoBranco: true },
  chatgpt:           { local: '/brands/chatgpt.png',       si: 'openai', fundoBranco: true },
  gpt:               { local: '/brands/chatgpt.png',       si: 'openai', fundoBranco: true },
  claude:            { local: '/brands/claude.png',        si: 'anthropic', fundoBranco: true },
  anthropic:         { local: '/brands/claude.png',        si: 'anthropic', fundoBranco: true },
  gemini:            { local: '/brands/gemini.png',        si: 'googlegemini', fundoBranco: true },
  'google gemini':   { local: '/brands/gemini.png',        si: 'googlegemini', fundoBranco: true },
  capcut:            { local: '/brands/capcut.png',        si: 'capcut', fundoBranco: true },
  lovable:           { local: '/brands/lovable.png',       fundoBranco: true },

  // ── Bancos brasileiros ──
  nubank:            { local: '/brands/nubank.png',           si: 'nubank', domain: 'nubank.com.br' },
  bradesco:          { local: '/brands/bradesco.png',         si: 'bradesco', domain: 'bradesco.com.br' },
  itau:              { local: '/brands/itau.png',             si: 'itau', domain: 'itau.com.br' },
  'itaú':            { local: '/brands/itau.png',             si: 'itau', domain: 'itau.com.br' },
  santander:         { local: '/brands/santander.png',        si: 'santander', domain: 'santander.com.br' },
  'banco do brasil': { local: '/brands/banco-do-brasil.png',  si: 'bancodobrasil', domain: 'bb.com.br' },
  bb:                { local: '/brands/banco-do-brasil.png',  si: 'bancodobrasil', domain: 'bb.com.br' },
  caixa:             { local: '/brands/caixa.png',   domain: 'caixa.gov.br' },
  'caixa economica': { local: '/brands/caixa.png',   domain: 'caixa.gov.br' },
  inter:             { local: '/brands/inter.png',   domain: 'inter.co' },
  'banco inter':     { local: '/brands/inter.png',   domain: 'inter.co' },
  'c6 bank':         { domain: 'c6bank.com.br' },
  c6:                { domain: 'c6bank.com.br' },
  c6bank:            { domain: 'c6bank.com.br' },
  'banco safra':     { si: 'safra',           domain: 'safra.com.br' },
  safra:             { si: 'safra',           domain: 'safra.com.br' },
  'banco do nordeste': { domain: 'bnb.gov.br' },
  bnb:               { domain: 'bnb.gov.br' },
  // Fintechs e bancos digitais
  'btg pactual':     { local: '/brands/btg.png',      domain: 'btgpactual.com' },
  btg:               { local: '/brands/btg.png',      domain: 'btgpactual.com' },
  'xp investimentos':{ domain: 'xpi.com.br' },
  xp:                { domain: 'xpi.com.br' },
  xpi:               { domain: 'xpi.com.br' },
  'banco original':  { local: '/brands/original.png', domain: 'original.com.br' },
  original:          { local: '/brands/original.png', domain: 'original.com.br' },
  next:              { local: '/brands/next.png',     domain: 'next.me' },
  'banco next':      { local: '/brands/next.png',     domain: 'next.me' },
  neon:              { domain: 'neon.com.br' },
  'banco neon':      { domain: 'neon.com.br' },
  'banco pan':       { domain: 'bancopan.com.br' },
  pan:               { domain: 'bancopan.com.br' },
  pagbank:           { local: '/brands/pagbank.png',  domain: 'pagbank.com.br' },
  pagseguro:         { local: '/brands/pagbank.png',  domain: 'pagseguro.com.br' },
  stone:             { domain: 'stone.com.br' },
  'will bank':       { domain: 'willbank.com.br' },
  willbank:          { domain: 'willbank.com.br' },
  will:              { domain: 'willbank.com.br' },
  sicredi:           { local: '/brands/sicredi.png',  domain: 'sicredi.com.br' },
  sicoob:            { local: '/brands/sicoob.png',   domain: 'sicoob.com.br' },
  '99pay':           { domain: '99pay.com.br' },
  banrisul:          { domain: 'banrisul.com.br' },
  'banco daycoval':  { domain: 'daycoval.com.br' },
  daycoval:          { domain: 'daycoval.com.br' },
  'banco bmg':       { domain: 'bancobmg.com.br' },
  bmg:               { domain: 'bancobmg.com.br' },
  bv:                { domain: 'bv.com.br' },
  'banco bv':        { domain: 'bv.com.br' },

  // ── Pagamentos / Carteira digital ──
  'mercado pago':    { local: '/brands/mercado-pago.png', si: 'mercadopago', domain: 'mercadopago.com.br' },
  mercadopago:       { local: '/brands/mercado-pago.png', si: 'mercadopago', domain: 'mercadopago.com.br' },
  picpay:            { local: '/brands/picpay.png',       si: 'picpay',      domain: 'picpay.com' },
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
  '99':              { local: '/brands/99.png',             si: '99' },
  '99 pop':          { local: '/brands/99.png',             si: '99' },
  cabify:            { si: 'cabify' },
  ifood:             { local: '/brands/ifood.png',          si: 'ifood', domain: 'ifood.com.br' },
  rappi:             { local: '/brands/rappi.png',           si: 'rappi' },
  aiqfome:           { local: '/brands/aiqfome.png' },
  'aiq fome':        { local: '/brands/aiqfome.png' },
  'ze delivery':     { local: '/brands/ze-delivery.png' },
  zedelivery:        { local: '/brands/ze-delivery.png' },
  'zé delivery':     { local: '/brands/ze-delivery.png' },
  blablacar:         { local: '/brands/blablacar.png',       si: 'blablacar' },
  'bla bla car':     { local: '/brands/blablacar.png',       si: 'blablacar' },

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
  sora:              { local: '/brands/sora.png' },

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
    // Tudo que não é letra/número vira SEPARADOR (cobre emoji e pontuação).
    // Precisa ser espaço, não remoção: no extrato o lojista vem colado num
    // código ("EC*SORA", "NETFLIX.COM") e, apagando o '*', sobra "ecsora" —
    // aí 'sora' não é palavra inteira e o ícone da marca não aparece.
    // ⚠️ Não usar \p{Emoji} aqui: ele casa '*', '#' e os dígitos 0-9 (bases de
    // keycap), o que apagava o '*' e mataria chave com número (ex.: '99').
    .replace(/[^a-z0-9\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Índice com as CHAVES passadas pela mesma normalização do nome buscado.
// Sem isso, chave com acento/símbolo é chave morta: 'itaú' nunca casaria com
// "ITAÚ" (que chega normalizado como "itau"). Duplicatas ('disney' e 'disney+')
// colapsam na mesma entrada — a primeira vence.
const MARCAS_NORM: Record<string, Marca> = (() => {
  const m: Record<string, Marca> = {};
  for (const [k, v] of Object.entries(MARCAS)) {
    const nk = normalizar(k);
    if (nk && !m[nk]) m[nk] = v;
  }
  return m;
})();

// Verifica se `trecho` aparece como palavra completa dentro de `texto`
// (delimitado por início, fim ou espaço). Evita "inter" → "internet".
function palavraInteira(texto: string, trecho: string): boolean {
  const escaped = trecho.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${escaped}(\\s|$)`).test(texto);
}

export function marcaDe(nome: string): Marca | null {
  const key = normalizar(nome);
  if (!key) return null;
  if (MARCAS_NORM[key]) return MARCAS_NORM[key];
  for (const [k, v] of Object.entries(MARCAS_NORM)) {
    // Só aceita match parcial se a chave da marca é uma palavra inteira
    // dentro do nome buscado. "inter" ≠ "internet", "mercado" ≠ "mercado livre".
    if (palavraInteira(key, k)) return v;
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
