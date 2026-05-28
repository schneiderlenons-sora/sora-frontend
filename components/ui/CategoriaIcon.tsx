'use client';

import IconeMarca, { marcaDe } from './IconeMarca';

// ─────────────────────────────────────────────────────────────
// CategoriaIcon — decide como renderizar o ícone de uma categoria/conta:
//
//  1. Marca conhecida com PNG local em /public/brands/ → a imagem É o
//     ícone (preenche 100% do círculo, sem nenhum wrapper). Esta é a
//     forma mais bonita: o usuário envia uma logo já circular full-bleed
//     do Canva e ela aparece exatamente como desenhada.
//  2. Marca conhecida sem PNG local → fundo branco neutro + logo
//     colorido oficial via Simple Icons / Brandfetch.
//  3. Sem marca → emoji em fundo tonalizado da categoria.
// ─────────────────────────────────────────────────────────────

interface Props {
  nome:    string;
  icone?:  string | null;      // emoji fallback (ex: "🛒")
  size?:   number;             // tamanho em px (default 40)
  bg?:     string;             // fundo da categoria (só quando NÃO é marca)
  color?:  string;
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

  // 1. PNG circular local — ÚNICA forma de ter um ícone bonito full-bleed.
  //    Renderiza a imagem direto, SEM wrapper colorido. A própria PNG
  //    transparente carrega o formato circular.
  if (marca?.local) {
    return (
      <div
        className={`${rounded} overflow-hidden flex-shrink-0 ${className}`}
        style={dim}
      >
        <IconeMarca
          nome={nome}
          size={size}
          fallback={
            <div
              className="flex items-center justify-center w-full h-full"
              style={{ background: bg, color, fontSize: Math.round(size * 0.5) }}
            >
              {icone || nome.charAt(0).toUpperCase()}
            </div>
          }
        />
      </div>
    );
  }

  // 2. Marca via Simple Icons / Brandfetch → fundo branco + logo natural
  if (marca) {
    const logoSize = Math.round(size * 0.7);
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

  // 3. Sem marca: emoji em fundo tonalizado
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
