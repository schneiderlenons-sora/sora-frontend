'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Zap, Folder, Check, Play, ChevronDown, Calendar, Bell,
  Sparkles, Pencil, Trash2, FileText, MessageCircle, ListTodo,
} from 'lucide-react';
import { Caret } from './chatbits';
import { useTranslations } from 'next-intl';

const VERDE = '#16a34a';   // acento escuro (contraste em card branco)
const VERDE_CLARO = '#61ce70';

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function Onda({ cor = VERDE }: { cor?: string }) {
  return (
    <span className="flex items-end gap-[2px] h-4">
      {[4, 7, 10, 6, 9, 5, 8, 5, 10, 6, 8, 4, 7, 5, 9].map((h, i) => (
        <span key={i} className="w-[2px] rounded-full" style={{ height: `${h}px`, background: cor, opacity: 0.75 }} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CARD 1 — Crie projetos (formulário com typewriter → dashboard com progresso)
// ---------------------------------------------------------------------------
function ProjetoMini({ nome, cat, pct, counts, on }: { nome: string; cat: string; pct: number; counts: [number, number, number, number]; on: boolean }) {
  const t = useTranslations('produtividade');
  const stats = [
    { n: counts[0], l: t('stPend'), c: 'text-zinc-500' },
    { n: counts[1], l: t('stFazendo'), c: 'text-emerald-600' },
    { n: counts[2], l: t('stAtraso'), c: 'text-red-500' },
    { n: counts[3], l: t('stConcl'), c: 'text-green-600' },
  ];
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-3">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg grid place-items-center" style={{ background: 'rgba(97,206,112,0.16)' }}>
          <Folder size={14} style={{ color: VERDE }} />
        </span>
        <div className="leading-tight min-w-0">
          <p className="font-bold text-[12px] text-zinc-900 truncate">{nome}</p>
          <p className="text-[10px] text-zinc-400">{cat}</p>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1">
        <span>{t('progresso')}</span><span className="font-semibold tabular-nums">{on ? pct : 0}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden mb-2.5">
        <div className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
             style={{ width: `${on ? pct : 0}%`, background: `linear-gradient(90deg, ${VERDE_CLARO}, ${VERDE})` }} />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {stats.map((s) => (
          <div key={s.l} className="rounded-md bg-zinc-50 py-1 text-center">
            <p className={`text-[12px] font-bold tabular-nums ${s.c}`}>{s.n}</p>
            <p className="text-[7px] font-semibold tracking-wide text-zinc-400">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjetosCard() {
  const t = useTranslations('produtividade');
  const { ref, inView } = useInView<HTMLDivElement>();
  const [fase, setFase] = useState<'form' | 'dash'>('form');
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [prog, setProg] = useState(false);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((r) => { timers.push(setTimeout(r, ms)); });
    const NOME = t('projetoNomeAnim');
    (async () => {
      while (vivo) {
        setFase('form'); setNome(''); setSalvando(false); setProg(false); setVisivel(true);
        await espera(900); if (!vivo) return;
        for (let i = 1; i <= NOME.length; i++) { if (!vivo) return; setNome(NOME.slice(0, i)); await espera(52); }
        await espera(700); if (!vivo) return;
        setSalvando(true); await espera(650); if (!vivo) return;
        setVisivel(false); await espera(340); if (!vivo) return;                          // some o formulário
        setFase('dash'); setProg(false); setVisivel(true); await espera(90); if (!vivo) return;
        setProg(true); await espera(4000); if (!vivo) return;
        setVisivel(false); await espera(340); if (!vivo) return;                          // some antes de reiniciar
      }
    })();
    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  return (
    <div ref={ref} className="rounded-3xl bg-white/95 backdrop-blur p-6 sm:p-8 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.35)]">
      <h3 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-zinc-900">
        {t('projetosTituloL1')}<br className="hidden sm:block" /> {t('projetosTituloL2')}
      </h3>
      <p className="mt-3 text-zinc-500 leading-relaxed max-w-md">
        {t('projetosDesc')}
      </p>

      <div className={`relative mt-7 h-[290px] transition-opacity duration-300 ${visivel ? 'opacity-100' : 'opacity-0'}`}>
        {fase === 'form' && (
        <div className="absolute inset-0">
          <div className="mx-auto max-w-sm rounded-2xl bg-white border border-zinc-200/80 shadow-lg p-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100">
              <span className="w-9 h-9 rounded-xl grid place-items-center" style={{ background: 'rgba(97,206,112,0.16)' }}>
                <Folder size={17} style={{ color: VERDE }} />
              </span>
              <div className="leading-tight">
                <p className="font-bold text-sm text-zinc-900">{t('novoProjeto')}</p>
                <p className="text-[11px] text-zinc-400">{t('novoProjetoDesc')}</p>
              </div>
            </div>
            <p className="text-[10px] font-bold tracking-wider text-zinc-400 mt-4 mb-1.5">{t('lblNomeProjeto')}</p>
            <div className="h-10 rounded-lg border border-zinc-200 bg-white px-3 flex items-center text-[13px] text-zinc-800">
              {nome}<Caret />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <p className="text-[10px] font-bold tracking-wider text-zinc-400 mb-1.5">{t('lblCategoria')}</p>
                <div className="h-9 rounded-lg border border-zinc-200 px-3 flex items-center justify-between text-[12px] text-zinc-600">
                  {t('catPessoal')} <ChevronDown size={13} className="text-zinc-400" />
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold tracking-wider text-zinc-400 mb-1.5">{t('lblPrazo')}</p>
                <div className="h-9 rounded-lg border border-zinc-200 px-3 flex items-center gap-1.5 text-[12px] text-zinc-500">
                  <Calendar size={12} /> {t('dataPrazo')}
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-[13px] font-bold transition-transform ${salvando ? 'scale-95' : ''}`}
                      style={{ background: `linear-gradient(135deg, ${VERDE_CLARO}, ${VERDE})` }}>
                <Check size={14} strokeWidth={3} /> {t('salvarProjeto')}
              </button>
            </div>
          </div>
        </div>
        )}
        {fase === 'dash' && (
        <div className="absolute inset-0">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-sm text-zinc-900">{t('projetos')}</p>
            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold" style={{ color: VERDE, background: 'rgba(97,206,112,0.14)' }}>{t('btnNovoProjeto')}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ProjetoMini nome={t('proj1Nome')} cat={t('catPessoal')}  pct={0}  counts={[3, 0, 0, 0]} on={prog} />
            <ProjetoMini nome={t('proj2Nome')} cat={t('catEducacao')} pct={33} counts={[2, 1, 2, 1]} on={prog} />
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CARD 2 — Divida em tarefas + prioridade (áudio → prioridade → lista)
// ---------------------------------------------------------------------------
const PRIO_COR = ['#16a34a', '#d97706', '#ef4444'];

function TarefasCard() {
  const t = useTranslations('produtividade');
  const PRIOS = (t.raw('prios') as string[]).map((l, i) => ({ l, cor: PRIO_COR[i] }));
  const { ref, inView } = useInView<HTMLDivElement>();
  const [fase, setFase] = useState<'input' | 'list'>('input');
  const [transc, setTransc] = useState('');
  const [abriu, setAbriu] = useState(false);
  const [sel, setSel] = useState(false);
  const [visivel, setVisivel] = useState(true);

  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((r) => { timers.push(setTimeout(r, ms)); });
    const T = t('tarefaTranscAnim');
    (async () => {
      while (vivo) {
        setFase('input'); setTransc(''); setAbriu(false); setSel(false); setVisivel(true);
        await espera(800); if (!vivo) return;
        for (let i = 1; i <= T.length; i++) { if (!vivo) return; setTransc(T.slice(0, i)); await espera(26); }
        await espera(700); if (!vivo) return;
        setAbriu(true); await espera(1000); if (!vivo) return;   // abre a lista de prioridade
        setSel(true);   await espera(1100); if (!vivo) return;   // seleciona "Urgente"
        setVisivel(false); await espera(340); if (!vivo) return;
        setFase('list'); setVisivel(true); await espera(4000); if (!vivo) return;
        setVisivel(false); await espera(340); if (!vivo) return;
      }
    })();
    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  return (
    <div ref={ref} className="rounded-3xl bg-white/95 backdrop-blur p-6 sm:p-8 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.35)]">
      <h3 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-zinc-900">
        {t('tarefasTituloL1')}<br className="hidden sm:block" /> {t('tarefasTituloL2')}
      </h3>
      <p className="mt-3 text-zinc-500 leading-relaxed max-w-md">
        {t('tarefasDesc')}
      </p>

      <div className={`relative mt-7 h-[290px] transition-opacity duration-300 ${visivel ? 'opacity-100' : 'opacity-0'}`}>
        {fase === 'input' && (
        <div className="absolute inset-0">
          <div className="rounded-2xl bg-zinc-50 border border-zinc-200/70 p-3.5">
            <div className="flex items-center gap-3">
              <Play size={16} style={{ color: VERDE }} fill="currentColor" />
              <Onda />
              <span className="ml-auto text-[11px] text-zinc-400">0:07</span>
            </div>
            <p className="mt-2 text-[12px] italic text-zinc-600 leading-snug min-h-[32px]">“{transc}<Caret />”</p>
          </div>

          <p className="text-[10px] font-bold tracking-wider text-zinc-400 mt-5 mb-2">{t('nivelPrioridade')}</p>
          <div className={`rounded-xl border border-zinc-200 bg-white overflow-hidden transition-all duration-300 ${abriu ? 'opacity-100 max-h-56' : 'opacity-0 max-h-0'}`}>
            {PRIOS.map((p, i) => {
              const ativo = sel && i === 2;
              return (
                <div key={p.l} className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] transition-colors"
                     style={ativo ? { background: 'rgba(239,68,68,0.08)' } : undefined}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.cor }} />
                  <span className={ativo ? 'font-bold' : 'text-zinc-600'} style={ativo ? { color: p.cor } : undefined}>{p.l}</span>
                  {ativo && <Check size={14} strokeWidth={3} className="ml-auto" style={{ color: p.cor }} />}
                </div>
              );
            })}
          </div>
        </div>
        )}
        {fase === 'list' && (
        <div className="absolute inset-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">{t('pendente')}</p>
          <div className="rounded-xl border border-zinc-200 bg-white p-3.5 animate-[slide-up_450ms_ease-out_both]">
            <div className="flex items-start gap-2.5">
              <span className="w-4 h-4 rounded-full border-2 border-zinc-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[13px] text-zinc-900">{t('tarefaConclusao')}</p>
                <p className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {t('data30nov')}</span>
                  <span className="flex items-center gap-1 font-semibold" style={{ color: '#ef4444' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#ef4444' }} /> {t('urgente')}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-2 text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-zinc-400"><Pencil size={11} /> {t('editar')}</span>
              <span className="flex items-center gap-1 text-red-500"><Trash2 size={11} /> {t('excluir')}</span>
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-wider mt-4 mb-2" style={{ color: VERDE }}>{t('concluidas')}</p>
          <div className="rounded-xl border-l-4 border border-zinc-200 bg-white p-3.5 animate-[slide-up_500ms_ease-out_both]" style={{ borderLeftColor: VERDE_CLARO, animationDelay: '120ms' }}>
            <div className="flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full grid place-items-center flex-shrink-0" style={{ background: VERDE_CLARO }}>
                <Check size={11} strokeWidth={3} className="text-white" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-zinc-400 line-through">{t('tarefaPesquisar')}</p>
                <p className="text-[11px] text-zinc-300 flex items-center gap-1 mt-0.5"><Calendar size={11} /> {t('semPrazo')}</p>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3 cards menores (adaptados: lembrete · anotar por áudio · consultar)
// ---------------------------------------------------------------------------
function MiniCard({ titulo, desc, children }: { titulo: string; desc: string; children: (on: boolean) => React.ReactNode }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!inView) return;
    let vivo = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const espera = (ms: number) => new Promise<void>((r) => { timers.push(setTimeout(r, ms)); });
    (async () => {
      while (vivo) {
        setOn(false); await espera(900); if (!vivo) return;
        setOn(true);  await espera(3200); if (!vivo) return;
      }
    })();
    return () => { vivo = false; timers.forEach(clearTimeout); };
  }, [inView]);

  return (
    <div ref={ref} className="rounded-3xl bg-white/95 backdrop-blur p-6 shadow-[0_20px_60px_-25px_rgba(0,0,0,0.35)] flex flex-col">
      <h3 className="text-xl font-bold leading-tight tracking-tight text-zinc-900">{titulo}</h3>
      <p className="mt-2.5 text-[14px] text-zinc-500 leading-relaxed">{desc}</p>
      <div className="relative mt-6 h-[150px]">{children(on)}</div>
    </div>
  );
}

function Selo({ on }: { on: boolean }) {
  return (
    <span className={`absolute -right-1 top-8 w-8 h-8 rounded-full grid place-items-center text-white shadow-lg transition-all duration-500 ${on ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
          style={{ background: `linear-gradient(135deg, ${VERDE_CLARO}, ${VERDE})` }}>
      <Sparkles size={15} />
    </span>
  );
}

function Resultado({ on, icon, label, atraso = 0 }: { on: boolean; icon: React.ReactNode; label: string; atraso?: number }) {
  return (
    <div className={`absolute left-6 bottom-0 right-2 rounded-xl bg-white border border-zinc-100 shadow-lg p-3 transition-all duration-500 ${on ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
         style={{ transitionDelay: `${atraso}ms` }}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider" style={{ color: VERDE }}>{icon} {label}</p>
      <div className="mt-2 space-y-1.5">
        <span className="block h-1.5 rounded-full bg-zinc-100 w-3/4" />
        <span className="block h-1.5 rounded-full bg-zinc-100 w-1/2" />
      </div>
    </div>
  );
}

export default function ProdutividadeShowcase({ onLight = false }: { onLight?: boolean }) {
  const t = useTranslations('produtividade');
  return (
    <section className={`relative overflow-hidden py-20 lg:py-28 ${onLight ? 'border-t border-zinc-200/50 dark:border-white/[0.04]' : ''}`}
             style={onLight ? undefined : { background: 'linear-gradient(165deg, #0b3d22 0%, #14713f 45%, #2aa15c 100%)' }}>
      {!onLight && (
        <div aria-hidden className="absolute inset-0 pointer-events-none opacity-40"
             style={{ background: 'radial-gradient(ellipse at top, rgba(255,255,255,0.18) 0%, transparent 55%)' }} />
      )}

      <div className="relative max-w-6xl mx-auto px-5 sm:px-8">
        {/* HEADER */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-bold shadow-sm"
                style={onLight ? { background: `linear-gradient(135deg, ${VERDE_CLARO}, ${VERDE})`, color: '#fff' } : { background: '#fff', color: VERDE }}>
            <Zap size={15} fill="currentColor" /> {t('badge')}
          </span>
          <h2 className={`mt-6 text-3xl sm:text-5xl font-bold leading-[1.08] tracking-tight ${onLight ? 'text-zinc-900 dark:text-white' : 'text-white'}`}>
            {t('tituloL1')}<br className="hidden sm:block" /> {t('tituloL2')}
          </h2>
          <p className={`mt-5 text-base sm:text-lg leading-relaxed ${onLight ? 'text-zinc-500 dark:text-white/60' : 'text-white/75'}`}>
            {t('subtitulo')}
          </p>
        </div>

        {/* 2 CARDS GRANDES — primeiro maior (layout assimétrico ~1.8:1) */}
        <div className="mt-14 grid lg:grid-cols-[1.8fr_1fr] gap-6 items-stretch">
          <ProjetosCard />
          <TarefasCard />
        </div>

        {/* 3 CARDS MENORES */}
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <MiniCard
            titulo={t('mini1Titulo')}
            desc={t('mini1Desc')}
          >
            {(on) => (
              <>
                <div className="absolute left-0 top-0 w-[62%] rounded-xl bg-white border border-zinc-100 shadow-md p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider text-zinc-400"><Bell size={12} /> {t('lblLembrete')}</p>
                  <p className="mt-2 text-[12px] font-semibold text-zinc-800">{t('lembreteRemedio')}</p>
                  <p className="text-[10px] text-zinc-400">{t('lembreteHora')}</p>
                </div>
                <Selo on={on} />
                <Resultado on={on} icon={<MessageCircle size={11} />} label={t('enviadoWhatsApp')} />
              </>
            )}
          </MiniCard>

          <MiniCard
            titulo={t('mini2Titulo')}
            desc={t('mini2Desc')}
          >
            {(on) => (
              <>
                <div className="absolute left-0 top-0 w-[68%] rounded-xl bg-white border border-zinc-100 shadow-md p-3">
                  <div className="flex items-center gap-2">
                    <Play size={13} style={{ color: VERDE }} fill="currentColor" />
                    <Onda />
                    <span className="ml-auto text-[10px] text-zinc-400">0:05</span>
                  </div>
                  <p className="mt-2 text-[10px] italic text-zinc-500 leading-snug">“{t('audioTarefa')}”</p>
                </div>
                <Selo on={on} />
                <Resultado on={on} icon={<ListTodo size={11} />} label={t('tarefaCriada')} />
              </>
            )}
          </MiniCard>

          <MiniCard
            titulo={t('mini3Titulo')}
            desc={t('mini3Desc')}
          >
            {(on) => (
              <>
                <div className="absolute left-0 top-0 w-[70%] rounded-xl bg-white border border-zinc-100 shadow-md p-3">
                  <div className="flex items-center gap-2">
                    <Play size={13} style={{ color: VERDE }} fill="currentColor" />
                    <Onda />
                    <span className="ml-auto text-[10px] text-zinc-400">0:12</span>
                  </div>
                  <p className="mt-2 text-[10px] italic text-zinc-500 leading-snug">“{t('audioNota')}”</p>
                </div>
                <Selo on={on} />
                <Resultado on={on} icon={<FileText size={11} />} label={t('notaSalva')} />
              </>
            )}
          </MiniCard>
        </div>
      </div>
    </section>
  );
}
