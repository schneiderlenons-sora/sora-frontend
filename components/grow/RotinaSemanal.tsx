'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Planejamento Semanal (rotina) — card da aba Hábitos.
// Sem check-in: é organização/visualização da rotina.
//
// Dois tipos de bloco:
//   • TEMPLATE (data_especifica null) → a rotina que se repete toda semana.
//   • PONTUAL  (data_especifica set)  → veio da Agenda, vale só naquele dia.
//     Vem marcado com selo pra não se confundir com a rotina fixa.
//
// Responsivo: a grade de 7 colunas não cabe no mobile, então lá vira seletor de
// dia + timeline vertical (sem scroll horizontal).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  CalendarClock, Plus, X, Loader2, Trash2, CalendarDays, Sparkles, Clock,
} from 'lucide-react';

// Cor da APARÊNCIA do painel (verde da Sora por padrão; muda com o tema escolhido).
// Não pode ser hex fixo: `--primary` é o que segue o tema.
const BRAND = 'hsl(var(--primary))';
// Alpha via color-mix — brandA(12) (hex+alpha) não funciona com hsl(var(...)).
const brandA = (pct: number) => `color-mix(in srgb, ${BRAND} ${pct}%, transparent)`;

const DIAS = [
  { n: 1, curto: 'Seg', longo: 'Segunda' },
  { n: 2, curto: 'Ter', longo: 'Terça' },
  { n: 3, curto: 'Qua', longo: 'Quarta' },
  { n: 4, curto: 'Qui', longo: 'Quinta' },
  { n: 5, curto: 'Sex', longo: 'Sexta' },
  { n: 6, curto: 'Sáb', longo: 'Sábado' },
  { n: 7, curto: 'Dom', longo: 'Domingo' },
];

export type Bloco = {
  id: string;
  dia_semana: number;
  hora: string;
  titulo: string;
  cor?: string | null;
  data_especifica?: string | null;
  compromisso_id?: string | null;
};

const isoLocal = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

// Segunda-feira da semana de `base` (semana começa na segunda).
function segundaDa(base: Date) {
  const d = new Date(base);
  const js = d.getDay();               // 0=dom
  const delta = js === 0 ? -6 : 1 - js;
  d.setDate(d.getDate() + delta);
  d.setHours(0, 0, 0, 0);
  return d;
}

const diaSemanaBR = (d: Date) => { const j = d.getDay(); return j === 0 ? 7 : j; };
const hhmm = (h: string) => (h || '').slice(0, 5);

interface Props {
  phone?: string;
  /** Visão = só leitura. Semana = editável. */
  readOnly?: boolean;
}

