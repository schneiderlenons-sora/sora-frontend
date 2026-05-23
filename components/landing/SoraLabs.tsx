'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Beaker, ArrowLeft, ArrowRight, GraduationCap, CreditCard, Heart, Brain, Clock,
  PlayCircle, Sparkles, ArrowRight as ArrowRightIcon,
} from 'lucide-react';

const BRAND = '#61ce70';

type Curso = {
  id:       string;
  titulo:   string;
  tag:      string;     // categoria curta no topo
  duracao:  string;
  desc:     string;
  cor:      string;     // hex base
  corDark:  string;     // hex escuro pro gradient
  corGlow:  string;     // rgba pro halo do hover
  icon:     typeof GraduationCap;
  novo?:    boolean;
  comingSoon?: boolean;
};

const CURSOS: Curso[] = [
  {
    id: 'gestao-financeira',
    titulo: 'Domine sua vida financeira',
    tag: 'Curso · Finanças',
    duracao: '12 aulas · 2h',
    desc: 'Do zero ao controle: organize contas, monte sua reserva e saia do vermelho de uma vez.',
    cor: '#61ce70',
    corDark: '#1f6f3d',
    corGlow: 'rgba(97, 206, 112, 0.45)',
    icon: GraduationCap,
    novo: true,
  },
  {
    id: 'creditos-cartao',
    titulo: 'Cartão de crédito a seu favor',
    tag: 'Curso · Crédito',
    duracao: '8 aulas · 1h20',
    desc: 'Use limite, pontos e cashback como alavanca. Nunca mais pague juros à toa.',
    cor: '#3b82f6',
    corDark: '#1d3a8a',
    corGlow: 'rgba(59, 130, 246, 0.45)',
    icon: CreditCard,
  },
  {
    id: 'desafio-10kg',
    titulo: 'Desafio: 10kg em 30 dias',
    tag: 'Desafio · Saúde',
    duracao: '30 dias · cardápio',
    desc: 'Plano alimentar dia a dia, treinos curtos e checkpoints. Emagreça com saúde.',
    cor: '#f97316',
    corDark: '#9a3412',
    corGlow: 'rgba(249, 115, 22, 0.45)',
    icon: Heart,
  },
  {
    id: 'anti-procrastinacao',
    titulo: 'Organização anti-procrastinação',
    tag: 'Curso · Produtividade',
    duracao: '6 aulas · 45min',
    desc: 'Sistema de rotina e foco pra quem sempre adia. Comece pequeno, mantenha grande.',
    cor: '#8b5cf6',
    corDark: '#4c1d95',
    corGlow: 'rgba(139, 92, 246, 0.45)',
    icon: Brain,
  },
  {
    id: 'em-breve',
    titulo: 'Novos conteúdos todo mês',
    tag: 'Em breve',
    duracao: 'Atualizações mensais',
    desc: 'Toda assinatura ativa recebe cursos, desafios e dicas novas sem custo extra.',
    cor: '#52525b',
    corDark: '#27272a',
    corGlow: 'rgba(82, 82, 91, 0.35)',
    icon: Clock,
    comingSoon: true,
  },
];

