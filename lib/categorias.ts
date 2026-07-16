// ─────────────────────────────────────────────────────────────
// Tema de categorias — emoji + paleta de cores HSL
// Funciona em modo claro e escuro com contraste WCAG AA
// ─────────────────────────────────────────────────────────────

export interface CategoriaTheme {
  emoji: string;
  hue:   number;   // HSL hue (0-360)
  label: string;
}

export const CATEGORIA_TEMAS: Record<string, CategoriaTheme> = {
  mercado:        { emoji: '🛒', hue: 150, label: 'Mercado' },
  supermercado:   { emoji: '🛒', hue: 150, label: 'Supermercado' },
  restaurante:    { emoji: '🍽️', hue: 25,  label: 'Restaurante' },
  alimentacao:    { emoji: '🍽️', hue: 25,  label: 'Alimentação' },
  transporte:     { emoji: '🚗', hue: 215, label: 'Transporte' },
  saude:          { emoji: '💊', hue: 340, label: 'Saúde' },
  aluguel:        { emoji: '🏠', hue: 270, label: 'Aluguel' },
  moradia:        { emoji: '🏠', hue: 270, label: 'Moradia' },
  assinaturas:    { emoji: '📺', hue: 0,   label: 'Assinaturas' },
  lazer:          { emoji: '🎬', hue: 45,  label: 'Lazer' },
  educacao:       { emoji: '📚', hue: 235, label: 'Educação' },
  vestuario:      { emoji: '👕', hue: 320, label: 'Vestuário' },
  pet:            { emoji: '🐶', hue: 35,  label: 'Pet' },
  padaria:        { emoji: '🥖', hue: 38,  label: 'Padaria' },
  internet:       { emoji: '🛜', hue: 195, label: 'Internet' },
  viagem:         { emoji: '✈️', hue: 200, label: 'Viagem' },
  hospedagem:     { emoji: '🏨', hue: 200, label: 'Hospedagem' },
  salario:        { emoji: '💰', hue: 142, label: 'Salário' },
  transferencia:  { emoji: '🔄', hue: 220, label: 'Transferência' },
  transferencias: { emoji: '💸', hue: 220, label: 'Transferências' },
  investimentos:  { emoji: '📈', hue: 160, label: 'Investimentos' },
  compras:        { emoji: '🛍️', hue: 290, label: 'Compras' },
  encomendas:     { emoji: '🚚', hue: 280, label: 'Encomendas' },
  contas:         { emoji: '💡', hue: 48,  label: 'Contas' },
  beleza:         { emoji: '💇', hue: 330, label: 'Beleza' },
  academia:       { emoji: '💪', hue: 12,  label: 'Academia' },
  impostos:       { emoji: '🧾', hue: 4,   label: 'Impostos' },
  ajuste:         { emoji: '🔧', hue: 200, label: 'Ajuste' },
  escola:         { emoji: '🏫', hue: 225, label: 'Escola' },
  // Categorias/subcategorias da migration 072
  autocuidado:      { emoji: '🧼', hue: 190, label: 'Autocuidado' },
  medico:           { emoji: '🩺', hue: 350, label: 'Médico' },
  'plano de saude': { emoji: '❤️‍🩹', hue: 355, label: 'Plano de Saúde' },
  vendas:           { emoji: '💵', hue: 140, label: 'Vendas' },
  presente:         { emoji: '🎁', hue: 340, label: 'Presente' },
  combustivel:      { emoji: '⛽', hue: 20,  label: 'Combustível' },
  seguro:           { emoji: '🔒', hue: 210, label: 'Seguro' },
  filhos:           { emoji: '👶', hue: 30,  label: 'Filhos' },
  financiamento:    { emoji: '🔖', hue: 265, label: 'Financiamento' },
  extras:           { emoji: '📥', hue: 175, label: 'Extras' },
  seguros:        { emoji: '🛡️', hue: 210, label: 'Seguros' },
  outros:         { emoji: '📦', hue: 220, label: 'Outros' },
};

