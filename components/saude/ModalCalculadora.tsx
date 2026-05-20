'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import {
  X, Loader2, Check, AlertCircle, Calculator, Flame, Activity, Target as TargetIcon, Salad,
} from 'lucide-react';

const NIVEIS = [
  { v: 'sedentario', l: 'Sedentário',  desc: 'Pouca ou nenhuma atividade' },
  { v: 'leve',       l: 'Leve',         desc: '1-3 dias/semana' },
  { v: 'moderado',   l: 'Moderado',     desc: '3-5 dias/semana' },
  { v: 'intenso',    l: 'Intenso',      desc: '6-7 dias/semana' },
  { v: 'atleta',     l: 'Atleta',       desc: 'Treinos pesados/2x ao dia' },
];

const OBJETIVOS = [
  { v: 'emagrecer',    l: 'Emagrecer',    desc: '−500 kcal/dia', icon: '🔥' },
  { v: 'manter',       l: 'Manter',       desc: 'TDEE',          icon: '⚖️' },
  { v: 'ganhar_massa', l: 'Ganhar massa', desc: '+400 kcal/dia', icon: '💪' },
  { v: 'definicao',    l: 'Definição',    desc: '−300 kcal/dia', icon: '✨' },
];

const DIETAS = [
  { v: 'padrao',        l: 'Padrão',        desc: '30/45/25' },
  { v: 'low_carb',      l: 'Low Carb',      desc: '35/25/40' },
  { v: 'cetogenica',    l: 'Cetogênica',    desc: '25/10/65' },
  { v: 'hipercalorica', l: 'Hipercalórica', desc: '25/55/20' },
  { v: 'vegetariana',   l: 'Vegetariana',   desc: '25/50/25' },
  { v: 'vegana',        l: 'Vegana',        desc: '22/55/23' },
];

interface Props {
  phone:    string;
  inicial?: any;
  onClose:  () => void;
  onSuccess: (metas: any) => void;
}

