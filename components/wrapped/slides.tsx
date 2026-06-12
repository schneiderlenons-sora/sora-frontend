'use client';

import type { Slide, WrappedDeck } from '@/lib/wrapped/themes';
import { Grain, Blobs, Reveal, Pop, CountUp } from './fx';
import { Flame, TrendingDown, TrendingUp, ArrowUpRight } from 'lucide-react';

const SERIF = 'Georgia, "Times New Roman", serif';

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n || 0);
const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(Math.round(n || 0));

// ─── Frame + roteador de arquétipos ──────────────────────────────────────
export function SlideView({ slide, deck }: { slide: Slide; deck: WrappedDeck }) {
  const th = slide.theme;
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: th.gradient, color: th.fg }}>
      <Blobs theme={th} />
      {/* vinheta pra contraste do texto */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: th.dark
          ? 'radial-gradient(120% 80% at 30% 20%, transparent 40%, rgba(0,0,0,0.45) 100%)'
          : 'radial-gradient(120% 80% at 30% 20%, transparent 45%, rgba(0,0,0,0.12) 100%)' }} />
      <Grain opacity={th.dark ? 0.16 : 0.10} />

      <div className="relative h-full flex flex-col p-7 sm:p-8">
        {/* topo: marca · período */}
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: th.dim }}>
          <span>{deck.marca}</span>
          <span>{deck.periodoLabel}</span>
        </div>

        <div className="flex-1 flex flex-col justify-center min-h-0">
          {slide.tipo === 'cover'   && <Cover s={slide} />}
          {slide.tipo === 'numero'  && <Numero s={slide} />}
          {slide.tipo === 'frase'   && <Frase s={slide} />}
          {slide.tipo === 'ranking' && <Ranking s={slide} />}
          {slide.tipo === 'persona' && <Persona s={slide} />}
          {slide.tipo === 'streak'  && <Streak s={slide} />}
          {slide.tipo === 'final'   && <Final s={slide} deck={deck} />}
        </div>

        {slide.tipo !== 'final' && (
          <p className="text-center text-[10px] tracking-wide" style={{ color: th.dim }}>toque pra avançar</p>
        )}
      </div>
    </div>
  );
}

// ─── COVER ────────────────────────────────────────────────────────────────
function Cover({ s }: { s: Extract<Slide, { tipo: 'cover' }> }) {
  const { theme: th } = s;
  return (
    <div>
      <Pop delay={120}>
        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ background: 'rgba(255,255,255,0.14)', color: th.fg, border: '1px solid rgba(255,255,255,0.22)' }}>
          {s.emoji} {s.selo}
        </span>
      </Pop>
      <div className="mt-6">
        <Reveal delay={200}>
          <span className="text-base font-medium" style={{ color: th.dim }}>{s.kicker}</span>
        </Reveal>
        <Reveal delay={300} className="mt-1">
          <h1 className="font-black tracking-[-0.04em] leading-[0.9] text-[64px] sm:text-[76px]">{s.titulo}</h1>
        </Reveal>
        <Reveal delay={480} className="mt-1">
          <span className="text-[40px] sm:text-[46px] leading-[1] italic" style={{ fontFamily: SERIF, color: th.accent }}>
            {s.sub}
          </span>
        </Reveal>
      </div>
    </div>
  );
}

// ─── NÚMERO GIGANTE ─────────────────────────────────────────────────────
function Numero({ s }: { s: Extract<Slide, { tipo: 'numero' }> }) {
  const { theme: th } = s;
  const isMoney = s.prefixo === 'R$ ';
  const fmt = (n: number) => isMoney ? fmtMoney(n) : `${fmtNum(n)}${s.sufixo || ''}`;
  return (
    <div>
      <Reveal delay={120}>
        <span className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: th.dim }}>
          {s.emoji} {s.label}
        </span>
      </Reveal>
      <Reveal delay={260} className="mt-3">
        <span className="block font-black tabular-nums tracking-[-0.05em] leading-[0.82] text-[80px] sm:text-[104px]"
          style={{ color: th.fg, textShadow: th.dark ? '0 8px 40px rgba(0,0,0,0.35)' : 'none' }}>
          <CountUp valor={s.valor} format={fmt} />
        </span>
      </Reveal>
      {s.sub && (
        <Reveal delay={520} className="mt-5">
          <p className="text-[17px] leading-snug max-w-[300px]" style={{ color: th.dim }}>{s.sub}</p>
        </Reveal>
      )}
      {s.delta != null && (
        <Pop delay={760} className="mt-5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-bold"
            style={{ background: 'rgba(255,255,255,0.16)', color: th.fg }}>
            {s.delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {Math.abs(s.delta).toFixed(0)}% vs período anterior
          </span>
        </Pop>
      )}
    </div>
  );
}

// ─── FRASE CINÉTICA ──────────────────────────────────────────────────────
function Frase({ s }: { s: Extract<Slide, { tipo: 'frase' }> }) {
  const { theme: th } = s;
  return (
    <div className="space-y-1">
      {s.antes && (
        <Reveal delay={140}>
          <span className="text-[26px] sm:text-[30px] font-medium leading-tight" style={{ color: th.dim }}>{s.antes}</span>
        </Reveal>
      )}
      <Reveal delay={300}>
        <span className="block font-black tracking-[-0.03em] leading-[0.92] text-[52px] sm:text-[64px]" style={{ color: th.accent }}>
          {s.emoji} {s.destaque}
        </span>
      </Reveal>
      {s.depois && (
        <Reveal delay={460}>
          <span className="text-[26px] sm:text-[30px] font-medium leading-tight" style={{ color: th.dim }}>{s.depois}</span>
        </Reveal>
      )}
      {s.sub && (
        <Reveal delay={640} className="!mt-5">
          <p className="text-[16px] leading-snug max-w-[300px]" style={{ color: th.dim }}>{s.sub}</p>
        </Reveal>
      )}
    </div>
  );
}

