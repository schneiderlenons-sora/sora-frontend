// Catálogo de personalização do avatar do usuário (cores + ícones de baleia).
// As artes ficam em public/avatars/<arquivo>.png — enquanto não existirem, o
// AvatarMembro cai no emoji 🐳 (fallback), então a feature já funciona.

export const AVATAR_CORES: string[] = [
  '#61ce70', // verde Sora
  '#3b82f6', // azul
  '#7c3aed', // roxo
  '#ec4899', // rosa
  '#ef4444', // vermelho
  '#f97316', // laranja
  '#eab308', // amarelo
  '#06b6d4', // ciano
  '#10b981', // esmeralda
  '#8b5cf6', // violeta
  '#f43f5e', // rosa-vermelho
  '#18181b', // black
];

export const AVATAR_COR_PADRAO = '#61ce70';

export interface AvatarPreset {
  id:    string;
  label: string;
  img:   string;   // public/avatars/<arquivo>.png
  emoji: string;   // fallback enquanto a arte não existe
}

// Ícones de baleia pré-definidos (estilo Netflix). O usuário escolhe 1.
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'classica',   label: 'Clássica',   img: '/avatars/baleia-classica.png',   emoji: '🐳' },
  { id: 'grana',      label: 'Grana',      img: '/avatars/baleia-grana.png',      emoji: '🐳' },
  { id: 'estudiosa',  label: 'Estudiosa',  img: '/avatars/baleia-estudiosa.png',  emoji: '🐳' },
  { id: 'festa',      label: 'Festa',      img: '/avatars/baleia-festa.png',      emoji: '🐳' },
  { id: 'dorminhoca', label: 'Dorminhoca', img: '/avatars/baleia-dorminhoca.png', emoji: '🐳' },
  { id: 'apaixonada', label: 'Apaixonada', img: '/avatars/baleia-apaixonada.png', emoji: '🐳' },
];

export function presetById(id?: string | null): AvatarPreset | null {
  if (!id) return null;
  return AVATAR_PRESETS.find(p => p.id === id) || null;
}
