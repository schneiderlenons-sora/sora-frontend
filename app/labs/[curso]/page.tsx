'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Leitor de curso do Sora Labs.
//
// Uma aula por vez, com navegação anterior/próxima — e não a apostila inteira
// numa página: o curso tem ~65 min de leitura e a rolagem infinita faz a pessoa
// desistir antes da aula 2. Uma aula por tela dá o "terminei isto" que sustenta
// o hábito.
//
// O progresso vive em localStorage (lib/labs-progresso). ⚠️ Ele só é lido
// DEPOIS da montagem (`useEffect`), nunca no `useState` inicial: no SSR não
// existe `window`, e ler ali daria hydration mismatch — a primeira pintura do
// servidor sairia sem progresso e a do cliente com, e o React reclama.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { TODOS_CURSOS } from '@/lib/labs-cursos';
import { conteudoDoCurso, type Aula, type Bloco } from '@/lib/labs-conteudo';
import { aulasLidas, alternarAula, missoesFeitas, alternarMissao } from '@/lib/labs-progresso';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Circle, Clock,
  Copy, Lightbulb, AlertTriangle, Target, MessageCircle, List,
} from 'lucide-react';

export default function CursoPage() {
  const params = useParams();
  const router = useRouter();
  const { perfil } = useAuth();
  const userId = perfil?.id || null;

  const cursoId = String(params?.curso || '');
  const curso = TODOS_CURSOS.find((c) => c.id === cursoId);
  const conteudo = conteudoDoCurso(cursoId);

  const [indice, setIndice]   = useState(0);
  const [lidas, setLidas]     = useState<string[]>([]);
  const [missoes, setMissoes] = useState<number[]>([]);
  const [sumario, setSumario] = useState(false);
  const [copiado, setCopiado] = useState<string>('');

  // Progresso só depois da montagem — ver nota de hydration no topo.
  useEffect(() => {
    if (!cursoId) return;
    setLidas(aulasLidas(userId, cursoId));
    setMissoes(missoesFeitas(userId, cursoId));
  }, [userId, cursoId]);

  const aula: Aula | undefined = conteudo?.aulas[indice];
  const total = conteudo?.aulas.length || 0;
  const pct = total ? Math.round((lidas.length / total) * 100) : 0;

  // Ao trocar de aula, volta ao topo — senão a pessoa cai no meio do texto novo.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [indice]);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado(''), 1800);
    } catch { /* clipboard bloqueado */ }
  };

  if (!curso || !conteudo || !aula) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto py-20 text-center space-y-4">
          <BookOpen size={40} className="mx-auto text-muted-foreground" />
          <p className="text-lg font-bold text-foreground">Curso não encontrado</p>
          <p className="text-sm text-muted-foreground">
            Este conteúdo ainda está em produção ou o link mudou.
          </p>
          <Link href="/labs" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'hsl(var(--primary))' }}>
            <ArrowLeft size={15} /> Voltar ao Labs
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const lida = lidas.includes(aula.id);
  const ultima = indice === total - 1;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto pb-28">

        {/* ── Cabeçalho fixo: onde estou + quanto falta ─────────────── */}
        <div className="sticky top-0 z-20 -mx-4 px-4 pt-3 pb-3 bg-background/85 backdrop-blur-xl border-b border-border/60">
          <div className="flex items-center gap-3">
            <Link href="/labs" aria-label="Voltar ao Sora Labs"
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-border bg-card hover:bg-muted transition-colors flex-shrink-0">
              <ArrowLeft size={16} className="text-foreground" />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-muted-foreground truncate">{curso.titulo}</p>
              {/* Barra + número: a barra sozinha não diz "3 de 9". */}
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1.5 rounded-full bg-muted flex-1 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                       style={{ width: `${pct}%`, background: curso.cor }} />
                </div>
                <span className="text-[11px] font-bold tabular-nums text-muted-foreground flex-shrink-0">
                  {lidas.length}/{total}
                </span>
              </div>
            </div>
            <button onClick={() => setSumario((v) => !v)} aria-expanded={sumario}
                    aria-label="Sumário do curso"
                    className="w-9 h-9 rounded-xl flex items-center justify-center border border-border bg-card hover:bg-muted transition-colors flex-shrink-0">
              <List size={16} className="text-foreground" />
            </button>
          </div>

          {/* Sumário — troca de aula sem passar por todas */}
          {sumario && (
            <div className="mt-3 rounded-2xl border border-border bg-card p-2 space-y-0.5 max-h-[60vh] overflow-y-auto">
              {conteudo.aulas.map((a, i) => {
                const ok = lidas.includes(a.id);
                return (
                  <button key={a.id} onClick={() => { setIndice(i); setSumario(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                            i === indice ? 'bg-muted' : 'hover:bg-muted/60'}`}>
                    {ok
                      ? <CheckCircle2 size={16} style={{ color: curso.cor }} className="flex-shrink-0" />
                      : <Circle size={16} className="text-muted-foreground flex-shrink-0" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {a.modulo}
                      </span>
                      <span className={`block text-sm truncate ${i === indice ? 'font-bold text-foreground' : 'text-foreground/80'}`}>
                        {a.titulo}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">{a.minutos}min</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Intro (só na primeira aula) ───────────────────────────── */}
        {indice === 0 && (
          <div className="mt-6 rounded-2xl p-5 border" style={{
            borderColor: `color-mix(in srgb, ${curso.cor} 35%, transparent)`,
            background: `color-mix(in srgb, ${curso.cor} 7%, transparent)`,
          }}>
            <p className="text-sm text-foreground/90 leading-relaxed">{conteudo.intro}</p>
          </div>
        )}

        {/* ── Aula ─────────────────────────────────────────────────── */}
        <article className="mt-6">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: curso.cor }}>
            {aula.modulo} · Aula {aula.numero}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-tight">
            {aula.titulo}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{aula.objetivo}</p>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground mt-3">
            <Clock size={12} /> {aula.minutos} min de leitura
          </p>

          <div className="mt-7 space-y-4">
            {aula.blocos.map((b, i) => (
              <BlocoView key={i} bloco={b} cor={curso.cor}
                         missoes={missoes} copiado={copiado} onCopiar={copiar}
                         onMissao={(dia) => setMissoes(alternarMissao(userId, cursoId, dia))} />
            ))}
          </div>
        </article>

        {/* ── Marcar como lida ─────────────────────────────────────── */}
        <button
          onClick={() => setLidas(alternarAula(userId, cursoId, aula.id))}
          aria-pressed={lida}
          className={`mt-8 w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.99] ${
            lida ? 'border border-border bg-card text-foreground' : 'text-white'}`}
          style={lida ? undefined : { background: curso.cor }}
        >
          {lida ? <><CheckCircle2 size={17} style={{ color: curso.cor }} /> Aula concluída</>
                : <><Check size={17} /> Marcar aula como concluída</>}
        </button>

        {/* ── Navegação ────────────────────────────────────────────── */}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => setIndice((i) => Math.max(0, i - 1))} disabled={indice === 0}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-border transition-colors ${
                    indice === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-card hover:bg-muted'}`}>
            <ArrowLeft size={15} /> Anterior
          </button>
          {ultima ? (
            <button onClick={() => router.push('/labs')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted transition-colors">
              Concluir <Check size={15} />
            </button>
          ) : (
            <button onClick={() => setIndice((i) => Math.min(total - 1, i + 1))}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border border-border bg-card hover:bg-muted transition-colors">
              Próxima <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Blocos ──────────────────────────────────────────────────────────────────

/** Estilos das caixas de destaque. Ícone + título carregam o sentido — a cor
 *  sozinha nunca distingue nada (acessibilidade). */
const CAIXAS = {
  dica:    { Icon: Lightbulb,     cor: '#0ea5e9' },
  atencao: { Icon: AlertTriangle, cor: '#f59e0b' },
  tarefa:  { Icon: Target,        cor: '#61ce70' },
} as const;

function BlocoView({ bloco, cor, missoes, copiado, onCopiar, onMissao }: {
  bloco: Bloco; cor: string; missoes: number[]; copiado: string;
  onCopiar: (t: string) => void; onMissao: (dia: number) => void;
}) {
  switch (bloco.tipo) {
    case 'h':
      return <h2 className="text-lg font-bold text-foreground pt-3 tracking-tight">{bloco.texto}</h2>;

    case 'p':
      return <p className="text-[15px] leading-[1.75] text-foreground/85">{bloco.texto}</p>;

    case 'lista':
      return (
        <ul className="space-y-2.5">
          {bloco.itens.map((t, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-[1.7] text-foreground/85">
              <span className="mt-2 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cor }} />
              <span className="min-w-0">{t}</span>
            </li>
          ))}
        </ul>
      );

    case 'passos':
      return (
        <ol className="space-y-3">
          {bloco.itens.map((t, i) => (
            <li key={i} className="flex gap-3 text-[15px] leading-[1.7] text-foreground/85">
              <span className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-bold tabular-nums"
                    style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)`, color: cor }}>
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5">{t}</span>
            </li>
          ))}
        </ol>
      );

    case 'comando':
      // Toque copia — o comando existe pra ser colado no WhatsApp, e obrigar a
      // pessoa a digitar à mão é onde ela desiste de testar.
      return (
        <div>
          <button onClick={() => onCopiar(bloco.texto)}
                  aria-label={`Copiar comando: ${bloco.texto}`}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border bg-muted/40 hover:bg-muted transition-colors text-left active:scale-[0.99]">
            <MessageCircle size={15} className="flex-shrink-0" style={{ color: cor }} />
            <code className="flex-1 min-w-0 text-[13px] font-mono text-foreground break-words">{bloco.texto}</code>
            {copiado === bloco.texto
              ? <Check size={15} className="flex-shrink-0" style={{ color: cor }} />
              : <Copy size={15} className="text-muted-foreground flex-shrink-0" />}
          </button>
          {bloco.nota && <p className="text-xs text-muted-foreground mt-1.5 px-1 leading-relaxed">{bloco.nota}</p>}
        </div>
      );

    case 'script':
      return (
        <div className="rounded-2xl border border-dashed border-border p-4">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{bloco.titulo}</p>
            <button onClick={() => onCopiar(bloco.texto)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              {copiado === bloco.texto ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
            </button>
          </div>
          <p className="text-[15px] leading-[1.7] text-foreground/90 italic">“{bloco.texto}”</p>
        </div>
      );

    case 'caixa': {
      const { Icon, cor: c } = CAIXAS[bloco.variante || 'dica'];
      return (
        <div className="rounded-2xl p-4 border" style={{
          borderColor: `color-mix(in srgb, ${c} 35%, transparent)`,
          background: `color-mix(in srgb, ${c} 8%, transparent)`,
        }}>
          <div className="flex items-start gap-3">
            <Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: c }} />
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground mb-1">{bloco.titulo}</p>
              <p className="text-[14px] leading-relaxed text-foreground/80">{bloco.texto}</p>
            </div>
          </div>
        </div>
      );
    }

    case 'missoes':
      return (
        <div className="space-y-2">
          {bloco.itens.map((m) => {
            const ok = missoes.includes(m.dia);
            return (
              <button key={m.dia} onClick={() => onMissao(m.dia)} aria-pressed={ok}
                      className="w-full flex items-start gap-3 px-3.5 py-3 rounded-xl border border-border bg-card hover:bg-muted/60 transition-colors text-left active:scale-[0.99]">
                {ok
                  ? <CheckCircle2 size={17} className="flex-shrink-0 mt-0.5" style={{ color: cor }} />
                  : <Circle size={17} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Dia {m.dia}
                  </span>
                  <span className={`block text-[14px] leading-snug ${ok ? 'text-muted-foreground line-through' : 'text-foreground/85'}`}>
                    {m.texto}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      );

    default:
      return null;
  }
}
