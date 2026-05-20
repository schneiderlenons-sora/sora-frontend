'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, Dumbbell, Plus, Flame } from 'lucide-react';

const CATEGORIAS = [
  { v: 'forca',      l: 'Força',      icone: '💪' },
  { v: 'cardio',     l: 'Cardio',     icone: '🏃' },
  { v: 'yoga',       l: 'Yoga',       icone: '🧘' },
  { v: 'luta',       l: 'Luta',       icone: '🥋' },
  { v: 'funcional',  l: 'Funcional',  icone: '🤸' },
  { v: 'esporte',    l: 'Esporte',    icone: '⚽' },
  { v: 'danca',      l: 'Dança',      icone: '💃' },
  { v: 'outro',      l: 'Outro',      icone: '🎯' },
];

const SUGESTOES = [
  'Academia', 'Corrida', 'Caminhada', 'Yoga', 'Pilates',
  'Jiu-jitsu', 'Crossfit', 'Boxe', 'Ciclismo', 'Natação',
  'Musculação', 'HIIT', 'Spinning', 'Funcional', 'Alongamento',
];

interface Props {
  phone:     string;
  catalogo:  any[];
  onClose:   () => void;
  onSuccess: () => void;
}

export default function ModalTreino({ phone, catalogo, onClose, onSuccess }: Props) {
  const [aba, setAba] = useState<'registrar' | 'novo'>('registrar');

  // Estado de "registrar sessão"
  const [treinoSelId, setTreinoSelId] = useState<string>(catalogo[0]?.id || '');
  const [duracao, setDuracao]         = useState('60');
  const [intensidade, setIntensidade] = useState(3);
  const [calorias, setCalorias]       = useState('');
  const [observacao, setObservacao]   = useState('');
  const [dataReg, setDataReg]         = useState(new Date().toISOString().slice(0, 10));

  // Estado de "novo treino"
  const [nome, setNome]   = useState('');
  const [cat, setCat]     = useState('forca');
  const [icone, setIcone] = useState('💪');

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvarRegistro() {
    setErro('');
    if (!treinoSelId) { setErro('Selecione ou crie um treino primeiro.'); return; }
    const dur = parseInt(duracao);
    if (!dur || dur <= 0) { setErro('Duração inválida.'); return; }
    setLoading(true);
    try {
      await api.saude.treinos.registrar({
        phone,
        treino_id: treinoSelId,
        data: dataReg,
        duracao_min: dur,
        intensidade,
        calorias_kcal: calorias ? parseInt(calorias) : null,
        observacao: observacao.trim() || null,
      });
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function salvarNovo() {
    setErro('');
    if (!nome.trim()) { setErro('Dê um nome ao treino.'); return; }
    setLoading(true);
    try {
      const novo = await api.saude.treinos.criar({ phone, nome: nome.trim(), categoria: cat, icone });
      // Pula direto pra aba registrar com o novo treino selecionado
      setAba('registrar');
      setTreinoSelId(novo.id);
      setNome('');
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-100 dark:bg-amber-950/40">
              <Dumbbell size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">Treinos</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex border-b border-border">
          {[
            { v: 'registrar', l: 'Registrar sessão' },
            { v: 'novo',      l: 'Novo treino' },
          ].map(t => (
            <button key={t.v} onClick={() => setAba(t.v as any)}
              className={`flex-1 px-4 py-2.5 text-xs font-bold transition-all relative ${
                aba === t.v ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {t.l}
              {aba === t.v && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 dark:bg-violet-400" />}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {aba === 'registrar' ? (
            <>
              {catalogo.length === 0 ? (
                <div className="rounded-xl p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-center">
                  <p className="text-xs text-foreground font-semibold mb-1">Sem treinos cadastrados</p>
                  <p className="text-[11px] text-muted-foreground mb-2">Crie seu primeiro treino na aba "Novo treino"</p>
                  <button onClick={() => setAba('novo')} className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">
                    Criar agora →
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Treino</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                      {catalogo.map(t => (
                        <button key={t.id} type="button" onClick={() => setTreinoSelId(t.id)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all text-left ${
                            treinoSelId === t.id ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500' : 'border-border bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                          }`}>
                          <span className="text-base">{t.icone}</span>
                          <span className="text-xs font-bold text-foreground truncate">{t.nome}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
                      <input type="date" value={dataReg} onChange={e => setDataReg(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="input" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Duração (min)</label>
                      <input type="text" inputMode="numeric" value={duracao} onChange={e => setDuracao(e.target.value.replace(/[^\d]/g, ''))} className="input text-center tabular font-bold" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block flex items-center gap-1">
                      <Flame size={10} /> Intensidade: {intensidade}/5
                    </label>
                    <input type="range" min={1} max={5} value={intensidade} onChange={e => setIntensidade(parseInt(e.target.value))} className="w-full accent-violet-600" />
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                      <span>leve</span><span>moderada</span><span>forte</span><span>intensa</span><span>máxima</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Calorias <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
                    <input type="text" inputMode="numeric" value={calorias} onChange={e => setCalorias(e.target.value.replace(/[^\d]/g, ''))} placeholder="350" className="input tabular" />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
                    <input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Treino de peito e tríceps..." className="input" maxLength={120} />
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome</label>
                <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Academia, Jiu-jitsu" className="input" maxLength={40} autoFocus />
                {nome === '' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {SUGESTOES.map(s => (
                      <button key={s} type="button" onClick={() => setNome(s)} className="text-[10px] px-2 py-1 rounded-full bg-muted/60 hover:bg-violet-100 dark:hover:bg-violet-950/40 transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Categoria + ícone</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORIAS.map(c => (
                    <button key={c.v} type="button" onClick={() => { setCat(c.v); setIcone(c.icone); }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                        cat === c.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 ring-1 ring-violet-500' : 'border-border bg-muted/20 hover:border-violet-300 dark:hover:border-violet-800'
                      }`}>
                      <span className="text-xl">{c.icone}</span>
                      <span className="text-[9px] font-bold text-foreground">{c.l}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
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
          <button onClick={aba === 'registrar' ? salvarRegistro : salvarNovo} disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {aba === 'registrar' ? 'Registrar treino' : 'Criar treino'}
          </button>
        </div>
      </div>
    </div>
  );
}
