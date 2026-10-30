'use client';

// Débitos do extrato que parecem ter pago a parcela de uma dívida.
//
// Relato (Robert, out/2026): o extrato do Banco do Brasil trazia o débito do
// empréstimo e a parcela seguia "não paga" — nada ligava um ao outro. A régua
// mora no backend (services/baixaDivida.js); aqui só se MOSTRA e se confirma.
//
// ⚠️ É SUGESTÃO, nunca automático: o banco cobra um pouco mais que a parcela
// cadastrada (727,12 × 720,34), então a pessoa confere antes. E dar baixa NÃO
// desconta da conta — o dinheiro já saiu, é o próprio débito.

import { useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { Landmark, Check, Loader2 } from 'lucide-react';
import { api, type SugestaoBaixaDivida } from '@/lib/api';
import { useConfirmar } from '@/contexts/ConfirmContext';
import { useDinheiro } from '@/lib/moeda-base';
import { useValores } from '@/lib/valores-ocultos';

export const chaveConciliacaoDividas = (phone?: string | null) => (phone ? `dividas-conciliacao:${phone}` : null);

/** `useSWR` direto, não `useApi`: o `useApi` cobriria a página inteira no
 *  LoadingGate por causa de um quadro secundário. */
export function useConciliacaoDividas(phone?: string | null) {
  return useSWR(chaveConciliacaoDividas(phone), () => api.dividas.conciliacao(phone!), { revalidateOnFocus: false });
}

/** 'YYYY-MM-DD' → 'dd/mm' (sem Date: a data já vem no fuso de SP). */
export const diaMes = (iso: string) => {
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : iso;
};

const semInscricao = () => () => {};

const CHAVE_DISPENSADAS = 'sora-baixa-divida-dispensadas-v1';
const chaveDe = (s: SugestaoBaixaDivida) => `${s.divida_id}|${s.transacao.id}`;

function lerDispensadas(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CHAVE_DISPENSADAS) : null;
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function gravarDispensadas(s: Set<string>) {
  try { window.localStorage.setItem(CHAVE_DISPENSADAS, JSON.stringify([...s].slice(-200))); } catch { /* sem storage: some só nesta visita */ }
}

export default function SugestoesBaixa({ phone, onBaixa }: { phone: string; onBaixa: (titulo: string) => void }) {
  const fmt = useDinheiro({ entrada: 'ouZero' });
  const { ocultos } = useValores();
  const confirmar = useConfirmar();
  const { data, mutate } = useConciliacaoDividas(phone);
  // Só no navegador: no servidor não há localStorage nem o cache do SWR, e
  // decidir no 1º render daria HTML diferente do servidor (hydration).
  const montado = useSyncExternalStore(semInscricao, () => true, () => false);
  const salvas = useMemo(() => (montado ? lerDispensadas() : new Set<string>()), [montado]);
  const [dispensadasAgora, setDispensadasAgora] = useState<Set<string>>(() => new Set());
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const lista = (data?.sugestoes || [])
    .filter((s) => !salvas.has(chaveDe(s)) && !dispensadasAgora.has(chaveDe(s)));
  if (!montado || !lista.length) return null;

  const v = (n: number) => (ocultos ? '•••••' : fmt(n));

  function dispensar(s: SugestaoBaixaDivida) {
    const novo = new Set(dispensadasAgora); novo.add(chaveDe(s));
    setDispensadasAgora(novo);
    gravarDispensadas(new Set([...salvas, ...novo]));
  }

  async function darBaixa(s: SugestaoBaixaDivida) {
    const conta = s.transacao.conta ? ` do ${s.transacao.conta}` : '';
    // Sem "desfazer" depois — por isso pergunta antes, nomeando valor e data.
    const ok = await confirmar({
      titulo: `Marcar a parcela de "${s.titulo}" como paga?`,
      mensagem: `A parcela que venceu em ${diaMes(s.vencimento)} fica paga com o débito de `
        + `${fmt(s.transacao.valor)}${conta} em ${diaMes(s.transacao.data)}. O saldo da conta não muda: `
        + 'esse dinheiro já saiu.',
      confirmar: 'Dar baixa',
    });
    if (!ok) return;
    setErro(''); setEnviando(chaveDe(s));
    try {
      await api.dividas.pagar(s.divida_id, {
        phone, valor: s.transacao.valor, tipo: 'parcela', data_pagamento: s.transacao.data,
        transacao_id: s.transacao.id,
        observacao: `Débito do banco${s.transacao.descricao ? `: ${s.transacao.descricao}` : ''}`.slice(0, 120),
      });
      await mutate();
      onBaixa(s.titulo);
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui dar baixa. Tente de novo.');
    } finally { setEnviando(null); }
  }

  return (
    <section className="card rounded-2xl p-4 sm:p-5 animate-fade-in" aria-labelledby="sugestoes-baixa-titulo">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary/10">
          <Landmark size={18} className="text-primary" />
        </div>
        <div className="min-w-0">
          <h2 id="sugestoes-baixa-titulo" className="text-sm font-bold text-foreground">
            {lista.length === 1 ? 'Um débito do banco parece ser parcela' : `${lista.length} débitos do banco parecem ser parcelas`}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Confira e dê baixa. A conta não é descontada de novo: o dinheiro já saiu.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {lista.map((s) => {
          const k = chaveDe(s);
          const ocupado = enviando === k;
          return (
            <li key={k} className="rounded-xl p-3 bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ border: '1px solid hsl(var(--border) / 0.6)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{s.titulo}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Saiu <strong className="text-foreground tabular">{v(s.transacao.valor)}</strong>
                  {s.transacao.conta && <> do {s.transacao.conta}</>} em <span className="tabular">{diaMes(s.transacao.data)}</span>
                  {' · '}parcela de <span className="tabular">{v(s.valor_parcela)}</span>
                  {Math.abs(s.diferenca) >= 0.01 && !ocultos && (
                    <span className="tabular"> ({s.diferenca > 0 ? '+' : '−'}{fmt(Math.abs(s.diferenca))})</span>
                  )}
                </p>
                {s.transacao.descricao && (
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">{s.transacao.descricao}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => dispensar(s)} disabled={ocupado}
                        className="btn-ghost px-3 min-h-[44px] sm:min-h-0 sm:py-2 text-xs">
                  Não é essa
                </button>
                <button onClick={() => darBaixa(s)} disabled={!!enviando}
                        className="btn btn-primary px-3 min-h-[44px] sm:min-h-0 sm:py-2 text-xs gap-1.5">
                  {ocupado ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Dar baixa
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {erro && <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-2">{erro}</p>}
    </section>
  );
}
