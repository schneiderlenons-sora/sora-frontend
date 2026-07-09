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

// ORDEM IMPORTA — marca/específico antes de genérico.
// ⚠️ Mantido em sincronia com sora-backend/src/services/categorizar.js (REGRAS).
const REGRAS: Regra[] = [
  // ── Marketplaces / Encomendas (subcategorias) ──
  { cat: 'Mercado Livre',  kws: ['mercado livre', 'mercadolivre', 'mercadolibre', 'meli '] },
  { cat: 'Amazon',         kws: ['amazon', 'amzn'] },
  { cat: 'Shopee',         kws: ['shopee'] },
  { cat: 'Aliexpress',     kws: ['aliexpress', 'ali express'] },
  { cat: 'TikTok Shop',    kws: ['tiktok', 'tik tok'] },
  { cat: 'Shein',          kws: ['shein'] },
  { cat: 'Encomendas',     kws: ['magazine luiza', 'magalu', 'americanas', 'casas bahia', 'submarino', 'kabum', 'pichau', 'terabyte', 'temu', 'wish', 'enjoei', 'pontofrio', 'ponto frio', 'extra com', 'fastshop', 'fast shop'] },

  // ── Transferências / Pix (não-consumo) ──
  { cat: 'Transferências', kws: ['mercado pago', 'mercadopago', 'pix enviado', 'pix recebido', 'pix ', 'ted ', 'doc ', 'transferencia', 'transferencias', 'transf '] },

  // ── Delivery / Alimentação ──
  { cat: 'iFood',          kws: ['ifood', 'i food'] },
  { cat: 'Alimentação',    kws: ['rappi', 'uber eats', 'ubereats', 'aiqfome', 'aiq fome', 'james delivery', 'ze delivery', 'zedelivery', 'delivery',
      'restaurante', 'restaur', 'lanchonete', 'lanches', 'hamburgueria', 'burger king', 'burguer', 'mcdonald', 'mc donalds', 'bobs', 'subway',
      'pizzaria', 'pizza', 'outback', 'habibs', 'spoleto', 'dominos', 'china in box', 'sushi', 'temaki', 'churrascaria', 'espetinho',
      'cafeteria', 'starbucks', 'kopenhagen', 'cacau show', 'sorveteria', 'acai', 'doceria', 'confeitaria', 'marmita', 'self service',
      'rotisseria', 'boteco', 'comida', 'restaurante e lanchonete',
      'quiosque', 'food truck', 'foodtruck', 'food park', 'petiscaria', 'pastelaria', 'creperia', 'tapiocaria', 'trailer de',
      // ── Comida do dia a dia: salgados, lanches, refeições, doces e bebidas ──
      'coxinha', 'coxinhas', 'pastel', 'pasteis', 'esfiha', 'esfirra', 'kibe', 'quibe', 'empada', 'empadao',
      'enroladinho', 'risole', 'rissole', 'bolinho', 'salgad', 'pao de queijo', 'lanche', 'hamburgu', 'hamburguer',
      'cheeseburger', 'x-tudo', 'x-salada', 'x-burguer', 'x-bacon', 'cachorro quente', 'cachorro-quente', 'hot dog', 'hotdog',
      'misto quente', 'sandui', 'sanduba', 'bauru', 'beirute', 'batata frita', 'porcao', 'tapioca', 'crepe', 'acaraje',
      'galeto', 'frango assado', 'refeicao', 'refeicoes', 'prato feito', 'prato do dia', 'marmit', 'marmitex', 'quentinha',
      'buffet', 'bufe', 'por quilo', 'rodizio', 'yakisoba', 'lamen', 'macarrao', 'lasanha', 'nhoque', 'feijoada',
      'strogonoff', 'estrogonofe', 'parmegiana', 'churrasco', 'sobremesa', 'brigadeiro', 'brownie', 'cupcake', 'bolo',
      'torta', 'donut', 'rosquinha', 'milkshake', 'milk shake', 'shake', 'picole', 'gelato', 'sorvete', 'chocolate',
      'guloseima', 'pirulito', 'chiclete', 'bombom', 'churros', 'pacoca', 'pipoca', 'refrigerante', 'refri', 'suco',
      'sucos', 'guarana', 'coca cola', 'coca-cola', 'pepsi', 'energetico', 'red bull', 'smoothie', 'agua de coco'] },
  { cat: 'Padaria',        kws: ['padaria', 'panificadora', 'panific'] },

  // ── Transporte ──
  { cat: 'Uber',           kws: ['uber'] },
  { cat: 'Transporte',     kws: ['99app', '99 pop', '99pop', '99 tecnologia', 'cabify', 'indrive', 'in drive', 'blablacar',
      'posto', 'ipiranga', 'shell ', 'petrobras', 'br mania', 'gasolina', 'combustivel', 'etanol', 'diesel',
      'estacionamento', 'estapar', 'zona azul', 'pedagio', 'sem parar', 'conectcar', 'veloe', 'move mais', 'ccr ',
      'metro', 'metrô', 'cptm', 'bilhete unico', 'sptrans', 'onibus', 'passagem rodoviaria', 'buser', 'autopecas', 'auto pecas',
      'oficina mecanica', 'borracharia', 'licenciamento'] },

  // ── Vestuário / Esporte (subcategorias) ──
  { cat: 'Nike',           kws: ['nike'] },
  { cat: 'Adidas',         kws: ['adidas'] },
  { cat: 'Vestuário',      kws: ['renner', 'riachuelo', 'pernambucanas', 'marisa', 'c&a ', 'c e a ', 'zara', 'hering', 'puma', 'reserva ',
      'centauro', 'netshoes', 'dafiti', 'calcados', 'sapataria', 'arezzo', 'melissa', 'youcom', 'leader', 'calvin klein', 'tommy',
      'olympikus', 'mizuno', 'decathlon', 'track field', 'osklen', 'colcci', 'lojas avenida', 'besni'] },

  // ── Beleza / Estética ──
  { cat: 'Beleza',         kws: ['salao', 'barbearia', 'barber', 'cabeleireiro', 'cabelereiro', 'manicure', 'estetica',
      'depilacao', 'sobrancelha', 'boticario', 'natura', 'sephora', 'perfumaria', 'quem disse berenice', 'avon'] },

  // ── Academia / Fitness ──
  { cat: 'Academia',       kws: ['academia', 'smartfit', 'smart fit', 'bodytech', 'bioritmo', 'bio ritmo', 'selfit', 'bluefit',
      'crossfit', 'personal trainer', 'pilates', 'tecnofit', 'totalpass', 'gympass', 'wellhub'] },

  // ── Assinaturas / Streaming (subcategorias) ──
  { cat: 'Netflix',        kws: ['netflix'] },
  { cat: 'Spotify',        kws: ['spotify'] },
  { cat: 'Disney+',        kws: ['disney'] },
  { cat: 'Prime Video',    kws: ['prime video', 'primevideo', 'amazon prime'] },
  { cat: 'HBO Max',        kws: ['hbomax', 'hbo max', 'hbo'] },
  { cat: 'Globo Play',     kws: ['globoplay', 'globo play'] },
  { cat: 'Assinaturas',    kws: ['youtube premium', 'youtube music', 'deezer', 'tidal', 'apple music', 'apple com bill', 'apple.com bill',
      'canva', 'notion', 'chatgpt', 'openai', 'midjourney', 'adobe', 'office 365', 'microsoft 365', 'google one', 'icloud',
      'paramount', 'crunchyroll', 'star plus', 'starplus', 'mubi', 'telecine', 'dropbox', 'linkedin premium', 'assinatura'] },

  // ── Mercado / supermercado ──
  { cat: 'Mercado',        kws: ['mercado', 'supermercado', 'super mercado', 'atacad', 'atacarejo', 'carrefour', 'assai', 'assaí',
      'pao de acucar', 'extra hiper', 'bompreco', 'hortifruti', 'sams club', 'sam s club', 'makro', 'tenda atac',
      'dia supermercado', 'sonda', 'st marche', 'mambo', 'natural da terra', 'sacolao', 'quitanda', 'hipermercado',
      'mercearia', 'prezunic', 'guanabara', 'zona sul', 'verdemar', 'cometa supermercados'] },

  // ── Saúde / Farmácia ──
  { cat: 'Saúde',          kws: ['farmacia', 'drogaria', 'drogasil', 'droga raia', 'pacheco', 'pague menos', 'panvel', 'raia ',
      'extrafarma', 'venancio', 'nissei', 'ultrafarma', 'clinica', 'hospital', 'laboratorio', 'fleury', 'sabin', 'hermes pardini',
      'unimed', 'amil', 'hapvida', 'notredame', 'odonto', 'dentista', 'ortodontia', 'consulta medica', 'exame', 'fisioterapia',
      'psicolog', 'terapia', 'vacina', 'otica', 'oculos'] },

  // ── Pet ──
  { cat: 'Pet',            kws: ['petz', 'cobasi', 'petlove', 'veterinari', 'pet shop', 'petshop', 'pet center', 'clinipet', 'agropet', 'racao'] },

  // ── Educação ──
  { cat: 'Educação',       kws: ['udemy', 'coursera', 'alura', 'duolingo', 'rocketseat', 'hotmart', 'escola', 'colegio',
      'faculdade', 'universidade', 'uninter', 'estacio', 'anhanguera', 'qconcursos', 'gran cursos', 'mensalidade escolar',
      'livraria', 'saraiva', 'papelaria', 'kumon', 'wizard', 'ccaa', 'fisk', 'cna ', 'curso de'] },

  // ── Lazer / Entretenimento ──
  { cat: 'Lazer e Entretenimento', kws: ['cinema', 'cinemark', 'kinoplex', 'ingresso', 'sympla', 'eventim', 'show ', 'teatro',
      'parque', 'hopi hari', 'beto carrero', 'steam', 'playstation', 'xbox', 'nintendo', 'riot games', 'epic games', 'twitch',
      'boliche', 'balada'] },

  // ── Viagem / Hospedagem ──
  { cat: 'Viagem',         kws: ['latam', 'gol linhas', 'azul linhas', 'azul viagens', 'smiles', 'decolar', '123 milhas',
      'cvc ', 'maxmilhas', 'expedia', 'hoteis com', 'airbnb', 'booking', 'hotel', 'pousada', 'hostel', 'resort',
      'rentcars', 'localiza', 'movida', 'unidas', 'rent a car'] },

  // ── Internet / Telefone / TV ──
  { cat: 'Internet',       kws: ['vivo fibra', 'vivo ', 'claro net', 'claro ', 'oi fibra', 'tim sa', 'tim celular', 'net servicos',
      'sky ', 'telefonica', 'internet', 'banda larga', 'fibra otica', 'recarga celular', 'tv por assinatura'] },

  // ── Contas de casa (energia, água, gás, condomínio) ──
  { cat: 'Contas',         kws: ['enel', 'cpfl', 'light ', 'cemig', 'copel', 'celpe', 'coelba', 'energisa', 'equatorial energia',
      'elektro', 'energia eletrica', 'conta de luz', 'sabesp', 'cedae', 'copasa', 'sanepar', 'caesb', 'embasa', 'conta de agua',
      'comgas', 'gas natural', 'ultragaz', 'liquigas', 'condominio', 'taxa condominio'] },

  // ── Moradia ──
  { cat: 'Moradia',        kws: ['aluguel', 'imobiliaria', 'quintoandar', 'quinto andar', 'construtora', 'leroy merlin',
      'telhanorte', 'tok stok', 'madeira madeira', 'mobly', 'casa bahia moveis'] },

  // ── Impostos / Taxas ──
  { cat: 'Impostos',       kws: ['darf', 'ipva', 'iptu', 'imposto', 'receita federal', 'detran', 'multa de transito', 'tarifa bancaria'] },

  // ── Seguros ──
  { cat: 'Seguros',        kws: ['seguro', 'porto seguro', 'azul seguros', 'sulamerica seguro', 'bradesco seguros', 'allianz', 'mapfre', 'tokio marine'] },

  // ── Salário / Renda ──
  { cat: 'Salário',        kws: ['salario', 'folha de pagamento', 'folha pagamento', 'pro labore', 'pro-labore', 'provento', 'remuneracao', 'decimo terceiro'] },

  // ── Investimentos ──
  { cat: 'Investimentos',  kws: ['aplicacao', 'resgate', 'tesouro direto', 'corretora', 'xp investimentos', 'nuinvest', 'aporte', 'renda fixa', 'fundo de investimento', 'b3 '] },
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
