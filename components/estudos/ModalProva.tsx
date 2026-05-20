'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, FileText, Trash2 } from 'lucide-react';

const TIPOS = [
  { v: 'prova',     l: 'Prova' },
  { v: 'simulado',  l: 'Simulado' },
  { v: 'trabalho',  l: 'Trabalho' },
  { v: 'projeto',   l: 'Projeto' },
  { v: 'tcc',       l: 'TCC' },
  { v: 'redacao',   l: 'Redação' },
  { v: 'outra',     l: 'Outra' },
];

interface Props {
  phone:      string;
  prova?:     any;
  cursos:     any[];
  disciplinas: any[];
  cursoIdInicial?: string;
  onClose:    () => void;
  onSuccess:  () => void;
}

export default function ModalProva({ phone, prova, cursos, disciplinas, cursoIdInicial, onClose, onSuccess }: Props) {
  const ed = !!prova;
  const [titulo, setTitulo]           = useState(prova?.titulo || '');
  const [tipo, setTipo]               = useState(prova?.tipo || 'prova');
  const [data, setData]               = useState(prova?.data || '');
  const [hora, setHora]               = useState(prova?.hora?.slice(0, 5) || '');
  const [cursoId, setCursoId]         = useState(prova?.curso_id || cursoIdInicial || '');
  const [disciplinaId, setDiscId]     = useState(prova?.disciplina_id || '');
  const [peso, setPeso]               = useState(prova?.peso?.toString() || '');
  const [notaObtida, setNota]         = useState(prova?.nota_obtida?.toString() || '');
  const [notaMaxima, setNotaMax]      = useState(prova?.nota_maxima?.toString() || '10');
  const [observacao, setObs]          = useState(prova?.observacao || '');
  const [realizada, setRealizada]     = useState(prova?.realizada || false);
  const [loading, setLoading]         = useState(false);
  const [erro, setErro]               = useState('');

  async function salvar() {
    setErro('');
    if (!titulo.trim()) { setErro('Título obrigatório.'); return; }
    if (!data) { setErro('Data obrigatória.'); return; }
    setLoading(true);
    try {
      const body: any = {
        phone,
        titulo: titulo.trim(),
        tipo, data,
        hora: hora || null,
        curso_id: cursoId || null,
        disciplina_id: disciplinaId || null,
        peso: peso ? parseFloat(peso.replace(',', '.')) : null,
        nota_obtida: notaObtida ? parseFloat(notaObtida.replace(',', '.')) : null,
        nota_maxima: notaMaxima ? parseFloat(notaMaxima.replace(',', '.')) : 10,
        observacao: observacao.trim() || null,
        realizada,
      };
      if (ed) await api.estudos.provas.editar(prova.id, body);
      else    await api.estudos.provas.criar(body);
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function deletar() {
    if (!ed || !confirm('Excluir essa prova?')) return;
    setLoading(true);
    try { await api.estudos.provas.deletar(prova.id, phone); onSuccess(); }
    catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  const disciplinasFiltradas = cursoId
    ? disciplinas.filter(d => d.curso_id === cursoId)
    : disciplinas;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-950/40">
              <FileText size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">{ed ? 'Editar prova' : 'Nova prova'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Título</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Prova bimestral, Simulado 1" className="input" maxLength={120} autoFocus />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Tipo</label>
            <div className="grid grid-cols-4 gap-1">
              {TIPOS.map(t => (
                <button key={t.v} type="button" onClick={() => setTipo(t.v)}
                  className={`px-1.5 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    tipo === t.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300'
                  }`}>
                  {t.l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Hora</label>
              <input type="time" value={hora} onChange={e => setHora(e.target.value)} className="input" />
            </div>
          </div>

          {cursos.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Curso</label>
              <select value={cursoId} onChange={e => setCursoId(e.target.value)} className="input">
                <option value="">— Sem curso —</option>
                {cursos.map(c => <option key={c.id} value={c.id}>{c.icone || '🎓'} {c.nome}</option>)}
              </select>
            </div>
          )}

          {disciplinasFiltradas.length > 0 && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Disciplina</label>
              <select value={disciplinaId} onChange={e => setDiscId(e.target.value)} className="input">
                <option value="">— Sem disciplina —</option>
                {disciplinasFiltradas.map(d => <option key={d.id} value={d.id}>{d.icone || '📚'} {d.nome}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Peso</label>
              <input type="text" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="1.0" className="input tabular text-center" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nota</label>
              <input type="text" inputMode="decimal" value={notaObtida} onChange={e => setNota(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="—" className="input tabular text-center font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Máx</label>
              <input type="text" inputMode="decimal" value={notaMaxima} onChange={e => setNotaMax(e.target.value.replace(/[^\d.,]/g, ''))} className="input tabular text-center" />
            </div>
          </div>

          {ed && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/40 flex items-center justify-between">
              <p className="text-xs font-bold text-foreground">Marcar como realizada</p>
              <button onClick={() => setRealizada(!realizada)}
                className={`relative w-11 h-6 rounded-full transition-all ${realizada ? 'bg-emerald-600' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all ${realizada ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2} placeholder="Conteúdo cobrado, bibliografia..." className="input resize-none" maxLength={300} />
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
            <button onClick={deletar} disabled={loading} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 p-2 rounded-lg">
              <Trash2 size={14} />
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
            <button onClick={salvar} disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {ed ? 'Salvar' : 'Criar prova'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
