'use client';

// =============================================================================
// "MOVIMENTAÇÃO ENTRE SUAS CONTAS?" — o par saída × entrada.
//
// Relato (Vander, out/2026): R$ 11.900 saem do Inter PJ e entram no BTG; sem a
// marca de transferência, a Sora conta o valor como GASTO e como RECEITA.
//
// ⚠️ SÓ SUGESTÃO. A régua (services/transferenciaPropria.js) tem falso
// positivo MEDIDO — dois Pix de mesmo valor pra pessoas diferentes no mesmo
// dia. Por isso cada par pede a confirmação da pessoa, e "Não é" esconde o par
// neste navegador. O servidor reconfere o par antes de marcar.
//
// Marcar não mexe em saldo (o dinheiro saiu de uma conta e entrou na outra de
// verdade); só tira os dois lançamentos do gasto e da receita. "Desfazer" fica
// no próprio item — sem toast pra caçar.
// =============================================================================

import { useState } from 'react';
import { ArrowRightLeft, ArrowRight, Check, Loader2, Undo2 } from 'lucide-react';
import type { ParConciliavelTx } from '@/lib/api';
import { fmtDataBR } from '@/lib/data-br';
import { useDinheiro } from '@/lib/moeda-base';
import { useFmt } from '@/lib/valores-ocultos';

export type ParTransferencia = { saida: ParConciliavelTx; entrada: ParConciliavelTx };

const CHAVE = 'sora-transf-dispensados-v1';
export const idParTransf = (p: ParTransferencia) => `${p.saida.id}:${p.entrada.id}`;

export function lerTransfDispensados(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return new Set(Array.isArray(v) ? v.map(String) : []);
  } catch { return new Set(); }
}

function dispensar(p: ParTransferencia) {
  try {
    const s = lerTransfDispensados(); s.add(idParTransf(p));
    localStorage.setItem(CHAVE, JSON.stringify([...s].slice(-200)));
  } catch { /* storage bloqueado: só nesta sessão */ }
}

// Mesmo critério de contraste do ConciliarBanco: o verde da marca como TEXTO
// não passa 4,5:1 no claro.
const TEXTO_VERDE = 'text-emerald-700 dark:text-[hsl(var(--primary))]';

type Estado = 'marcando' | 'feito' | 'desfazendo' | 'erro';

export default function TransferenciaSugestoes({ pares, onDispensar, onMarcar, onDesfazer }: {
  pares: ParTransferencia[];
  onDispensar: (p: ParTransferencia) => void;
  /** Marca as duas pontas. Rejeita com a mensagem do servidor. */
  onMarcar: (p: ParTransferencia) => Promise<void>;
  onDesfazer: (p: ParTransferencia) => Promise<void>;
}) {
  const fmt = useFmt(useDinheiro());
  const [estado, setEstado] = useState<Record<string, Estado>>({});
  const [erro, setErro] = useState<Record<string, string>>({});
  // Os pares marcados nesta visita ficam na lista (com "Desfazer") mesmo depois
  // que o servidor deixa de sugeri-los.
  const [feitos, setFeitos] = useState<ParTransferencia[]>([]);

  const lista = [...feitos, ...pares.filter((p) => !feitos.some((f) => idParTransf(f) === idParTransf(p)))];
  if (!lista.length) return null;
  const pendentes = lista.filter((p) => estado[idParTransf(p)] !== 'feito').length;

  async function marcar(p: ParTransferencia) {
    const id = idParTransf(p);
    setEstado((e) => ({ ...e, [id]: 'marcando' })); setErro((e) => ({ ...e, [id]: '' }));
    try {
      await onMarcar(p);
      setFeitos((f) => (f.some((x) => idParTransf(x) === id) ? f : [...f, p]));
      setEstado((e) => ({ ...e, [id]: 'feito' }));
    } catch (err: any) {
      setEstado((e) => ({ ...e, [id]: 'erro' }));
      setErro((e) => ({ ...e, [id]: err?.message || 'Não consegui marcar agora.' }));
    }
  }

  async function desfazer(p: ParTransferencia) {
    const id = idParTransf(p);
    setEstado((e) => ({ ...e, [id]: 'desfazendo' }));
    try {
      await onDesfazer(p);
      setFeitos((f) => f.filter((x) => idParTransf(x) !== id));
      setEstado((e) => { const n = { ...e }; delete n[id]; return n; });
    } catch (err: any) {
      setEstado((e) => ({ ...e, [id]: 'feito' }));
      setErro((e) => ({ ...e, [id]: err?.message || 'Não consegui desfazer agora.' }));
    }
  }

  return (
    <section aria-labelledby="transf-titulo" className="card rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-fade-in"
             style={{ boxShadow: 'inset 0 0 0 1px hsl(var(--primary) / 0.35)' }}>
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none" aria-hidden="true"
           style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 70%)' }} />

      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.14)' }}>
          <ArrowRightLeft size={18} style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 id="transf-titulo" className="font-semibold text-foreground flex items-center gap-2">
            Movimentação entre suas contas?
            {pendentes > 0 && (
              <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full text-foreground" style={{ background: 'hsl(var(--primary) / 0.18)' }}>
                {pendentes}
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Saiu de uma conta e entrou em outra, mesmo valor e dia. Se foi você movendo o próprio dinheiro,
            marque como transferência: deixa de contar como gasto e como receita. O saldo não muda.
          </p>
        </div>
      </div>

      <ul className="relative mt-3 space-y-2">
        {lista.map((p) => {
          const id = idParTransf(p);
          const st = estado[id];
          const feito = st === 'feito' || st === 'desfazendo';
          return (
            <li key={id} className="rounded-xl border border-border/60 p-3" style={{ background: 'hsl(var(--bg-card))' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                    <span className="truncate">{p.saida.carteira_nome}</span>
                    <ArrowRight size={13} className="text-muted-foreground flex-shrink-0" aria-label="para" />
                    <span className="truncate">{p.entrada.carteira_nome}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmtDataBR(p.saida.data)} · “{(p.saida.observacao || '').trim() || 'saída'}” / “{(p.entrada.observacao || '').trim() || 'entrada'}”
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{fmt(p.saida.valor)}</span>
              </div>

              {feito ? (
                <div className="mt-2.5 flex items-center justify-between gap-2" role="status">
                  <span className={`text-xs font-semibold inline-flex items-center gap-1 ${TEXTO_VERDE}`}>
                    <Check size={13} aria-hidden="true" /> Marcado como transferência
                  </span>
                  <button type="button" onClick={() => desfazer(p)} disabled={st === 'desfazendo'}
                          className="min-h-[44px] px-3 -mr-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 disabled:opacity-60">
                    {st === 'desfazendo' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <Undo2 size={13} aria-hidden="true" />}
                    Desfazer
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 grid grid-cols-2 sm:flex sm:justify-end gap-2">
                  <button type="button" onClick={() => { dispensar(p); onDispensar(p); }} disabled={st === 'marcando'}
                          className="btn-ghost min-h-[44px] px-4 text-sm text-muted-foreground disabled:opacity-50">
                    Não é
                  </button>
                  <button type="button" onClick={() => marcar(p)} disabled={st === 'marcando'} aria-busy={st === 'marcando'}
                          className="btn-primary min-h-[44px] px-3 sm:px-4 text-sm font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5 disabled:opacity-70">
                    {st === 'marcando' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ArrowRightLeft size={15} className="hidden sm:inline" aria-hidden="true" />}
                    É transferência
                  </button>
                </div>
              )}
              {erro[id] && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2">{erro[id]}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
