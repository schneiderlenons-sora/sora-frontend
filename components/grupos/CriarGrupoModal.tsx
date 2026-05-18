'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, Users } from 'lucide-react';
import { api } from '@/lib/api';

const EMOJIS = ['👨‍👩‍👧','👪','🏠','💑','👫','👬','👭','🎯','⭐','💚','🌟','🚀','🎉','🎁','💼','🏖️','⚽','🎮','🎵','🍕','🎨','🌈'];

interface Props {
  phone: string;
  limiteMembros: number;
  onClose: () => void;
  onSuccess: (grupo: any) => void;
}

export default function CriarGrupoModal({ phone, limiteMembros, onClose, onSuccess }: Props) {
  const [nome,    setNome]    = useState('');
  const [emoji,   setEmoji]   = useState('👨‍👩‍👧');
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  async function handleCriar() {
    setErro('');
    if (!nome.trim()) { setErro('Informe um nome para o grupo.'); return; }
    setLoading(true);
    try {
      const r = await api.grupos.criar({ phone, nome: nome.trim(), emoji });
      onSuccess(r.grupo);
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao criar grupo.');
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
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl bg-primary/15">
              {emoji}
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground leading-tight">Criar novo grupo</h2>
              <p className="text-xs text-muted-foreground">Compartilhe finanças com até {limiteMembros} pessoa{limiteMembros !== 1 ? 's' : ''}.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Nome do grupo *
            </label>
            <input
              type="text"
              value={nome}
              onChange={e => setNome(e.target.value)}
              autoFocus
              maxLength={40}
              placeholder='Ex: "Família Silva", "República 2026"'
              className="input"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
              Avatar
            </label>
            <div className="grid grid-cols-6 gap-1.5 p-2 rounded-xl bg-muted/30 border border-border">
              {EMOJIS.map(e => {
                const ativo = e === emoji;
                return (
                  <button
                    key={e}
                    onClick={() => setEmoji(e)}
                    className={`aspect-square rounded-lg flex items-center justify-center text-xl transition-all ${
                      ativo ? 'bg-primary/15 ring-2 ring-primary/40 scale-110' : 'hover:bg-card hover:scale-105'
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl p-3 bg-primary/5 border border-primary/15 flex items-start gap-2.5">
            <Users size={14} className="text-primary flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-foreground leading-relaxed">
              Você será o <strong>administrador</strong> do grupo. Pelo seu plano, pode ter até{' '}
              <strong>{limiteMembros} membros</strong> (incluindo você).
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
            onClick={handleCriar}
            disabled={loading}
            className="btn btn-primary px-4 py-2 text-sm gap-2 shadow-glow-sm"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Criar grupo
          </button>
        </div>
      </div>
    </div>
  );
}
