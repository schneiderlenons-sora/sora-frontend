'use client';

interface Props {
  name?:     string | null;
  src?:      string | null;            // URL ou dataURL
  size?:     'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showTooltip?: boolean;
}

function hueDoNome(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function iniciais(name: string): string {
  const partes = name.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].charAt(0).toUpperCase();
  return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}

const SIZES = {
  sm: { box: 'w-6 h-6',   text: 'text-[10px]' },
  md: { box: 'w-8 h-8',   text: 'text-xs'     },
  lg: { box: 'w-12 h-12', text: 'text-base'   },
  xl: { box: 'w-24 h-24', text: 'text-2xl'    },
};

export default function AvatarMembro({ name, src, size = 'md', className = '', showTooltip = true }: Props) {
  const nome = name || 'Desconhecido';
  const hue = hueDoNome(nome);
  const ini = iniciais(nome);
  const sz = SIZES[size];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={nome}
        title={showTooltip ? nome : undefined}
        className={`inline-block rounded-full object-cover ring-2 ring-card flex-shrink-0 ${sz.box} ${className}`}
      />
    );
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full text-white font-bold shadow-sm flex-shrink-0 ring-2 ring-card ${sz.box} ${sz.text} ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 65% 50%), hsl(${(hue + 30) % 360} 70% 40%))`,
      }}
      title={showTooltip ? nome : undefined}
      aria-label={nome}
    >
      {ini}
    </div>
  );
}