// Sinônimos → chave do catálogo. Cobrem nomes que NÃO batem por substring com as
// chaves acima (ex.: "dentista" não contém "saude"). Usados só como fallback,
// depois do match direto/substring. Termos específicos (≥5 letras) pra evitar
// falso positivo. Espelha o categorizar.js do backend nos casos comuns.
// Espelha o roteamento do backend (categorizar.js / interpretador.js):
// dentista e estética → Autocuidado · planos → Plano de Saúde · demais médicos →
// Médico · nutricionista/farmácia → Saúde · gasolina → Combustível.
export const CATEGORIA_ALIASES: Record<string, string> = {
  // Autocuidado (exceções de Saúde)
  dentista: 'autocuidado', dentaria: 'autocuidado', odonto: 'autocuidado', ortodont: 'autocuidado',
  dermato: 'autocuidado', esteticista: 'autocuidado', estetica: 'autocuidado',
  cabeleireiro: 'autocuidado', barbeiro: 'autocuidado', barbearia: 'autocuidado', manicure: 'autocuidado',
  // Plano de Saúde
  unimed: 'plano de saude', hapvida: 'plano de saude', notredame: 'plano de saude',
  // Médico
  medico: 'medico', consulta: 'medico', exame: 'medico', hospital: 'medico',
  laboratorio: 'medico', fisioterap: 'medico', otorrino: 'medico', pediatra: 'medico',
  cardiolog: 'medico', ortoped: 'medico', ginecolog: 'medico', oftalmo: 'medico',
  // Saúde geral
  nutricionista: 'saude', farmacia: 'saude', drogaria: 'saude', remedio: 'saude',
  clinica: 'saude', psicolog: 'saude', vacina: 'saude',
  // Combustível / Transporte
  gasolina: 'combustivel', combustivel: 'combustivel', uber: 'transporte',
  // Alimentação / Assinaturas comuns
  ifood: 'alimentacao', netflix: 'assinaturas', spotify: 'assinaturas',
};

// Lista para o modal — categorias mais usadas
export const CATEGORIAS_MODAL = [
  { emoji: '🛒', nome: 'Mercado' },
  { emoji: '🍽️', nome: 'Restaurante' },
  { emoji: '🚗', nome: 'Transporte' },
  { emoji: '💊', nome: 'Saúde' },
  { emoji: '🏠', nome: 'Aluguel' },
  { emoji: '📺', nome: 'Assinaturas' },
  { emoji: '🎬', nome: 'Lazer' },
  { emoji: '📚', nome: 'Educação' },
  { emoji: '👕', nome: 'Vestuário' },
  { emoji: '🐶', nome: 'Pet' },
  { emoji: '💪', nome: 'Academia' },
  { emoji: '🛜', nome: 'Internet' },
  { emoji: '✈️', nome: 'Viagem' },
  { emoji: '💰', nome: 'Salário' },
  { emoji: '📈', nome: 'Investimentos' },
  { emoji: '🔄', nome: 'Transferência' },
  { emoji: '📦', nome: 'Outros' },
];