// ─── RANKING (top 3, estilo "top artists") ───────────────────────────────
function Ranking({ s }: { s: Extract<Slide, { tipo: 'ranking' }> }) {
  const { theme: th } = s;
  return (
    <div>
      <Reveal delay={120}>
        <span className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: th.dim }}>{s.label}</span>
      </Reveal>
      <div className="mt-5 space-y-3">
        {s.itens.slice(0, 4).map((it, i) => (
          <Reveal key={i} delay={280 + i * 130}>
            <div className="flex items-center gap-3">
              <span className="font-black tabular-nums text-[30px] sm:text-[34px] leading-none w-9 flex-shrink-0"
                style={{ color: i === 0 ? th.accent : th.dim }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold truncate text-[19px] sm:text-[21px]" style={{ color: th.fg }}>
                    {it.emoji} {it.nome}
                  </span>
                  <span className="font-bold tabular-nums text-[14px] flex-shrink-0" style={{ color: th.dim }}>{it.valorTexto}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.16)' }}>
                  <div className="h-full rounded-full motion-safe:animate-[wr-shine_1.4s_ease-out]"
                    style={{ width: `${Math.max(8, it.pct)}%`, background: it.cor || th.accent, transition: 'width 700ms cubic-bezier(0.22,1,0.36,1)' }} />
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

// ─── PERSONA (perfil divertido) ──────────────────────────────────────────
function Persona({ s }: { s: Extract<Slide, { tipo: 'persona' }> }) {
  const { theme: th } = s;
  return (
    <div className="text-center">
      <Pop delay={150}>
        <span className="text-[88px] leading-none block motion-safe:animate-[wr-float_4s_ease-in-out_infinite]">{s.emoji}</span>
      </Pop>
      <Reveal delay={320} className="mt-5">
        <span className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: th.dim }}>{s.label}</span>
      </Reveal>
      <Reveal delay={420} className="mt-1">
        <h2 className="font-black tracking-[-0.03em] leading-[0.95] text-[46px] sm:text-[54px]" style={{ color: th.fg }}>{s.nome}</h2>
      </Reveal>
      <Reveal delay={580} className="mt-4">
        <p className="text-[16px] leading-snug max-w-[280px] mx-auto" style={{ color: th.dim }}>{s.sub}</p>
      </Reveal>
    </div>
  );
}

// ─── STREAK ───────────────────────────────────────────────────────────────
function Streak({ s }: { s: Extract<Slide, { tipo: 'streak' }> }) {
  const { theme: th } = s;
  return (
    <div>
      <Reveal delay={120}>
        <span className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: th.dim }}>{s.label}</span>
      </Reveal>
      <div className="mt-3 flex items-end gap-3">
        <Pop delay={500}>
          <Flame size={64} style={{ color: th.accent }} className="motion-safe:animate-[wr-float_3s_ease-in-out_infinite]" />
        </Pop>
        <Reveal delay={260}>
          <span className="font-black tabular-nums tracking-[-0.05em] leading-[0.8] text-[110px] sm:text-[128px]" style={{ color: th.fg }}>
            <CountUp valor={s.valor} format={(n) => fmtNum(n)} />
          </span>
        </Reveal>
        <Reveal delay={420}>
          <span className="font-black text-[28px] pb-4" style={{ color: th.accent }}>{s.sufixo}</span>
        </Reveal>
      </div>
      <Reveal delay={640} className="mt-4">
        <p className="text-[17px] leading-snug max-w-[300px]" style={{ color: th.dim }}>{s.sub}</p>
      </Reveal>
    </div>
  );
}

// ─── FINAL — card compartilhável (o "money shot" do story) ───────────────
function Final({ s, deck }: { s: Extract<Slide, { tipo: 'final' }>; deck: WrappedDeck }) {
  const { theme: th } = s;
  return (
    <div className="flex flex-col h-full justify-center">
      <Pop delay={120}>
        <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em]" style={{ color: th.accent }}>
          ✦ {deck.marca} · {deck.periodoLabel}
        </span>
      </Pop>
      <Reveal delay={240} className="mt-4">
        <h2 className="font-black tracking-[-0.03em] leading-[0.95] text-[40px] sm:text-[48px] whitespace-pre-line" style={{ color: th.fg }}>
          {s.titulo}
        </h2>
      </Reveal>

      <div className="mt-7 grid grid-cols-2 gap-x-4 gap-y-5">
        {s.resumo.map((r, i) => (
          <Reveal key={i} delay={420 + i * 110}>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: th.dim }}>{r.label}</p>
              <p className="font-black tabular-nums text-[26px] sm:text-[30px] leading-tight mt-0.5" style={{ color: th.fg }}>{r.valor}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={900} className="mt-8">
        <p className="text-[15px] leading-snug" style={{ color: th.dim }}>{s.sub}</p>
      </Reveal>

      <div className="mt-6 flex items-center justify-between">
        <span className="font-black text-[18px] tracking-tight" style={{ color: th.fg }}>{s.handle}</span>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: th.accent }}>
          forsora.com <ArrowUpRight size={13} />
        </span>
      </div>
    </div>
  );
}
