'use client';

import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

const SHOTS = [
  { id: 'finance-dashboard',     titulo: 'Dashboard',     painel: 'finance',  desc: 'Saldo, fluxo e KPIs do mês em uma só tela.',                                             img: '/screenshots/finance-dashboard.jpeg' },
  { id: 'finance-transacoes',    titulo: 'Transações',    painel: 'finance',  desc: 'Histórico completo com filtros, busca e categorias personalizadas.',                     img: '/screenshots/finance-transacoes.png' },
  { id: 'finance-investimentos', titulo: 'Investimentos', painel: 'finance',  desc: 'Patrimônio, carteira por classe de ativo, dividendos e rentabilidade ao vivo.',         img: '/screenshots/finance-investimentos.png' },
  { id: 'finance-metas',         titulo: 'Metas',         painel: 'finance',  desc: 'Cálculo automático de aporte pra bater o objetivo.',                                    img: '/screenshots/finance-metas.jpeg' },
  { id: 'finance-cartao',        titulo: 'Negócios',      painel: 'negocios', desc: 'Painel financeiro do seu negócio — lucro líquido, receita e vendas em tempo real.',     img: '/screenshots/finance-cartao.png' },
  { id: 'finance-limites',       titulo: 'DRE & Integrações', painel: 'negocios', desc: 'Hotmart, Stripe, Kiwify e mais — DRE completo reconciliado automaticamente.',       img: '/screenshots/finance-limites.png' },
  { id: 'grow-dashboard',        titulo: 'Sora Grow',     painel: 'grow',     desc: 'Visão diária de hábitos, tarefas e saúde.',                                             img: '/screenshots/grow-dashboard.png' },
  { id: 'grow-saude',            titulo: 'Saúde',         painel: 'grow',     desc: 'Plano automático de ganho ou perda de peso com base no seu perfil, objetivo e histórico.', img: '/screenshots/grow-saude.png' },
];

