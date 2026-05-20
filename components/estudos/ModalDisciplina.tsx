'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, BookOpen, Trash2 } from 'lucide-react';

const ICONES = ['📚','📖','📐','📏','🔬','🧪','⚖️','💼','🏛️','🌐','🗣️','🧠','💻','🎨','🎵','⚙️'];
const CORES  = ['#7c3aed','#ec4899','#f59e0b','#10b981','#06b6d4','#3b82f6','#ef4444','#84cc16'];

interface Props {
  phone:    string;
  disciplina?: any;
  cursos:   any[];
  cursoIdInicial?: string;
  onClose:  () => void;
  onSuccess: () => void;
}

export default function ModalDisciplina({ phone, disciplina, cursos, cursoIdInicial, onClose, onSuccess }: Props) {
  const ed = !!disciplina;
  const [nome, setNome]         = useState(disciplina?.nome || '');
  const [cursoId, setCursoId]   = useState(disciplina?.curso_id || cursoIdInicial || '');
  const [icone, setIcone]       = useState(disciplina?.icone || '📚');
  const [cor, setCor]           = useState(disciplina?.cor || '#7c3aed');
  const [prioridade, setPrio]   = useState(disciplina?.prioridade || 3);
  const [metaMin, setMetaMin]   = useState(disciplina?.meta_minutos_semana?.toString() || '');
  const [observacao, setObs]    = useState(disciplina?.observacao || '');
  const [status, setStatus]     = useState(disciplina?.status || 'ativa');
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState('');

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Nome obrigatório.'); return; }
    setLoading(true);
    try {
      const body: any = {
        phone,
        nome: nome.trim(),
        curso_id: cursoId || null,
        icone, cor,
        prioridade,
        meta_minutos_semana: metaMin ? parseInt(metaMin) : null,
        observacao: observacao.trim() || null,
        status,
      };
      if (ed) await api.estudos.disciplinas.editar(disciplina.id, body);
      else    await api.estudos.disciplinas.criar(body);
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function deletar() {
    if (!ed || !confirm(`Excluir "${disciplina.nome}"? As sessões de estudo serão mantidas no histórico.`)) return;
    setLoading(true);
    try { await api.estudos.disciplinas.deletar(disciplina.id, phone); onSuccess(); }
    catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-950/40">
              <BookOpen size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">{ed ? 'Editar disciplina' : 'Nova disciplina'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Cálculo I, Direito Constitucional" className="input" maxLength={80} autoFocus />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Curso vinculado</label>
            <select value={cursoId} onChange={e => setCursoId(e.target.value)} className="input">
              <option value="">— Independente —</option>
              {cursos.map(c => <option key={c.id} value={c.id}>{c.icone || '🎓'} {c.nome}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Ícone</label>
            <div className="grid grid-cols-8 gap-2">
              {ICONES.map(i => (
                <button key={i} type="button" onClick={() => setIcone(i)}
                  className={`w-10 h-10 rounded-xl text-lg transition-all ${icone === i ? 'bg-violet-100 dark:bg-violet-950/40 scale-110 ring-2 ring-violet-500' : 'bg-muted/40 hover:bg-muted'}`}>
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${cor === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-card' : ''}`}
                  style={{ background: c, ['--tw-ring-color' as any]: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Prioridade: {prioridade}/5</label>
            <input type="range" min={1} max={5} value={prioridade} onChange={e => setPrio(parseInt(e.target.value))} className="w-full accent-violet-600" />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <span>baixa</span><span>média</span><span>alta</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Meta semanal (min) <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
            <input type="text" inputMode="numeric" value={metaMin} onChange={e => setMetaMin(e.target.value.replace(/[^\d]/g, ''))} placeholder="ex: 300 (5h por semana)" className="input tabular" />
          </div>

          {ed && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Status</label>
              <div className="grid grid-cols-3 gap-1">
                {[{ v: 'ativa', l: 'Ativa' }, { v: 'concluida', l: 'Concluída' }, { v: 'pausada', l: 'Pausada' }].map(s => (
                  <button key={s.v} type="button" onClick={() => setStatus(s.v)}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition-all border ${
                      status === s.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300'
                    }`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20">
          {ed && (
            <button onClick={deletar} disabled={loading} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg">
              <Trash2 size={14} />
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
            <button onClick={salvar} disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {ed ? 'Salvar' : 'Criar disciplina'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
