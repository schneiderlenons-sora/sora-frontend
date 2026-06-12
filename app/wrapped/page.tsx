'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, Sparkles, Lock, Hourglass } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import WrappedPlayer from '@/components/wrapped/WrappedPlayer';
import { construirDeckFinance, construirDeckGrow } from '@/lib/wrapped/build';

export default function WrappedHome() {
  const { phone } = useAuth();
  const [modo, setModo] = useState<'mes' | 'ano'>('mes');
  const [aberto, setAberto] = useState<null | 'finance' | 'grow'>(null);

  const periodo = modo === 'ano' ? String(new Date().getFullYear()) : undefined;
  const { data: fin }  = useApi(phone ? `wrapped:fin:${phone}:${modo}` : null,  () => api.wrapped.financas(phone, periodo));
  const { data: grow } = useApi(phone ? `wrapped:grow:${phone}:${modo}` : null, () => api.wrapped.grow(phone, periodo));

  const deckFin  = useMemo(() => (fin?.disponivel ? construirDeckFinance(fin) : null), [fin]);
  const deckGrow = useMemo(() => (grow?.disponivel ? construirDeckGrow(grow) : null), [grow]);

  if (aberto === 'finance' && deckFin) return <WrappedPlayer deck={deckFin} onClose={() => setAberto(null)} />;
  if (aberto === 'grow' && deckGrow)   return <WrappedPlayer deck={deckGrow} onClose={() => setAberto(null)} />;

  return (
    <div className="fixed inset-0 overflow-auto text-white"
      style={{ background: 'radial-gradient(120% 90% at 50% 0%, #10231a 0%, #060a08 55%, #000 100%)' }}>
      <div className="min-h-full flex flex-col items-center justify-center p-6 gap-7">
        <Link href="/dashboard" className="absolute top-5 left-5 inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Voltar
        </Link>

        <div className="text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.22em] mb-5"
            style={{ background: 'rgba(97,209,123,0.14)', color: '#61D17B', border: '1px solid rgba(97,209,123,0.3)' }}>
            <Sparkles size={12} /> Sora Wrapped
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-[0.95]">
            Seu resumo,<br /><span style={{ color: '#61D17B' }}>pronto pro story.</span>
          </h1>
        </div>

        {/* toggle mês / ano */}
        <div className="inline-flex p-1 rounded-full bg-white/[0.06] border border-white/10">
          {(['mes', 'ano'] as const).map(m => (
            <button key={m} onClick={() => setModo(m)}
              className={`px-5 py-1.5 rounded-full text-sm font-bold transition-colors ${modo === m ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>
              {m === 'mes' ? 'Este mês' : 'Este ano'}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <WrappedCard
            titulo="Finance Wrapped" sub="Seus números" emoji="💸"
            grad="linear-gradient(150deg, #03110a 0%, #0a5e33 55%, #61D17B 115%)"
            stats={fin} onClick={() => setAberto('finance')} />
          <WrappedCard
            titulo="Grow Wrapped" sub="Sua evolução" emoji="🌱"
            grad="linear-gradient(150deg, #160726 0%, #6d28d9 55%, #d946ef 115%)"
            stats={grow} onClick={() => setAberto('grow')} />
        </div>

        <p className="text-white/40 text-xs max-w-sm text-center">
          O Wrapped libera depois de ~30 dias de uso, quando já há dados suficientes pra contar sua história. 🐳
        </p>
      </div>
    </div>
  );
}

function WrappedCard({ titulo, sub, grad, emoji, stats, onClick }:
  { titulo: string; sub: string; grad: string; emoji: string; stats: any; onClick: () => void }) {
  const carregando = stats === undefined;
  const disponivel = !!stats?.disponivel;
  const faltamDias = stats?.faltam?.dias ?? 0;
  const faltamDados = (stats?.faltam?.lancamentos ?? stats?.faltam?.atividade ?? 0);

  const msgBloqueio = faltamDias > 0
    ? `Faltam ${faltamDias} ${faltamDias === 1 ? 'dia' : 'dias'} de uso`
    : faltamDados > 0
      ? 'Continue registrando — quase lá!'
      : 'Em breve';

  return (
    <button onClick={disponivel ? onClick : undefined} disabled={!disponivel}
      className={`group relative aspect-[4/5] sm:aspect-[3/4] rounded-3xl overflow-hidden text-left transition-transform duration-300 ${disponivel ? 'hover:-translate-y-1.5 hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-default'}`}
      style={{ background: grad }}>
      <div aria-hidden className="absolute -top-16 -right-16 w-56 h-56 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 65%)' }} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

      {/* véu de bloqueio */}
      {!disponivel && !carregando && <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />}

      <div className="relative h-full flex flex-col justify-between p-6">
        <span className="text-5xl">{emoji}</span>
        <div>
          <h2 className="text-2xl font-black tracking-tight leading-tight">{titulo}</h2>
          <p className="text-white/75 text-sm mt-1">{sub}</p>

          {carregando ? (
            <span className="inline-block mt-4 h-4 w-24 rounded bg-white/20 animate-pulse" />
          ) : disponivel ? (
            <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-bold uppercase tracking-widest text-white group-hover:gap-2.5 transition-all">
              <Play size={13} className="fill-white" /> Ver Wrapped
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 mt-4 text-[12px] font-bold uppercase tracking-widest text-white/85">
              {faltamDias > 0 ? <Hourglass size={13} /> : <Lock size={13} />} {msgBloqueio}
            </span>
          )}
        </div>
      </div>
      <div className="absolute inset-0 rounded-3xl ring-1 ring-white/15 group-hover:ring-white/30 transition-colors" />
    </button>
  );
}
