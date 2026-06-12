'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Sparkles } from 'lucide-react';
import WrappedPlayer from '@/components/wrapped/WrappedPlayer';
import { deckFinanceDemo, deckGrowDemo } from '@/lib/wrapped/mock';

// Preview do Sora Wrapped (dados de exemplo) — pra validar o design.
export default function WrappedPreview() {
  const [aberto, setAberto] = useState<null | 'finance' | 'grow'>(null);

  if (aberto) {
    return (
      <WrappedPlayer
        deck={aberto === 'finance' ? deckFinanceDemo : deckGrowDemo}
        onClose={() => setAberto(null)}
      />
    );
  }

  return (
    <div className="fixed inset-0 overflow-auto text-white"
      style={{ background: 'radial-gradient(120% 90% at 50% 0%, #10231a 0%, #060a08 55%, #000 100%)' }}>
      <div className="min-h-full flex flex-col items-center justify-center p-6 gap-8">
        <Link href="/dashboard" className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Voltar
        </Link>

        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.22em] mb-5"
            style={{ background: 'rgba(97,209,123,0.14)', color: '#61D17B', border: '1px solid rgba(97,209,123,0.3)' }}>
            <Sparkles size={12} /> Sora Wrapped · preview
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-[0.95]">
            Seu mês,<br /><span style={{ color: '#61D17B' }}>pronto pro story.</span>
          </h1>
          <p className="text-white/55 text-sm mt-4 max-w-sm mx-auto">Toque num card pra ver a experiência completa (dados de exemplo).</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <PreviewCard tipo="finance" titulo="Finance Wrapped" sub="Seus números do mês"
            grad="linear-gradient(150deg, #03110a 0%, #0a5e33 55%, #61D17B 115%)" emoji="💸" onClick={() => setAberto('finance')} />
          <PreviewCard tipo="grow" titulo="Grow Wrapped" sub="Sua evolução do mês"
            grad="linear-gradient(150deg, #160726 0%, #6d28d9 55%, #d946ef 115%)" emoji="🌱" onClick={() => setAberto('grow')} />
        </div>
      </div>
    </div>
  );
}

function PreviewCard({ titulo, sub, grad, emoji, onClick }:
  { tipo: string; titulo: string; sub: string; grad: string; emoji: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="group relative aspect-[4/5] sm:aspect-[3/4] rounded-3xl overflow-hidden text-left transition-transform duration-300 hover:-translate-y-1.5 hover:scale-[1.02] active:scale-95"
      style={{ background: grad }}>
      <div aria-hidden className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 65%)' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      <div className="relative h-full flex flex-col justify-between p-6">
        <span className="text-5xl">{emoji}</span>
        <div>
          <h2 className="text-2xl font-black tracking-tight leading-tight">{titulo}</h2>
          <p className="text-white/75 text-sm mt-1">{sub}</p>
          <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-bold uppercase tracking-widest text-white group-hover:gap-2.5 transition-all">
            <Play size={13} className="fill-white" /> Ver Wrapped
          </span>
        </div>
      </div>
      <div className="absolute inset-0 rounded-3xl ring-1 ring-white/15 group-hover:ring-white/30 transition-colors" />
    </button>
  );
}
