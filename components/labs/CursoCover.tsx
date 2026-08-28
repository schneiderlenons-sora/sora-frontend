'use client';

import { Clock, Lock, BookOpen, Play } from 'lucide-react';
import Link from 'next/link';
import type { LabCurso } from '@/lib/labs-cursos';
import { cursoDisponivel } from '@/lib/labs-conteudo';

// Capa de conteúdo do Sora Labs — mesmo estilo da seção da landing, adaptada
// pra LEITURA (sem vídeo) e estado "em breve" (nada liberado ainda).
export default function CursoCover({
  curso,
  index = 0,
  onClick,
}: { curso: LabCurso; index?: number; onClick?: (c: LabCurso) => void }) {
  const Icon = curso.icon;

  // ⚠️ Curso COM conteúdo vira <Link>, não <button> com onClick: navegação de
  // verdade precisa abrir em nova aba, aparecer no histórico e ser prefetchada.
  // Um button que chama router.push perde as três coisas.
  const liberado = cursoDisponivel(curso.id);
  const Raiz: any = liberado ? Link : 'button';
  const propsRaiz = liberado
    ? { href: `/labs/${curso.id}`, prefetch: false }
    : { type: 'button' as const, onClick: () => onClick?.(curso) };

  return (
    <Raiz
      {...propsRaiz}
      data-card
      aria-label={`${curso.titulo} — ${curso.tag}${liberado ? '' : ' (em breve)'}`}
      style={{
        animationDelay: `${index * 50}ms`,
        ['--cor' as string]: curso.cor,
        ['--cor-dark' as string]: curso.corDark,
        ['--cor-glow' as string]: curso.corGlow,
      } as React.CSSProperties}
      className="
        group snap-start shrink-0 w-[260px] sm:w-[290px] lg:w-[310px] aspect-[3/4]
        rounded-3xl overflow-hidden relative text-left cursor-pointer
        animate-[slide-up_600ms_ease-out_both]
        transition-[transform,box-shadow] duration-300 ease-out
        hover:-translate-y-1.5 hover:scale-[1.02]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]
      "
    >
      {/* Glow colorido sob o card no hover */}
      <span aria-hidden className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10"
        style={{ boxShadow: `0 25px 60px -15px var(--cor-glow)` }} />

      {/* Gradient principal */}
      <div className="absolute inset-0" style={{ background: `linear-gradient(140deg, ${curso.cor} 0%, ${curso.corDark} 100%)` }} />

      {/* Textura: halo + grid + curvas + ícone gigante */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-50 group-hover:opacity-70 transition-opacity duration-500"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 60%)' }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }} />
        <svg className="absolute inset-0 w-full h-full opacity-[0.18] group-hover:opacity-[0.28] transition-opacity duration-500" viewBox="0 0 320 426" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`l-${curso.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="white" stopOpacity="0.8" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M -50 300 Q 80 230, 170 275 T 380 190" stroke={`url(#l-${curso.id})`} strokeWidth="2" fill="none" />
          <path d="M -50 360 Q 100 285, 190 330 T 400 255" stroke={`url(#l-${curso.id})`} strokeWidth="1.5" fill="none" opacity="0.6" />
        </svg>
        <div className="absolute -bottom-6 -right-6 opacity-[0.14] group-hover:opacity-[0.20] group-hover:scale-110 transition-all duration-500 origin-bottom-right">
          <Icon size={190} strokeWidth={1.1} color="white" />
        </div>
      </div>

      {/* Vinheta inferior */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 pointer-events-none bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

      {/* Selo — ícone + palavra, nunca só a cor */}
      <div className="absolute top-4 right-4 z-10">
        {liberado ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-white text-black backdrop-blur-md shadow-sm">
            <Play size={9} className="fill-current" />
            Disponível
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-black/35 text-white backdrop-blur-md border border-white/20 shadow-sm">
            <Clock size={9} />
            Em breve
          </span>
        )}
      </div>

      {/* Conteúdo */}
      <div className="relative h-full flex flex-col justify-between p-5 sm:p-6 text-white">
        <div className="flex items-start gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/15 backdrop-blur-md border border-white/25 shadow-sm">
            {curso.tag}
          </span>
        </div>

        <div>
          <p className="text-[11px] font-semibold text-white/75 mb-2 inline-flex items-center gap-1.5 tracking-wide">
            <BookOpen size={11} /> {curso.meta}
          </p>
          <h3 className="text-xl sm:text-[22px] font-bold leading-[1.15] tracking-tight mb-2 line-clamp-2 drop-shadow-sm">
            {curso.titulo}
          </h3>
          <p className="text-[13px] text-white/85 leading-snug mb-4 line-clamp-3">
            {curso.desc}
          </p>

          {/* CTA */}
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-white/85 group-hover:gap-2.5 transition-all duration-200">
            {liberado
              ? <><BookOpen size={12} /> Começar a ler</>
              : <><Lock size={12} /> Disponível em breve</>}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 rounded-3xl ring-1 ring-white/15 pointer-events-none group-hover:ring-white/30 transition-colors duration-300" />
    </Raiz>
  );
}
