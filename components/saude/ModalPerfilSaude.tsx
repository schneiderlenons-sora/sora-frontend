'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, User, Plus, Trash2 } from 'lucide-react';

const NIVEIS = [
  { v: 'sedentario', l: 'Sedentário' },
  { v: 'leve',       l: 'Leve' },
  { v: 'moderado',   l: 'Moderado' },
  { v: 'intenso',    l: 'Intenso' },
  { v: 'atleta',     l: 'Atleta' },
];

const OBJETIVOS = [
  { v: 'emagrecer',    l: 'Emagrecer' },
  { v: 'manter',       l: 'Manter' },
  { v: 'ganhar_massa', l: 'Ganhar massa' },
  { v: 'definicao',    l: 'Definição' },
];

interface Props {
  phone:     string;
  perfil?:   any;
  onClose:   () => void;
  onSuccess: () => void;
}

export default function ModalPerfilSaude({ phone, perfil, onClose, onSuccess }: Props) {
  const [altura, setAltura] = useState(perfil?.altura_cm ? String(perfil.altura_cm) : '');
  const [sexo, setSexo]     = useState<'M'|'F'|'outro'>(perfil?.sexo || 'M');
  const [dn, setDn]         = useState(perfil?.data_nascimento || '');
  const [nivel, setNivel]   = useState(perfil?.nivel_atividade || 'moderado');
  const [objetivo, setObj]  = useState(perfil?.objetivo || 'manter');
  const [metaPeso, setMetaPeso] = useState(perfil?.meta_peso_kg ? String(perfil.meta_peso_kg) : '');
  const [metaPesoData, setMetaPesoData] = useState(perfil?.meta_peso_data || '');
  const [condicoes, setCondicoes] = useState<string[]>(perfil?.condicoes_cronicas || []);
  const [alergias, setAlergias]   = useState<string[]>(perfil?.alergias || []);
  const [novaCond, setNovaCond]   = useState('');
  const [novaAl, setNovaAl]       = useState('');
  const [cicloAtivo, setCicloAtivo] = useState(perfil?.ciclo_ativo || false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    setLoading(true);
    try {
      await api.saude.perfil.salvar(phone, {
        altura_cm:        altura ? parseInt(altura) : null,
        sexo,
        data_nascimento:  dn || null,
        nivel_atividade:  nivel,
        objetivo,
        meta_peso_kg:     metaPeso ? parseFloat(metaPeso.replace(',', '.')) : null,
        meta_peso_data:   metaPesoData || null,
        condicoes_cronicas: condicoes,
        alergias,
        ciclo_ativo:      cicloAtivo,
      });
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-violet-100 dark:bg-violet-950/40">
              <User size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Perfil de saúde</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Altura (cm)</label>
              <input type="text" inputMode="numeric" value={altura} onChange={e => setAltura(e.target.value.replace(/[^\d]/g, ''))} placeholder="175" className="input text-center tabular font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data de nasc.</label>
              <input type="date" value={dn} onChange={e => setDn(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="input" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Sexo biológico</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[{ v:'M',l:'Masculino'},{ v:'F',l:'Feminino'},{ v:'outro',l:'Outro'}].map(s => (
                <button key={s.v} type="button" onClick={() => setSexo(s.v as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    sexo === s.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500' : 'border-border bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                  }`}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nível de atividade</label>
            <div className="grid grid-cols-5 gap-1">
              {NIVEIS.map(n => (
                <button key={n.v} type="button" onClick={() => setNivel(n.v)}
                  className={`px-1.5 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    nivel === n.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                  }`}>
                  {n.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Objetivo</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {OBJETIVOS.map(o => (
                <button key={o.v} type="button" onClick={() => setObj(o.v)}
                  className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    objetivo === o.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                  }`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Meta de peso</label>
            <div className="grid grid-cols-2 gap-2">
              <input type="text" inputMode="decimal" value={metaPeso} onChange={e => setMetaPeso(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="70 kg" className="input tabular" />
              <input type="date" value={metaPesoData} onChange={e => setMetaPesoData(e.target.value)} className="input" />
            </div>
          </div>

          <ListaTag titulo="Condições crônicas" items={condicoes} novo={novaCond} setNovo={setNovaCond} onAdd={() => { if (novaCond.trim()) { setCondicoes([...condicoes, novaCond.trim()]); setNovaCond(''); } }} onRemove={(i) => setCondicoes(condicoes.filter((_, idx) => idx !== i))} placeholder="Ex: hipertensão, diabetes tipo 2" />
          <ListaTag titulo="Alergias" items={alergias} novo={novaAl} setNovo={setNovaAl} onAdd={() => { if (novaAl.trim()) { setAlergias([...alergias, novaAl.trim()]); setNovaAl(''); } }} onRemove={(i) => setAlergias(alergias.filter((_, idx) => idx !== i))} placeholder="Ex: lactose, glúten, amendoim" />

          {sexo === 'F' && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/40 flex items-center justify-between">
              <div className="flex-1">
                <p className="text-xs font-bold text-foreground">Rastreio de ciclo menstrual</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Cruza com humor e energia automaticamente</p>
              </div>
              <button onClick={() => setCicloAtivo(!cicloAtivo)}
                className={`relative w-11 h-6 rounded-full transition-all ${cicloAtivo ? 'bg-violet-600' : 'bg-muted'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all ${cicloAtivo ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          )}

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
            Salvar perfil
          </button>
        </div>
      </div>
    </div>
  );
}

function ListaTag({ titulo, items, novo, setNovo, onAdd, onRemove, placeholder }: any) {
  return (
    <div>
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">{titulo}</label>
      <div className="flex gap-2">
        <input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAdd())} placeholder={placeholder} className="input flex-1" maxLength={60} />
        <button type="button" onClick={onAdd} disabled={!novo.trim()} className="px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
          <Plus size={13} />
        </button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {items.map((t: string, i: number) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 text-[11px] font-semibold">
              {t}
              <button onClick={() => onRemove(i)} className="hover:text-red-500"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
