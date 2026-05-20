'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, TestTube } from 'lucide-react';

const EXAMES_COMUNS = [
  { nome: 'Glicemia em jejum',        unidade: 'mg/dL', ref_min: 70,   ref_max: 99   },
  { nome: 'Hemoglobina glicada',      unidade: '%',     ref_min: 4.0,  ref_max: 5.6  },
  { nome: 'Colesterol total',         unidade: 'mg/dL', ref_min: 0,    ref_max: 190  },
  { nome: 'Colesterol HDL',           unidade: 'mg/dL', ref_min: 40,   ref_max: 999  },
  { nome: 'Colesterol LDL',           unidade: 'mg/dL', ref_min: 0,    ref_max: 130  },
  { nome: 'Triglicerídeos',           unidade: 'mg/dL', ref_min: 0,    ref_max: 150  },
  { nome: 'Hemoglobina',              unidade: 'g/dL',  ref_min: 13.0, ref_max: 17.5 },
  { nome: 'Vitamina D (25-OH)',       unidade: 'ng/mL', ref_min: 30,   ref_max: 100  },
  { nome: 'TSH',                      unidade: 'mUI/L', ref_min: 0.4,  ref_max: 4.5  },
  { nome: 'Vitamina B12',             unidade: 'pg/mL', ref_min: 200,  ref_max: 900  },
  { nome: 'Ferritina',                unidade: 'ng/mL', ref_min: 30,   ref_max: 300  },
  { nome: 'Creatinina',               unidade: 'mg/dL', ref_min: 0.7,  ref_max: 1.3  },
];

interface Props {
  phone:    string;
  onClose:  () => void;
  onSuccess: () => void;
}

export default function ModalExame({ phone, onClose, onSuccess }: Props) {
  const [nome, setNome]     = useState('');
  const [valor, setValor]   = useState('');
  const [unidade, setUnidade] = useState('');
  const [refMin, setRefMin] = useState('');
  const [refMax, setRefMax] = useState('');
  const [data, setData]     = useState(new Date().toISOString().slice(0, 10));
  const [obs, setObs]       = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  function aplicarPreset(p: typeof EXAMES_COMUNS[0]) {
    setNome(p.nome);
    setUnidade(p.unidade);
    setRefMin(String(p.ref_min));
    setRefMax(String(p.ref_max));
  }

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Informe o nome do exame.'); return; }
    if (!valor.trim()) { setErro('Informe o valor.'); return; }
    const v = parseFloat(valor.replace(',', '.'));
    if (isNaN(v)) { setErro('Valor inválido.'); return; }
    setLoading(true);
    try {
      await api.saude.exames.criar({
        phone,
        nome: nome.trim(),
        valor: v,
        unidade: unidade.trim() || null,
        data,
        referencia_min: refMin ? parseFloat(refMin.replace(',', '.')) : null,
        referencia_max: refMax ? parseFloat(refMax.replace(',', '.')) : null,
        observacao: obs.trim() || null,
      });
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  // Verifica se valor está fora da faixa
  const valorNum = parseFloat(valor.replace(',', '.'));
  const min = parseFloat(refMin || '');
  const max = parseFloat(refMax || '');
  const foraDaFaixa = !isNaN(valorNum) && ((!isNaN(min) && valorNum < min) || (!isNaN(max) && valorNum > max));

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-pink-100 dark:bg-pink-950/40">
              <TestTube size={16} className="text-pink-600 dark:text-pink-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Registrar exame</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Exames comuns</label>
            <div className="flex flex-wrap gap-1.5">
              {EXAMES_COMUNS.map(e => (
                <button key={e.nome} type="button" onClick={() => aplicarPreset(e)}
                        className="text-[10px] px-2 py-1 rounded-full bg-muted/60 hover:bg-pink-100 dark:hover:bg-pink-950/40 transition-colors">
                  {e.nome}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome do exame</label>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Glicemia em jejum" className="input" maxLength={100} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Valor</label>
              <input type="text" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value.replace(/[^\d.,-]/g, ''))} placeholder="92" className="input tabular text-center font-bold text-base" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Unidade</label>
              <input value={unidade} onChange={e => setUnidade(e.target.value)} placeholder="mg/dL" className="input text-center" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Faixa de referência <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" inputMode="decimal" value={refMin} onChange={e => setRefMin(e.target.value.replace(/[^\d.,-]/g, ''))} placeholder="mín" className="input tabular text-center" />
              <input type="text" inputMode="decimal" value={refMax} onChange={e => setRefMax(e.target.value.replace(/[^\d.,-]/g, ''))} placeholder="máx" className="input tabular text-center" />
            </div>
          </div>

          {foraDaFaixa && (
            <div className="rounded-xl p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Valor fora da faixa de referência. Procure o médico se persistir.
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
            <input type="date" value={data} onChange={e => setData(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="input" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Em jejum, após exercício..." className="input" maxLength={150} />
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
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}
