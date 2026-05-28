'use client';

import IconeMarca, { marcaDe } from './IconeMarca';

// ─────────────────────────────────────────────────────────────
// CategoriaIcon — decide como renderizar o ícone de uma categoria/conta:
//
//  1. Marca conhecida COM bg oficial (ex: Spotify verde, Nubank roxo,
//     Netflix vermelho) → círculo preenchido na cor da marca + logo
//     branco no centro. Esta é a representação que iOS / App Store usa.
//  2. Marca conhecida SEM bg (só temos brandfetch domain) → círculo
//     branco neutro + logo colorido oficial.
//  3. Sem marca → emoji em fundo tonalizado da categoria (cor do
//     usuário).
// ─────────────────────────────────────────────────────────────

interface Props {
  nome:    string;             // ex: "Spotify", "Mercado", "Nubank"
  icone?:  string | null;      // emoji fallback (ex: "🛒")
  size?:   number;             // tamanho do círculo em px (default 40)
  bg?:     string;             // fundo da categoria — usado SÓ quando não é marca
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
  const marca = marcaDe(nome);
  const dim = { width: size, height: size };

  // Marca conhecida COM cor de fundo oficial → fundo colorido + logo branco
  if (marca?.bg) {
    const logoSize = Math.round(size * 0.6);
    return (
      <div
        className={`${rounded} overflow-hidden flex-shrink-0 flex items-center justify-center ${className}`}
        style={{ ...dim, background: marca.bg }}
      >
        <IconeMarca
          nome={nome}
          size={logoSize}
          fallback={
            <span
              className="font-bold"
              style={{ color: '#fff', fontSize: Math.round(size * 0.45) }}
            >
              {(icone && /\p{Emoji}/u.test(icone) ? icone : nome.charAt(0).toUpperCase())}
            </span>
          }
        />
      </div>
    );
  }

  // Marca conhecida SEM bg → fundo branco neutro + logo colorido
  if (marca) {
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
            <span style={{ color: '#000', fontSize: Math.round(size * 0.45) }}>
              {icone || nome.charAt(0).toUpperCase()}
            </span>
          }
        />
      </div>
    );
  }

  // Sem marca: emoji em fundo tonalizado da categoria
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
