'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, Receipt, Zap, Calendar, ArrowDownRight } from 'lucide-react';
import { api } from '@/lib/api';

const TIPOS_PAGAMENTO = [
  { v: 'parcela',       l: 'Parcela',         desc: 'Pagamento mensal regular',     icon: Receipt },
  { v: 'antecipacao',   l: 'Antecipação',     desc: 'Adiantar uma ou mais parcelas', icon: Zap     },
  { v: 'juros_atraso',  l: 'Juros de atraso', desc: 'Multa por parcela atrasada',    icon: Calendar},
] as const;

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

interface Props {
  phone:    string;
  divida:   any;
  onClose:   () => void;
  onSuccess: (quitada: boolean) => void;
}

export default function PagarParcelaModal({ phone, divida, onClose, onSuccess }: Props) {
  const valorPadrao = divida.valor_parcela || 0;
  const [valorRaw, setValorRaw] = useState<string>(
    valorPadrao ? String(Math.round(valorPadrao * 100)) : ''
  );
  const [tipo,    setTipo]    = useState<'parcela' | 'antecipacao' | 'juros_atraso'>('parcela');
  const [data,    setData]    = useState(new Date().toISOString().slice(0, 10));
  const [obs,     setObs]     = useState('');
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  const parcelasPagas = divida.parcelas_pagas || 0;
  const parcelasTotal = divida.parcelas_total || 0;
  const numeroAtual = parcelasPagas + 1;
  const restantes = Math.max(0, parcelasTotal - parcelasPagas);
  const ehUltima = numeroAtual >= parcelasTotal && parcelasTotal > 0;

  const fmtBR = (raw: string) =>
    !raw ? '0,00' : (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const valor = parseInt(valorRaw || '0', 10) / 100;

  async function salvar() {
    setErro('');
    if (!valor || valor <= 0) { setErro('Informe o valor pago.'); return; }
    setLoading(true);
    try {
      const r = await api.dividas.pagar(divida.id, {
        phone,
        valor,
        tipo,
        data_pagamento: data,
        observacao: obs.trim() || undefined,
        numero_parcela: tipo === 'parcela' || tipo === 'antecipacao' ? numeroAtual : undefined,
      });
      onSuccess(r.quitada);
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao registrar pagamento.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <ArrowDownRight size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">Registrar pagamento</h2>
              <p className="text-xs text-muted-foreground truncate">
                em <strong className="text-foreground">{divida.titulo}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Contexto da parcela */}
          {parcelasTotal > 0 && tipo === 'parcela' && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Parcela</span>
                {ehUltima && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-950/40">
                    <Check size={9} /> Última!
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-foreground tabular">
                {numeroAtual} <span className="text-muted-foreground/60 font-normal">/ {parcelasTotal}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{restantes - 1} restante{restantes - 1 === 1 ? '' : 's'} após este pagamento</p>
            </div>
          )}

          {/* Tipo de pagamento */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Tipo
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {TIPOS_PAGAMENTO.map(t => {
                const ativo = tipo === t.v;
                const Icon = t.icon;
                return (
                  <button
                    key={t.v}
                    onClick={() => setTipo(t.v as any)}
                    type="button"
                    title={t.desc}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      ativo
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border bg-muted/20 hover:border-primary/40'
                    }`}
                  >
                    <Icon size={14} className={ativo ? 'text-primary' : 'text-muted-foreground'} />
                    <span className="text-[10px] font-semibold text-foreground leading-tight text-center">{t.l}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Valor */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Valor pago</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">R$</span>
              <input
                inputMode="numeric"
                value={fmtBR(valorRaw)}
                onChange={e => setValorRaw(e.target.value.replace(/\D/g, ''))}
                className="text-4xl font-bold text-foreground bg-transparent border-none outline-none text-center w-full tabular"
                autoFocus
              />
            </div>
            {tipo === 'parcela' && valorPadrao > 0 && valor !== valorPadrao && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Padrão da parcela: <strong className="text-foreground tabular">{fmt(valorPadrao)}</strong>
              </p>
            )}
          </div>

          {/* Data */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Data do pagamento
            </label>
            <input
              type="date"
              value={data}
              onChange={e => setData(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="input"
            />
          </div>

          {/* Observação */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Observação <span className="text-muted-foreground/60 normal-case font-normal">(opcional)</span>
            </label>
            <input
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Ex: Pago pelo PIX, comprovante salvo"
              maxLength={120}
              className="input"
            />
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={loading || !valor}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Registrar pagamento
          </button>
        </div>
      </div>
    </div>
  );
}
