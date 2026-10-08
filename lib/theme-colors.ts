// =====================================================================
// Cor temática do app — uma variável CSS (--primary) governa Finance + Grow.
// O usuário escolhe uma paleta em Configurações; a escolha persiste e
// recolore todas as abas instantaneamente (zero custo de performance).
// =====================================================================

/** `vibrante` = as 6 originais. `sobrio` = tons dessaturados (pedido de cliente,
 *  out/2026: "as cores de tema são bem chamativas"). */
export type Tom = 'vibrante' | 'sobrio';

export type Paleta = { id: string; nome: string; hsl: string; hex: string; tom: Tom };

// `hsl` alimenta a variável CSS --primary (formato "H S% L%").
// `hex` é só pra amostra (swatch) do seletor.
//
// ⚠️ A COR TEM DE SOBREVIVER AOS DOIS TEMAS. `--primary` é a MESMA em `:root` e
// `.dark`, e os fundos são opostos: #F5F6F8 no claro, #0A0A0B no black. Cor
// escura demais some no black; clara demais some no claro. O
// `eval:paletas` mede as duas pontas de TODA paleta deste array — WCAG pede
// 3:1 pra componente (botão, ícone, borda) contra o fundo.
//
// É por isso que as sóbrias ficam entre ~34% e ~47% de luminosidade: é a
// faixa que atravessa os dois fundos. Escurecer mais "pra ficar sóbrio" é
// exatamente o que quebra o tema escuro — três cores foram cortadas por isso
// (ver abaixo).
export const PALETAS: Paleta[] = [
  // ── Vibrantes (as originais) ───────────────────────────────────────────
  { id: 'verde',    nome: 'Verde Sora', hsl: '134 55% 60%', hex: '#5BC571', tom: 'vibrante' },
  { id: 'azul',     nome: 'Azul',       hsl: '217 91% 60%', hex: '#3B82F6', tom: 'vibrante' },
  { id: 'roxo',     nome: 'Roxo',       hsl: '262 83% 58%', hex: '#7C3AED', tom: 'vibrante' },
  { id: 'laranja',  nome: 'Laranja',    hsl: '25 95% 53%',  hex: '#F97316', tom: 'vibrante' },
  { id: 'rosa',     nome: 'Rosa',       hsl: '330 81% 60%', hex: '#EC4899', tom: 'vibrante' },
  { id: 'vermelho', nome: 'Vermelho',   hsl: '0 72% 55%',   hex: '#DC2626', tom: 'vibrante' },

  // ── Sóbrias ────────────────────────────────────────────────────────────
  //
  // ⚠️ OS HEX SÃO OS MESMOS DA `PALETA_SOBRIAS` DAS CATEGORIAS
  // (`components/categorias/NovaCategoriaModal.tsx`, set/2026) — a MESMA
  // queixa já foi atendida lá ("as cores são muito gritantes"), e aquela
  // paleta já tem nomes. Inventar um "Petróleo" diferente aqui daria duas
  // cores com o mesmo nome no mesmo produto.
  //
  // ⚠️ MAS SÓ 5 DAS 10 SERVEM DE TEMA, e isso foi medido: o chip de categoria
  // é pequeno e vive sobre o card, enquanto `--primary` precisa aparecer nos
  // DOIS fundos e aguentar texto BRANCO em cima. **Grafite (2,65), Vinho
  // (2,82) e Café (2,75) somem no tema black**; Terracota e Areia não
  // sustentam o texto branco. Por isso esses nomes NÃO viraram tema — em vez
  // de entrarem com outro hex e brigarem com a categoria homônima.
  //
  // DUAS entram 3 pontos de luminosidade fora da cor da categoria, porque sem
  // isso as seis seriam todas FRIAS — e 3 pontos o olho não distingue numa
  // bolinha de 36px: **Terracota** 50% → 47% (é o que o texto branco exige:
  // 4,11 → 4,57) e **Vinho** 39% → 42% (sem isso ela some no tema black:
  // 2,82 → 3,12).
  //
  // ⚠️ A **Ardósia** foi testada e CORTADA: contra a Chumbo ela dá **1,11:1**
  // (1,0 seria a mesma cor) — no seletor eram duas bolinhas iguais ocupando
  // duas das seis vagas. Com ela fora, o par mais parecido passou a ser
  // Musgo × Oliva, a 19 de 255 por canal. Conferido numa bancada a 390px.
  { id: 'chumbo',    nome: 'Chumbo',    hsl: '217 19% 44%', hex: '#5B6B85', tom: 'sobrio' },
  { id: 'petroleo',  nome: 'Petróleo',  hsl: '189 29% 34%', hex: '#3D6870', tom: 'sobrio' },
  { id: 'musgo',     nome: 'Musgo',     hsl: '96 15% 38%',  hex: '#5E7052', tom: 'sobrio' },
  { id: 'oliva',     nome: 'Oliva',     hsl: '59 28% 35%',  hex: '#71703F', tom: 'sobrio' },
  { id: 'terracota', nome: 'Terracota', hsl: '18 32% 47%',  hex: '#9E6951', tom: 'sobrio' },
  { id: 'vinho',     nome: 'Vinho',     hsl: '348 26% 42%', hex: '#874F5A', tom: 'sobrio' },
];

/** Os dois grupos, na ordem em que o seletor os mostra. */
export const GRUPOS_PALETA: { tom: Tom; titulo: string; descricao: string }[] = [
  { tom: 'vibrante', titulo: 'Vibrantes', descricao: 'Cores vivas, com mais presença' },
  { tom: 'sobrio',   titulo: 'Sóbrias',   descricao: 'Tons discretos, para quem prefere menos contraste' },
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
