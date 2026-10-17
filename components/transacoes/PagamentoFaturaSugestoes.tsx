'use client';

// =============================================================================
// "ESTA SAÍDA PAGOU A FATURA?" — pagamento que só aparece na conta corrente.
//
// O cliente paga a fatura por débito na conta e o pagamento nunca chega pelo
// cartão: a fatura fica "vencida em aberto" e a saída da conta conta como
// GASTO em cima das compras do cartão (dobro). Medido em 16/10/2026: 7 faturas
// na base com UMA saída de conta no valor exato, entre o fechamento e 7 dias
// após o vencimento ("PGTO PEND CARTAO", "NEON PAGAMENTOS"…).
//
// ⚠️ SÓ SUGESTÃO, o cliente confirma. Confirmar registra a saída como
// pagamento DAQUELA fatura e a tira do gasto — o saldo não muda (a saída já
// debitou a conta). "Desfazer" fica no próprio item.
// =============================================================================

import { useState } from 'react';
import { CreditCard, Check, Loader2, Undo2 } from 'lucide-react';
import { fmtDataBR } from '@/lib/data-br';
import { useDinheiro } from '@/lib/moeda-base';
import { useFmt } from '@/lib/valores-ocultos';

export type ParPagamentoFatura = {
  saida: { id: string; valor: number; observacao: string | null; carteira_nome: string | null; data: string };
  fatura: { cartao_id: string; cartao_nome: string; competencia: string; fatura: number; restante: number; venc: string };
};

const CHAVE = 'sora-pagfat-dispensados-v1';
export const idParPagFat = (p: ParPagamentoFatura) => `${p.saida.id}:${p.fatura.cartao_id}:${p.fatura.competencia}`;

export function lerPagFatDispensados(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return new Set(Array.isArray(v) ? v.map(String) : []);
  } catch { return new Set(); }
}

function dispensar(p: ParPagamentoFatura) {
  try {
    const s = lerPagFatDispensados(); s.add(idParPagFat(p));
    localStorage.setItem(CHAVE, JSON.stringify([...s].slice(-200)));
  } catch { /* storage bloqueado */ }
}

/** 'YYYY-MM' → 'outubro'. Dia 15 ao meio-dia: nenhum fuso desloca o mês. */
const mesLongo = (ym: string) => /^\d{4}-\d{2}$/.test(ym)
  ? new Date(`${ym}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' })
  : 'este mês';

const TEXTO_VERDE = 'text-emerald-700 dark:text-[hsl(var(--primary))]';
type Estado = 'marcando' | 'feito' | 'desfazendo';

export default function PagamentoFaturaSugestoes({ pares, onDispensar, onVincular, onDesfazer }: {
  pares: ParPagamentoFatura[];
  onDispensar: (p: ParPagamentoFatura) => void;
  onVincular: (p: ParPagamentoFatura) => Promise<void>;
  onDesfazer: (p: ParPagamentoFatura) => Promise<void>;
}) {
  const fmt = useFmt(useDinheiro());
  const [estado, setEstado] = useState<Record<string, Estado>>({});
  const [erro, setErro] = useState<Record<string, string>>({});
  const [feitos, setFeitos] = useState<ParPagamentoFatura[]>([]);

  const lista = [...feitos, ...pares.filter((p) => !feitos.some((f) => idParPagFat(f) === idParPagFat(p)))];
  if (!lista.length) return null;
  const pendentes = lista.filter((p) => estado[idParPagFat(p)] !== 'feito').length;

  async function vincular(p: ParPagamentoFatura) {
    const id = idParPagFat(p);
    setEstado((e) => ({ ...e, [id]: 'marcando' })); setErro((e) => ({ ...e, [id]: '' }));
    try {
      await onVincular(p);
      setFeitos((f) => (f.some((x) => idParPagFat(x) === id) ? f : [...f, p]));
      setEstado((e) => ({ ...e, [id]: 'feito' }));
    } catch (err: any) {
      setEstado((e) => { const n = { ...e }; delete n[id]; return n; });
      setErro((e) => ({ ...e, [id]: err?.message || 'Não consegui registrar agora.' }));
    }
  }

  async function desfazer(p: ParPagamentoFatura) {
    const id = idParPagFat(p);
    setEstado((e) => ({ ...e, [id]: 'desfazendo' }));
    try {
      await onDesfazer(p);
      setFeitos((f) => f.filter((x) => idParPagFat(x) !== id));
      setEstado((e) => { const n = { ...e }; delete n[id]; return n; });
    } catch (err: any) {
      setEstado((e) => ({ ...e, [id]: 'feito' }));
      setErro((e) => ({ ...e, [id]: err?.message || 'Não consegui desfazer agora.' }));
    }
  }

  return (
    <section aria-labelledby="pagfat-titulo" className="card rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-fade-in"
             style={{ boxShadow: 'inset 0 0 0 1px hsl(var(--primary) / 0.35)' }}>
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none" aria-hidden="true"
           style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.14) 0%, transparent 70%)' }} />

      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(var(--primary) / 0.14)' }}>
          <CreditCard size={18} style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 id="pagfat-titulo" className="font-semibold text-foreground flex items-center gap-2">
            Pagou alguma fatura?
            {pendentes > 0 && (
              <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full text-foreground" style={{ background: 'hsl(var(--primary) / 0.18)' }}>
                {pendentes}
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Uma saída da sua conta tem o valor exato de uma fatura em aberto. Se foi o pagamento,
            confirme: a fatura fica paga e a saída deixa de contar como gasto. O saldo não muda.
          </p>
        </div>
      </div>

      <ul className="relative mt-3 space-y-2">
        {lista.map((p) => {
          const id = idParPagFat(p);
          const st = estado[id];
          const feito = st === 'feito' || st === 'desfazendo';
          return (
            <li key={id} className="rounded-xl border border-border/60 p-3" style={{ background: 'hsl(var(--bg-card))' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Fatura de {mesLongo(p.fatura.competencia)} · {p.fatura.cartao_nome}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Saiu de {p.saida.carteira_nome} em {fmtDataBR(p.saida.data)} · “{(p.saida.observacao || '').trim() || 'saída'}”
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{fmt(p.saida.valor)}</span>
              </div>

              {feito ? (
                <div className="mt-2.5 flex items-center justify-between gap-2" role="status">
                  <span className={`text-xs font-semibold inline-flex items-center gap-1 ${TEXTO_VERDE}`}>
                    <Check size={13} aria-hidden="true" /> Fatura registrada como paga
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
                    Não foi
                  </button>
                  <button type="button" onClick={() => vincular(p)} disabled={st === 'marcando'} aria-busy={st === 'marcando'}
                          className="btn-primary min-h-[44px] px-3 sm:px-4 text-sm font-semibold whitespace-nowrap inline-flex items-center justify-center gap-1.5 disabled:opacity-70">
                    {st === 'marcando' ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} className="hidden sm:inline" aria-hidden="true" />}
                    Foi o pagamento
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
