'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, Target, Bell } from 'lucide-react';
import { api } from '@/lib/api';

const BRAND = '#61D17B';

interface Props {
  phone: string;
  valorInicial?:        number;
  ativoInicial?:        boolean;
  alertaAtivoInicial?:  boolean;
  alertaPctInicial?:    number;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditarLimiteGeralModal({
  phone, valorInicial = 0, ativoInicial = true,
  alertaAtivoInicial = true, alertaPctInicial = 80,
  onClose, onSuccess,
}: Props) {
  const [valorRaw, setValorRaw]   = useState(String(Math.round((valorInicial || 0) * 100)));
  const [ativo,    setAtivo]      = useState(ativoInicial);
  const [alerta,   setAlerta]     = useState(alertaAtivoInicial);
  const [pct,      setPct]        = useState(alertaPctInicial);
  const [loading,  setLoading]    = useState(false);
  const [erro,     setErro]       = useState('');

  const valorFmt = (() => {
    if (!valorRaw) return '0,00';
    return (parseInt(valorRaw, 10) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  })();

  const valorBruto = parseInt(valorRaw || '0', 10) / 100;
  const valorAlerta = valorBruto * (pct / 100);

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    setValorRaw(e.target.value.replace(/\D/g, ''));
  }

  async function handleSalvar() {
    setErro('');
    if (!valorRaw || valorRaw === '0') {
      setErro('Informe o valor do limite geral.');
      return;
    }
    setLoading(true);
    try {
      await api.limites.setGeral({
        phone,
        valor: parseInt(valorRaw, 10) / 100,
        ativo,
        alerta_ativo: alerta,
        alerta_pct: pct,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar limite.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${BRAND}22` }}
            >
              <Target size={20} style={{ color: BRAND }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">
                Editar limite geral
              </h2>
              <p className="text-xs text-muted-foreground">
                Define o teto total dos seus gastos no mês.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Valor */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Valor do limite mensal *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={valorFmt}
                onChange={handleValor}
                autoFocus
                className="input pl-10 tabular text-right text-lg font-bold"
              />
            </div>
          </div>

          {/* Toggle: ativar */}
          <ToggleRow
            label="Ativar limite"
            description="Quando desativado, os cálculos seguem mas você não recebe avisos."
            value={ativo}
            onChange={setAtivo}
          />

          {/* Toggle: alerta WhatsApp */}
          <ToggleRow
            label="Receber alerta no WhatsApp"
            description="A Sora avisa quando você atingir o limite percentual."
            value={alerta}
            onChange={setAlerta}
            disabled={!ativo}
            icon={<Bell size={14} />}
          />

          {/* Slider de % alerta */}
          {alerta && ativo && (
            <div className="rounded-xl p-3 bg-muted/30 border border-border/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">Avisar ao atingir</span>
                <span className="text-sm font-bold tabular" style={{ color: BRAND }}>{pct}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={pct}
                onChange={e => setPct(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 tabular">
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
              {valorBruto > 0 && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                  📱 A Sora te avisará quando você atingir{' '}
                  <strong className="text-foreground tabular">
                    {valorAlerta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </strong>{' '}
                  ({pct}% de{' '}
                  {valorBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}).
                </p>
              )}
            </div>
          )}

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
            onClick={handleSalvar}
            disabled={loading}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar limite
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TOGGLE ROW (switch + label + description)
// ─────────────────────────────────────────────────────────────
interface ToggleRowProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function ToggleRow({ label, description, value, onChange, disabled, icon }: ToggleRowProps) {
  return (
    <div className={`flex items-start justify-between gap-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
          {icon}{label}
        </p>
        {description && (
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!value)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
          value ? 'bg-primary' : 'bg-muted-foreground/30'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        aria-pressed={value}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
