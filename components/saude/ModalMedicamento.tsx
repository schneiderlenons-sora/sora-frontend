'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, Pill, Plus, Clock, Trash2 } from 'lucide-react';

const DIAS = [
  { v: 1, l: 'Seg' }, { v: 2, l: 'Ter' }, { v: 3, l: 'Qua' },
  { v: 4, l: 'Qui' }, { v: 5, l: 'Sex' }, { v: 6, l: 'Sáb' }, { v: 7, l: 'Dom' },
];

interface Props {
  phone:        string;
  medicamento?: any;
  onClose:      () => void;
  onSuccess:    () => void;
}

export default function ModalMedicamento({ phone, medicamento, onClose, onSuccess }: Props) {
  const ed = !!medicamento;
  const [nome, setNome]       = useState(medicamento?.nome || '');
  const [dosagem, setDosagem] = useState(medicamento?.dosagem || '');
  const [horarios, setHor]    = useState<string[]>(medicamento?.horarios?.map((h: string) => h.slice(0, 5)) || ['08:00']);
  const [novoHorario, setNovoHorario] = useState('');
  const [dias, setDias]       = useState<number[]>(medicamento?.dias_semana || [1,2,3,4,5,6,7]);
  const [estoque, setEstoque] = useState(medicamento?.estoque_atual != null ? String(medicamento.estoque_atual) : '');
  const [alerta, setAlerta]   = useState(medicamento?.estoque_alerta != null ? String(medicamento.estoque_alerta) : '5');
  const [validade, setValidade] = useState(medicamento?.data_validade || '');
  const [obs, setObs]         = useState(medicamento?.observacao || '');
  const [lembrete, setLembrete] = useState(medicamento?.lembrete_ativo !== false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');

  function addHorario() {
    if (!novoHorario || horarios.includes(novoHorario)) return;
    setHor([...horarios, novoHorario].sort());
    setNovoHorario('');
  }
  function removerHorario(h: string) {
    setHor(horarios.filter(x => x !== h));
  }
  function toggleDia(d: number) {
    setDias(dias.includes(d) ? dias.filter(x => x !== d) : [...dias, d].sort());
  }

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Informe o nome do medicamento.'); return; }
    if (horarios.length === 0) { setErro('Adicione pelo menos um horário.'); return; }
    if (dias.length === 0) { setErro('Selecione pelo menos um dia da semana.'); return; }
    setLoading(true);
    try {
      const body: any = {
        phone,
        nome: nome.trim(),
        dosagem: dosagem.trim() || null,
        horarios,
        dias_semana: dias,
        estoque_atual: estoque ? parseInt(estoque) : null,
        estoque_alerta: alerta ? parseInt(alerta) : 5,
        data_validade: validade || null,
        observacao: obs.trim() || null,
        lembrete_ativo: lembrete,
        ativo: true,
      };
      if (ed) await api.saude.medicamentos.editar(medicamento.id, body);
      else    await api.saude.medicamentos.criar(body);
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function deletar() {
    if (!ed || !confirm('Excluir este medicamento? O histórico de doses será mantido.')) return;
    setLoading(true);
    try { await api.saude.medicamentos.deletar(medicamento.id, phone); onSuccess(); }
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-100 dark:bg-rose-950/40">
              <Pill size={16} className="text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">{ed ? 'Editar medicamento' : 'Novo medicamento'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Nome</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Losartana" className="input" maxLength={60} autoFocus />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Dosagem</label>
              <input value={dosagem} onChange={e => setDosagem(e.target.value)} placeholder="50mg, 1 comp." className="input" maxLength={30} />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block flex items-center gap-1"><Clock size={10} /> Horários</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {horarios.map(h => (
                <span key={h} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold tabular">
                  {h}
                  <button onClick={() => removerHorario(h)} className="hover:text-red-500"><X size={10} /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="time" value={novoHorario} onChange={e => setNovoHorario(e.target.value)} className="input flex-1" />
              <button type="button" onClick={addHorario} disabled={!novoHorario} className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50">
                <Plus size={13} />
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Dias da semana</label>
            <div className="grid grid-cols-7 gap-1">
              {DIAS.map(d => {
                const ativo = dias.includes(d.v);
                return (
                  <button key={d.v} type="button" onClick={() => toggleDia(d.v)}
                          className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${
                            ativo ? 'border-rose-500 bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' : 'border-border bg-muted/20 text-muted-foreground hover:border-rose-300'
                          }`}>
                    {d.l}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Estoque atual</label>
              <input type="text" inputMode="numeric" value={estoque} onChange={e => setEstoque(e.target.value.replace(/[^\d]/g, ''))} placeholder="30 comprimidos" className="input tabular" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Avisar com</label>
              <input type="text" inputMode="numeric" value={alerta} onChange={e => setAlerta(e.target.value.replace(/[^\d]/g, ''))} className="input tabular text-center" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data de validade <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
            <input type="date" value={validade} onChange={e => setValidade(e.target.value)} className="input" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
            <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Tomar com água, em jejum..." className="input" maxLength={150} />
          </div>

          <div className="rounded-xl p-3 bg-muted/30 border border-border/40 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">Lembrete no WhatsApp</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Nos horários configurados</p>
            </div>
            <button onClick={() => setLembrete(!lembrete)}
              className={`relative w-11 h-6 rounded-full transition-all ${lembrete ? 'bg-rose-600' : 'bg-muted'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-all ${lembrete ? 'translate-x-5' : ''}`} />
            </button>
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {ed ? 'Salvar' : 'Cadastrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
