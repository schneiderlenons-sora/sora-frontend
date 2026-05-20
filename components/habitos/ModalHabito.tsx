'use client';

import { useState, useMemo } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, Target, Trash2, Bell, BellOff, Sparkles } from 'lucide-react';

const ICONES = [
  '🏋️','🧘','🚴','🏊','🎯','💧',
  '📚','✍️','🧹','🍎','🌿','😴',
  '🧠','💪','🎵','🌅','🌙','⚡',
  '🏃','🥗','🧴','💊','🏥','📖',
  '🎨','🌱','🤸','🥑','☕','🧎',
];

const CORES = [
  '#7c3aed','#ec4899','#f59e0b','#10b981','#06b6d4',
  '#3b82f6','#ef4444','#84cc16','#f97316','#a855f7',
];

const DIAS = [
  { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 7, l: 'Dom' },
];

const PERIODOS = [
  { v: 'manha',  l: 'Manhã',     emoji: '🌅', hora: '07:00' },
  { v: 'tarde',  l: 'Tarde',     emoji: '☀️', hora: '14:00' },
  { v: 'noite',  l: 'Noite',     emoji: '🌙', hora: '21:00' },
  { v: 'custom', l: 'Específico', emoji: '⏰', hora: '' },
  { v: 'livre',  l: 'A qualquer hora', emoji: '✨', hora: '' },
];

function periodoDoHorario(h?: string | null): string {
  if (!h) return 'livre';
  const hora = parseInt(h.slice(0, 2));
  if (isNaN(hora)) return 'livre';
  if (hora >= 5 && hora < 12) return 'manha';
  if (hora >= 12 && hora < 18) return 'tarde';
  return 'noite';
}

interface Props {
  phone:    string;
  habito?:  any;
  onClose:  () => void;
  onSuccess: () => void;
}