export default function SoraLabs() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [podeEsq, setPodeEsq] = useState(false);
  const [podeDir, setPodeDir] = useState(true);

  // Atualiza estado das setas conforme posição do scroll
  function updateArrows() {
    const el = scrollerRef.current;
    if (!el) return;
    setPodeEsq(el.scrollLeft > 8);
    setPodeDir(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      window.removeEventListener('resize', updateArrows);
    };
  }, []);

  function scrollBy(dir: 'left' | 'right') {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = card ? card.offsetWidth + 20 : 320;
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  }

  return (
    <section className="relative py-24 lg:py-36 border-t border-zinc-200/50 dark:border-white/[0.04] overflow-hidden">

      {/* BG: glow verde + grid sutil (mesmo padrão do hero) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] opacity-25 dark:opacity-15"
             style={{ background: `radial-gradient(ellipse, ${BRAND}1F 0%, transparent 60%)` }} />
        <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.06]"
             style={{
               backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
               backgroundSize: '56px 56px',
               maskImage: 'radial-gradient(ellipse 70% 50% at 50% 40%, black 30%, transparent 80%)',
               WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 40%, black 30%, transparent 80%)',
             }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8">

        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          {/* Eyebrow / toggle */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] backdrop-blur-sm">
            <Beaker size={11} style={{ color: BRAND }} />
            <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-700 dark:text-white/70">
              Sora Labs
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-[-0.03em] max-w-3xl mx-auto">
            A Sora vai além<br />
            <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              da organização.
            </span>
          </h2>

          <div className="mt-6 max-w-2xl mx-auto space-y-3 text-zinc-600 dark:text-white/65 text-base sm:text-lg leading-relaxed">
            <p>
              Além de toda a plataforma de organização, você recebe acesso ao{' '}
              <strong className="text-zinc-900 dark:text-white">Sora Labs</strong> — uma plataforma feita exclusivamente para você{' '}
              <span className="font-semibold" style={{ color: BRAND }}>evoluir</span>.
            </p>
            <p className="text-sm sm:text-base text-zinc-500 dark:text-white/50">
              Acesse mensalmente novos cursos, desafios, dicas financeiras, ideias de negócios e muito mais.
            </p>
          </div>
        </div>

        {/* Carrossel — scroll horizontal estilo Netflix */}
        <div className="relative">
          {/* Setas (desktop only) */}
          <button
            type="button"
            onClick={() => scrollBy('left')}
            disabled={!podeEsq}
            aria-label="Cards anteriores"
            className={`hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-12 h-12 rounded-full items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.1] shadow-lg transition-all duration-200 ${
              podeEsq ? 'hover:scale-110 hover:shadow-xl active:scale-95 cursor-pointer' : 'opacity-30 cursor-not-allowed'
            }`}
          >
            <ArrowLeft size={17} className="text-zinc-700 dark:text-white/85" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy('right')}
            disabled={!podeDir}
            aria-label="Próximos cards"
            className={`hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-12 h-12 rounded-full items-center justify-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.1] shadow-lg transition-all duration-200 ${
              podeDir ? 'hover:scale-110 hover:shadow-xl active:scale-95 cursor-pointer' : 'opacity-30 cursor-not-allowed'
            }`}
          >
            <ArrowRight size={17} className="text-zinc-700 dark:text-white/85" />
          </button>

          {/* Gradient edges */}
          <div className="absolute left-0 top-0 bottom-3 w-12 sm:w-16 z-10 pointer-events-none bg-gradient-to-r from-white dark:from-[#0a0a0a] to-transparent" />
          <div className="absolute right-0 top-0 bottom-3 w-12 sm:w-16 z-10 pointer-events-none bg-gradient-to-l from-white dark:from-[#0a0a0a] to-transparent" />

          {/* Scroller */}
          <div
            ref={scrollerRef}
            className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-pl-5 pt-2 pb-6 -mx-5 px-5 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
            style={{ touchAction: 'pan-x pan-y' }}
          >
            {CURSOS.map((c, i) => (
              <CursoCard key={c.id} curso={c} index={i} />
            ))}
          </div>
        </div>

        {/* Frase final */}
        <div className="mt-20 lg:mt-28 text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/60 dark:bg-white/[0.03] backdrop-blur-sm">
            <Sparkles size={11} style={{ color: BRAND }} />
            <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-700 dark:text-white/70">
              O diferencial Sora
            </span>
          </div>
          <p className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-[-0.02em] leading-[1.15]">
            <span className="text-zinc-400 dark:text-white/40">Outros softwares vendem só a ferramenta.</span>
            <br />
            <span className="text-transparent bg-clip-text"
                  style={{ backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, #4DAE61 100%)` }}>
              A Sora entrega a ferramenta e o conhecimento.
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

// ─── Card de curso ────────────────────────────────────────────────────────────

function CursoCard({ curso, index }: { curso: Curso; index: number }) {
  const Icon = curso.icon;

  return (
    <button
      type="button"
      data-card
      aria-label={`${curso.titulo} — ${curso.tag}`}
      style={{
        animationDelay: `${index * 50}ms`,
        // CSS vars usadas no hover (sombra colorida)
        ['--cor' as string]: curso.cor,
        ['--cor-dark' as string]: curso.corDark,
        ['--cor-glow' as string]: curso.corGlow,
      } as React.CSSProperties}
      className={`
        group snap-start shrink-0 w-[280px] sm:w-[320px] lg:w-[340px] aspect-[3/4]
        rounded-3xl overflow-hidden relative text-left
        animate-[slide-up_700ms_ease-out_both]
        transition-[transform,box-shadow] duration-300 ease-out
        hover:-translate-y-2 hover:scale-[1.02]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0a0a0a]
        ${curso.comingSoon ? 'cursor-default' : 'cursor-pointer'}
      `}
    >
      {/* Glow colorido sob o card no hover — cinematic depth */}
      <span
        aria-hidden
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
        style={{ boxShadow: `0 25px 60px -15px var(--cor-glow)` }}
      />

      {/* CAMADA 1 — Gradient principal */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(140deg, ${curso.cor} 0%, ${curso.corDark} 100%)` }}
      />

      {/* CAMADA 2 — Padrão decorativo: grid sutil + halo top-right + waves SVG */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Halo branco no canto superior direito (depth) */}
        <div
          className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-50 group-hover:opacity-70 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 60%)` }}
        />

        {/* Grid sutil em cima do gradient (textura) */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)`,
            backgroundSize: '36px 36px',
          }}
        />

        {/* Curvas decorativas (SVG) — visual de "abstract art cover" */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.18] group-hover:opacity-[0.28] transition-opacity duration-500"
          viewBox="0 0 340 453"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id={`l-${curso.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M -50 320 Q 80 240, 180 290 T 400 200"
            stroke={`url(#l-${curso.id})`}
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M -50 380 Q 100 300, 200 350 T 420 270"
            stroke={`url(#l-${curso.id})`}
            strokeWidth="1.5"
            fill="none"
            opacity="0.6"
          />
        </svg>

        {/* Marca d'água do ícone gigante no fundo direito-baixo */}
        <div className="absolute -bottom-6 -right-6 opacity-[0.14] group-hover:opacity-[0.20] group-hover:scale-110 transition-all duration-500 origin-bottom-right">
          <Icon size={200} strokeWidth={1.1} color="white" />
        </div>
      </div>

      {/* CAMADA 3 — Vinheta inferior pra legibilidade do título */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      {/* Ribbon "NOVO" — pequeno selo top-right */}
      {curso.novo && (
        <div className="absolute top-4 right-4 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-white text-zinc-950 shadow-md">
            <Sparkles size={9} />
            Novo
          </span>
        </div>
      )}

      {/* Conteúdo */}
      <div className="relative h-full flex flex-col justify-between p-5 sm:p-6 text-white">

        {/* TOPO: tag + ícone glassmorphism */}
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/15 backdrop-blur-md border border-white/25 shadow-sm">
            {curso.tag}
          </span>
        </div>

        {/* BASE: duração + título + descrição + CTA */}
        <div>
          <p className="text-[11px] font-semibold text-white/75 mb-2 tabular-nums tracking-wide">
            {curso.duracao}
          </p>

          <h3 className="text-xl sm:text-[22px] font-bold leading-[1.15] tracking-tight mb-2 line-clamp-2 drop-shadow-sm">
            {curso.titulo}
          </h3>

          <p className="text-[13px] text-white/85 leading-snug mb-4 line-clamp-3">
            {curso.desc}
          </p>

          {/* CTA inline */}
          {curso.comingSoon ? (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/80">
              <Clock size={12} />
              Em breve
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white transition-all duration-200 group-hover:gap-2.5">
              <PlayCircle size={13} />
              Acessar curso
              <ArrowRightIcon
                size={12}
                className="opacity-0 -ml-2 group-hover:opacity-100 group-hover:ml-0 transition-all duration-200"
              />
            </div>
          )}
        </div>
      </div>

      {/* Borda sutil sempre visível + ring colorido no hover */}
      <div className="absolute inset-0 rounded-3xl ring-1 ring-white/15 pointer-events-none group-hover:ring-white/30 transition-colors duration-300" />
    </button>
  );
}
