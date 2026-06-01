// ─────────────────────────────────────────────────────────────
// Auto-categorização por descrição (extratos OFX / importação)
//
// Extratos bancários trazem descrições "sujas" — "AMAZONMD", "SHOPEE*123",
// "IFOOD *PEDIDO", "UBER* TRIP". Aqui mapeamos trechos da descrição para o
// NOME de uma categoria/subcategoria, pro usuário não precisar editar.
//
// O nome retornado é o nome SIMPLES (sem emoji). O painel de categorias casa
// por nome normalizado (emoji removido + minúsculo), então "Amazon" agrupa
// na subcategoria "Amazon", "Mercado" agrupa no pai "🛒 Mercado", etc.
//
// Regras são avaliadas EM ORDEM — a primeira que casar vence. Por isso marcas
// específicas (Mercado Livre, Mercado Pago) vêm ANTES de termos genéricos
// (Mercado), evitando que "mercado livre" caia em "Mercado".
// ─────────────────────────────────────────────────────────────

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .replace(/[^a-z0-9\s]/g, ' ')    // pontuação/símbolos viram espaço
    .replace(/\s+/g, ' ')
    .trim();
}

// Casa keyword: substring para palavras "longas" (>=4), palavra inteira para
// curtas (evita "99" casar dentro de "1999", "bk" dentro de "bkasdf").
function casa(texto: string, kw: string): boolean {
  if (kw.length >= 4) return texto.includes(kw);
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${esc}(\\s|$)`).test(texto);
}

type Regra = { cat: string; kws: string[] };

// ORDEM IMPORTA — específico antes de genérico.
const REGRAS: Regra[] = [
  // ── Encomendas / marketplaces (subcategorias da categoria Encomendas) ──
  { cat: 'Mercado Livre', kws: ['mercado livre', 'mercadolivre', 'mercadolibre', 'meli'] },
  { cat: 'Amazon',        kws: ['amazon', 'amzn'] },
  { cat: 'Shopee',        kws: ['shopee'] },
  { cat: 'Aliexpress',    kws: ['aliexpress', 'alibaba', 'ali express'] },
  { cat: 'TikTok Shop',   kws: ['tiktok', 'tik tok'] },
  { cat: 'Shein',         kws: ['shein'] },

  // ── Pagamentos / transferências (antes de "Mercado") ──
  { cat: 'Transferências', kws: ['mercado pago', 'mercadopago', 'pix ', 'ted ', 'doc ', 'transferencia'] },

  // ── Delivery / Alimentação ──
  { cat: 'iFood',       kws: ['ifood', 'i food'] },
  { cat: 'Alimentação', kws: ['rappi', 'restaurante', 'lanchonete', 'burger', 'mcdonald', 'mc donalds', 'bobs', 'subway', 'pizzaria', 'pizza', 'outback', 'habibs', 'spoleto', 'dominos', 'china in box', 'sushi', 'cafeteria', 'starbucks'] },
  { cat: 'Padaria',     kws: ['padaria', 'panificadora'] },

  // ── Transporte ──
  { cat: 'Uber',        kws: ['uber'] },
  { cat: 'Transporte',  kws: ['99app', '99 pop', '99pop', 'cabify', 'posto', 'ipiranga', 'shell', 'petrobras', 'gasolina', 'combustivel', 'estacionamento', 'pedagio', 'sem parar', 'conectcar', 'veloe', 'metro', 'onibus', 'blablacar'] },

  // ── Roupa / Esporte (subcategorias de Vestuário) ──
  { cat: 'Nike',        kws: ['nike'] },
  { cat: 'Adidas',      kws: ['adidas'] },
  { cat: 'Vestuário',   kws: ['renner', 'riachuelo', 'cea', 'c&a', 'zara', 'hering', 'puma', 'reserva', 'marisa', 'pernambucanas'] },

  // ── Assinaturas / streaming (subcategorias de Assinaturas) ──
  { cat: 'Netflix',     kws: ['netflix'] },
  { cat: 'Spotify',     kws: ['spotify'] },
  { cat: 'Disney+',     kws: ['disney'] },
  { cat: 'Prime Video', kws: ['prime video', 'primevideo'] },
  { cat: 'HBO Max',     kws: ['hbo', 'hbomax'] },
  { cat: 'Globo Play',  kws: ['globoplay', 'globo play'] },
  { cat: 'Assinaturas', kws: ['youtube premium', 'deezer', 'canva', 'notion', 'apple com', 'apple.com', 'google ', 'paramount', 'crunchyroll'] },

  // ── Mercado / supermercado (genérico — depois de Mercado Livre/Pago) ──
  { cat: 'Mercado',     kws: ['mercado', 'supermercado', 'atacad', 'carrefour', 'assai', 'pao de acucar', 'big bompreco', 'hortifruti', 'sams club', 'makro', 'tenda atac'] },

  // ── Saúde ──
  { cat: 'Saúde',       kws: ['farmacia', 'drogaria', 'drogasil', 'pague menos', 'panvel', 'raia', 'clinica', 'hospital', 'laboratorio', 'unimed', 'odonto', 'dentista', 'ultrafarma'] },

  // ── Pet ──
  { cat: 'Pet',         kws: ['petz', 'cobasi', 'petlove', 'veterinari', 'pet shop', 'petshop'] },

  // ── Educação ──
  { cat: 'Educação',    kws: ['udemy', 'coursera', 'alura', 'duolingo', 'faculdade', 'universidade', 'qconcursos'] },

  // ── Lazer ──
  { cat: 'Lazer e Entretenimento', kws: ['cinema', 'cinemark', 'ingresso', 'steam', 'playstation', 'xbox', 'nintendo'] },

  // ── Viagem ──
  { cat: 'Viagem',      kws: ['latam', 'airbnb', 'booking', ' hotel', 'decolar', '123 milhas', 'cvc viagens', 'azul linhas', 'gol linhas'] },

  // ── Internet / telecom ──
  { cat: 'Internet',    kws: ['vivo fibra', 'claro net', 'net servicos', 'telefonica', 'oi fibra'] },
];

// Retorna o nome da categoria/subcategoria sugerida, ou null se nada casar.
export function categorizarDescricao(descricao: string): string | null {
  const t = normalizar(descricao);
  if (!t) return null;
  for (const regra of REGRAS) {
    for (const kw of regra.kws) {
      const k = normalizar(kw);
      if (k && casa(t, k)) return regra.cat;
    }
  }
  return null;
}
