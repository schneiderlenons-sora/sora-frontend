'use client';

import { useState } from 'react';
import { X, Loader2, AlertTriangle, ArrowRightLeft, Trash2, Check } from 'lucide-react';
import { api } from '@/lib/api';

type Conta = { id: string; nome: string; tipo?: string };

// Fluxo de exclusão de conta que NUNCA deixa transações órfãs:
//  1) tenta excluir; se a conta tiver lançamentos, o backend responde 409 e
//  2) o modal pergunta: mover os lançamentos pra outra conta OU excluí-los junto.
export default function ExcluirContaModal({
  conta, contas, onClose, onExcluida,
}: {
  conta: Conta;
  contas: Conta[];                                  // todas as contas do grupo
  onClose: () => void;
  onExcluida: (info: { movidas: number; excluidas: number }) => void;
}) {
  const outras = contas.filter(c => c.id !== conta.id);
  const [fase, setFase] = useState<'confirmar' | 'escolher'>('confirmar');
  const [count, setCount] = useState(0);
  const [acao, setAcao] = useState<'mover' | 'excluir'>(outras.length ? 'mover' : 'excluir');
  const [destino, setDestino] = useState(outras[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function excluirDireto() {
    setErro(''); setLoading(true);
    try {
      const r = await api.wallets.deletar(conta.id);
      onExcluida({ movidas: r.movidas || 0, excluidas: r.excluidas || 0 });
      onClose();
    } catch (e: any) {
      if (e?.body?.motivo === 'conta_com_transacoes') {
        setCount(e.body.count || 0);
        setAcao(outras.length ? 'mover' : 'excluir');
        setFase('escolher');
      } else {
        setErro(e?.message || 'Erro ao excluir.');
      }
    } finally { setLoading(false); }
  }

  async function confirmarComAcao() {
    setErro('');
    if (acao === 'mover' && !destino) { setErro('Escolha a conta destino.'); return; }
    setLoading(true);
    try {
      const r = await api.wallets.deletar(conta.id,
        acao === 'mover' ? { transacoes: 'mover', destino } : { transacoes: 'excluir' });
      onExcluida({ movidas: r.movidas || 0, excluidas: r.excluidas || 0 });
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao excluir.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-fade-in"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-red-500/15">
              <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-base font-bold text-foreground truncate">Excluir conta</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {fase === 'confirmar' ? (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tem certeza que quer excluir a conta <strong className="text-foreground">{conta.nome}</strong>?
              Se ela tiver lançamentos, eu pergunto o que fazer com eles antes.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                A conta <strong className="text-foreground">{conta.nome}</strong> tem{' '}
                <strong className="text-foreground">{count}</strong> lançamento{count !== 1 ? 's' : ''}.
                O que fazer com {count !== 1 ? 'eles' : 'ele'}?
              </p>

              {/* Opção: mover */}
              <button type="button" disabled={!outras.length} onClick={() => setAcao('mover')}
                className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
                  acao === 'mover' ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border bg-muted/20 hover:border-primary/40'
                } ${!outras.length ? 'opacity-40 cursor-not-allowed' : ''}`}>
                <div className="flex items-center gap-2.5">
                  <ArrowRightLeft size={16} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Mover para outra conta</p>
                    <p className="text-[11px] text-muted-foreground">Mantém o histórico; ajusta o saldo da conta destino.</p>
                  </div>
                  {acao === 'mover' && <Check size={15} className="text-primary flex-shrink-0" />}
                </div>
                {acao === 'mover' && outras.length > 0 && (
                  <select value={destino} onChange={e => { e.stopPropagation(); setDestino(e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    className="mt-3 w-full px-3 h-10 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary">
                    {outras.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                )}
                {!outras.length && (
                  <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">Você não tem outra conta pra onde mover.</p>
                )}
              </button>

              {/* Opção: excluir junto */}
              <button type="button" onClick={() => setAcao('excluir')}
                className={`w-full text-left rounded-2xl border p-3.5 transition-all ${
                  acao === 'excluir' ? 'border-red-500 bg-red-500/5 ring-1 ring-red-500/30' : 'border-border bg-muted/20 hover:border-red-500/40'
                }`}>
                <div className="flex items-center gap-2.5">
                  <Trash2 size={16} className="text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Excluir os lançamentos junto</p>
                    <p className="text-[11px] text-muted-foreground">Apaga a conta e {count !== 1 ? 'os' : 'o'} {count} lançamento{count !== 1 ? 's' : ''}. Não dá pra desfazer.</p>
                  </div>
                  {acao === 'excluir' && <Check size={15} className="text-red-600 dark:text-red-400 flex-shrink-0" />}
                </div>
              </button>
            </>
          )}

          {erro && (
            <div className="rounded-xl p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-400">
              {erro}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={fase === 'escolher' ? () => setFase('confirmar') : onClose}
                  disabled={loading} className="btn-ghost px-4 py-2 text-sm">
            {fase === 'escolher' ? 'Voltar' : 'Cancelar'}
          </button>
          <button onClick={fase === 'confirmar' ? excluirDireto : confirmarComAcao}
                  disabled={loading || (fase === 'escolher' && acao === 'mover' && !destino)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 transition-colors">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {fase === 'confirmar' ? 'Excluir' : (acao === 'mover' ? 'Mover e excluir conta' : 'Excluir tudo')}
          </button>
        </div>
      </div>
    </div>
  );
}