export default function RotinaSemanal({ phone, readOnly = false }: Props) {
  const [blocos, setBlocos]   = useState<Bloco[]>([]);
  const [carregando, setCarr] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [salvando, setSalv]   = useState(false);
  const [removendo, setRem]   = useState<string | null>(null);
  const [erro, setErro]       = useState('');

  // Dia selecionado no mobile (default: hoje).
  const [diaSel, setDiaSel] = useState<number>(() => diaSemanaBR(new Date()));

  // Semana atual (pra trazer os blocos pontuais da Agenda).
  const semana = useMemo(() => {
    const seg = segundaDa(new Date());
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(seg); d.setDate(seg.getDate() + i); return d;
    });
    return { de: isoLocal(dias[0]), ate: isoLocal(dias[6]), dias };
  }, []);

  const carregar = useCallback(async () => {
    if (!phone) { setCarr(false); return; }
    try {
      const r = await api.grow.rotina.listar(phone, { de: semana.de, ate: semana.ate });
      setBlocos(Array.isArray(r) ? r : []);
    } catch { setBlocos([]); }
    finally { setCarr(false); }
  }, [phone, semana.de, semana.ate]);

  useEffect(() => { carregar(); }, [carregar]);

  // Só as horas EM USO — a grade acompanha a rotina em vez de mostrar 24 linhas.
  const horas = useMemo(
    () => [...new Set(blocos.map(b => hhmm(b.hora)))].sort(),
    [blocos]
  );

  const porCelula = useMemo(() => {
    const m = new Map<string, Bloco[]>();
    for (const b of blocos) {
      const k = `${b.dia_semana}|${hhmm(b.hora)}`;
      m.set(k, [...(m.get(k) || []), b]);
    }
    return m;
  }, [blocos]);

  const totalTemplate = blocos.filter(b => !b.data_especifica).length;
  const totalPontual  = blocos.filter(b => b.data_especifica).length;

  async function criar(dia: number, hora: string, titulo: string) {
    if (!phone) return;
    setSalv(true); setErro('');
    try {
      // Sem cor: o bloco segue a APARÊNCIA do painel. Gravar cor aqui congelaria
      // o tema do momento da criação.
      await api.grow.rotina.criar({ phone, dia_semana: dia, hora, titulo, cor: null });
      setAddOpen(false);
      await carregar();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar. Tente de novo.');
    } finally { setSalv(false); }
  }

  async function remover(id: string) {
    if (!phone) return;
    setRem(id);
    const backup = blocos;
    setBlocos(prev => prev.filter(b => b.id !== id)); // otimista
    try { await api.grow.rotina.deletar(id, phone); }
    catch { setBlocos(backup); }
    finally { setRem(null); }
  }

  const vazio = !carregando && blocos.length === 0;

  return (
    <section
      className="relative rounded-3xl border overflow-hidden animate-[slide-up_500ms_ease-out_both]"
      style={{ border: `1px solid hsl(var(--border) / 0.4)`, background: 'hsl(var(--bg-card) / 0.5)' }}
      aria-label="Planejamento semanal"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{ background: `radial-gradient(circle at top right, ${brandA(14)} 0%, transparent 70%)` }} />

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between gap-3 p-5 border-b" style={{ borderColor: 'hsl(var(--border) / 0.4)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
               style={{ background: brandA(12) }}>
            <CalendarClock size={18} style={{ color: BRAND }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground leading-tight">Planejamento semanal</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {carregando ? 'Carregando…'
                : vazio ? 'Monte a rotina que se repete toda semana'
                : <>
                    <span className="tabular-nums font-medium text-foreground/80">{totalTemplate}</span> bloco{totalTemplate === 1 ? '' : 's'} fixo{totalTemplate === 1 ? '' : 's'}
                    {totalPontual > 0 && <> · <span className="tabular-nums font-medium text-foreground/80">{totalPontual}</span> da agenda esta semana</>}
                  </>}
            </p>
          </div>
        </div>

        {!readOnly && (
          <button
            onClick={() => { setAddOpen(v => !v); setErro(''); }}
            aria-expanded={addOpen}
            className="flex items-center gap-1.5 px-3 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 flex-shrink-0"
            style={{ minHeight: 44, background: addOpen ? 'hsl(var(--bg-muted))' : brandA(12), color: addOpen ? undefined : BRAND }}
          >
            {addOpen ? <X size={16} /> : <Plus size={16} />}
            <span className="hidden sm:inline">{addOpen ? 'Fechar' : 'Adicionar'}</span>
          </button>
        )}
      </div>

      {/* ── Form de adicionar ───────────────────────────────── */}
      {!readOnly && addOpen && (
        <AddForm diaInicial={diaSel} salvando={salvando} erro={erro} onCancel={() => setAddOpen(false)} onSalvar={criar} />
      )}

      {/* ── Conteúdo ────────────────────────────────────────── */}
      {carregando ? (
        <div className="relative flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : vazio ? (
        <div className="relative flex flex-col items-center justify-center text-center gap-2 px-6 py-12">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--bg-muted))' }}>
            <CalendarDays size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Sua rotina ainda está em branco</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            {readOnly
              ? 'Monte seu planejamento na aba Semana — ele se repete todas as semanas.'
              : 'Adicione blocos por horário (acordar, academia, trabalho…). Você monta uma vez e vale todas as semanas.'}
          </p>
          {!readOnly && !addOpen && (
            <button onClick={() => setAddOpen(true)}
              className="mt-1 flex items-center gap-1.5 px-3 rounded-xl text-sm font-semibold"
              style={{ minHeight: 44, background: brandA(12), color: BRAND }}>
              <Plus size={16} /> Montar rotina
            </button>
          )}
        </div>
      ) : (
        <>
          {/* ══ DESKTOP: grade completa ══ */}
          <div className="relative hidden lg:block p-4">
            <div className="grid gap-1" style={{ gridTemplateColumns: `4.5rem repeat(7, minmax(0, 1fr))` }}>
              {/* cabeçalho */}
              <div />
              {DIAS.map((d, i) => {
                const ehHoje = d.n === diaSemanaBR(new Date());
                return (
                  <div key={d.n} className="px-2 py-2 text-center rounded-lg"
                       style={{ background: ehHoje ? brandA(10) : undefined }}>
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${ehHoje ? '' : 'text-muted-foreground'}`}
                       style={{ color: ehHoje ? BRAND : undefined }}>{d.curto}</p>
                    <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {semana.dias[i].getDate()}
                    </p>
                  </div>
                );
              })}

              {/* linhas por hora */}
              {horas.map((h, hi) => (
                <FragmentLinha
                  key={h} hora={h} idx={hi} porCelula={porCelula}
                  readOnly={readOnly} removendo={removendo} onRemover={remover}
                />
              ))}
            </div>
          </div>

          {/* ══ MOBILE: seletor de dia + timeline vertical ══ */}
          <div className="relative lg:hidden">
            {/* Tabs de dia (scroll só aqui, não na grade) */}
            <div className="flex gap-1.5 px-4 pt-4 pb-3 overflow-x-auto" role="tablist" aria-label="Dia da semana">
              {DIAS.map(d => {
                const ativo = d.n === diaSel;
                const qtd = blocos.filter(b => b.dia_semana === d.n).length;
                return (
                  <button
                    key={d.n} role="tab" aria-selected={ativo}
                    onClick={() => setDiaSel(d.n)}
                    className="flex flex-col items-center justify-center px-3 rounded-xl text-xs font-bold transition-all flex-shrink-0"
                    style={{
                      minHeight: 44, minWidth: 48,
                      background: ativo ? BRAND : 'hsl(var(--bg-muted))',
                      color: ativo ? '#fff' : undefined,
                    }}
                  >
                    {d.curto}
                    <span className={`text-[10px] tabular-nums font-medium ${ativo ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {qtd || '–'}
                    </span>
                  </button>
                );
              })}
            </div>

            <TimelineDia
              dia={diaSel} blocos={blocos.filter(b => b.dia_semana === diaSel)}
              readOnly={readOnly} removendo={removendo} onRemover={remover}
            />
          </div>
        </>
      )}

      {/* Legenda: só quando há bloco da agenda (senão é ruído) */}
      {!vazio && totalPontual > 0 && (
        <p className="relative flex items-center gap-1.5 px-5 pb-4 text-[11px] text-muted-foreground">
          <Sparkles size={11} style={{ color: BRAND }} />
          Blocos com selo vieram da sua agenda e valem só nesta semana.
        </p>
      )}
    </section>
  );
}

