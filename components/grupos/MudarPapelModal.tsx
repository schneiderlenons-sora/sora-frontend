'use client';

import { useState } from 'react';
import { X, Loader2, AlertCircle, Check, Crown, Pencil, Eye } from 'lucide-react';
import { api } from '@/lib/api';

type Papel = 'admin' | 'escrita' | 'leitura';

const OPCOES: { papel: Papel; titulo: string; desc: string; icon: any; emoji: string }[] = [
  { papel: 'admin',   titulo: 'Admin',   desc: 'Pode gerenciar membros e configurações.', icon: Crown,  emoji: '👑' },
  { papel: 'escrita', titulo: 'Escrita', desc: 'Pode adicionar e editar transações.',     icon: Pencil, emoji: '✍️' },
  { papel: 'leitura', titulo: 'Leitura', desc: 'Apenas visualiza dados do grupo.',        icon: Eye,    emoji: '👀' },
];

interface Props {
  phone:    string;
  membroId: string;
  membroNome: string;
  papelAtual: Papel;
  onClose:    () => void;
  onSuccess:  () => void;
}

export default function MudarPapelModal({ phone, membroId, membroNome, papelAtual, onClose, onSuccess }: Props) {
  const [escolhido, setEscolhido] = useState<Papel>(papelAtual);
  const [loading,   setLoading]   = useState(false);
  const [erro,      setErro]      = useState('');

  async function handleSalvar() {
    if (escolhido === papelAtual) { onClose(); return; }
    setErro('');
    setLoading(true);
    try {
      await api.grupos.atualizarMembro(membroId, { phone, papel: escolhido });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao atualizar papel.');
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
          <div>
            <h2 className="text-base font-bold text-foreground leading-tight">Mudar papel</h2>
            <p className="text-xs text-muted-foreground truncate">de <strong className="text-foreground">{membroNome}</strong></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {OPCOES.map(({ papel, titulo, desc, emoji }) => {
            const ativo = escolhido === papel;
            return (
              <button
                key={papel}
                onClick={() => setEscolhido(papel)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                  ativo ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-muted/30 hover:border-primary/40'
                }`}
              >
                <div className="text-2xl flex-shrink-0">{emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{titulo}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                </div>
                {ativo && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}

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
            Salvar papel
          </button>
        </div>
      </div>
    </div>
  );
}
