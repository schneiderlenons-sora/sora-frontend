'use client';

import { corEmpresa, iniciaisEmpresa, type Empresa } from '@/lib/empresas';

// Avatar da empresa: logo (data URL) ou iniciais sobre a cor de destaque.
// A cor do texto é calculada pela LUMINÂNCIA da cor escolhida — em cores claras
// (ex.: o verde da Sora) as iniciais ficam escuras, garantindo contraste
// legível em qualquer opção da paleta (regra de acessibilidade §1).

const TAMANHOS = {
  sm: { box: 28, texto: 'text-[10px]' },
  md: { box: 36, texto: 'text-xs' },
  lg: { box: 48, texto: 'text-sm' },
  xl: { box: 64, texto: 'text-lg' },
} as const;

/** Luminância relativa (WCAG) → decide entre texto escuro e claro. */
function textoLegivelSobre(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '#fff';
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = canal(parseInt(h.slice(0, 2), 16));
  const g = canal(parseInt(h.slice(2, 4), 16));
  const b = canal(parseInt(h.slice(4, 6), 16));
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.5 ? '#0b1220' : '#ffffff';
}

export default function EmpresaAvatar({
  empresa,
  tamanho = 'md',
  className = '',
}: {
  empresa?: Empresa | null;
  tamanho?: keyof typeof TAMANHOS;
  className?: string;
}) {
  const { box, texto } = TAMANHOS[tamanho];
  const cor = corEmpresa(empresa);

  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: box, height: box, background: empresa?.logo_url ? 'transparent' : cor }}
      aria-hidden
    >
      {empresa?.logo_url ? (
        <img
          src={empresa.logo_url}
          alt=""
          width={box}
          height={box}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className={`font-bold tracking-tight ${texto}`} style={{ color: textoLegivelSobre(cor) }}>
          {iniciaisEmpresa(empresa?.nome)}
        </span>
      )}
    </span>
  );
}
