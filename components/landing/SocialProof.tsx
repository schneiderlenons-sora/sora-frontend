'use client';

import { Star, Quote } from 'lucide-react';

const TESTEMUNHOS = [
  {
    nome: 'Jeferson S.',
    role: 'Designer',
    foto: 'J',
    cor: '#61ce70',
    quote: 'Finalmente consigo organizar minha vida em um lugar só. A IA da Sora é insana — entende áudio, foto, qualquer coisa.',
    stars: 5,
  },
  {
    nome: 'Marina R.',
    role: 'Empreendedora digital',
    foto: 'M',
    cor: '#7c3aed',
    quote: 'Em 2 semanas economizei R$ 800 só de notar onde tava perdendo. Mudou minha relação com dinheiro.',
    stars: 5,
  },
  {
    nome: 'Carlos M.',
    role: 'Estudante de medicina',
    foto: 'C',
    cor: '#3b82f6',
    quote: 'Uso pelo WhatsApp todo dia. Não preciso abrir mais nenhum app de planilha. Salvou minha rotina.',
    stars: 5,
  },
];

const METRICAS = [
  { valor: '12k+',    label: 'Usuários ativos' },
  { valor: 'R$ 18M',  label: 'Movimentados/mês' },
  { valor: '99.9%',   label: 'Uptime' },
  { valor: '4.8/5',   label: 'Avaliação' },
];

export default function SocialProof() {
  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-12 lg:mb-16">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            Quem usa
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Quem testa,<br />
            <span className="text-zinc-400 dark:text-white/30">não larga.</span>
          </h2>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {METRICAS.map(m => (
            <div key={m.label} className="text-center p-6 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/[0.06]">
              <p className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight">
                {m.valor.includes('+') || m.valor.includes('/') || m.valor.includes('%') ? (
                  <span>
                    {m.valor.replace(/[+/%]|\/\d.*/, '')}
                    <span className="text-zinc-400 dark:text-white/30">
                      {m.valor.match(/[+/%].*/)?.[0]}
                    </span>
                  </span>
                ) : m.valor}
              </p>
              <p className="text-xs text-zinc-500 dark:text-white/50 mt-1">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Testemunhos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TESTEMUNHOS.map((t, i) => (
            <div
              key={t.nome}
              className="relative p-6 rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Quote size={18} className="text-zinc-300 dark:text-white/15 mb-3" />

              {/* Stars */}
              <div className="flex items-center gap-0.5 mb-3">
                {Array.from({ length: t.stars }).map((_, n) => (
                  <Star key={n} size={13} fill="#fbbf24" stroke="#fbbf24" />
                ))}
              </div>

              <p className="text-sm text-zinc-700 dark:text-white/80 leading-relaxed italic mb-5">
                "{t.quote}"
              </p>

              <div className="flex items-center gap-3 pt-4 border-t border-zinc-100 dark:border-white/[0.05]">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                     style={{ background: `linear-gradient(135deg, ${t.cor}, ${escurecer(t.cor)})` }}>
                  {t.foto}
                </div>
                <div>
                  <p className="font-bold text-sm">{t.nome}</p>
                  <p className="text-xs text-zinc-500 dark:text-white/40">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function escurecer(hex: string, amt = 0.2): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - Math.round(255 * amt));
  const g = Math.max(0, ((n >> 8)  & 0xff) - Math.round(255 * amt));
  const b = Math.max(0,  (n        & 0xff) - Math.round(255 * amt));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
