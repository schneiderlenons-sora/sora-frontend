'use client';

import { useState } from 'react';
import { presetById } from '@/lib/avatares';

interface Props {
  name?:     string | null;
  src?:      string | null;            // foto (URL ou dataURL) — prioridade
  preset?:   string | null;            // id do ícone de baleia
  cor?:      string | null;            // cor de fundo (preset/inicial)
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
  sm: { box: 'w-6 h-6',   text: 'text-[10px]', emoji: 'text-sm'  },
  md: { box: 'w-8 h-8',   text: 'text-xs',     emoji: 'text-lg'  },
  lg: { box: 'w-12 h-12', text: 'text-base',   emoji: 'text-2xl' },
  xl: { box: 'w-24 h-24', text: 'text-2xl',    emoji: 'text-5xl' },
};

// Ícone do preset: tenta a arte (public/avatars), cai pro emoji se faltar.
function PresetIcone({ img, emoji, alt, emojiClass }: { img: string; emoji: string; alt: string; emojiClass: string }) {
  const [erro, setErro] = useState(false);
  if (erro) return <span className={emojiClass} aria-hidden>{emoji}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={img} alt={alt} onError={() => setErro(true)} className="w-[78%] h-[78%] object-contain" draggable={false} />;
}

export default function AvatarMembro({ name, src, preset, cor, size = 'md', className = '', showTooltip = true }: Props) {
  const nome = name || 'Desconhecido';
  const hue = hueDoNome(nome);
  const ini = iniciais(nome);
  const sz = SIZES[size];

  // 1) Foto enviada — prioridade.
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

  const bg = cor || `linear-gradient(135deg, hsl(${hue} 65% 50%), hsl(${(hue + 30) % 360} 70% 40%))`;
  const p = presetById(preset);

  // 2) Ícone de baleia (preset) sobre a cor escolhida.
  if (p) {
    return (
      <div
        className={`relative inline-flex items-center justify-center rounded-full overflow-hidden shadow-sm flex-shrink-0 ring-2 ring-card ${sz.box} ${className}`}
        style={{ background: bg }}
        title={showTooltip ? nome : undefined}
        aria-label={nome}
      >
        <PresetIcone img={p.img} emoji={p.emoji} alt={p.label} emojiClass={sz.emoji} />
      </div>
    );
  }

  // 3) Inicial sobre a cor.
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-full text-white font-bold shadow-sm flex-shrink-0 ring-2 ring-card ${sz.box} ${sz.text} ${className}`}
      style={{ background: bg }}
      title={showTooltip ? nome : undefined}
      aria-label={nome}
    >
      {ini}
    </div>
  );
}
