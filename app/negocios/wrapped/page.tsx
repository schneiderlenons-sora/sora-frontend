'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import {
  X, ChevronLeft, ChevronRight, Share2, Loader2, ArrowRight,
  Crown, Sparkles, TrendingUp, Trophy, Users, Clock, Zap, Award,
} from 'lucide-react';

const BRAND = '#61ce70';

const MES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const periodoLabel = (iso: string) => {
  const [a, m] = iso.split('-');
  return `${MES_NOMES[parseInt(m) - 1]} ${a}`;
};
const fmt = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((centavos || 0) / 100);
const fmtNum = (n: number) => new Intl.NumberFormat('pt-BR').format(n || 0);

const NOMES_PLAT: Record<string, string> = {
  hotmart: 'Hotmart', kiwify: 'Kiwify', eduzz: 'Eduzz',
  stripe: 'Stripe', mercadopago: 'Mercado Pago',
};
const CORES_PLAT: Record<string, string> = {
  hotmart: '#f04e23', kiwify: '#0066ff', eduzz: '#ff6b00',
  stripe: '#635bff', mercadopago: '#00b1ea',
};

// ─── COMPONENTE PRINCIPAL ────────────────────────────────────────
export default function WrappedPage() {
  const { isBlack, phone } = useAuth();
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx]     = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (!phone || !isBlack) return;
    api.negocios.wrapped.get(phone).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [phone, isBlack]);

  const slides = useMemo(() => construirSlides(data), [data]);

  // Auto-advance 6s por slide (pausa no último)
  useEffect(() => {
    if (!autoplay || !slides.length || idx === slides.length - 1) return;
    const t = setTimeout(() => setIdx(i => Math.min(slides.length - 1, i + 1)), 6000);
    return () => clearTimeout(t);
  }, [idx, autoplay, slides.length]);

  // Teclas: ← → Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') { setIdx(i => Math.min(slides.length - 1, i + 1)); setAutoplay(false); }
      if (e.key === 'ArrowLeft')  { setIdx(i => Math.max(0, i - 1)); setAutoplay(false); }
      if (e.key === 'Escape')     window.history.back();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slides.length]);

  if (!isBlack) {
    return <FullCenter><p className="text-white/70 text-sm">Disponível no plano Black.</p></FullCenter>;
  }
  if (loading) {
    return <FullCenter><Loader2 className="animate-spin text-white/50" size={24} /></FullCenter>;
  }
  if (!data || !slides.length) {
    return (
      <FullCenter>
        <div className="text-center max-w-sm">
          <p className="text-white/80 text-base font-bold mb-2">Wrapped ainda não disponível</p>
          <p className="text-white/50 text-xs leading-relaxed mb-4">Conecte uma plataforma e registre vendas pra desbloquear seu resumo do mês.</p>
          <Link href="/negocios" className="text-xs font-bold underline" style={{ color: BRAND }}>Voltar para Negócios</Link>
        </div>
      </FullCenter>
    );
  }

  const slide = slides[idx];

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden select-none"
         style={{ touchAction: 'pan-y' }}>

      {/* Barras de progresso no topo (estilo Instagram Stories) */}
      <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 p-3">
        {slides.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-white transition-all"
                 style={{
                   width: i < idx ? '100%' : i === idx ? (autoplay ? '100%' : '50%') : '0%',
                   transitionDuration: i === idx && autoplay ? '6000ms' : '0ms',
                 }} />
          </div>
        ))}
      </div>

      {/* Botão fechar */}
      <Link href="/negocios"
            className="absolute top-3 right-4 z-30 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-sm">
        <X size={16} />
      </Link>

      {/* Container 9:16 centralizado */}
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div key={idx}
             className="relative w-full h-full max-w-[min(420px,calc(100vh*9/16))] aspect-[9/16] rounded-3xl overflow-hidden animate-wrapped-in"
             style={{ background: slide.bg }}>

          {/* Conteúdo do slide */}
          <SlideContent slide={slide} periodo={data.periodo} />

          {/* Áreas de tap left/right */}
          <button onClick={() => { setIdx(i => Math.max(0, i - 1)); setAutoplay(false); }}
                  className="absolute left-0 top-0 bottom-0 w-1/3 z-10" aria-label="Anterior" />
          <button onClick={() => { setIdx(i => Math.min(slides.length - 1, i + 1)); setAutoplay(false); }}
                  className="absolute right-0 top-0 bottom-0 w-1/3 z-10" aria-label="Próximo" />
        </div>
      </div>

      {/* Setas navegação desktop */}
      <button onClick={() => { setIdx(i => Math.max(0, i - 1)); setAutoplay(false); }}
              disabled={idx === 0}
              className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-all disabled:opacity-30">
        <ChevronLeft size={16} />
      </button>
      <button onClick={() => { setIdx(i => Math.min(slides.length - 1, i + 1)); setAutoplay(false); }}
              disabled={idx === slides.length - 1}
              className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center transition-all disabled:opacity-30">
        <ChevronRight size={16} />
      </button>

      <style jsx>{`
        @keyframes wrapped-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        .animate-wrapped-in { animation: wrapped-in 500ms cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}

// ─── COMPONENTE DE SLIDE ─────────────────────────────────────────

function SlideContent({ slide, periodo }: { slide: Slide; periodo: string }) {
  return (
    <div className="relative w-full h-full p-8 flex flex-col">
      {/* Padrão de fundo sutil */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
           style={{
             backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 50%)',
           }} />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none mix-blend-overlay"
           style={{
             backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
           }} />

      {/* Topo: marca + período */}
      <div className="relative flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] opacity-70">
        <span>Sora · Wrapped</span>
        <span>{periodoLabel(periodo)}</span>
      </div>

      {/* Conteúdo central */}
      <div className="relative flex-1 flex flex-col justify-center">
        {slide.tipo === 'cover'   && <SlideCover   slide={slide} periodo={periodo} />}
        {slide.tipo === 'numero'  && <SlideNumero  slide={slide} />}
        {slide.tipo === 'destaque' && <SlideDestaque slide={slide} />}
        {slide.tipo === 'final'   && <SlideFinal   slide={slide} />}
      </div>

      {/* Rodapé com dica */}
      {slide.tipo !== 'final' && (
        <p className="relative text-center text-[10px] opacity-50">Toque pra avançar →</p>
      )}
    </div>
  );
}

function SlideCover({ slide, periodo }: { slide: Slide; periodo: string }) {
  return (
    <div className="space-y-6 text-center">
      <Crown size={32} className="mx-auto" style={{ color: BRAND }} />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-60 mb-3">Seu mês em números</p>
        <h1 className="text-5xl font-bold tracking-tight leading-[0.95]">
          {periodoLabel(periodo)}
        </h1>
        <p className="text-sm opacity-70 mt-4 max-w-[200px] mx-auto leading-relaxed">
          {slide.subtitulo}
        </p>
      </div>
    </div>
  );
}

function SlideNumero({ slide }: { slide: Slide }) {
  return (
    <div className="space-y-4">
      {slide.icon && <slide.icon size={22} className="opacity-60" />}
      <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{slide.label}</p>
      <NumberAnimated valor={slide.valor!} prefixo={slide.prefixo} sufixo={slide.sufixo} />
      {slide.subtitulo && (
        <p className="text-sm opacity-80 leading-relaxed max-w-[280px]">{slide.subtitulo}</p>
      )}
      {slide.delta != null && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold mt-2 backdrop-blur-sm"
             style={{ background: slide.delta >= 0 ? 'rgba(97,206,112,0.2)' : 'rgba(255,255,255,0.15)' }}>
          {slide.delta >= 0 ? '↑' : '↓'} {Math.abs(slide.delta).toFixed(0)}% vs mês anterior
        </div>
      )}
    </div>
  );
}

function SlideDestaque({ slide }: { slide: Slide }) {
  return (
    <div className="space-y-5">
      {slide.icon && <slide.icon size={22} className="opacity-60" />}
      <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-60">{slide.label}</p>
      <h2 className="text-4xl font-bold tracking-tight leading-[1.05]">{slide.titulo}</h2>
      {slide.valorTexto && (
        <p className="text-xl font-bold opacity-90 tabular-nums">{slide.valorTexto}</p>
      )}
      {slide.subtitulo && (
        <p className="text-sm opacity-70 leading-relaxed max-w-[280px]">{slide.subtitulo}</p>
      )}
    </div>
  );
}

function SlideFinal({ slide }: { slide: Slide }) {
  const [compartilhando, setCompartilhando] = useState(false);

  async function compartilhar() {
    setCompartilhando(true);
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Meu mês na Sora',
          text: slide.subtitulo!,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copiado!');
      }
    } catch {} finally {
      setTimeout(() => setCompartilhando(false), 500);
    }
  }

  return (
    <div className="space-y-6 text-center">
      <Sparkles size={32} className="mx-auto" style={{ color: BRAND }} />
      <h2 className="text-3xl font-bold tracking-tight leading-[1.1]">{slide.titulo}</h2>
      <p className="text-sm opacity-80 leading-relaxed max-w-[260px] mx-auto">{slide.subtitulo}</p>

      <button onClick={compartilhar}
              disabled={compartilhando}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold text-black shadow-lg transition-transform active:scale-95"
              style={{ background: 'white' }}>
        {compartilhando
          ? <><Loader2 size={14} className="animate-spin" /> Compartilhando…</>
          : <><Share2 size={14} /> Compartilhar resumo</>}
      </button>

      <Link href="/negocios"
            className="inline-flex items-center gap-1 text-xs opacity-70 hover:opacity-100 mt-2">
        Voltar para Negócios <ArrowRight size={11} />
      </Link>
    </div>
  );
}

// ─── NÚMERO ANIMADO COUNT-UP ─────────────────────────────────────

function NumberAnimated({ valor, prefixo, sufixo }: { valor: number; prefixo?: string; sufixo?: string }) {
  const [v, setV] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const dur = 1400;
    function step(now: number) {
      const p = Math.min(1, (now - start) / dur);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setV(valor * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    }
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [valor]);

  const txt = prefixo === 'R$ '
    ? fmt(v)
    : `${prefixo || ''}${fmtNum(Math.round(v))}${sufixo || ''}`;

  return (
    <p className="text-[64px] sm:text-7xl font-bold tracking-tight leading-none tabular-nums">
      {txt}
    </p>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────

type Slide = {
  tipo: 'cover' | 'numero' | 'destaque' | 'final';
  bg: string;
  icon?: any;
  label?: string;
  titulo?: string;
  subtitulo?: string;
  valor?: number;
  valorTexto?: string;
  prefixo?: string;
  sufixo?: string;
  delta?: number | null;
};

function construirSlides(data: any): Slide[] {
  if (!data || data.total_vendas === 0) return [];

  // Gradientes premium — não infantis. Pensa Stripe/Apple, não Spotify Wrapped colorido.
  const gradients = {
    midnight: 'linear-gradient(135deg, #0f0f1e 0%, #1a1a2e 50%, #16213e 100%)',
    ember:    'linear-gradient(135deg, #1a0e0e 0%, #2d1b1b 50%, #4a1f1f 100%)',
    forest:   'linear-gradient(135deg, #0a1f1a 0%, #0d2818 50%, #1a3d2e 100%)',
    royal:    'linear-gradient(135deg, #1a0e2e 0%, #2d1b4e 50%, #3d2570 100%)',
    gold:     'linear-gradient(135deg, #2a1f0a 0%, #3d2f15 50%, #5a4520 100%)',
    ink:      'linear-gradient(135deg, #000 0%, #0a0a0a 50%, #1a1a1a 100%)',
  };

  const slides: Slide[] = [];

  // 1. Cover
  slides.push({
    tipo: 'cover', bg: gradients.midnight,
    subtitulo: 'Veja como foi seu mês com a Sora.',
  });

  // 2. Receita bruta
  slides.push({
    tipo: 'numero', bg: gradients.forest,
    icon: TrendingUp,
    label: 'Você faturou',
    valor: data.receita_bruta, prefixo: 'R$ ',
    subtitulo: `Em ${fmtNum(data.total_vendas)} ${data.total_vendas === 1 ? 'venda' : 'vendas'} pelo mês inteiro.`,
  });

  // 3. Lucro líquido
  if (data.lucro_liquido > 0) {
    slides.push({
      tipo: 'numero', bg: gradients.ember,
      icon: Trophy,
      label: 'Seu lucro líquido',
      valor: data.lucro_liquido, prefixo: 'R$ ',
      subtitulo: `Margem de ${data.margem_pct?.toFixed(1) || 0}% — o que sobrou depois de taxas, impostos e custos.`,
      delta: data.delta_lucro_pct,
    });
  }

  // 4. Produto campeão
  if (data.produto_top) {
    slides.push({
      tipo: 'destaque', bg: gradients.royal,
      icon: Award,
      label: 'Seu produto campeão',
      titulo: data.produto_top.nome,
      valorTexto: `${fmt(data.produto_top.valor)} · ${fmtNum(data.produto_top.vendas)} ${data.produto_top.vendas === 1 ? 'venda' : 'vendas'}`,
      subtitulo: 'O que mais puxou seu mês.',
    });
  }

  // 5. Plataforma top
  if (data.plataforma_top) {
    const platCor = CORES_PLAT[data.plataforma_top.plataforma] || BRAND;
    slides.push({
      tipo: 'destaque',
      bg: `linear-gradient(135deg, #0a0a0a 0%, ${platCor}30 100%)`,
      icon: Zap,
      label: 'Sua plataforma top',
      titulo: NOMES_PLAT[data.plataforma_top.plataforma] || data.plataforma_top.plataforma,
      valorTexto: `${fmt(data.plataforma_top.valor)} · ${fmtNum(data.plataforma_top.vendas)} ${data.plataforma_top.vendas === 1 ? 'venda' : 'vendas'}`,
    });
  }

  // 6. Melhor dia
  if (data.melhor_dia) {
    const d = new Date(data.melhor_dia.data);
    const dia = d.getDate();
    const mes = MES_NOMES[d.getMonth()];
    slides.push({
      tipo: 'destaque', bg: gradients.gold,
      icon: Trophy,
      label: 'Seu melhor dia',
      titulo: `${dia} de ${mes}`,
      valorTexto: fmt(data.melhor_dia.valor),
      subtitulo: 'Marque na agenda — esse foi o dia.',
    });
  }

  // 7. Compradores únicos
  if (data.compradores_unicos > 1) {
    slides.push({
      tipo: 'numero', bg: gradients.midnight,
      icon: Users,
      label: 'Pessoas que compraram',
      valor: data.compradores_unicos,
      subtitulo: data.compradores_unicos === 1
        ? 'Um cliente conquistado neste mês.'
        : `${fmtNum(data.compradores_unicos)} clientes únicos passaram pelo seu funil.`,
    });
  }

  // 8. Hora pico
  if (data.hora_pico != null) {
    slides.push({
      tipo: 'destaque', bg: gradients.royal,
      icon: Clock,
      label: 'Sua hora de ouro',
      titulo: `${String(data.hora_pico).padStart(2, '0')}:00`,
      subtitulo: 'O horário em que sua audiência mais comprou. Vale considerar pra próximas campanhas.',
    });
  }

  // 9. MRR (se for relevante)
  if (data.mrr > 0) {
    slides.push({
      tipo: 'numero', bg: gradients.ember,
      icon: TrendingUp,
      label: 'Receita recorrente',
      valor: data.mrr, prefixo: 'R$ ',
      subtitulo: 'Sua MRR — receita que se repete sem você precisar fechar novas vendas.',
    });
  }

  // 10. Final
  slides.push({
    tipo: 'final', bg: gradients.ink,
    titulo: 'Esse foi seu mês.\nQue venham os próximos.',
    subtitulo: 'Sora — seu CFO de bolso. Compartilhe seus números com quem quiser.',
  });

  return slides;
}

// ─── Layout helpers ──────────────────────────────────────────────

function FullCenter({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center p-6">{children}</div>
  );
}
