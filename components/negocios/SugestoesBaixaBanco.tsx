'use client';

// "Chegou do banco, parecido com esta conta — dar baixa?" (Sora Negócios).
//
// O espelho da conta do banco já dá baixa sozinho quando o valor bate no
// centavo. Este quadro cobre o resto — desconto, juros, atraso maior —, que
// antes ficava como lançamento novo ao lado da conta em aberto (a projeção
// dobrava). A régua mora no backend (services/baixaBancoNegocio.js); aqui só
// se mostra e se confirma. Some sozinho quando não há nada.

import { useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { Landmark, Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useConfirmar } from '@/contexts/ConfirmContext';
import { fmtCent, type Lancamento } from '@/lib/lancamentos';

type Sugestao = { aberto: Lancamento; banco: Lancamento; diferenca: number };

const CHAVE_DISPENSADAS = 'sora-neg-baixa-banco-dispensadas-v1';
const chaveDe = (s: Sugestao) => `${s.aberto.id}|${s.banco.id}`;
const semInscricao = () => () => {};
const diaMes = (iso?: string | null) => {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

function lerDispensadas(): Set<string> {
  try { return new Set(JSON.parse(window.localStorage.getItem(CHAVE_DISPENSADAS) || '[]')); }
  catch { return new Set(); }
}

export default function SugestoesBaixaBanco({ phone, empresaId, tipo, cor, onBaixa }: {
  phone: string;
  empresaId: string;
  /** 'entrada' na tela A receber; 'saida' em Contas a pagar. */
  tipo: 'entrada' | 'saida';
  cor: string;
  onBaixa: () => void;
}) {
  const confirmar = useConfirmar();
  const { data, mutate } = useSWR(
    phone && empresaId ? `neg:baixa-banco:${empresaId}` : null,
    () => api.negocios.lancamentos.conciliacaoBanco(phone, empresaId),
    { revalidateOnFocus: false },
  );
  // Só no navegador: localStorage e o cache do SWR não existem no servidor.
  const montado = useSyncExternalStore(semInscricao, () => true, () => false);
  const salvas = useMemo(() => (montado ? lerDispensadas() : new Set<string>()), [montado]);
  const [agora, setAgora] = useState<Set<string>>(() => new Set());
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState('');

  const lista = (data?.sugestoes || [])
    .filter((s) => s.aberto.tipo === tipo && !salvas.has(chaveDe(s)) && !agora.has(chaveDe(s)));
  if (!montado || !lista.length) return null;

  const recebeu = tipo === 'entrada';

  function dispensar(s: Sugestao) {
    const novo = new Set(agora); novo.add(chaveDe(s)); setAgora(novo);
    try {
      window.localStorage.setItem(CHAVE_DISPENSADAS, JSON.stringify([...salvas, ...novo].slice(-200)));
    } catch { /* sem storage: some só nesta visita */ }
  }

  async function darBaixa(s: Sugestao) {
    const ok = await confirmar({
      titulo: `Dar baixa em "${s.aberto.descricao}"?`,
      mensagem: `A conta de ${fmtCent(s.aberto.valor)} fica ${recebeu ? 'recebida' : 'paga'} com os `
        + `${fmtCent(s.banco.valor)} que ${recebeu ? 'entraram' : 'saíram'} no banco em ${diaMes(s.banco.data)}. `
        + 'O lançamento do banco passa a ser esta conta (não conta duas vezes).',
      confirmar: 'Dar baixa',
    });
    if (!ok) return;
    setErro(''); setEnviando(chaveDe(s));
    try {
      await api.negocios.lancamentos.baixaBanco(s.aberto.id, s.banco.id);
      await mutate();
      onBaixa();
    } catch (e) {
      setErro((e as Error)?.message || 'Não consegui dar baixa. Tente de novo.');
    } finally { setEnviando(null); }
  }

  return (
    <section className="rounded-3xl bg-card p-4 sm:p-5 animate-fade-in" aria-labelledby="neg-baixa-banco"
             style={{ border: '1px solid hsl(var(--border))' }}>
      <div className="flex items-start gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
          <Landmark size={18} style={{ color: cor }} />
        </span>
        <div className="min-w-0">
          <h2 id="neg-baixa-banco" className="text-sm font-bold text-foreground">
            {lista.length === 1 ? 'Chegou do banco algo parecido com uma conta' : `${lista.length} lançamentos do banco parecem contas em aberto`}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            O valor não bate exato (desconto, juros ou atraso). Confira antes de dar baixa.
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {lista.map((s) => {
          const k = chaveDe(s);
          const ocupado = enviando === k;
          const dif = s.diferenca;
          return (
            <li key={k} className="rounded-2xl p-3 bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ border: '1px solid hsl(var(--border) / 0.6)' }}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{s.aberto.descricao}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Conta de <span className="tabular-nums">{fmtCent(s.aberto.valor)}</span>
                  {s.aberto.vencimento && <> · vence {diaMes(s.aberto.vencimento)}</>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {recebeu ? 'Entrou' : 'Saiu'} <strong className="text-foreground tabular-nums">{fmtCent(s.banco.valor)}</strong>
                  {' '}em {diaMes(s.banco.data)}
                  {dif !== 0 && <span className="tabular-nums"> ({dif > 0 ? '+' : '−'}{fmtCent(Math.abs(dif))})</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => dispensar(s)} disabled={ocupado}
                        className="btn-ghost px-3 min-h-[44px] text-xs">
                  Não é essa
                </button>
                <button onClick={() => darBaixa(s)} disabled={!!enviando}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-xs font-bold text-white disabled:opacity-60"
                        style={{ background: cor }}>
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
