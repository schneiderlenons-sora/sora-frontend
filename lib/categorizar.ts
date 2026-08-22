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
// Prefixo '=' força palavra inteira mesmo em kw longa — pra kw que é sufixo de
// outra palavra comum (ex.: '=racao', senão "libeRACAO"/"decoRACAO" viram Pet).
function casa(texto: string, kw: string): boolean {
  const exato = kw[0] === '=';
  const k = exato ? kw.slice(1) : kw;
  if (!exato && k.length >= 4) return texto.includes(k);
  const esc = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|\\s)${esc}(\\s|$)`).test(texto);
}

type Regra = { cat: string; kws: string[] };

// ORDEM IMPORTA — marca/específico antes de genérico.
// ⚠️ Mantido em sincronia com sora-backend/src/services/categorizar.js (REGRAS).
// Taxonomia v3 (ver sora-backend/sql/084_categorias_v3.sql).
// ⚠️ Mantido em sincronia com sora-backend/src/services/categorizar.js (REGRAS).
const REGRAS: Regra[] = [
  // ── Encomendas / Compras (marcas) ──
  // "amazon prime" é streaming, não marketplace → checa ANTES de 'amazon'.
  { cat: 'Prime Video',    kws: ['amazon prime', 'prime video', 'primevideo'] },
  { cat: 'Mercado Livre',  kws: ['mercado livre', 'mercadolivre', 'mercadolibre', 'meli '] },
  { cat: 'Amazon',         kws: ['amazon', 'amzn'] },
  { cat: 'Shopee',         kws: ['shopee'] },
  { cat: 'Aliexpress',     kws: ['aliexpress', 'ali express'] },
  { cat: 'TikTok Shop',    kws: ['tiktok shop', 'tiktok', 'tik tok'] },
  { cat: 'Shein',          kws: ['shein'] },
  { cat: 'Nike',           kws: ['nike'] },
  { cat: 'Adidas',         kws: ['adidas'] },
  { cat: 'Encomendas',     kws: ['magazine luiza', 'magalu', 'americanas', 'casas bahia', 'submarino', 'kabum', 'pichau', 'terabyte', 'temu', 'wish', 'enjoei', 'pontofrio', 'ponto frio', 'fastshop', 'fast shop', 'shopify'] },

  // ── Assinatura da Sora (EC*SORA no extrato) — antes do genérico ──
  { cat: 'Assinaturas',    kws: ['ec sora', 'forsora', 'sora ai'] },

  // ── Trabalho / Negócio (anúncios e ferramentas) ──
  { cat: 'Facebook Ads',   kws: ['facebk', 'facebook ad', 'fb ads', 'meta ads', 'meta plataform', 'instagram ad', 'anuncio facebook', 'anuncios facebook', 'anuncio instagram', 'anuncios instagram', 'facebook'] },
  { cat: 'Google Ads',     kws: ['google ads', 'googleads', 'google adwords'] },
  { cat: 'Empreendimento', kws: ['tiktok ads', 'kwai for business', 'linkedin ads', 'mailchimp', 'fornecedor', 'frete', 'transportadora', 'embalagem', 'correios sedex'] },

  // ── Transferências / Pix / estornos (não-consumo) ──
  // A taxonomia v3 tem subcategorias próprias (PIX, Boleto, Transferência
  // recebida) — antes tudo caía no genérico "Transferências" e o usuário perdia
  // a quebra. Específicas primeiro; "Transferências" fica só pro que sobra.
  { cat: 'PIX',            kws: ['pix enviado', 'pix recebido', 'pix qr', 'qr pix', 'pagamento pix', 'recebimento pix', 'pix ', '=pix'] },
  { cat: 'Transferência recebida', kws: ['deposito de dinheiro', 'deposito em conta', 'deposito recebido', 'deposito bancario',
      'dinheiro recebido', 'transferencia recebida', 'ted recebida', 'doc recebido', '=deposito'] },
  { cat: 'Boleto',         kws: ['boleto'] },
  { cat: 'Transferências', kws: ['mercado pago', 'mercadopago', 'ted ', 'doc ', 'transferencia', 'transferencias', 'transf ',
      'venda cancelada', 'liberacao de dinheiro', 'estorno', 'devolucao', 'reembolso', 'chargeback'] },

  // ── Delivery (marcas) — ANTES de comida genérica. "Zé Delivery" ≠ "delivery". ──
  { cat: 'iFood',          kws: ['ifood', 'i food'] },
  { cat: 'AiqFome',        kws: ['aiqfome', 'aiq fome'] },
  { cat: 'Zé Delivery',    kws: ['ze delivery', 'zedelivery', 'ze entrega'] },
  { cat: 'Rappi',          kws: ['rappi'] },
  { cat: 'Delivery',       kws: ['uber eats', 'ubereats', 'james delivery', 'delivery', 'tele entrega', 'daki'] },

  // ── Alimentação (Café, Padaria, Supermercado, Lanches, Restaurante) ──
  { cat: 'Café',           kws: ['cafeteria', 'starbucks', 'the coffee', 'kopenhagen', 'cacau show', 'cafe ', 'coffee'] },
  { cat: 'Padaria',        kws: ['padaria', 'panificadora', 'panific'] },
  { cat: 'Supermercado',   kws: ['mercado', 'supermercado', 'super mercado', 'atacad', 'atacarejo', 'carrefour', 'assai', 'assaí',
      'pao de acucar', 'extra hiper', 'bompreco', 'hortifruti', 'sams club', 'sam s club', 'makro', 'tenda atac',
      'dia supermercado', 'sonda', 'st marche', 'mambo', 'natural da terra', 'sacolao', 'quitanda', 'hipermercado',
      'mercearia', 'prezunic', 'guanabara', 'zona sul', 'verdemar', 'cometa supermercados', 'creme de leite', 'creme de avela'] },
  { cat: 'Lanches',        kws: ['lanchonete', 'lanches', 'lanche', 'hamburgueria', 'burger king', 'burguer', 'hamburgu', 'hamburguer',
      'mcdonald', 'mc donalds', 'bobs', 'subway', 'cheeseburger', 'x-tudo', 'x-salada', 'x-burguer', 'x-bacon', 'cachorro quente',
      'cachorro-quente', 'hot dog', 'hotdog', 'misto quente', 'sandui', 'sanduba', 'bauru', 'beirute', 'batata frita', 'porcao',
      'coxinha', 'coxinhas', 'pastel', 'pasteis', 'esfiha', 'esfirra', 'kibe', 'quibe', 'empada', 'empadao', 'enroladinho',
      'risole', 'rissole', 'bolinho', 'salgad', 'pao de queijo', 'pastelaria', 'tapioca', 'crepe', 'creperia', 'tapiocaria',
      'acaraje', 'food truck', 'foodtruck', 'food park', 'petiscaria', 'trailer de', 'quiosque', 'pipoca', 'churros'] },
  { cat: 'Restaurante',    kws: ['restaurante', 'restaur', 'pizzaria', 'pizza', 'outback', 'habibs', 'spoleto', 'dominos',
      'china in box', 'sushi', 'temaki', 'churrascaria', 'espetinho', 'sorveteria', 'acai', 'doceria', 'confeitaria', 'marmita',
      'self service', 'rotisseria', 'boteco', 'comida', 'galeto', 'frango assado', 'refeicao', 'refeicoes', 'prato feito',
      'prato do dia', 'marmit', 'marmitex', 'quentinha', 'buffet', 'bufe', 'por quilo', 'rodizio', 'yakisoba', 'lamen',
      'macarrao', 'lasanha', 'nhoque', 'feijoada', 'strogonoff', 'estrogonofe', 'parmegiana', 'churrasco'] },

  // ── Transporte (Combustível, apps, Estacionamento, Pedágio…) ──
  { cat: 'Uber',           kws: ['uber'] },
  { cat: '99',             kws: ['99app', '99 pop', '99pop', '99 tecnologia', '99 taxi'] },
  { cat: 'Blablacar',      kws: ['blablacar', 'bla bla car'] },
  { cat: 'Combustível',    kws: ['posto', 'ipiranga', 'shell ', 'petrobras', 'br mania', 'gasolina', 'combustivel', 'etanol', 'diesel', 'alcool posto'] },
  { cat: 'Estacionamento', kws: ['estacionamento', 'estapar', 'zona azul', 'estar zona'] },
  { cat: 'Pedágio',        kws: ['pedagio', 'sem parar', 'conectcar', 'veloe', 'move mais', 'ccr ', 'ecovias', 'artesp'] },
  { cat: 'Manutenção do veículo', kws: ['oficina mecanica', 'borracharia', 'autopecas', 'auto pecas', 'auto center', 'funilaria', 'troca de oleo'] },
  { cat: 'Transporte',     kws: ['cabify', 'indrive', 'in drive', 'metro', 'metrô', 'cptm', 'bilhete unico', 'sptrans', 'onibus',
      'passagem rodoviaria', 'buser', 'licenciamento', 'taxi', 'brt'] },

  // ── Compras (roupa/calçado/eletrônico) ──
  { cat: 'Calçados',       kws: ['centauro', 'netshoes', 'dafiti', 'calcados', 'sapataria', 'arezzo', 'melissa', 'olympikus', 'mizuno', 'usaflex'] },
  { cat: 'Eletrônicos',    kws: ['kabum', 'fast shop', 'samsung', 'apple store', 'iplace', 'girafa', 'eletronico'] },
  { cat: 'Roupas',         kws: ['renner', 'riachuelo', 'pernambucanas', 'marisa', 'c&a ', 'c e a ', 'zara', 'hering', 'puma', 'reserva ',
      'youcom', 'leader', 'calvin klein', 'tommy', 'decathlon', 'track field', 'osklen', 'colcci', 'lojas avenida', 'besni', 'roupa', 'vestuario'] },

  // ── Autocuidado ──
  { cat: 'Barbeiro',       kws: ['barbearia', 'barbeiro', 'barber'] },
  { cat: 'Salão de beleza',kws: ['salao de beleza', 'salao', 'cabeleireiro', 'cabelereiro', 'sobrancelha', 'depilacao'] },
  { cat: 'Manicure',       kws: ['manicure', 'pedicure', 'nail', 'unhas'] },
  { cat: 'Autocuidado',    kws: ['dermatolog', 'esteticista', 'estetica', 'cirurgia plastica',
      'botox', 'harmoniza', 'preenchimento facial', 'corte de cabelo',
      'creme', 'perfume', 'pomada', 'hidratante', 'shampoo', 'xampu', 'condicionador', 'sabonete', 'desodorante',
      'protetor solar', 'maquiagem', 'batom', 'cosmetic', 'skincare', 'esmalte', 'barbeador', 'gilete',
      'escova de dente', 'creme dental', 'fio dental', 'enxaguante', 'boticario', 'natura', 'sephora', 'perfumaria', 'quem disse berenice', 'avon',
      'massagem', 'spa ', 'tatuagem', 'piercing'] },

  // ── Dieta / suplementos ──
  { cat: 'Dieta',          kws: ['whey', 'creatina', 'bcaa', 'suplemento', 'hipercalorico', 'pre treino', 'pre-treino',
      'maltodextrina', 'albumina', 'growth', 'max titanium', 'integralmedica', 'probiotica', 'vitamina', 'multivitaminico',
      'isotonico', 'gatorade', 'colageno', 'termogenico'] },

  // ── Academia / Fitness ──
  { cat: 'Academia',       kws: ['academia', 'smartfit', 'smart fit', 'bodytech', 'bioritmo', 'bio ritmo', 'selfit', 'bluefit',
      'crossfit', 'personal trainer', 'pilates', 'tecnofit', 'totalpass', 'gympass', 'wellhub'] },

  // ── Esporte ──
  { cat: 'Esporte',        kws: ['futebol', 'society', 'quadra de', 'aluguel de quadra', 'beach tennis', 'futevolei', 'volei',
      'basquete', 'jiu jitsu', 'jiujitsu', 'muay thai', 'karate', 'judo', 'natacao', 'tenis '] },

  // ── Assinaturas / Streaming (marcas) ──
  { cat: 'Netflix',        kws: ['netflix'] },
  { cat: 'Spotify',        kws: ['spotify'] },
  { cat: 'Disney+',        kws: ['disney'] },
  { cat: 'Prime Video',    kws: ['prime video', 'primevideo', 'amazon prime'] },
  { cat: 'HBO Max',        kws: ['hbomax', 'hbo max', 'hbo', 'max stream'] },
  { cat: 'Globo Play',     kws: ['globoplay', 'globo play'] },
  { cat: 'Assinaturas',    kws: ['youtube premium', 'youtube music', 'deezer', 'tidal', 'apple music', 'apple com bill', 'apple.com bill',
      '=canva', 'notion', 'chatgpt', 'openai', 'midjourney', 'adobe', 'office 365', 'microsoft 365', 'google one', 'icloud',
      'paramount', 'crunchyroll', 'star plus', 'starplus', 'mubi', 'telecine', 'dropbox', 'linkedin premium', 'assinatura',
      // Ferramentas de IA/dev cobradas por mês. Vinham como "Outros" porque não
      // existiam aqui. Keywords curtas ou que são pedaço de palavra comum vão
      // com '=' (palavra inteira): '=claude' senão casa "Claudete"/"Claudia",
      // '=canva' senão casa "canvas", '=cursor'/'=grok' porque são genéricas.
      'anthropic', '=claude', 'claude ai', 'claude sub', 'lovable', 'cursor ai', '=cursor',
      'github copilot', 'copilot', 'perplexity', 'elevenlabs', 'runway ml', 'heygen',
      'replit', 'vercel', 'netlify', 'figma', 'framer', 'capcut', 'gemini advanced', 'google ai',
      'v0 dev', 'windsurf', 'supabase', 'railway app'] },

  // ── Saúde (Farmácia, Plano, Dentista, Psicólogo, Exames, Consultas) ──
  { cat: 'Plano de Saúde', kws: ['unimed', 'amil', 'hapvida', 'notredame', 'paz eterna', 'sulamerica', 'sul america',
      'golden cross', 'prevent senior', 'porto seguro saude', 'bradesco saude', 'plano de saude'] },
  { cat: 'Dentista',       kws: ['dentista', 'odontolog', 'odonto'] },
  { cat: 'Psicólogo',      kws: ['psicolog', 'psiquiatra', 'terapia', 'terapeuta'] },
  { cat: 'Exames',         kws: ['exame', 'laboratorio', 'fleury', 'sabin', 'hermes pardini', 'raio x', 'ultrassom', 'ressonancia', 'tomografia'] },
  { cat: 'Farmácia',       kws: ['farmacia', 'drogaria', 'drogasil', 'droga raia', 'pacheco', 'pague menos', 'panvel', 'raia ',
      'extrafarma', 'venancio', 'nissei', 'ultrafarma', 'remedio'] },
  { cat: 'Consultas',      kws: ['otorrino', 'fisioterap', 'cardiolog', 'ortoped', 'pediatra', 'ginecolog', 'urolog', 'oftalmo',
      'neurolog', 'endocrino', 'reumatolog', 'clinico geral', 'consulta medica', 'medico', 'hospital', 'clinica'] },
  { cat: 'Saúde',          kws: ['nutricionista', 'nutrolog', 'vacina', 'otica', 'oculos'] },

  // ── Família / Pet ──
  { cat: 'Pets',           kws: ['petz', 'cobasi', 'petlove', 'veterinari', 'pet shop', 'petshop', 'pet center', 'clinipet', 'agropet', '=racao'] },
  { cat: 'Família',        kws: ['fralda', 'creche', 'bercario', 'mesada', 'escolinha', 'brinquedo', 'ri happy', 'pbkids'] },

  // ── Educação ──
  { cat: 'Educação',       kws: ['udemy', 'coursera', 'alura', 'duolingo', 'rocketseat', 'hotmart', 'escola', 'colegio',
      'faculdade', 'universidade', 'uninter', 'estacio', 'anhanguera', 'qconcursos', 'gran cursos', 'mensalidade escolar',
      'livraria', 'saraiva', 'papelaria', 'kumon', 'wizard', 'ccaa', 'fisk', 'cna ', 'curso de'] },

  // ── Lazer ──
  { cat: 'Lazer',          kws: ['cinema', 'cinemark', 'kinoplex', 'ingresso', 'sympla', 'eventim', 'show ', 'teatro',
      'parque', 'hopi hari', 'beto carrero', 'steam', 'playstation', 'xbox', 'nintendo', 'riot games', 'epic games', 'twitch',
      'boliche', 'balada', 'bar ', 'pub ', 'cervejaria', 'festa', 'evento'] },

  // ── Viagem → subcategoria de Lazer ──
  { cat: 'Viagem',         kws: ['latam', 'gol linhas', 'azul linhas', 'azul viagens', 'smiles', 'decolar', '123 milhas',
      'cvc ', 'maxmilhas', 'expedia', 'hoteis com', 'airbnb', 'booking', 'hotel', 'pousada', 'hostel', 'resort',
      'rentcars', 'localiza', 'movida', 'unidas', 'rent a car'] },

  // ── Tecnologia (telecom/celular/cloud) ──
  { cat: 'Tecnologia',     kws: ['vivo fibra', 'vivo ', 'claro net', 'claro ', 'oi fibra', 'tim sa', 'tim celular', 'net servicos',
      'sky ', 'telefonica', 'recarga celular', 'google play', 'app store', 'aws ', 'google cloud', 'azure', 'godaddy', 'hostgator', 'hostinger'] },

  // ── Moradia (contas de casa → subcategorias) ──
  { cat: 'Internet',       kws: ['internet', 'banda larga', 'fibra otica', 'tv por assinatura'] },
  { cat: 'Conta de Luz',   kws: ['enel', 'cpfl', 'light ', 'cemig', 'copel', 'celpe', 'coelba', 'energisa', 'equatorial energia',
      'elektro', 'energia eletrica', 'conta de luz', 'conta de energia', 'energia'] },
  { cat: 'Água',           kws: ['sabesp', 'cedae', 'copasa', 'sanepar', 'caesb', 'embasa', 'conta de agua', 'saneamento'] },
  { cat: 'Gás',            kws: ['comgas', 'gas natural', 'ultragaz', 'liquigas', 'botijao', 'gas de cozinha'] },
  { cat: 'Condomínio',     kws: ['condominio', 'taxa condominio'] },
  { cat: 'IPTU',           kws: ['iptu'] },
  { cat: 'Aluguel',        kws: ['aluguel', 'imobiliaria', 'quintoandar', 'quinto andar', 'locacao imovel'] },
  { cat: 'Moradia',        kws: ['construtora', 'leroy merlin', 'telhanorte', 'tok stok', 'madeira madeira', 'mobly',
      'casa bahia moveis', 'material de construcao', 'reforma'] },

  // ── Financeiro (juros, tarifas, impostos, empréstimos) ──
  { cat: 'Financiamento',  kws: ['financiamento', 'consorcio', 'prestacao veiculo'] },
  { cat: 'Financeiro',     kws: ['darf', 'ipva', 'imposto', 'receita federal', 'detran', 'multa de transito', 'tarifa bancaria',
      'tarifa mensal', 'anuidade cartao', 'iof', 'juros', 'emprestimo', 'previdencia', 'consignado'] },

  // ── Seguros → Seguro do veículo / genérico ──
  { cat: 'Seguro do veículo', kws: ['seguro auto', 'seguro do carro', 'seguro veicular', 'porto seguro auto'] },
  { cat: 'Seguro',         kws: ['seguro de vida', 'seguro residencial', 'seguro viagem', 'apolice', 'porto seguro', 'azul seguros',
      'sulamerica seguro', 'bradesco seguros', 'allianz', 'mapfre', 'tokio marine', 'seguro'] },

  // ── Doações ──
  { cat: 'Doações',        kws: ['dizimo', 'oferta igreja', 'doacao', 'vakinha', 'vaquinha', 'apae', 'cruz vermelha'] },

  // ── Compras genérico (fallback) ──
  { cat: 'Compras',        kws: ['presente', 'lembrancinha', 'shopping', 'loja de departamento'] },

  // ── Salário / Renda ──
  { cat: 'Salário',        kws: ['salario', 'folha de pagamento', 'folha pagamento', 'pro labore', 'pro-labore', 'provento', 'remuneracao', 'decimo terceiro'] },

  // ── Negócio (receita de vendas/serviços) ──
  { cat: 'Negócio',        kws: ['venda de', 'recebi de cliente', 'freelance', 'freela', 'consultoria', 'prestacao de servico'] },

  // ── Investimentos (receita) ──
  { cat: 'Investimentos',  kws: ['dividendo', 'rendimento', 'aplicacao', 'resgate', 'tesouro direto', 'corretora', 'xp investimentos', 'nuinvest', 'aporte', 'renda fixa', 'fundo de investimento', 'b3 '] },
];

// Retorna o nome da categoria/subcategoria sugerida, ou null se nada casar.
// Categorias que só fazem sentido como ENTRADA → o par de saída.
const SO_RECEITA: Record<string, string> = { PIX: 'Pix enviado' };

/**
 * Corrige a categoria pela DIREÇÃO do lançamento.
 *
 * O motor de palavras-chave olha só a descrição, e "Pix enviado" e "Pix
 * recebido" casam na mesma regra → os dois caíam em `PIX`, que na taxonomia é
 * categoria de RECEITA. Um Pix que SAI ficava com categoria de entrada.
 *
 * O dinheiro nunca sumiu: Transações e Relatórios somam por `tipo`, então a
 * saída sempre contou como despesa. Quem escondia era a aba CATEGORIAS, que
 * lista as categorias de despesa e não achava `PIX` entre elas. Medido: 1.106
 * lançamentos de Gasto com essa categoria na base, e `PIX` é de receita nos
 * 141 grupos — não era caso isolado.
 *
 * ⚠️ O DESTINO PRECISA EXISTIR NA TAXONOMIA. O campo `categoria` é texto
 * livre, e um nome que não é categoria cadastrada some da aba do mesmo jeito —
 * seria trocar um bug pelo outro. `Pix enviado` é criada pela migration 132 em
 * todos os grupos, pendurada em Financeiro.
 */
export function ajustarPorDirecao(categoria: string | null, ehGasto?: boolean): string | null {
  if (!ehGasto || !categoria) return categoria;
  return SO_RECEITA[categoria] || categoria;
}

export function categorizarDescricao(descricao: string): string | null {
  const t = normalizar(descricao);
  if (!t) return null;
  for (const regra of REGRAS) {
    for (const kw of regra.kws) {
      // normalizar() comeria o '=' (vira espaço) — reaplica depois pra manter
      // o pedido de "palavra inteira".
      const exato = kw[0] === '=';
      const k = normalizar(kw);
      if (k && casa(t, exato ? `=${k}` : k)) return regra.cat;
    }
  }
  return null;
}

// ── Pagamento de fatura do cartão ───────────────────────────────────────────
// Subcategoria de Financeiro (migration 103). Antes era a string solta
// 'Fatura cartão', repetida em vários arquivos — e esquecer UM filtro faz o
// pagamento voltar a contar como gasto no relatório, em DOBRO (as compras da
// fatura já foram categorizadas uma a uma).
// ⚠️ Espelha sora-backend/src/services/categorizar.js.
export const CATEGORIA_FATURA = 'Fatura';
export const CATEGORIA_FATURA_LEGADO = 'Fatura cartão';

/** É pagamento de fatura? Aceita o nome novo e o legado (histórico não reescrito). */
export function ehPagamentoFatura(categoria?: string | null): boolean {
  const c = (categoria || '').toString().trim().toLowerCase();
  return c === CATEGORIA_FATURA.toLowerCase() || c === CATEGORIA_FATURA_LEGADO.toLowerCase();
}
