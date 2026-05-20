'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { X, Loader2, Check, AlertCircle, CalendarHeart, Trash2 } from 'lucide-react';

const ESPECIALIDADES = [
  'Clínico geral', 'Cardiologista', 'Dermatologista', 'Endocrinologista',
  'Ginecologista', 'Nutricionista', 'Oftalmologista', 'Ortopedista',
  'Pediatra', 'Psicólogo', 'Psiquiatra', 'Dentista', 'Urologista', 'Outro',
];

interface Props {
  phone:    string;
  consulta?: any;
  onClose:  () => void;
  onSuccess: () => void;
}

export default function ModalConsulta({ phone, consulta, onClose, onSuccess }: Props) {
  const ed = !!consulta;
  const [profissional, setProf]  = useState(consulta?.profissional || '');
  const [especialidade, setEsp]  = useState(consulta?.especialidade || '');
  const [data, setData]          = useState(consulta?.data || '');
  const [hora, setHora]          = useState(consulta?.hora?.slice(0, 5) || '');
  const [local, setLocal]        = useState(consulta?.local || '');
  const [observacao, setObs]     = useState(consulta?.observacao || '');
  const [retornoData, setRetorno] = useState(consulta?.retorno_data || '');
  const [status, setStatus]      = useState(consulta?.status || 'agendada');
  const [lembrete, setLembrete]  = useState(consulta?.lembrete_ativo !== false);
  const [loading, setLoading]    = useState(false);
  const [erro, setErro]          = useState('');

  async function salvar() {
    setErro('');
    if (!data) { setErro('Data obrigatória.'); return; }
    setLoading(true);
    try {
      const body: any = {
        phone,
        profissional: profissional.trim() || null,
        especialidade: especialidade.trim() || null,
        data, hora: hora || null,
        local: local.trim() || null,
        observacao: observacao.trim() || null,
        retorno_data: retornoData || null,
        status,
        lembrete_ativo: lembrete,
      };
      if (ed) await api.saude.consultas.editar(consulta.id, body);
      else    await api.saude.consultas.criar(body);
      onSuccess();
    } catch (e: any) { setErro(e.message); }
    finally { setLoading(false); }
  }

  async function deletar() {
    if (!ed || !confirm('Excluir essa consulta?')) return;
    setLoading(true);
    try { await api.saude.consultas.deletar(consulta.id, phone); onSuccess(); }
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
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-pink-100 dark:bg-pink-950/40">
              <CalendarHeart size={16} className="text-pink-600 dark:text-pink-400" />
            </div>
            <h2 className="text-base font-bold text-foreground">{ed ? 'Editar consulta' : 'Nova consulta'}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Especialidade</label>
            <select value={especialidade} onChange={e => setEsp(e.target.value)} className="input">
              <option value="">— Selecione —</option>
              {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Profissional</label>
            <input value={profissional} onChange={e => setProf(e.target.value)} placeholder="Dr. José Silva" className="input" maxLength={100} />
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

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Local</label>
            <input value={local} onChange={e => setLocal(e.target.value)} placeholder="Clínica, hospital, endereço..." className="input" maxLength={150} />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Observação</label>
            <textarea value={observacao} onChange={e => setObs(e.target.value)} rows={2} placeholder="Motivo, sintomas, anotações..." className="input resize-none" maxLength={300} />
          </div>

          {ed && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Status</label>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { v: 'agendada',  l: 'Agendada' },
                  { v: 'realizada', l: 'Realizada' },
                  { v: 'cancelada', l: 'Cancelada' },
                  { v: 'remarcada', l: 'Remarcada' },
                ].map(s => (
                  <button key={s.v} type="button" onClick={() => setStatus(s.v)}
                    className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                      status === s.v ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300' : 'border-border bg-muted/20 hover:border-violet-300'
                    }`}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data do retorno <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span></label>
            <input type="date" value={retornoData} onChange={e => setRetorno(e.target.value)} className="input" />
          </div>

          <div className="rounded-xl p-3 bg-muted/30 border border-border/40 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold text-foreground">Lembrete no WhatsApp</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">24h antes da consulta</p>
            </div>
            <button onClick={() => setLembrete(!lembrete)}
              className={`relative w-11 h-6 rounded-full transition-all ${lembrete ? 'bg-violet-600' : 'bg-muted'}`}>
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {ed ? 'Salvar' : 'Agendar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
