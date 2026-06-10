// =====================================================================
// Cor temática do app — uma variável CSS (--primary) governa Finance + Grow.
// O usuário escolhe uma paleta em Configurações; a escolha persiste e
// recolore todas as abas instantaneamente (zero custo de performance).
// =====================================================================

export type Paleta = { id: string; nome: string; hsl: string; hex: string };

// `hsl` alimenta a variável CSS --primary (formato "H S% L%").
// `hex` é só pra amostra (swatch) do seletor.
export const PALETAS: Paleta[] = [
  { id: 'verde',    nome: 'Verde Sora', hsl: '134 55% 60%', hex: '#5BC571' },
  { id: 'azul',     nome: 'Azul',       hsl: '217 91% 60%', hex: '#3B82F6' },
  { id: 'roxo',     nome: 'Roxo',       hsl: '262 83% 58%', hex: '#7C3AED' },
  { id: 'laranja',  nome: 'Laranja',    hsl: '25 95% 53%',  hex: '#F97316' },
  { id: 'rosa',     nome: 'Rosa',       hsl: '330 81% 60%', hex: '#EC4899' },
  { id: 'vermelho', nome: 'Vermelho',   hsl: '0 72% 55%',   hex: '#DC2626' },
];

export const PALETA_PADRAO = 'verde';
export const BRAND_STORAGE_KEY = 'sora-brand';

export function getPaletaSalva(): string {
  if (typeof window === 'undefined') return PALETA_PADRAO;
  try { return localStorage.getItem(BRAND_STORAGE_KEY) || PALETA_PADRAO; } catch { return PALETA_PADRAO; }
}

// Aplica a paleta: troca só a variável --primary (glows/gradientes derivam dela).
export function aplicarPaleta(id: string) {
  if (typeof document === 'undefined') return;
  const p = PALETAS.find(x => x.id === id) || PALETAS[0];
  document.documentElement.style.setProperty('--primary', p.hsl);
  try { localStorage.setItem(BRAND_STORAGE_KEY, p.id); } catch {}
}
