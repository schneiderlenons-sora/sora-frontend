'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, Target, Bell, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  phone: string;
  categoria: { id?: string; nome: string; icone?: string; cor?: number };
  limiteExistente?: { id?: string; limite_mensal?: number; percentual_alerta?: number } | null;
  mesRef: string; // YYYY-MM
  onClose: () => void;
  onSuccess: () => void;
}

export default function DefinirLimiteModal({
  phone, categoria, limiteExistente, mesRef, onClose, onSuccess,
}: Props) {
  const ediMode = !!limiteExistente?.limite_mensal;

  const [valorRaw, setValorRaw] = useState(
    limiteExistente?.limite_mensal
      ? String(Math.round(limiteExistente.limite_mensal * 100))
      : ''
  );
  const [alerta, setAlerta]   = useState(limiteExistente?.percentual_alerta ?? 80);
  const [loading, setLoading] = useState(false);
  const [erro, setErro]       = useState('');

  const valorFmt = (() => {
    if (!valorRaw) return '0,00';
    return (parseInt(valorRaw, 10) / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  })();

  function handleValor(e: React.ChangeEvent<HTMLInputElement>) {
    setValorRaw(e.target.value.replace(/\D/g, ''));
  }

  async function handleSalvar() {
    setErro('');
    if (!valorRaw || valorRaw === '0') {
      setErro('Informe o valor do limite.');
      return;
    }
    setLoading(true);
    try {
      const valor = parseInt(valorRaw, 10) / 100;
      await api.limites.setCategoria({
        phone,
        categoria: categoria.nome,
        limite_mensal: valor,
        percentual_alerta: alerta,
        mes_referencia: mesRef,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar limite.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemover() {
    if (!limiteExistente?.id) { onClose(); return; }
    if (!confirm('Remover o limite desta categoria?')) return;
    setLoading(true);
    try {
      await api.limites.deletar(limiteExistente.id);
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao remover limite.');
    } finally {
      setLoading(false);
    }
  }

  const corBg = categoria.cor !== undefined
    ? `hsl(${categoria.cor} 75% 50% / 0.15)`
    : 'hsl(var(--bg-muted))';
  const corFg = categoria.cor !== undefined
    ? `hsl(${categoria.cor} 65% 50%)`
    : 'hsl(var(--fg))';

  // Preview do valor alertado
  const valorBruto = parseInt(valorRaw || '0', 10) / 100;
  const valorAlerta = valorBruto * (alerta / 100);

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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: corBg, color: corFg }}
            >
              {categoria.icone || '📦'}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground leading-tight">
                {ediMode ? 'Editar limite' : 'Definir limite'}
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                Para: <strong className="text-foreground">{categoria.nome}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Valor */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block flex items-center gap-1.5">
              <Target size={11} /> Limite mensal *
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
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Valor máximo que você pretende gastar nesta categoria por mês.
            </p>
          </div>

          {/* Alerta */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Bell size={11} /> Alerta em
              </label>
              <span className="text-sm font-bold text-foreground tabular">
                {alerta}%
              </span>
            </div>

            <input
              type="range"
              min={50}
              max={100}
              step={5}
              value={alerta}
              onChange={e => setAlerta(parseInt(e.target.value, 10))}
              className="w-full accent-primary"
            />

            <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 tabular">
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>

            {valorBruto > 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Você receberá um aviso no WhatsApp quando atingir{' '}
                <strong className="text-foreground tabular">
                  {valorAlerta.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}
                </strong>{' '}
                ({alerta}% do limite).
              </p>
            )}
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <div>
            {ediMode && (
              <button
                onClick={handleRemover}
                disabled={loading}
                className="btn-ghost px-3 py-2 text-sm gap-1.5 text-red-600 dark:text-red-400"
              >
                <Trash2 size={13} />
                Remover
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
            <button
              onClick={handleSalvar}
              disabled={loading}
              className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {ediMode ? 'Salvar' : 'Definir limite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
