'use client';

// Aba "Aniversários" da Agenda + o formulário. Pedido de cliente (Tatiane,
// nov/2026): datas que se repetem todo ano, com lembrete uma semana antes (dá
// tempo do presente) e no dia. A regra mora no backend
// (services/aniversarios.js); as contas da tela em lib/aniversarios.ts
// (eval:aniversarios compara as duas).
//
// ⚠️ Formulário em portal: a Agenda tem cards com backdrop-blur, que prendem
// um `fixed` (CLAUDE.md, "Modal/overlay"). Apagar pede confirmação NA TELA
// (o confirm() do navegador some no WhatsApp).

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Cake, Plus, X, Loader2, Check, Bell, BellOff, ChevronRight, Trash2, AlertCircle, Gift } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import {
  type Aniversario, type TipoData, TIPOS_DATA, MESES_NOME, maxDiaDoMes, ordenarPorProxima, quandoFalta, rotuloAnos,
} from '@/lib/aniversarios';

const ROSA = '#db2777';
export const chaveAniversarios = (phone: string) => `grow:aniv:${phone}`;

const isoHoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ═══════════════════════════════════════════════════════════════════
// ABA — a lista, de quem vem primeiro
// ═══════════════════════════════════════════════════════════════════
export function ViewAniversarios({ phone, onAbrir }: { phone: string; onAbrir: (a: Aniversario | null) => void }) {
  const { data, error, mutate } = useApi(chaveAniversarios(phone), () => api.grow.aniversarios.listar(phone), { portao: false });
  const hoje = isoHoje();
  const ordenados = useMemo(() => ordenarPorProxima(data?.itens ?? [], hoje), [data, hoje]);

  // Grupos por mês da PRÓXIMA data ("Dezembro", "Janeiro de 2027").
  const grupos = useMemo(() => {
    const anoAtual = hoje.slice(0, 4);
    const m = new Map<string, typeof ordenados>();
    for (const x of ordenados) {
      const mes = cap(MESES_NOME[Number(x.proxima.slice(5, 7)) - 1]);
      const rotulo = x.proxima.slice(0, 4) === anoAtual ? mes : `${mes} de ${x.proxima.slice(0, 4)}`;
      if (!m.has(rotulo)) m.set(rotulo, []);
      m.get(rotulo)!.push(x);
    }
    return [...m.entries()];
  }, [ordenados, hoje]);

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-border/40 p-6 text-center" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <AlertCircle size={22} className="mx-auto text-red-500" aria-hidden />
        <p className="mt-2 text-sm text-foreground">Não consegui carregar os aniversários agora. Eles continuam salvos.</p>
        <button onClick={() => void mutate()} className="mt-3 h-11 px-4 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted">Tentar de novo</button>
      </div>
    );
  }
  if (!data) {
    return <div className="space-y-2" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-[72px] rounded-2xl bg-muted/40 animate-pulse" />)}</div>;
  }
  if (!data.liberado) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 px-6 py-10 text-center">
        <Cake size={26} className="mx-auto" style={{ color: ROSA }} aria-hidden />
        <p className="mt-3 text-sm text-foreground font-semibold">Os aniversários estão quase prontos.</p>
        <p className="mt-1 text-xs text-muted-foreground">Falta um ajuste do nosso lado. Tente de novo mais tarde.</p>
      </div>
    );
  }

  const adicionar = (
    <button onClick={() => onAbrir(null)}
      className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-white text-sm font-bold shadow-lg active:scale-[0.98] transition-transform"
      style={{ background: ROSA, boxShadow: `0 10px 20px -10px ${ROSA}` }}>
      <Plus size={15} aria-hidden /> Adicionar data
    </button>
  );

  if (!ordenados.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border/60 px-6 py-12 text-center">
        <span className="inline-flex w-14 h-14 rounded-2xl items-center justify-center" style={{ background: `color-mix(in srgb, ${ROSA} 12%, transparent)` }}>
          <Cake size={24} style={{ color: ROSA }} aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-bold text-foreground">Nenhum aniversário ainda</h2>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Cadastre uma vez e a data se repete todo ano. A Sora te avisa no WhatsApp uma semana antes, pra dar tempo do presente, e no próprio dia.
        </p>
        <div className="mt-5">{adicionar}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
          Repetem todo ano. A Sora te avisa uma semana antes e no dia.
        </p>
        {adicionar}
      </div>
      {grupos.map(([rotulo, lista], gi) => (
        <section key={rotulo} aria-label={rotulo} className="animate-[slide-up_400ms_ease-out_both]" style={{ animationDelay: `${Math.min(gi, 6) * 40}ms` }}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <h3 className="text-sm font-bold text-foreground">{rotulo}</h3>
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{lista.length}</span>
          </div>
          <div className="space-y-2">
            {lista.map(({ a, proxima, dias }) => <LinhaAniversario key={a.id} a={a} proxima={proxima} dias={dias} onAbrir={() => onAbrir(a)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function LinhaAniversario({ a, proxima, dias, onAbrir }: { a: Aniversario; proxima: string; dias: number; onAbrir: () => void }) {
  const t = TIPOS_DATA[a.tipo] || TIPOS_DATA.aniversario;
  const anos = rotuloAnos(a, proxima);
  const ehHoje = dias === 0;
  const semana = new Date(`${proxima}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long' }).replace('-feira', '');
  return (
    <button onClick={onAbrir}
      className={`w-full text-left rounded-2xl border backdrop-blur-xl flex items-stretch overflow-hidden transition-colors hover:border-border ${ehHoje ? '' : 'border-border/40'}`}
      style={{ background: 'hsl(var(--bg-card) / 0.5)', ...(ehHoje ? { borderColor: ROSA, boxShadow: `0 0 0 1px ${ROSA}` } : {}) }}>
      <div className="flex flex-col items-center justify-center w-16 flex-shrink-0 py-3 border-r border-border/30"
           style={{ background: `color-mix(in srgb, ${ROSA} ${ehHoje ? 14 : 6}%, transparent)` }}>
        <span className="text-xl font-bold tabular-nums leading-none text-foreground">{proxima.slice(8, 10)}</span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: ROSA }}>{MESES_NOME[Number(proxima.slice(5, 7)) - 1].slice(0, 3)}</span>
      </div>
      <div className="flex-1 min-w-0 py-2.5 px-3">
        <p className="text-sm font-bold text-foreground truncate"><span aria-hidden>{t.emoji} </span>{a.nome}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground truncate">
          <span className="font-semibold" style={ehHoje ? { color: ROSA } : undefined}>{ehHoje ? 'Hoje 🎉' : quandoFalta(dias)}</span>
          {!ehHoje && <> · {semana}</>}
          {anos && <> · {anos}</>}
          {a.tipo !== 'aniversario' && <> · {t.curto}</>}
        </p>
      </div>
      <div className="flex items-center gap-1.5 pr-3 text-muted-foreground">
        {a.lembrete_semana || a.lembrete_dia
          ? <Bell size={13} aria-label="Com lembrete" />
          : <BellOff size={13} aria-label="Sem lembrete" />}
        <ChevronRight size={16} aria-hidden />
      </div>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════
// FORMULÁRIO — criar / editar / apagar
// ═══════════════════════════════════════════════════════════════════
export function ModalAniversario({ item, onFechar, onSalvo }: {
  item: Aniversario | null;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [tipo, setTipo] = useState<TipoData>(item?.tipo || 'aniversario');
  const [nome, setNome] = useState(item?.nome || '');
  const [dia, setDia] = useState<number>(item?.dia || new Date().getDate());
  const [mes, setMes] = useState<number>(item?.mes || new Date().getMonth() + 1);
  const [ano, setAno] = useState(item?.ano ? String(item.ano) : '');
  const [semana, setSemana] = useState(item ? item.lembrete_semana : true);
  const [noDia, setNoDia] = useState(item ? item.lembrete_dia : true);
  const [obs, setObs] = useState(item?.observacao || '');
  const [salvando, setSalvando] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [erro, setErro] = useState('');
  const [montado, setMontado] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMontado(true), 0); return () => clearTimeout(t); }, []);

  const maxDia = maxDiaDoMes(mes);
  const diaValido = Math.min(dia, maxDia);
  const t = TIPOS_DATA[tipo];

  function conferir(): string | null {
    if (!nome.trim()) return tipo === 'data' ? 'Dê um nome pra data.' : 'Diga de quem é.';
    if (ano) {
      const n = Number(ano);
      const anoAtual = new Date().getFullYear();
      if (!/^\d{4}$/.test(ano) || n < 1900 || n > anoAtual) return `O ano tem que ser entre 1900 e ${anoAtual}.`;
      const bis = (n % 4 === 0 && n % 100 !== 0) || n % 400 === 0;
      if (mes === 2 && diaValido === 29 && !bis) return `${n} não teve 29 de fevereiro.`;
      const data = `${ano}-${String(mes).padStart(2, '0')}-${String(diaValido).padStart(2, '0')}`;
      if (data > isoHoje()) return 'Essa data ainda não aconteceu. Deixe o ano em branco se for o caso.';
    }
    return null;
  }

  async function salvar() {
    const e = conferir();
    if (e) { setErro(e); return; }
    setErro(''); setSalvando(true);
    const body = {
      nome: nome.trim(), tipo, dia: diaValido, mes, ano: ano ? Number(ano) : null,
      lembrete_semana: semana, lembrete_dia: noDia, observacao: obs.trim() || null,
    };
    try {
      if (item) await api.grow.aniversarios.editar(item.id, body);
      else await api.grow.aniversarios.criar(body);
      onSalvo();
    } catch (er: any) { setErro(er?.message || 'Não consegui salvar.'); setSalvando(false); }
  }

  async function apagar() {
    if (!item) return;
    setSalvando(true);
    try { await api.grow.aniversarios.deletar(item.id); onSalvo(); }
    catch (er: any) { setErro(er?.message || 'Não consegui apagar.'); setSalvando(false); setConfirmarApagar(false); }
  }

  if (!montado) return null;
  const rotuloNome = tipo === 'aniversario' ? 'De quem é?' : tipo === 'casamento' ? 'De quem é? (o casal)' : 'Nome da data';
  const exemploNome = tipo === 'aniversario' ? 'Ex.: Ana, Mãe, Seu João' : tipo === 'casamento' ? 'Ex.: Ana e João' : 'Ex.: Formatura, Dia que adotei o Thor';
  const anoRotulo = tipo === 'aniversario' ? 'Ano de nascimento' : tipo === 'casamento' ? 'Ano do casamento' : 'Ano';

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4" onClick={onFechar}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label={item ? 'Editar data' : 'Nova data'}
           className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl border border-border animate-fade-in max-h-[90vh] overflow-y-auto"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground inline-flex items-center gap-2">
            <span aria-hidden>{t.emoji}</span> {item ? 'Editar data' : 'Nova data'}
          </h2>
          <button onClick={onFechar} aria-label="Fechar" className="w-11 h-11 -mr-2 rounded-xl flex items-center justify-center hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div role="radiogroup" aria-label="Tipo de data" className="grid grid-cols-3 gap-1.5">
            {(Object.keys(TIPOS_DATA) as TipoData[]).map((k) => {
              const ativo = tipo === k;
              return (
                <button key={k} role="radio" aria-checked={ativo} onClick={() => setTipo(k)}
                  className="rounded-xl px-2 py-2.5 text-center border transition-colors"
                  style={ativo ? { borderColor: ROSA, background: `color-mix(in srgb, ${ROSA} 10%, transparent)` } : undefined}>
                  <span className="block text-lg leading-none" aria-hidden>{TIPOS_DATA[k].emoji}</span>
                  <span className="block mt-1 text-[11px] font-semibold text-foreground">{TIPOS_DATA[k].curto}</span>
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="aniv-nome" className="text-xs font-semibold text-muted-foreground mb-2 block">{rotuloNome}</label>
            <input id="aniv-nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder={exemploNome} maxLength={80} autoFocus={!item} className="input" />
          </div>

          <div className="grid grid-cols-[5.5rem_1fr] gap-3">
            <div>
              <label htmlFor="aniv-dia" className="text-xs font-semibold text-muted-foreground mb-2 block">Dia</label>
              <select id="aniv-dia" value={diaValido} onChange={(e) => setDia(Number(e.target.value))} className="input tabular-nums">
                {Array.from({ length: maxDia }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="aniv-mes" className="text-xs font-semibold text-muted-foreground mb-2 block">Mês</label>
              <select id="aniv-mes" value={mes} onChange={(e) => setMes(Number(e.target.value))} className="input">
                {MESES_NOME.map((m, i) => <option key={m} value={i + 1}>{cap(m)}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="aniv-ano" className="text-xs font-semibold text-muted-foreground mb-2 block">
              {anoRotulo} <span className="font-normal text-muted-foreground/70">(opcional)</span>
            </label>
            <input id="aniv-ano" value={ano} inputMode="numeric" maxLength={4} placeholder="Ex.: 1990"
                   onChange={(e) => setAno(e.target.value.replace(/\D/g, '').slice(0, 4))} className="input tabular-nums" />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {tipo === 'aniversario' ? 'Com o ano, a Sora diz quantos anos a pessoa faz.' : 'Com o ano, a Sora diz quantos anos a data completa.'}
              {mes === 2 && diaValido === 29 && ' Em anos sem 29 de fevereiro, o aviso vale pro dia 28.'}
            </p>
          </div>

          <div className="rounded-xl bg-muted/30 p-3 space-y-1">
            <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2 mb-1"><Bell size={15} style={{ color: ROSA }} aria-hidden /> Lembrar no WhatsApp</p>
            <Interruptor rotulo="1 semana antes" ajuda="dá tempo de pensar no presente" ligado={semana} onMudar={setSemana} />
            <Interruptor rotulo="No dia" ajuda="pra não esquecer os parabéns" ligado={noDia} onMudar={setNoDia} />
          </div>

          <div>
            <label htmlFor="aniv-obs" className="text-xs font-semibold text-muted-foreground mb-2 inline-flex items-center gap-1.5">
              <Gift size={13} aria-hidden /> Ideia de presente ou observação <span className="font-normal text-muted-foreground/70">(opcional)</span>
            </label>
            <textarea id="aniv-obs" value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2}
                      placeholder="Ex.: gosta de livros de suspense" className="input resize-none" />
            <p className="mt-1 text-[11px] text-muted-foreground">Vai junto no lembrete de uma semana antes.</p>
          </div>

          {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}

          {item && (confirmarApagar ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5" role="alert">
              <p className="text-sm text-foreground flex-1 min-w-[10rem]">Apagar esta data? Os lembretes param.</p>
              <button onClick={() => setConfirmarApagar(false)} className="h-10 px-3 rounded-xl text-sm font-semibold text-foreground hover:bg-muted">Cancelar</button>
              <button onClick={() => void apagar()} disabled={salvando} className="h-10 px-3.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">Apagar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmarApagar(true)} className="inline-flex items-center gap-1.5 h-10 px-2 -ml-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-500/10">
              <Trash2 size={14} aria-hidden /> Apagar esta data
            </button>
          ))}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={onFechar} className="btn-ghost px-4 h-11 text-sm">Cancelar</button>
          <button onClick={() => void salvar()} disabled={salvando || !nome.trim()}
                  className="inline-flex items-center gap-2 px-4 h-11 rounded-xl text-white text-sm font-bold hover:opacity-90 disabled:opacity-50"
                  style={{ background: ROSA }}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {item ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Interruptor({ rotulo, ajuda, ligado, onMudar }: { rotulo: string; ajuda: string; ligado: boolean; onMudar: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} onClick={() => onMudar(!ligado)}
            className="w-full flex items-center justify-between gap-3 min-h-[44px] text-left">
      <span>
        <span className="block text-sm font-semibold text-foreground">{rotulo}</span>
        <span className="block text-[11px] text-muted-foreground">{ajuda}</span>
      </span>
      <span className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${ligado ? '' : 'bg-muted-foreground/30'}`}
            style={ligado ? { background: ROSA } : undefined} aria-hidden>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${ligado ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}
