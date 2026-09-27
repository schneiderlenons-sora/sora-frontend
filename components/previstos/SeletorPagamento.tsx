'use client';

// ─────────────────────────────────────────────────────────────────────────────
// "Qual lançamento pagou esta previsão?" — a conciliação manual.
//
// ⚠️ PEDIDO LITERAL DE CLIENTE (Vander, 26/09/2026): "Será ótimo eu ter uma
// opção nas movimentações onde eu possa relacionar à qual previsão é aquele
// pagamento para dar baixa." Ele já havia pedido em e-mails anteriores, e a
// falta disso o levou à conclusão de que "esta funcionalidade de previsão, da
// forma que está, não é útil".
//
// ⚠️ O BACKEND SEMPRE SOUBE FAZER (`services/quitacao.js:vincularTransacao`,
// com trava de corrida e recusa de transação já vinculada). O que nunca
// existiu foi a TELA — e era o único jeito de conciliar o que o casamento
// automático não alcança (>30% de diferença, carteira errada, fora da janela
// de 5 dias do `casarPrevisao`).
//
// ⚠️ AMARRA, NUNCA CRIA. Medido na conta dele: 7 das 9 contas fixas estão em
// modo `prever`/`nao_lancar`, ou seja, quem traz o lançamento é o banco. Criar
// uma transação nova ali seria a duplicata que a baixa existe pra evitar — o
// caminho certo é apontar a cobrança que JÁ chegou.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useDinheiro } from '@/lib/moeda-base';
import { fmtDataBR } from '@/lib/data-br';

type Candidata = {
  id: string;
  data: string;
  valor: number;
  tipo: string;
  observacao?: string | null;
  categoria?: string | null;
  carteira_nome?: string | null;
  recorrencia_id?: string | null;
  transferencia?: boolean;
};

export default function SeletorPagamento({
  phone, titulo, valorPrevisto, tipo, competencia, onEscolher, onFechar,
}: {
  phone: string;
  /** Nome da conta fixa — o cabeçalho diz o que está sendo conciliado. */
  titulo: string;
  valorPrevisto: number;
  tipo: 'Gasto' | 'Recebimento';
  /** 'YYYY-MM' da ocorrência. É o mês em que a busca começa. */
  competencia: string;
  onEscolher: (transacaoId: string) => Promise<void> | void;
  onFechar: () => void;
}) {
  const fmt = useDinheiro();
  const [mes, setMes] = useState(competencia);
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState<Candidata[] | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState<string | null>(null);

  // Portal: o card dos previstos usa backdrop-blur, e um `fixed` dentro dele
  // vira filho do card em vez da tela (regra registrada no CLAUDE.md).
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    let vivo = true;
    setLinhas(null); setErro('');
    api.transacoes.listar(phone, { mes, tipo, limit: 300 })
      .then((r) => { if (vivo) setLinhas((r?.transacoes || []) as Candidata[]); })
      .catch((e) => { if (vivo) setErro(e?.message || 'Não consegui carregar os lançamentos.'); });
    return () => { vivo = false; };
  }, [phone, mes, tipo]);

  const candidatas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (linhas || [])
      // ⚠️ Já vinculada NÃO entra: o backend recusaria com 409, e oferecer uma
      // opção que sempre falha é pior do que não oferecer.
      .filter((t) => !t.recorrencia_id)
      // Transferência move dinheiro entre contas próprias — não paga conta.
      .filter((t) => !t.transferencia)
      .filter((t) => !termo
        || `${t.observacao || ''} ${t.categoria || ''} ${t.carteira_nome || ''}`.toLowerCase().includes(termo))
      // ⚠️ Ordenado pela PROXIMIDADE DO VALOR, não pela data. O pagamento que
      // a pessoa procura é quase sempre o de valor parecido, e numa lista de
      // 300 linhas por data ele fica no meio do supermercado.
      .sort((a, b) => Math.abs(Number(a.valor) - valorPrevisto) - Math.abs(Number(b.valor) - valorPrevisto))
      .slice(0, 40);
  }, [linhas, busca, valorPrevisto]);

  async function escolher(id: string) {
    setSalvando(id); setErro('');
    try { await onEscolher(id); onFechar(); }
    catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não consegui vincular.');
      setSalvando(null);
    }
  }

  // Os 3 meses em volta da competência: pagamento adiantado ou atrasado cai
  // no mês vizinho, e era justamente o caso que não tinha saída.
  const meses = useMemo(() => {
    const [a, m] = competencia.split('-').map(Number);
    return [-1, 0, 1].map((d) => {
      const dt = new Date(a, m - 1 + d, 1);
      return {
        id: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`,
        label: dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      };
    });
  }, [competencia]);

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true"
         aria-label={`Escolher o lançamento que pagou ${titulo}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onFechar} />
      <div className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] bg-card border border-border
                      rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col
                      animate-[slide-up_240ms_ease-out_both] motion-reduce:animate-none">

        <div className="flex items-start justify-between gap-3 p-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">Qual lançamento pagou isto?</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {titulo} · previsto {fmt(valorPrevisto)}
            </p>
          </div>
          <button onClick={onFechar} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 -mt-1 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-2 border-b border-border">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus
                   placeholder="Buscar pela descrição…" aria-label="Buscar lançamento"
                   className="w-full h-11 pl-9 pr-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary" />
          </div>
          <div className="flex items-center gap-1.5">
            {meses.map((m) => (
              <button key={m.id} onClick={() => setMes(m.id)} aria-pressed={mes === m.id}
                      className={`h-9 px-3 rounded-xl text-xs font-bold capitalize transition-all border ${
                        mes === m.id ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                {m.label}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              {linhas ? `${candidatas.length} lançamento${candidatas.length === 1 ? '' : 's'}` : ''}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {erro && (
            <p className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl p-3 m-2">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {erro}
            </p>
          )}
          {!linhas ? (
            <div className="py-10 flex justify-center"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
          ) : candidatas.length === 0 ? (
            <div className="py-10 px-6 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum lançamento livre neste mês.
              </p>
              {/* ⚠️ Explica em vez de só mostrar vazio: lançamento que já está
                  amarrado a outra previsão não aparece aqui de propósito. */}
              <p className="text-xs text-muted-foreground/70 mt-1.5 leading-relaxed">
                Só aparecem lançamentos ainda não vinculados a nenhuma conta fixa.
                Tente outro mês acima, ou busque pela descrição.
              </p>
            </div>
          ) : candidatas.map((t) => {
            const diff = Math.abs(Number(t.valor) - valorPrevisto);
            // Verde só quando é praticamente o valor previsto — o resto fica
            // neutro pra não sugerir certeza que não temos.
            const perto = diff <= Math.max(1, valorPrevisto * 0.05);
            return (
              <button key={t.id} onClick={() => escolher(t.id)} disabled={!!salvando}
                      className="w-full flex items-center gap-3 p-3 rounded-xl text-left hover:bg-muted/50 active:scale-[0.99] transition-all disabled:opacity-50">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground truncate">
                    {t.observacao || t.categoria || 'Lançamento'}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {fmtDataBR(t.data)} · {t.carteira_nome || 'sem conta'}
                  </span>
                </span>
                <span className="flex-shrink-0 text-right">
                  <span className={`block text-sm font-semibold tabular-nums ${perto ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                    {fmt(Number(t.valor))}
                  </span>
                  {/* Ícone + texto, nunca cor sozinha. */}
                  {perto && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check size={10} /> bate
                    </span>
                  )}
                </span>
                {salvando === t.id && <Loader2 size={15} className="animate-spin text-muted-foreground flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
