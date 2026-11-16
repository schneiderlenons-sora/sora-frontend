'use client';

// Registrar ou corrigir uma pesagem — com DATA (pedido de cliente, nov/2026:
// "não permite escolher a data"). Hoje vem marcado; dá pra escolher qualquer
// dia que já passou. A regra de gravação mora no backend
// (services/pesoRegistro.js): um peso por dia, nada no futuro.
//
// ⚠️ Portal pro body: os cards da Saúde usam backdrop-blur e prenderiam o fixed.

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Scale, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { parseNumeroDigitado } from '@/lib/formato-br';
import { hojeSP, fmtKg, type RegistroPeso } from '@/lib/peso';

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const semInscricao = () => () => {};

export default function ModalPeso({ phone, registro, datasComPeso = [], onClose, onSuccess }: {
  phone: string;
  /** Presente = corrigir este registro. */
  registro?: RegistroPeso | null;
  /** Dias que já têm pesagem (YYYY-MM-DD) — pra avisar ANTES de substituir. */
  datasComPeso?: string[];
  onClose: () => void;
  /** `aviso` diz o que aconteceu quando não é o óbvio (ex.: substituiu o do dia). */
  onSuccess: (aviso?: string) => void;
}) {
  const editando = !!registro?.id;
  const hoje = hojeSP();
  // Montado no cliente (o portal precisa de `document`) sem setState em efeito.
  const mounted = useSyncExternalStore(semInscricao, () => true, () => false);
  const [peso, setPeso] = useState(registro ? fmtKg(Number(String(registro.peso_kg).replace(',', '.'))) : '');
  const [data, setData] = useState(registro?.data?.slice(0, 10) || hoje);
  const [obs, setObs] = useState(registro?.observacao || '');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    const val = parseNumeroDigitado(peso, { dinheiro: false });
    if (!Number.isFinite(val) || val < 1 || val >= 600) { setErro('Informe um peso válido (ex.: 72,5).'); return; }
    if (!data) { setErro('Escolha a data da pesagem.'); return; }
    if (data > hoje) { setErro('A data não pode ser no futuro.'); return; }
    setLoading(true);
    try {
      if (editando) {
        await api.saude.pesos.editar(registro!.id, { peso_kg: val, data, observacao: obs.trim() || null });
        onSuccess('Pesagem corrigida.');
      } else {
        const r = await api.saude.pesos.criar({ phone, peso_kg: val, data, observacao: obs.trim() || undefined });
        onSuccess(r?.substituiu ? `Já havia um peso em ${ddmm(data)} — foi substituído por ${fmtKg(val)} kg.` : undefined);
      }
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui salvar. Tente de novo.');
    } finally { setLoading(false); }
  }

  if (!mounted) return null;

  return createPortal((
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4" onClick={() => !loading && onClose()}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-labelledby="peso-titulo"
           className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl overflow-hidden border border-border"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 dark:bg-primary/15">
              <Scale size={16} className="text-primary" />
            </div>
            <h2 id="peso-titulo" className="text-base font-bold text-foreground">
              {editando ? 'Corrigir pesagem' : 'Registrar peso'}
            </h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center">
            <label htmlFor="peso-valor" className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 block">Peso</label>
            <div className="flex items-baseline justify-center gap-1.5">
              <input
                id="peso-valor"
                type="text"
                inputMode="decimal"
                value={peso}
                onChange={e => setPeso(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="0,0"
                className="text-5xl font-bold text-foreground bg-transparent border-none outline-none text-center w-36 tabular"
                autoFocus={!editando}
              />
              <span className="text-xl font-bold text-muted-foreground">kg</span>
            </div>
          </div>

          <div>
            <label htmlFor="peso-data" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Data da pesagem
            </label>
            <input id="peso-data" type="date" value={data} max={hoje}
                   onChange={e => setData(e.target.value)}
                   className="input w-full" />
            {(() => {
              // Um peso por dia: registrar num dia que já tem substitui; corrigir
              // pra um dia que já tem é recusado pelo servidor (409).
              const ocupado = data && data !== registro?.data?.slice(0, 10) && datasComPeso.some(d => d.slice(0, 10) === data);
              if (ocupado) {
                return (
                  <p className="text-[11px] mt-1 text-amber-700 dark:text-amber-500">
                    {editando
                      ? `Já existe uma pesagem em ${ddmm(data)}. Escolha outro dia ou corrija aquela.`
                      : `Já existe uma pesagem em ${ddmm(data)} — ela será substituída por esta.`}
                  </p>
                );
              }
              if (!editando && data !== hoje) {
                return <p className="text-[11px] text-muted-foreground mt-1">Vai entrar no histórico em {ddmm(data)}.</p>;
              }
              return null;
            })()}
          </div>

          <input
            value={obs}
            onChange={e => setObs(e.target.value)}
            placeholder="Observação (opcional — ex.: em jejum)"
            aria-label="Observação"
            className="input w-full"
            maxLength={100}
          />

          {erro && (
            <div role="alert" className="rounded-xl p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2">
              <AlertCircle size={13} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 h-11 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !peso}
                  className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {editando ? 'Salvar' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
