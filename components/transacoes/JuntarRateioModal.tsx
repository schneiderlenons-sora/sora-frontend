'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import { X, Loader2, Merge, AlertTriangle } from 'lucide-react';

// =============================================================================
// Juntar de volta um lançamento dividido (migration 152).
//
// ⚠️ MOSTRA AS PARTES ANTES DE JUNTAR. O usuário só vê a linha em que clicou;
// as outras partes podem estar em outra página da lista ou escondidas por um
// filtro. Juntar sem mostrar o que vai ser fundido é pedir confirmação de algo
// que ele não está vendo.
//
// ⚠️ É IRREVERSÍVEL COM UM CLIQUE — a divisão em categorias se perde. A tela diz
// isso, do mesmo jeito que o RatearModal diz que a divisão substitui a linha.
//
// ⚠️ createPortal(document.body): a lista vive em card com backdrop-blur, que
// vira containing block do position:fixed. Regra do CLAUDE.md.
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function JuntarRateioModal({
  phone, tx, partes, onClose, onSuccess,
}: {
  phone: string;
  tx: any;
  /** Todas as linhas do mesmo rateio_grupo que a tela já tem em mãos. */
  partes: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  useEffect(() => { setMontado(true); }, []);

  // ⚠️ As partes vêm da lista JÁ CARREGADA, então podem estar incompletas (a
  // lista é paginada). Por isso a tela nunca afirma um total: ela mostra o que
  // conseguiu ver e diz que quem soma de verdade é o servidor. Prometer um
  // número aqui e o servidor devolver outro seria pior que não prometer.
  const vistas = useMemo(
    () => (partes || []).filter((p) => p && p.rateio_grupo === tx.rateio_grupo),
    [partes, tx.rateio_grupo],
  );
  const somaVista = vistas.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const origem = tx.rateio_origem || null;

  async function juntar() {
    setSalvando(true); setErro('');
    try {
      const r = await api.transacoes.desfazerRateio(tx.rateio_grupo, phone);
      // O aviso do servidor (total mudou / categoria era palpite) é informação
      // que o usuário precisa, mas não impede o sucesso.
      if (r?.aviso) window.setTimeout(() => alert(r.aviso), 50);
      onSuccess(); onClose();
    } catch (e: any) {
      // 422 aqui é RECUSA EXPLICADA (partes em contas diferentes, por ex.), não
      // falha técnica — o texto vem pronto do backend e é o que o usuário lê.
      setErro(e?.message || 'Não consegui juntar. Tente de novo.');
    } finally { setSalvando(false); }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border animate-fade-in max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Juntar lançamento dividido"
      >
        <header className="flex items-start gap-3 p-5 pb-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
            <Merge size={18} style={{ color: BRAND }} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground leading-tight">Juntar de volta</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {tx.observacao || 'Lançamento dividido'}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar"
            className="grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
            style={{ width: 40, height: 40 }}>
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-3">
          <div className="rounded-2xl border border-border/60 overflow-hidden">
            {vistas.map((p, i) => (
              <div key={p.id}
                   className={`flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm ${i ? 'border-t border-border/50' : ''}`}>
                <span className="text-foreground truncate">{nomeCategoria(p.categoria)}</span>
                <span className="tabular text-muted-foreground flex-shrink-0">{fmt(Number(p.valor))}</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-t border-border bg-muted/30">
              <span className="text-sm font-semibold text-foreground">
                {vistas.length === 1 ? 'Esta parte' : `${vistas.length} partes`}
              </span>
              <span className="text-sm font-bold tabular" style={{ color: BRAND }}>{fmt(somaVista)}</span>
            </div>
          </div>

          <div className="rounded-2xl p-3.5 border border-border/60" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
            <p className="text-[12px] text-muted-foreground leading-snug">
              Vai virar <strong className="text-foreground">um lançamento só</strong>
              {origem?.categoria
                ? <> na categoria <strong className="text-foreground">{nomeCategoria(origem.categoria)}</strong>, que era a de antes da divisão.</>
                : <> na categoria da maior parte — esta divisão é anterior ao registro da categoria original.</>}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-2xl p-3 bg-muted/40 border border-border/60">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-[12px] leading-snug text-muted-foreground">
              A divisão em categorias <strong className="text-foreground">se perde</strong> — pra ter de
              volta é preciso dividir de novo. Seu saldo não muda: o valor total continua o mesmo,
              na mesma conta.
            </p>
          </div>

          {erro && <p className="text-[13px] text-red-600 dark:text-red-400 leading-snug">{erro}</p>}
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-border/60 flex items-center gap-2">
          <button onClick={onClose} className="btn-ghost px-4 text-sm flex-1" style={{ minHeight: 44 }}>
            Cancelar
          </button>
          <button
            onClick={juntar} disabled={salvando}
            className="btn btn-primary px-4 text-sm flex-1 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: 44, background: BRAND }}
          >
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Juntando…</> : 'Juntar de volta'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