export default function ModalCalculadora({ phone, inicial, onClose, onSuccess }: Props) {
  const [peso, setPeso]      = useState(inicial?.peso_kg ? String(inicial.peso_kg) : '');
  const [altura, setAltura]  = useState(inicial?.altura_cm ? String(inicial.altura_cm) : '');
  const [idade, setIdade]    = useState(inicial?.idade ? String(inicial.idade) : '');
  const [sexo, setSexo]      = useState<'M'|'F'|'outro'>(inicial?.sexo || 'M');
  const [nivel, setNivel]    = useState(inicial?.nivel_atividade || 'moderado');
  const [objetivo, setObj]   = useState(inicial?.objetivo || 'manter');
  const [dieta, setDieta]    = useState(inicial?.tipo_dieta || 'padrao');
  const [resultado, setResultado] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function calcular() {
    setErro('');
    const p = parseFloat(peso), a = parseFloat(altura), i = parseInt(idade);
    if (!p || p <= 0) { setErro('Peso inválido.'); return; }
    if (!a || a <= 0) { setErro('Altura inválida.'); return; }
    if (!i || i <= 0) { setErro('Idade inválida.'); return; }
    setLoading(true);
    try {
      const r = await api.saude.nutricao.calcular({
        phone, peso_kg: p, altura_cm: a, idade: i, sexo, nivel_atividade: nivel, objetivo, tipo_dieta: dieta, salvar: false,
      });
      setResultado(r);
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function salvarComoMetas() {
    if (!resultado) return;
    setLoading(true);
    try {
      const r = await api.saude.nutricao.calcular({
        phone,
        peso_kg: parseFloat(peso),
        altura_cm: parseFloat(altura),
        idade: parseInt(idade),
        sexo, nivel_atividade: nivel, objetivo, tipo_dieta: dieta, salvar: true,
      });
      onSuccess(r);
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
              <Calculator size={16} className="text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-none">Calculadora nutricional</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Suas metas diárias em 30 segundos</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Dados básicos */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Peso (kg)</label>
              <input type="text" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="70" className="input text-center text-base font-bold tabular" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Altura (cm)</label>
              <input type="text" inputMode="numeric" value={altura} onChange={e => setAltura(e.target.value.replace(/[^\d]/g, ''))} placeholder="175" className="input text-center text-base font-bold tabular" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Idade</label>
              <input type="text" inputMode="numeric" value={idade} onChange={e => setIdade(e.target.value.replace(/[^\d]/g, ''))} placeholder="30" className="input text-center text-base font-bold tabular" />
            </div>
          </div>

          {/* Sexo */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Sexo biológico</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { v: 'M', l: 'Masculino' },
                { v: 'F', l: 'Feminino' },
                { v: 'outro', l: 'Outro' },
              ].map(s => (
                <button key={s.v} type="button" onClick={() => setSexo(s.v as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                    sexo === s.v
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500'
                      : 'border-border bg-muted/20 text-foreground hover:border-violet-300 dark:hover:border-violet-800'
                  }`}>
                  {s.l}
                </button>
              ))}
            </div>
          </div>

          {/* Nível de atividade */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block flex items-center gap-1">
              <Activity size={10} /> Nível de atividade
            </label>
            <div className="grid grid-cols-5 gap-1">
              {NIVEIS.map(n => (
                <button key={n.v} type="button" onClick={() => setNivel(n.v)} title={n.desc}
                  className={`px-1.5 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    nivel === n.v
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                      : 'border-border bg-muted/20 text-foreground hover:border-violet-300 dark:hover:border-violet-800'
                  }`}>
                  {n.l}
                </button>
              ))}
            </div>
          </div>

          {/* Objetivo */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block flex items-center gap-1">
              <TargetIcon size={10} /> Objetivo
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {OBJETIVOS.map(o => (
                <button key={o.v} type="button" onClick={() => setObj(o.v)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                    objetivo === o.v
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500'
                      : 'border-border bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                  }`}>
                  <span className="text-lg">{o.icon}</span>
                  <span className="text-[10px] font-bold text-foreground">{o.l}</span>
                  <span className="text-[9px] text-muted-foreground">{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dieta */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block flex items-center gap-1">
              <Salad size={10} /> Tipo de dieta <span className="text-muted-foreground/60 normal-case font-normal">(P/C/G)</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {DIETAS.map(d => (
                <button key={d.v} type="button" onClick={() => setDieta(d.v)}
                  className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                    dieta === d.v
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300'
                      : 'border-border bg-muted/20 text-foreground hover:border-violet-300 dark:hover:border-violet-800'
                  }`}>
                  <span className="block">{d.l}</span>
                  <span className="text-muted-foreground/70 text-[9px] tabular">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Botão calcular */}
          {!resultado && (
            <button onClick={calcular} disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold disabled:opacity-50 transition-all shadow-lg shadow-violet-600/30">
              {loading ? <><Loader2 size={14} className="animate-spin" /> Calculando...</> : <><Flame size={14} /> Calcular minhas metas</>}
            </button>
          )}

          {/* Resultado */}
          {resultado && (
            <div className="rounded-2xl p-5 border-2 border-violet-300 dark:border-violet-800 bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30">
              <p className="text-[10px] font-bold uppercase tracking-widest text-violet-700 dark:text-violet-400 mb-3">Suas metas diárias</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <Resultado label="TMB" value={resultado.tmb} unit="kcal" sub="metabolismo basal" />
                <Resultado label="TDEE" value={resultado.tdee} unit="kcal" sub="gasto total" />
              </div>

              <div className="text-center mb-4 pb-4 border-b border-violet-300/40 dark:border-violet-800/40">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Calorias diárias</p>
                <p className="text-4xl font-bold text-foreground tabular tracking-tight mt-1">
                  {resultado.calorias}<span className="text-base font-medium text-muted-foreground ml-1">kcal</span>
                </p>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <MacroBox label="Proteína" value={resultado.proteinas_g} unit="g" cor="#ec4899" />
                <MacroBox label="Carbo"    value={resultado.carboidratos_g} unit="g" cor="#f59e0b" />
                <MacroBox label="Gordura"  value={resultado.gorduras_g} unit="g" cor="#10b981" />
                <MacroBox label="Água"     value={(resultado.agua_ml / 1000).toFixed(1)} unit="L" cor="#06b6d4" />
              </div>

              <button onClick={() => setResultado(null)}
                className="text-[11px] text-violet-600 dark:text-violet-400 hover:underline mt-4 mx-auto block">
                ← Recalcular
              </button>
            </div>
          )}

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={15} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">{resultado ? 'Fechar' : 'Cancelar'}</button>
          {resultado && (
            <button onClick={salvarComoMetas} disabled={loading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Salvar como minhas metas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Resultado({ label, value, unit, sub }: any) {
  return (
    <div className="text-center p-3 rounded-xl bg-card/60 border border-border/40">
      <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground tabular tracking-tight mt-1">
        {value}<span className="text-[10px] font-medium text-muted-foreground ml-0.5">{unit}</span>
      </p>
      <p className="text-[9px] text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

function MacroBox({ label, value, unit, cor }: any) {
  return (
    <div className="text-center p-2 rounded-lg" style={{ background: `${cor}15` }}>
      <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: cor }}>{label}</p>
      <p className="text-base font-bold text-foreground tabular tracking-tight mt-0.5">
        {value}<span className="text-[10px] font-medium text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
