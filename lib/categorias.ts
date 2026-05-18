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
  outros:         { emoji: '📦', hue: 220, label: 'Outros' },
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

// Retorna emoji + cor para qualquer categoria
export function getCategoriaTheme(categoria: string): CategoriaTheme & { color: string; bg: string; ring: string } {
  const limpo = normaliza(categoria);

  // Tenta encontrar correspondência exata ou parcial
  let tema = CATEGORIA_TEMAS[limpo];
  if (!tema) {
    for (const [key, val] of Object.entries(CATEGORIA_TEMAS)) {
      if (limpo.includes(key) || key.includes(limpo)) { tema = val; break; }
    }
  }
  if (!tema) tema = CATEGORIA_TEMAS.outros;

  // Se a categoria original já tem emoji, usa esse
  const emojiMatch = (categoria || '').match(/\p{Emoji}/u);
  const emoji = emojiMatch ? emojiMatch[0] : tema.emoji;

  return {
    ...tema,
    emoji,
    color: `hsl(${tema.hue} 65% 50%)`,
    bg:    `hsl(${tema.hue} 75% 50% / 0.12)`,
    ring:  `hsl(${tema.hue} 65% 50% / 0.25)`,
  };
}

// Extrai apenas o nome sem emoji
export function nomeCategoria(categoria: string): string {
  return (categoria || '').replace(/\p{Emoji}/gu, '').trim() || 'Sem categoria';
}
