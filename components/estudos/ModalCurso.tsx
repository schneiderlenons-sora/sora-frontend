'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, GraduationCap, Trash2 } from 'lucide-react';

const TIPOS = [
  { v: 'faculdade', l: 'Faculdade',  icon: '🎓' },
  { v: 'online',    l: 'Curso online', icon: '💻' },
  { v: 'concurso',  l: 'Concurso',    icon: '🏆' },
  { v: 'idioma',    l: 'Idioma',      icon: '🗣️' },
  { v: 'outro',     l: 'Outro',       icon: '📚' },
];

const STATUS = [
  { v: 'ativo',      l: 'Em andamento' },
  { v: 'concluido',  l: 'Concluído' },
  { v: 'pausado',    l: 'Pausado' },
  { v: 'abandonado', l: 'Abandonado' },
];

const CORES = ['#7c3aed','#ec4899','#f59e0b','#10b981','#06b6d4','#3b82f6','#ef4444','#84cc16'];

interface Props {
  phone:    string;
  curso?:   any;
  tipoInicial?: string;
  onClose:  () => void;
  onSuccess: () => void;
}

export default function ModalCurso({ phone, curso, tipoInicial, onClose, onSuccess }: Props) {
  const ed = !!curso;
  const [nome, setNome]               = useState(curso?.nome || '');
  const [tipo, setTipo]               = useState(curso?.tipo || tipoInicial || 'online');
  const [instituicao, setInstituicao] = useState(curso?.instituicao || '');
  const [instrutor, setInstrutor]     = useState(curso?.instrutor || '');
  const [icone, setIcone]             = useState(curso?.icone || '🎓');
  const [cor, setCor]                 = useState(curso?.cor || '#7c3aed');
  const [dataInicio, setDataInicio]   = useState(curso?.data_inicio || '');
  const [dataFim, setDataFim]         = useState(curso?.data_fim || '');
  const [cargaH, setCargaH]           = useState(curso?.carga_horaria_h?.toString() || '');
  const [progresso, setProgresso]     = useState(curso?.progresso_pct?.toString() || '0');
  const [url, setUrl]                 = useState(curso?.url || '');
  const [observacao, setObs]          = useState(curso?.observacao || '');
  const [status, setStatus]           = useState(curso?.status || 'ativo');
  const [loading, setLoading]         = useState(false);
  const [erro, setErro]               = useState('');

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Nome do curso obrigatório.'); return; }
    setLoading(true);
    try {
      const body: any = {
        phone,
        nome: nome.trim(),
        tipo,
        instituicao: instituicao.trim() || null,
        instrutor: instrutor.trim() || null,
        icone, cor,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        carga_horaria_h: cargaH ? parseInt(cargaH) : null,
        progresso_pct: progresso ? parseFloat(progresso) : 0,
        url: url.trim() || null,
        observacao: observacao.trim() || null,
        status,
      };
      if (ed) await api.estudos.cursos.editar(curso.id, body);
      else    await api.estudos.cursos.criar(body);
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function deletar() {
    if (!ed || !confirm(`Excluir "${curso.nome}"? Disciplinas serão desvinculadas mas mantidas.`)) return;
    setLoading(true);
    try { await api.estudos.cursos.deletar(curso.id, phone); onSuccess(); }
    catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  const tipoLabel: any = {
    faculdade: 'graduação, mestrado, doutorado, técnico…',
    online: 'Udemy, Coursera, YouTube, Alura…',
    concurso: 'Banco do Brasil, INSS, OAB, ENEM…',
    idioma: 'inglês, espanhol, francês…',
    outro: 'qualquer outro curso ou formação',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-950/40">
              <GraduationCap size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">{ed ? 'Editar curso' : 'Novo curso'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Tipo</label>
            <div className="grid grid-cols-5 gap-1.5">
              {TIPOS.map(t => (
                <button key={t.v} type="button" onClick={() => setTipo(t.v)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                    tipo === t.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500' : 'border-border bg-muted/20 hover:border-violet-300'
                  }`}>
                  <span className="text-lg">{t.icon}</span>
                  <span className="text-[9px] font-bold text-foreground">{t.l}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 italic">{tipoLabel[tipo]}</p>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder={tipo === 'concurso' ? 'Concurso BB 2026' : tipo === 'faculdade' ? 'Engenharia de Software' : 'Nome do curso'} className="input" maxLength={120} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">{tipo === 'concurso' ? 'Banca' : tipo === 'faculdade' ? 'Instituição' : 'Plataforma'}</label>
              <input value={instituicao} onChange={e => setInstituicao(e.target.value)} placeholder={tipo === 'online' ? 'Udemy, Coursera...' : tipo === 'concurso' ? 'Cebraspe, FCC, FGV...' : 'USP, Anhembi...'} className="input" maxLength={80} />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">{tipo === 'concurso' ? 'Cargo' : 'Instrutor/Professor'}</label>
              <input value={instrutor} onChange={e => setInstrutor(e.target.value)} placeholder={tipo === 'concurso' ? 'Escriturário' : 'Nome'} className="input" maxLength={80} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="input" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">{tipo === 'concurso' ? 'Data da prova' : 'Término'}</label>
              <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="input" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Progresso (%)</label>
              <input type="text" inputMode="numeric" value={progresso} onChange={e => setProgresso(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" className="input tabular" />
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full transition-all" style={{ width: `${Math.min(100, parseFloat(progresso) || 0)}%`, background: cor }} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Carga (h)</label>
              <input type="text" inputMode="numeric" value={cargaH} onChange={e => setCargaH(e.target.value.replace(/[^\d]/g, ''))} placeholder="40" className="input tabular text-center" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {CORES.map(c => (
                <button key={c} type="button" onClick={() => setCor(c)}
                  className={`w-8 h-8 rounded-lg transition-all ${cor === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-card' : 'hover:scale-105'}`}
                  style={{ background: c, ['--tw-ring-color' as any]: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Link / URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="input" maxLength={300} />
          </div>

          {ed && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Status</label>
              <div className="grid grid-cols-4 gap-1">
                {STATUS.map(s => (
                  <button key={s.v} type="button" onClick={() => setStatus(s.v)}
                    className={`px-1.5 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                      status === s.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300'
                    }`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2} placeholder="Notas, edital, observações..." className="input resize-none" maxLength={300} />
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
              {ed ? 'Salvar' : 'Criar curso'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