// Limpa o nome — remove emoji + lowercase + sem acento
function normaliza(nome: string): string {
  return (nome || '')
    .replace(/\p{Emoji}/gu, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().trim();
}

// Hash determinístico — usado como fallback final quando o nome não tem
// match nem no catálogo nem na lista de categorias do usuário.
function hueDoNome(nome: string): number {
  const limpo = normaliza(nome);
  let hash = 0;
  for (let i = 0; i < limpo.length; i++) hash = limpo.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

// Detecta se um hex é grayscale (R≈G≈B). O backend antigo salva categorias
// padrão com cor "#808080" e queremos ignorar isso pra cair no tema do nome.
export function isHexGrayscale(hex: string): boolean {
  const m = hex.trim().match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return false;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  return Math.max(r, g, b) - Math.min(r, g, b) < 15;
}

// Versão CÍTRICA (vibrante) de uma cor: preserva o TOM (hue) da categoria e crava
// saturação alta + brilho médio. Cada categoria continua com sua cor própria, só
// que "no talo" (verde cítrico, roxo cítrico, laranja cítrico…). Aceita hsl(...)
// do catálogo E #hex custom; formato desconhecido volta como está.
export function citrico(color: string, sat = 90, light = 58): string {
  if (!color) return color;
  const hsl = color.match(/hsl\(\s*([\d.-]+)/i);
  if (hsl) return `hsl(${hsl[1]} ${sat}% ${light}%)`;
  const hex = color.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return color; // cinza puro → não inventa um tom
    const d = max - min;
    let hue = max === r ? (g - b) / d + (g < b ? 6 : 0)
            : max === g ? (b - r) / d + 2
            :             (r - g) / d + 4;
    hue = Math.round(hue * 60);
    return `hsl(${hue} ${sat}% ${light}%)`;
  }
  return color;
}

// Item mínimo aceito pelo helper — qualquer objeto com nome + cor opcional
export interface CategoriaUserMin {
  nome?: string;
  icone?: string | null;
  cor?: number | string | null;
}

// Resolve a cor da categoria considerando, em ordem:
//   1. Categoria customizada do usuário (cor + icone definidos no painel)
//   2. Catálogo CATEGORIA_TEMAS por match de nome
//   3. Hash determinístico do nome (cores estáveis, nunca cinza)
export function getCategoriaTheme(
  categoria: string,
  categoriasUsuario?: CategoriaUserMin[]
): CategoriaTheme & { color: string; bg: string; ring: string } {
  const limpo = normaliza(categoria);

  // 1. Match com categorias do usuário (cor customizada vence)
  let hueUsuario: number | null = null;
  let hexUsuario: string | null = null;
  let emojiUsuario: string | null = null;
  if (categoriasUsuario && categoriasUsuario.length) {
    const match = categoriasUsuario.find(c => normaliza(c.nome || '') === limpo);
    if (match) {
      if (typeof match.cor === 'number') {
        hueUsuario = match.cor;
      } else if (typeof match.cor === 'string') {
        const trim = match.cor.trim();
        if (trim.startsWith('#')) {
          // Hex válido só conta se NÃO for grayscale do default do backend
          if (!isHexGrayscale(trim)) hexUsuario = trim;
        } else {
          const n = parseFloat(trim);
          if (!isNaN(n)) hueUsuario = n;
        }
      }
      if (match.icone) emojiUsuario = match.icone;
    }
  }

  // 2. Catálogo
  let tema = CATEGORIA_TEMAS[limpo];
  if (!tema) {
    for (const [key, val] of Object.entries(CATEGORIA_TEMAS)) {
      if (limpo.includes(key) || key.includes(limpo)) { tema = val; break; }
    }
  }

  // 2b. Sinônimos (ex.: "dentista" → Saúde) — só se o catálogo não bateu.
  if (!tema) {
    for (const [palavra, chave] of Object.entries(CATEGORIA_ALIASES)) {
      if (limpo.includes(palavra)) { tema = CATEGORIA_TEMAS[chave]; break; }
    }
  }

  // 3. Hash final — antes era cinza/Outros; agora gera cor estável a partir do nome
  if (!tema) {
    tema = { emoji: '📦', hue: hueDoNome(limpo), label: categoria };
  }

  // Se a categoria original já tem emoji, usa esse
  const emojiMatch = (categoria || '').match(/\p{Emoji}/u);
  const emoji = emojiUsuario || (emojiMatch ? emojiMatch[0] : tema.emoji);

  // Hex customizado válido vence; senão usa hue (custom ou catálogo)
  if (hexUsuario) {
    return {
      ...tema,
      emoji,
      color: hexUsuario,
      bg:    hexUsuario + '20',
      ring:  hexUsuario + '40',
    };
  }

  const hue = hueUsuario != null ? hueUsuario : tema.hue;
  return {
    ...tema,
    emoji,
    hue,
    color: `hsl(${hue} 65% 50%)`,
    bg:    `hsl(${hue} 75% 50% / 0.12)`,
    ring:  `hsl(${hue} 65% 50% / 0.25)`,
  };
}

// Extrai apenas o nome sem emoji
export function nomeCategoria(categoria: string): string {
  return (categoria || '').replace(/\p{Emoji}/gu, '').trim() || 'Sem categoria';
}
