'use client';

// Passar o saldo de uma fatura ATRASADA pra próxima — com ou sem juros.
//
// ⚠️ É ESCOLHA da pessoa (nov/2026, decisão do dono). Antes a Sora rolava
// sozinha 24h depois do vencimento e a fatura vencida sumia da tela como se
// estivesse paga (relato do Fábio). A regra mora no backend
// (`services/faturaRollover.js` → `rolarFatura`): valor recalculado na hora,
// só fatura vencida, um toque = um lançamento. Os juros entram como um GASTO
// de verdade ("Juros"), porque é dinheiro novo que o banco cobrou.
//
// ⚠️ Portal pro body: o card do cartão tem animação/blur e prenderia o fixed.

import { useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { api, type FaturaAtrasada } from '@/lib/api';
import { useDinheiro, useSimboloMoeda, useMoedaBase } from '@/lib/moeda-base';
import { valorDasUnidades, textoDasUnidades } from '@/lib/moeda';
import { nomeDoMesFatura, mesSeguinteFatura, ddmmFatura } from '@/lib/fatura-atrasada';

const semInscricao = () => () => {};

interface Props {
  cartaoId: string;
  cartaoNome: string;
  atrasada: FaturaAtrasada;
  onClose: () => void;
  /** Depois de passar com sucesso. `msg` é o que a tela confirma. */
  onPassada: (msg: string) => void;
}

export default function PassarFaturaModal({ cartaoId, cartaoNome, atrasada, onClose, onPassada }: Props) {
  const fmt = useDinheiro({ entrada: 'ouZero' });
  const simbolo = useSimboloMoeda();
  const moeda = useMoedaBase();
  const [comJuros, setComJuros] = useState(false);
  const [jurosRaw, setJurosRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  // Montado no cliente (o portal precisa de `document`) sem setState em efeito.
  const mounted = useSyncExternalStore(semInscricao, () => true, () => false);

  const mes = nomeDoMesFatura(atrasada.competencia);
  const mesDestino = nomeDoMesFatura(mesSeguinteFatura(atrasada.competencia));
  const juros = comJuros ? valorDasUnidades(parseInt(jurosRaw || '0', 10), moeda) : 0;
  const total = atrasada.restante + juros;
  const faltaJuros = comJuros && !(juros > 0);

  async function passar() {
    setErro('');
    if (faltaJuros) { setErro('Informe o valor dos juros, ou escolha "Sem juros".'); return; }
    setLoading(true);
    try {
      const r = await api.wallets.rolarFatura({ cartao_id: cartaoId, competencia: atrasada.competencia, juros: comJuros ? juros : 0 });
      onPassada(r.jaRolado
        ? `A fatura de ${mes} já tinha sido passada pra próxima.`
        : `Fatura de ${mes} passada pra ${mesDestino}: ${fmt((r.valor ?? atrasada.restante) + (r.juros ?? 0))}.`);
      onClose();
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui passar a fatura. Tente de novo.');
    } finally { setLoading(false); }
  }

  if (!mounted) return null;

  return createPortal((
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4"
         onClick={(e) => { e.stopPropagation(); if (!loading) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-labelledby="passar-titulo"
           className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[92dvh] flex flex-col"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-500/15">
              <ArrowRight size={20} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 id="passar-titulo" className="text-base font-bold text-foreground leading-tight">Passar pra próxima fatura</h2>
              <p className="text-xs text-muted-foreground truncate">{cartaoNome}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain">
          <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 px-3.5 py-3">
            <p className="text-[12px] font-semibold text-red-700 dark:text-red-300 inline-flex items-center gap-1.5">
              <AlertTriangle size={13} /> Fatura de {mes} · venceu em {ddmmFatura(atrasada.venc)}
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-sm text-red-800/90 dark:text-red-200/90">Em aberto</span>
              <strong className="text-lg tabular text-red-800 dark:text-red-200">{fmt(atrasada.restante)}</strong>
            </div>
          </div>

          <div role="radiogroup" aria-label="Juros" className="grid grid-cols-2 gap-2">
            {[
              { v: false, titulo: 'Sem juros', sub: 'Só o valor em aberto' },
              { v: true, titulo: 'Com juros', sub: 'Somar os juros cobrados' },
            ].map((o) => {
              const ativo = comJuros === o.v;
              return (
                <button key={String(o.v)} type="button" role="radio" aria-checked={ativo}
                        onClick={() => { setComJuros(o.v); setErro(''); }}
                        className={`min-h-[56px] rounded-xl px-3 py-2.5 text-left border transition-colors ${ativo
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                          : 'border-border hover:bg-muted/50'}`}>
                  <span className="block text-sm font-bold text-foreground">{o.titulo}</span>
                  <span className="block text-[11px] text-muted-foreground">{o.sub}</span>
                </button>
              );
            })}
          </div>

          {comJuros && (
            <div className="animate-fade-in">
              <label htmlFor="passar-juros" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Valor dos juros
              </label>
              <div className="flex items-baseline gap-1 input py-2.5">
                <span className="text-sm font-bold text-muted-foreground">{simbolo}</span>
                <input id="passar-juros" inputMode="numeric" autoFocus
                       value={textoDasUnidades(jurosRaw ? parseInt(jurosRaw, 10) : 0, moeda)}
                       onChange={(e) => { setJurosRaw(e.target.value.replace(/\D/g, '')); setErro(''); }}
                       className="text-lg font-bold text-foreground bg-transparent border-none outline-none w-full tabular p-0" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Use o valor que aparece na fatura do banco. Ele entra como um gasto de &ldquo;Juros&rdquo; na fatura de {mesDestino}.
              </p>
            </div>
          )}

          <div className="rounded-xl bg-muted/40 px-3.5 py-2.5 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Saldo de {mes}</span>
              <span className="tabular text-foreground">{fmt(atrasada.restante)}</span>
            </div>
            {comJuros && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Juros</span>
                <span className="tabular text-foreground">+ {fmt(juros)}</span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border/50 pt-1.5">
              <span className="font-semibold text-foreground">Entra na fatura de {mesDestino}</span>
              <strong className="tabular text-foreground">{fmt(total)}</strong>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {`A fatura de ${mes} deixa de aparecer como atrasada. Se você já pagou, use “Pagar fatura” em vez disto.`}
          </p>

          {erro && <p className="text-xs text-red-600 font-medium" role="alert">{erro}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-border bg-muted/20 shrink-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button onClick={onClose} className="btn-ghost px-4 h-11 text-sm">Cancelar</button>
          <button onClick={passar} disabled={loading}
                  className="btn btn-primary px-4 h-11 text-sm gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Passar {fmt(total)}
          </button>
        </div>
      </div>
    </div>
  ), document.body);
}
