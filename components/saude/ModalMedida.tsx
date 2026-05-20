'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, Ruler } from 'lucide-react';

const CAMPOS = [
  { k: 'cintura_cm',  l: 'Cintura',  un: 'cm' },
  { k: 'quadril_cm',  l: 'Quadril',  un: 'cm' },
  { k: 'braco_cm',    l: 'Braço',    un: 'cm' },
  { k: 'perna_cm',    l: 'Perna',    un: 'cm' },
  { k: 'peito_cm',    l: 'Peito',    un: 'cm' },
  { k: 'pescoco_cm',  l: 'Pescoço',  un: 'cm' },
  { k: 'gordura_pct', l: '% Gordura',un: '%' },
  { k: 'musculo_pct', l: '% Músculo',un: '%' },
];

interface Props {
  phone:     string;
  inicial?:  any;
  onClose:   () => void;
  onSuccess: () => void;
}

export default function ModalMedida({ phone, inicial, onClose, onSuccess }: Props) {
  const [data, setData]     = useState(new Date().toISOString().slice(0, 10));
  const [valores, setValores] = useState<Record<string, string>>({});
  const [observacao, setObservacao] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  function set(k: string, v: string) {
    setValores(prev => ({ ...prev, [k]: v.replace(/[^\d.,]/g, '') }));
  }

  async function salvar() {
    setErro('');
    const algumPreenchido = Object.values(valores).some(v => v?.trim());
    if (!algumPreenchido) { setErro('Preencha pelo menos uma medida.'); return; }
    setLoading(true);
    try {
      const body: any = { phone, data, observacao: observacao.trim() || null };
      for (const [k, v] of Object.entries(valores)) {
        if (v?.trim()) body[k] = parseFloat(v.replace(',', '.'));
      }
      await api.saude.medidas.criar(body);
      onSuccess();
    } catch (e: any) { setErro(e.message); }
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
              <Ruler size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Novas medidas</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="input" />
          </div>

          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Medidas <span className="text-muted-foreground/60 normal-case font-normal">(deixe em branco o que não medir hoje)</span></p>

          <div className="grid grid-cols-2 gap-3">
            {CAMPOS.map(({ k, l, un }) => (
              <div key={k}>
                <label className="text-[10px] font-bold text-muted-foreground mb-1 block">{l}</label>
                <div className="flex items-center gap-1.5 relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={valores[k] || ''}
                    onChange={e => set(k, e.target.value)}
                    placeholder={inicial?.[k] ? String(inicial[k]) : '—'}
                    className="input pr-8 text-center tabular font-bold"
                  />
                  <span className="absolute right-3 text-[10px] text-muted-foreground font-bold">{un}</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Pela manhã em jejum..." className="input" maxLength={120} />
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
          <button onClick={salvar} disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
