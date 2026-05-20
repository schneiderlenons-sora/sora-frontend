'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, Activity } from 'lucide-react';

const SUGESTOES = [
  'Dor de cabeça', 'Enxaqueca', 'Cansaço', 'Tontura', 'Náusea',
  'Dor abdominal', 'Insônia', 'Refluxo', 'Dor lombar', 'Inchaço',
  'Sonolência', 'Falta de ar', 'Palpitação', 'Tosse', 'Coriza',
];

interface Props {
  phone:     string;
  onClose:   () => void;
  onSuccess: () => void;
}

export default function ModalSintoma({ phone, onClose, onSuccess }: Props) {
  const [nome, setNome]           = useState('');
  const [intensidade, setIntensidade] = useState(3);
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Informe o sintoma.'); return; }
    setLoading(true);
    try {
      await api.saude.sintomas.criar({ phone, nome: nome.trim(), intensidade, observacao: observacao.trim() || null });
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-100 dark:bg-rose-950/40">
              <Activity size={16} className="text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Registrar sintoma</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Sintoma</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Dor de cabeça" className="input" maxLength={60} autoFocus />
            {!nome && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {SUGESTOES.map(s => (
                  <button key={s} type="button" onClick={() => setNome(s)} className="text-[10px] px-2 py-1 rounded-full bg-muted/60 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Intensidade: {intensidade}/5</label>
            <input type="range" min={1} max={5} value={intensidade} onChange={e => setIntensidade(parseInt(e.target.value))} className="w-full accent-rose-600" />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <span>leve</span><span>fraca</span><span>moderada</span><span>forte</span><span>severa</span>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Após o almoço, após exercício..." className="input" maxLength={120} />
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !nome.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