// ─── Linha de uma hora na grade (desktop) ──────────────────────────
function FragmentLinha({ hora, idx, porCelula, readOnly, removendo, onRemover }: any) {
  return (
    <>
      <div className="flex items-start justify-end pr-2 pt-2">
        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">{hora}</span>
      </div>
      {DIAS.map(d => {
        const itens: Bloco[] = porCelula.get(`${d.n}|${hora}`) || [];
        return (
          <div key={d.n}
               className="min-h-[46px] rounded-lg p-1 space-y-1 animate-[slide-up_400ms_ease-out_both]"
               style={{ background: 'hsl(var(--bg-muted) / 0.35)', animationDelay: `${Math.min(idx * 40, 240)}ms` }}>
            {itens.map(b => (
              <BlocoChip key={b.id} b={b} readOnly={readOnly} removendo={removendo} onRemover={onRemover} />
            ))}
          </div>
        );
      })}
    </>
  );
}

// ─── Timeline de um dia (mobile) ───────────────────────────────────
function TimelineDia({ dia, blocos, readOnly, removendo, onRemover }: any) {
  const ordenados = [...blocos].sort((a: Bloco, b: Bloco) => hhmm(a.hora).localeCompare(hhmm(b.hora)));
  if (!ordenados.length) {
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
        <Clock size={18} className="text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nada em {DIAS.find(d => d.n === dia)?.longo} ainda.
        </p>
      </div>
    );
  }
  return (
    <ul className="px-4 pb-4 space-y-1.5">
      {ordenados.map((b: Bloco, i: number) => (
        <li key={b.id}
            className="flex items-center gap-3 animate-[slide-up_400ms_ease-out_both]"
            style={{ animationDelay: `${Math.min(i * 40, 240)}ms` }}>
          <span className="text-[11px] font-bold text-muted-foreground tabular-nums w-11 flex-shrink-0">
            {hhmm(b.hora)}
          </span>
          <div className="flex-1 min-w-0">
            <BlocoChip b={b} readOnly={readOnly} removendo={removendo} onRemover={onRemover} grande />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ─── Chip de um bloco ──────────────────────────────────────────────
function BlocoChip({ b, readOnly, removendo, onRemover, grande = false }: any) {
  const pontual = !!b.data_especifica;
  const saindo = removendo === b.id;
  return (
    <div
      className={`group relative flex items-center gap-1 rounded-lg ${grande ? 'px-3 py-2.5' : 'px-1.5 py-1'} transition-opacity`}
      style={{
        background: pontual ? brandA(12) : 'hsl(var(--bg-card) / 0.9)',
        border: `1px solid ${pontual ? brandA(45) : 'hsl(var(--border) / 0.5)'}`,
        opacity: saindo ? 0.4 : 1,
      }}
    >
      {/* Selo do bloco vindo da agenda — ícone + borda, não só cor (a11y) */}
      {pontual && <Sparkles size={grande ? 13 : 10} className="flex-shrink-0" style={{ color: BRAND }} aria-label="Da agenda, só nesta semana" />}
      <span className={`${grande ? 'text-sm' : 'text-[11px]'} font-medium text-foreground leading-tight truncate flex-1`}>
        {b.titulo}
      </span>
      {!readOnly && (
        <button
          onClick={() => onRemover(b.id)}
          disabled={saindo}
          aria-label={`Remover ${b.titulo}`}
          className={`flex items-center justify-center rounded text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0
                      ${grande ? 'w-9 h-9' : 'w-5 h-5 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100'}`}
        >
          {saindo ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={grande ? 15 : 11} />}
        </button>
      )}
    </div>
  );
}

// ─── Form de adicionar bloco ───────────────────────────────────────
function AddForm({ diaInicial, salvando, erro, onCancel, onSalvar }: any) {
  const [dia, setDia]       = useState<number>(diaInicial || 1);
  const [hora, setHora]     = useState('07:00');
  const [titulo, setTitulo] = useState('');
  const valido = !!titulo.trim() && /^\d{2}:\d{2}$/.test(hora);

  return (
    <div className="relative p-4 sm:p-5 border-b animate-fade-in"
         style={{ borderColor: 'hsl(var(--border) / 0.4)', background: 'hsl(var(--bg-muted) / 0.2)' }}>
      {/* Dia */}
      <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Dia da semana">
        {DIAS.map(d => {
          const ativo = d.n === dia;
          return (
            <button key={d.n} type="button" onClick={() => setDia(d.n)}
              aria-pressed={ativo}
              className="px-3 rounded-lg text-xs font-bold transition-all"
              style={{ minHeight: 44, background: ativo ? BRAND : 'hsl(var(--bg-muted))', color: ativo ? '#fff' : undefined }}>
              {d.curto}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-2.5">
        <div>
          <label htmlFor="rot-hora" className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Horário
          </label>
          <input id="rot-hora" type="time" value={hora} onChange={e => setHora(e.target.value)}
            className="w-full px-3 rounded-xl bg-background border border-border text-sm tabular-nums focus:outline-none focus:border-primary"
            style={{ height: 44 }} />
        </div>
        <div>
          <label htmlFor="rot-tit" className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
            O que você faz
          </label>
          <input id="rot-tit" value={titulo} onChange={e => setTitulo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && valido && !salvando && onSalvar(dia, hora, titulo.trim())}
            placeholder="Ex.: Acordar, Academia, Trabalho…" maxLength={60} autoFocus
            className="w-full px-3 rounded-xl bg-background border border-border text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
            style={{ height: 44 }} />
        </div>
      </div>

      {erro && <p className="text-xs text-red-500 mt-2" role="alert">{erro}</p>}

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => onSalvar(dia, hora, titulo.trim())} disabled={!valido || salvando}
          className="flex items-center gap-1.5 px-4 rounded-xl text-sm font-bold text-white transition-all
                     hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-40 disabled:translate-y-0"
          style={{ minHeight: 44, background: BRAND }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          Adicionar
        </button>
        <button onClick={onCancel}
          className="px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground"
          style={{ minHeight: 44 }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
