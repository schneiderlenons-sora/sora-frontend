'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, KeyRound } from 'lucide-react';
import { api } from '@/lib/api';

interface Props {
  phone: string;
  onClose:   () => void;
  onSuccess: () => void;
}

export default function EntrarGrupoModal({ phone, onClose, onSuccess }: Props) {
  const [codigo,  setCodigo]  = useState('');
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  async function handleEntrar() {
    setErro('');
    const code = codigo.toUpperCase().trim();
    if (code.length < 4) { setErro('Informe o código de convite.'); return; }
    setLoading(true);
    try {
      await api.grupos.aceitar(phone, code);
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Código inválido ou expirado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/15">
              <KeyRound size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Entrar em um grupo</h2>
              <p className="text-xs text-muted-foreground">Use o código que recebeu do admin.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Código de convite
            </label>
            <input
              type="text"
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              onKeyDown={e => { if (e.key === 'Enter') handleEntrar(); }}
              autoFocus
              placeholder="ABC123"
              className="input text-center text-2xl font-mono font-bold tracking-[0.4em] tabular py-3"
            />
            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
              O código tem 6 caracteres e foi compartilhado pelo administrador do grupo.
            </p>
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
            onClick={handleEntrar}
            disabled={loading || codigo.length < 4}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Entrar no grupo
          </button>
        </div>
      </div>
    </div>
  );
}