export default function Carrossel() {
  const [idx, setIdx] = useState(0);
  const ativo = SHOTS[idx];
  const touchStartX = useRef<number | null>(null);

  function prev() { setIdx(i => (i === 0 ? SHOTS.length - 1 : i - 1)); }
  function next() { setIdx(i => (i === SHOTS.length - 1 ? 0 : i + 1)); }

  function onTouchStart(e: React.TouchEvent) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 50) prev();
    else if (dx < -50) next();
    touchStartX.current = null;
  }

  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04]">

      {/* BG glow sutil */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] h-[600px] opacity-20 dark:opacity-10"
             style={{ background: 'radial-gradient(ellipse, rgba(97,206,112,0.18) 0%, transparent 60%)' }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        <div className="text-center mb-12 lg:mb-16">
          <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 dark:text-white/40 mb-4">
            Por dentro
          </p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            Cada tela,<br />
            <span className="text-zinc-400 dark:text-white/30">pensada nos detalhes.</span>
          </h2>
        </div>

        {/* Display principal — browser chrome + screenshot */}
        <div
          className="relative rounded-3xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-900 dark:bg-black overflow-hidden mb-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.5)] touch-pan-y"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Browser chrome */}
          <div className="px-4 py-3 flex items-center gap-2 border-b border-zinc-800 dark:border-white/[0.06] bg-zinc-900 dark:bg-zinc-950">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <span className="w-3 h-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="ml-3 px-3 py-1 rounded-md bg-white/5 text-[11px] font-mono text-white/60 inline-flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              forsora.com<span className="text-white/30">/{ativo.id.replace('finance-', '').replace('grow-', 'grow/')}</span>
            </div>

            {/* Setas de navegação no chrome */}
            <div className="ml-auto flex items-center gap-1">
              <button onClick={prev}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                <ArrowLeft size={14} />
              </button>
              <button onClick={next}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:text-white hover:bg-white/[0.06] transition-colors">
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Screenshot */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-950">
            <img
              key={ativo.id}
              src={ativo.img}
              alt={ativo.titulo}
              className="absolute inset-0 w-full h-full object-contain object-center animate-[fade-in_500ms_ease-out_both]"
              loading="lazy"
            />

            {/* Caption flutuante — só em desktop */}
            <div className="hidden sm:block absolute bottom-5 right-5 max-w-sm">
              <div className="px-4 py-3 rounded-xl backdrop-blur-md bg-black/60 border border-white/10 text-white shadow-2xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full"
                        style={{ background: ativo.painel === 'finance' ? '#61ce70' : ativo.painel === 'negocios' ? '#fbbf24' : '#7c3aed' }} />
                  <p className="text-[10px] font-bold uppercase tracking-widest"
                     style={{ color: ativo.painel === 'finance' ? '#61ce70' : ativo.painel === 'negocios' ? '#fbbf24' : '#7c3aed' }}>
                    {ativo.painel === 'finance' ? 'Sora Finance' : ativo.painel === 'negocios' ? 'Sora Negócios' : 'Sora Grow'}
                  </p>
                </div>
                <p className="font-bold text-sm">{ativo.titulo}</p>
                <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{ativo.desc}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Caption mobile — fora da imagem, abaixo */}
        <div className="sm:hidden mb-4 px-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full"
                  style={{ background: ativo.painel === 'finance' ? '#61ce70' : ativo.painel === 'negocios' ? '#fbbf24' : '#7c3aed' }} />
            <p className="text-[10px] font-bold uppercase tracking-widest"
               style={{ color: ativo.painel === 'finance' ? '#61ce70' : ativo.painel === 'negocios' ? '#fbbf24' : '#7c3aed' }}>
              {ativo.painel === 'finance' ? 'Sora Finance' : ativo.painel === 'negocios' ? 'Sora Negócios' : 'Sora Grow'}
            </p>
          </div>
          <p className="font-bold text-base">{ativo.titulo}</p>
          <p className="text-sm text-zinc-600 dark:text-white/65 mt-0.5 leading-relaxed">{ativo.desc}</p>
        </div>

        {/* Thumbnails */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {SHOTS.map((s, i) => {
            const ativa = idx === i;
            const cor = s.painel === 'finance' ? '#61ce70' : s.painel === 'negocios' ? '#fbbf24' : '#7c3aed';
            return (
              <button
                key={s.id}
                onClick={() => setIdx(i)}
                className={`group relative aspect-[16/10] rounded-xl overflow-hidden border transition-all ${
                  ativa
                    ? 'border-zinc-400 dark:border-white/30 shadow-md ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#0a0a0a]'
                    : 'border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.18] opacity-70 hover:opacity-100'
                }`}
                style={ativa ? { '--tw-ring-color': cor } as any : {}}
              >
                <img src={s.img} alt={s.titulo} loading="lazy"
                     className="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-1.5 left-2 right-2">
                  <p className="text-[9px] font-bold text-white truncate">{s.titulo}</p>
                </div>
                {/* Dot indicador de painel */}
                <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full" style={{ background: cor }} />
              </button>
            );
          })}
        </div>

        {/* Stats / contador */}
        <div className="flex items-center justify-between mt-6 text-xs text-zinc-500 dark:text-white/40">
          <span>{String(idx + 1).padStart(2, '0')} / {String(SHOTS.length).padStart(2, '0')}</span>
          <span className="font-mono">{ativo.titulo}</span>
        </div>

        {/* "Tudo isso e muito mais!" — fechamento elegante */}
        <div className="mt-20 lg:mt-28 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] backdrop-blur-sm">
            <Sparkles size={11} style={{ color: '#61ce70' }} />
            <span className="text-[11px] font-bold tracking-widest uppercase text-zinc-700 dark:text-white/70">
              Você só viu o começo
            </span>
          </div>
          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[-0.03em] leading-[1.05]">
            Tudo isso<br />
            <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
              e muito mais.
            </span>
          </h3>
          <p className="mt-4 text-base lg:text-lg text-zinc-600 dark:text-white/60 max-w-xl mx-auto leading-relaxed">
            Cada detalhe pensado pra te poupar tempo todo dia.
          </p>
          <Link href="#pricing"
                className="inline-flex items-center gap-2 mt-7 px-5 py-3 text-sm font-bold text-white rounded-xl shadow-md hover:-translate-y-0.5 transition-all"
                style={{ background: 'linear-gradient(135deg, #61ce70 0%, #4DAE61 100%)' }}>
            Ver todos os recursos →
          </Link>
        </div>
      </div>
    </section>
  );
}