export default function ModalHabito({ phone, habito, onClose, onSuccess }: Props) {
  const ed = !!habito;
  const [nome, setNome]           = useState(habito?.nome || '');
  const [icone, setIcone]         = useState(habito?.icone || '🎯');
  const [cor, setCor]             = useState(habito?.cor || '#7c3aed');
  const [dias, setDias]           = useState<number[]>(habito?.dias_semana || [1,2,3,4,5,6,7]);
  const [periodo, setPeriodo]     = useState(habito?.horario_lembrete ? 'custom' : 'livre');
  const [horarioCustom, setHorario] = useState(habito?.horario_lembrete?.slice(0, 5) || '07:00');
  const [lembreteAtivo, setLembrete] = useState(!!habito?.horario_lembrete);
  const [motivo, setMotivo]       = useState(habito?.motivo || '');
  const [tipo, setTipo]           = useState<'construir' | 'eliminar'>(habito?.tipo || 'construir');
  const [loading, setLoading]     = useState(false);
  const [erro, setErro]           = useState('');

  // Determina horário final
  const horarioFinal = useMemo(() => {
    if (!lembreteAtivo) return null;
    if (periodo === 'custom') return horarioCustom || null;
    if (periodo === 'livre') return null;
    return PERIODOS.find(p => p.v === periodo)?.hora || null;
  }, [periodo, horarioCustom, lembreteAtivo]);

  function toggleDia(d: number) {
    setDias(dias.includes(d) ? dias.filter(x => x !== d) : [...dias, d].sort());
  }

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Dê um nome ao hábito.'); return; }
    if (dias.length === 0) { setErro('Selecione pelo menos um dia.'); return; }
    setLoading(true);
    try {
      const body: any = {
        nome: nome.trim(), icone, cor,
        dias_semana: dias,
        horario_lembrete: horarioFinal,
        motivo: motivo.trim() || null,
        tipo,
      };
      if (ed) await api.grow.habitos.editar(habito.id, body);
      else    await api.grow.habitos.criar({ phone, ...body });
      onSuccess();
    } catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  async function arquivar() {
    if (!ed || !confirm(`Arquivar "${habito.nome}"? O histórico de check-ins é mantido.`)) return;
    setLoading(true);
    try { await api.grow.habitos.deletar(habito.id, phone); onSuccess(); }
    catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  const isConstruir = tipo === 'construir';
  const corPreview = cor;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-950/40">
              <Target size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">{ed ? 'Editar hábito' : 'Novo hábito'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* PREVIEW LIVE */}
          <div className="rounded-2xl p-4 border border-border/40 backdrop-blur-xl"
               style={{ background: `linear-gradient(135deg, ${corPreview}1A 0%, ${corPreview}08 100%)`, borderColor: `${corPreview}40` }}>
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl shadow-md"
                   style={{ background: corPreview, color: '#fff' }}>
                {icone}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">{nome || (isConstruir ? 'Novo hábito' : 'Hábito a eliminar')}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: `${corPreview}26`, color: corPreview }}>
                    {isConstruir ? '✅ construir' : '❌ eliminar'}
                  </span>
                  {horarioFinal && (
                    <span className="text-[9px] text-muted-foreground tabular">⏰ {horarioFinal}</span>
                  )}
                  <span className="text-[9px] text-muted-foreground">
                    {dias.length === 7 ? 'Todo dia' : `${dias.length}×/sem`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Beber 2L de água" className="input" maxLength={60} autoFocus />
          </div>

          {/* Tipo: construir vs eliminar */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setTipo('construir')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                  tipo === 'construir' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500' : 'border-border bg-muted/20 hover:border-emerald-300'
                }`}>
                <span className="text-xl">✅</span>
                <div className="text-left">
                  <p className="text-xs font-bold text-foreground">Construir</p>
                  <p className="text-[9px] text-muted-foreground">algo que quero fazer</p>
                </div>
              </button>
              <button type="button" onClick={() => setTipo('eliminar')}
                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                  tipo === 'eliminar' ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 ring-1 ring-rose-500' : 'border-border bg-muted/20 hover:border-rose-300'
                }`}>
                <span className="text-xl">❌</span>
                <div className="text-left">
                  <p className="text-xs font-bold text-foreground">Eliminar</p>
                  <p className="text-[9px] text-muted-foreground">algo que quero parar</p>
                </div>
              </button>
            </div>
          </div>

          {/* Emoji */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Emoji</label>
            <div className="grid grid-cols-6 gap-1.5">
              {ICONES.map(i => (
                <button key={i} type="button" onClick={() => setIcone(i)}
                  className={`aspect-square rounded-xl text-2xl flex items-center justify-center transition-all ${
                    icone === i ? 'scale-110 ring-2 ring-violet-500 bg-violet-100 dark:bg-violet-950/40' : 'bg-muted/40 hover:bg-muted'
                  }`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-9 h-9 rounded-xl transition-all ${cor === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-card' : 'hover:scale-105'}`}
                  style={{ background: c, ['--tw-ring-color' as any]: c }} />
              ))}
            </div>
          </div>

          {/* Dias da semana */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center justify-between">
              <span>Dias da semana</span>
              <button type="button" onClick={() => setDias(dias.length === 7 ? [1,2,3,4,5] : [1,2,3,4,5,6,7])}
                      className="normal-case font-semibold text-violet-600 dark:text-violet-400 hover:underline tracking-normal">
                {dias.length === 7 ? 'só semana' : 'todo dia'}
              </button>
            </label>
            <div className="grid grid-cols-7 gap-1">
              {DIAS.map(d => {
                const ativo = dias.includes(d.v);
                return (
                  <button key={d.v} type="button" onClick={() => toggleDia(d.v)}
                          className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                            ativo ? 'border-violet-500 bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 text-muted-foreground hover:border-violet-300'
                          }`}>
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Período / horário */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Quando</label>
            <div className="grid grid-cols-5 gap-1">
              {PERIODOS.map(p => (
                <button key={p.v} type="button" onClick={() => setPeriodo(p.v)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    periodo === p.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500' : 'border-border bg-muted/20 hover:border-violet-300'
                  }`}>
                  <span className="text-base">{p.emoji}</span>
                  <span className="text-[9px] font-bold text-foreground leading-tight text-center">{p.l}</span>
                </button>
              ))}
            </div>
            {periodo === 'custom' && (
              <input type="time" value={horarioCustom} onChange={e => setHorario(e.target.value)} className="input mt-2" />
            )}
          </div>

          {/* Lembrete WhatsApp */}
          {periodo !== 'livre' && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {lembreteAtivo ? <Bell size={14} className="text-violet-500" /> : <BellOff size={14} className="text-muted-foreground" />}
                <div>
                  <p className="text-xs font-bold text-foreground">Lembrete no WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {lembreteAtivo && horarioFinal ? `Diariamente às ${horarioFinal}` : 'Sem lembrete'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setLembrete(!lembreteAtivo)}
                      className={`relative w-11 h-6 rounded-full transition-all ${lembreteAtivo ? 'bg-violet-600' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all ${lembreteAtivo ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

          {/* Motivo / Por quê */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1">
              <Sparkles size={10} /> Por quê <span className="normal-case font-normal text-muted-foreground/60">(seu propósito, pra você ler nos dias difíceis)</span>
            </label>
            <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} placeholder='"Quero ter mais energia pra brincar com meus filhos."' className="input resize-none" maxLength={240} />
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20">
          {ed && (
            <button onClick={arquivar} disabled={loading} className="text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 p-2 rounded-lg" title="Arquivar">
              <Trash2 size={14} />
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
            <button onClick={salvar} disabled={loading || !nome.trim()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {ed ? 'Salvar' : 'Criar hábito'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { periodoDoHorario };
