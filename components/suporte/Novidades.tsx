'use client';

import { Sparkles } from 'lucide-react';
import { fmtDataBR } from '@/lib/data-br';
import { CHANGELOG } from '@/lib/changelog';

const BRAND = 'hsl(var(--primary))';

export default function Novidades() {
  const lista = [...CHANGELOG].reverse(); // mais recente primeiro

  return (
    <div className="space-y-3">
      {lista.map((n, i) => (
        <div
          key={n.versao}
          className="rounded-2xl border border-border bg-card p-4 sm:p-5 flex gap-3 animate-[slide-up_400ms_ease-out_both]"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)` }}
          >
            <Sparkles size={17} style={{ color: BRAND }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums"
                style={{ background: `color-mix(in srgb, ${BRAND} 15%, transparent)`, color: BRAND }}
              >
                v{n.versao}
              </span>
              <span className="text-[11px] text-muted-foreground">{fmtDataBR(n.data)}</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mt-1.5">{n.titulo}</h3>
            <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">{n.descricao}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
