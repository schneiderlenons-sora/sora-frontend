'use client';

import IconeMarca, { slugDaMarca } from './IconeMarca';

// ─────────────────────────────────────────────────────────────
// CategoriaIcon — wrapper que decide entre logo de marca (full-bleed
// num círculo branco) ou emoji em fundo tonalizado.
//
// Por que assim?
//   - Logos de marcas (Spotify, Netflix, Nubank) são SVGs/PNGs quadrados
//     com cores próprias. Colocar um fundo colorido extra dentro de um
//     círculo gera o efeito "quadrado dentro de círculo" — feio.
//   - Solução: quando reconhecemos a marca, descartamos o fundo
//     tonalizado e usamos um fundo branco neutro (estilo App Store)
//     com o logo ocupando todo o espaço.
//   - Quando NÃO é marca conhecida, mantém emoji + fundo colorido da
//     categoria (visual atual).
// ─────────────────────────────────────────────────────────────

interface Props {
  nome:    string;             // ex: "Spotify", "Mercado", "Nubank"
  icone?:  string | null;      // emoji fallback (ex: "🛒")
  size?:   number;             // tamanho do círculo em px (default 40)
  bg?:     string;             // fundo da categoria (HSL/hex/rgba) — usado só quando NÃO é marca
  color?:  string;             // cor do emoji quando NÃO é marca
  rounded?: string;            // classe tailwind (default rounded-xl)
  className?: string;
}

export default function CategoriaIcon({
  nome,
  icone,
  size = 40,
  bg,
  color,
  rounded = 'rounded-xl',
  className = '',
}: Props) {
  const ehMarca = !!slugDaMarca(nome);
  const dim = { width: size, height: size };

  if (ehMarca) {
    // Logo da marca centralizada num círculo branco neutro (estilo App Store).
    // Reservamos ~12% de padding pra logo respirar e não tocar a borda.
    const logoSize = Math.round(size * 0.78);
    return (
      <div
        className={`${rounded} overflow-hidden flex-shrink-0 flex items-center justify-center ring-1 ring-border/40 ${className}`}
        style={{ ...dim, background: '#fff' }}
      >
        <IconeMarca
          nome={nome}
          size={logoSize}
          fallback={
            <div
              className="flex items-center justify-center"
              style={{ width: size, height: size, background: bg, color, fontSize: Math.round(size * 0.5) }}
            >
              {icone || '📦'}
            </div>
          }
        />
      </div>
    );
  }

  // Emoji em fundo tonalizado da categoria
  const fontSize = Math.round(size * 0.5);
  return (
    <div
      className={`${rounded} flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ ...dim, background: bg, color, fontSize }}
    >
      {icone || '📦'}
    </div>
  );
}
