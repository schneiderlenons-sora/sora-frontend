'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Link from 'next/link';
import CursoCover from '@/components/labs/CursoCover';
import { CATEGORIAS, DESTAQUES, TOTAL_CURSOS, TODOS_CURSOS, type LabCurso, type LabCategoria } from '@/lib/labs-cursos';
import { cursoDisponivel } from '@/lib/labs-conteudo';
import {
  Beaker, Sparkles, BookOpen, Bell, ChevronLeft, ChevronRight, CheckCircle2,
} from 'lucide-react';

/** Cursos que já têm conteúdo — decidem o banner do topo e o contador do hero. */
const LIBERADOS = TODOS_CURSOS.filter((c) => cursoDisponivel(c.id));

export default function SoraLabsPage() {
  const [toast, setToast] = useState<string>('');
  const onCurso = useCallback((c: LabCurso) => {
    setToast(`🔔 "${c.titulo}" ainda está em produção — te avisamos assim que sair!`);
  }, []);

  // some o toast sozinho
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-28 space-y-10">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden rounded-3xl p-6 sm:p-10 animate-fade-in"
          style={{ background: 'linear-gradient(135deg, hsl(var(--bg-card)) 0%, hsl(var(--bg-subtle)) 100%)', border: '1px solid hsl(var(--border))' }}>
          {/* glows + grid */}
          <div aria-hidden className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-24 -left-20 w-96 h-96 rounded-full opacity-30"
              style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 65%)' }} />
            <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full opacity-20"
              style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.18) 0%, transparent 70%)' }} />
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: 'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
              backgroundSize: '48px 48px',
              maskImage: 'radial-gradient(ellipse 60% 70% at 30% 30%, black 30%, transparent 80%)',
              WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 30% 30%, black 30%, transparent 80%)',
            }} />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5 border border-primary/30 bg-primary/10 backdrop-blur-sm">
              <Beaker size={12} className="text-primary" />
              <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-primary">Sora Labs</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.05] text-foreground max-w-2xl">
              Aprenda enquanto<br />
              <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.6) 100%)' }}>
                organiza sua vida.
              </span>
            </h1>

            <p className="text-muted-foreground text-sm sm:text-base mt-4 max-w-xl leading-relaxed">
              Cursos, guias e desafios — direto ao ponto, pra você evoluir no seu ritmo.
              Tudo incluso na sua assinatura, sem custo extra.
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-6">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full">
                <BookOpen size={13} className="text-primary" /> {LIBERADOS.length} no ar · {TOTAL_CURSOS - LIBERADOS.length} a caminho
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full">
                <Sparkles size={13} className="text-primary" /> Novidades todo mês
              </span>
            </div>
          </div>
        </section>

        {/* ── BANNER DO CURSO LIBERADO ─────────────────────────
            ⚠️ Substituiu o "🚧 o Labs está chegando". Com um curso no ar,
            aquele banner passava a mentir logo acima de um card que abre —
            e quem lê "está chegando" nem tenta tocar. */}
        {LIBERADOS.length > 0 && (
          <section className="rounded-2xl p-5 sm:p-6 border border-primary/30 bg-primary/[0.06] flex flex-col sm:flex-row sm:items-center gap-4 animate-fade-in" style={{ animationDelay: '60ms' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <Sparkles size={22} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-foreground">
                🎉 {LIBERADOS.length === 1 ? 'O primeiro curso já está no ar' : `${LIBERADOS.length} cursos já estão no ar`}
              </p>
              <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                Os demais seguem em produção — toque numa capa marcada como “em breve” pra ser avisado quando lançar.
              </p>
            </div>
            <Link href={`/labs/${LIBERADOS[0].id}`} prefetch={false}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white flex-shrink-0 active:scale-[0.98] transition-transform"
                  style={{ background: 'hsl(var(--primary))' }}>
              <BookOpen size={15} /> Começar agora
            </Link>
          </section>
        )}

        {/* ── EM DESTAQUE ─────────────────────────────────────── */}
        <Fileira id="destaques" titulo="Em destaque" emoji="✨" cursos={DESTAQUES} onCurso={onCurso} />

        {/* ── CATEGORIAS ──────────────────────────────────────── */}
        {CATEGORIAS.map((cat: LabCategoria) => (
          <Fileira key={cat.id} id={cat.id} titulo={cat.nome} emoji={cat.emoji} cursos={cat.cursos} onCurso={onCurso} />
        ))}

        {/* ── RODAPÉ: o diferencial ───────────────────────────── */}
        <section className="rounded-3xl p-6 sm:p-8 text-center border border-border/60 bg-muted/20 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4 border border-primary/30 bg-primary/10">
            <CheckCircle2 size={12} className="text-primary" />
            <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-primary">O diferencial Sora</span>
          </div>
          <p className="text-lg sm:text-2xl font-bold tracking-tight leading-snug max-w-2xl mx-auto text-foreground">
            Outros apps vendem só a ferramenta.{' '}
            <span className="text-primary">A Sora entrega a ferramenta e o conhecimento.</span>
          </p>
        </section>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl bg-foreground text-background text-sm font-medium shadow-glow flex items-center gap-2 animate-fade-in max-w-[90vw]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}>
          <Bell size={15} className="flex-shrink-0" />
          <span className="truncate">{toast}</span>
        </div>
      )}
    </DashboardLayout>
  );
}

// ─── Fileira horizontal estilo Netflix ──────────────────────────────────────
function Fileira({ id, titulo, emoji, cursos, onCurso }:
  { id: string; titulo: string; emoji: string; cursos: LabCurso[]; onCurso: (c: LabCurso) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [esq, setEsq] = useState(false);
  const [dir, setDir] = useState(true);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEsq(el.scrollLeft > 8);
    setDir(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { el.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [update]);

  function nudge(d: 'l' | 'r') {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-card]');
    const step = card ? card.offsetWidth + 16 : 300;
    el.scrollBy({ left: d === 'l' ? -step : step, behavior: 'smooth' });
  }

  return (
    <section id={id} className="scroll-mt-24 animate-fade-in">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <span>{emoji}</span> {titulo}
        </h2>
        {/* setas desktop */}
        <div className="hidden lg:flex items-center gap-1.5">
          <button onClick={() => nudge('l')} disabled={!esq} aria-label="Anteriores"
            className={`w-8 h-8 rounded-full flex items-center justify-center border border-border bg-card transition-all ${esq ? 'hover:bg-muted active:scale-95' : 'opacity-30 cursor-not-allowed'}`}>
            <ChevronLeft size={16} className="text-foreground" />
          </button>
          <button onClick={() => nudge('r')} disabled={!dir} aria-label="Próximos"
            className={`w-8 h-8 rounded-full flex items-center justify-center border border-border bg-card transition-all ${dir ? 'hover:bg-muted active:scale-95' : 'opacity-30 cursor-not-allowed'}`}>
            <ChevronRight size={16} className="text-foreground" />
          </button>
        </div>
      </div>

      <div ref={ref}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pt-1 pb-4 -mx-1 px-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
        style={{ touchAction: 'pan-x pan-y' }}>
        {cursos.map((c, i) => (
          <CursoCover key={c.id} curso={c} index={i} onClick={onCurso} />
        ))}
      </div>
    </section>
  );
}
