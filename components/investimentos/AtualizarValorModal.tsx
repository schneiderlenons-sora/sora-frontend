'use client';

// ─────────────────────────────────────────────────────────────────────────────
// "Meu CDB rendeu — o valor hoje é X."
//
// Pedido de cliente (out/2026): "como faço pra adicionar lucro dos
// investimentos". Medido na conta dele: CDB de R$ 10.500 e uma ação, os dois
// com `valor_atual` igual ao `valor_aportado` — rendimento zero na tela.
//
// ⚠️ NÃO HAVIA CAMINHO NENHUM. A aba tem "Atualizar cotações" (que só funciona
// com ticker, via Yahoo), Aportar, Resgatar e Excluir. Renda fixa não tem
// cotação pública: CDB, LCI e Tesouro ficavam parados no valor de cadastro.
//
// ⚠️ E "APORTAR" NÃO RESOLVE, embora seja o que a pessoa tenta: o aporte soma
// no investido E no atual, então o total infla e a rentabilidade continua 0%.
// Por isso esta tela diz, com todas as letras, o que NÃO vai mudar.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useDinheiro, useSimboloMoeda } from '@/lib/moeda-base';
import { parseValorBR } from '@/lib/formato-br';

export default function AtualizarValorModal({
  investimento, onClose, onSuccess,
}: {
  investimento: { id: string; nome: string; ticker?: string | null; valor_aportado?: number | null; valor_atual?: number | null };
  onClose: () => void;
  onSuccess: () => void;
}) {
  const fmt = useDinheiro();
  const simbolo = useSimboloMoeda();
  const atual = Number(investimento.valor_atual) || 0;
  const aportado = Number(investimento.valor_aportado) || 0;

  const [texto, setTexto] = useState(String(atual.toFixed(2)).replace('.', ','));
  /** Código do ativo. Editável aqui porque, sem isto, quem cadastrou sem ele
   *  só tinha a saída de EXCLUIR e recadastrar — perdendo o histórico. */
  const [ticker, setTicker] = useState(String(investimento.ticker || '').trim());
  const tickerOriginal = String(investimento.ticker || '').trim();
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const novo = parseValorBR(texto);
  const valido = Number.isFinite(novo) && novo > 0;
  // Prévia do resultado: é o que responde "ficou lucro ou prejuízo?" antes de
  // salvar, sem a pessoa precisar fazer a conta de cabeça.
  const lucro = valido ? novo - aportado : 0;
  const pct = valido && aportado > 0 ? (lucro / aportado) * 100 : 0;

  async function salvar() {
    if (!valido || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      await api.investimentos.atualizarValor(investimento.id, novo);
      // ⚠️ Só chama o PUT genérico quando o código MUDOU: ele é outra rota e
      // outro risco, e não há razão de tocá-lo quando a pessoa só quis
      // atualizar o valor. `null` (não undefined) para poder APAGAR o código.
      if (ticker !== tickerOriginal) {
        await api.investimentos.editar(investimento.id, { ticker: ticker || null });
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      // ⚠️ A mensagem do servidor é MOSTRADA, não trocada por um genérico: a
      // recusa mais provável aqui é "este investimento vem do seu banco", e
      // ela explica o que fazer. "Erro ao salvar" mandaria tentar de novo.
      setErro(e instanceof Error ? e.message : 'Não consegui salvar.');
      setSalvando(false);
    }
  }

  // ⚠️ `createPortal`: os cards da aba usam backdrop-blur, e um ancestral com
  // backdrop-filter vira o containing block de `position: fixed` — o modal
  // ficaria preso DENTRO do card. z-index não resolve.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
         onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="av-titulo">
      <div onClick={(e) => e.stopPropagation()}
           className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-5 sm:p-6
                      space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="av-titulo" className="text-lg font-bold text-foreground">Atualizar valor</h2>
            <p className="text-xs text-muted-foreground truncate">{investimento.nome}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 -mt-2 flex items-center justify-center rounded-xl hover:bg-muted flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div>
          <label htmlFor="av-valor" className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Quanto este investimento vale hoje
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground flex-shrink-0">{simbolo}</span>
            {/* ⚠️ 16px no mobile (`text-base`): abaixo disso o iOS dá zoom ao
                focar e a tela salta. */}
            <input
              id="av-valor" type="text" inputMode="decimal" autoFocus
              value={texto} onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && valido) salvar(); }}
              className="flex-1 min-w-0 h-12 px-3 rounded-xl border border-border bg-background
                         text-base tabular outline-none focus:border-primary"
              placeholder="0,00"
            />
          </div>
        </div>

        {/* Prévia: lucro ou prejuízo, já calculado. */}
        {valido && aportado > 0 && (
          <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Você investiu</span>
              <span className="tabular font-semibold text-foreground">{fmt(aportado)}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Vale hoje</span>
              <span className="tabular font-semibold text-foreground">{fmt(novo)}</span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1.5 border-t border-border/40">
              {/* Ícone + palavra, nunca só a cor. */}
              <span className={`inline-flex items-center gap-1 font-bold ${lucro >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {lucro >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {lucro >= 0 ? 'Lucro' : 'Prejuízo'}
              </span>
              <span className={`tabular font-bold ${lucro >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                {lucro >= 0 ? '+' : '−'}{fmt(Math.abs(lucro))} ({pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(2).replace('.', ',')}%)
              </span>
            </div>
          </div>
        )}

        {/* ⚠️ DIZ O QUE NÃO MUDA. É a confusão que origina o pedido: a pessoa
            tenta registrar rendimento usando "Aportar" e infla o investido. */}
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Isto atualiza só <b className="text-foreground">quanto o investimento vale hoje</b>.
          O valor que você investiu continua {fmt(aportado)} — para dinheiro novo,
          use <b className="text-foreground">Aportar</b>.
        </p>

        {/* ── Código do ativo ────────────────────────────────────────────
            ⚠️ ESTE CAMPO RESOLVE UM BECO SEM SAÍDA. Quem cadastrou uma ação sem
            o código (porque digitou o nome em vez de escolher na busca, ou
            porque a cotação falhou naquele momento) ficava com o investimento
            parado para sempre: não havia edição em lugar nenhum do painel, e a
            única saída era excluir e recadastrar, perdendo o histórico. */}
        <div>
          <label htmlFor="av-ticker" className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Código do ativo <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="av-ticker" type="text" value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            className="w-full h-11 px-3 rounded-xl border border-border bg-background
                       text-base sm:text-sm outline-none focus:border-primary"
            placeholder="PETR4.SA"
          />
          <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
            Com o código preenchido, o botão <b className="text-foreground">Atualizar cotações</b> passa
            a buscar o preço deste ativo sozinho. Deixe em branco para renda fixa.
          </p>
        </div>

        {/* Ativo com cotação: avisa que o valor digitado é provisório. */}
        {ticker.trim() !== '' && (
          <p className="text-[11px] leading-relaxed rounded-xl border border-amber-300/60 dark:border-amber-900/60
                        bg-amber-50 dark:bg-amber-950/30 p-2.5 text-amber-800 dark:text-amber-200">
            Este ativo tem cotação ({ticker}). O valor que você informar vale até
            a próxima vez que você tocar em <b>Atualizar cotações</b>, que busca o preço do dia.
          </p>
        )}

        {erro && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400 leading-relaxed">{erro}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button" onClick={salvar} disabled={!valido || salvando}
            className="flex-1 h-12 rounded-xl text-white text-sm font-bold disabled:opacity-40
                       active:scale-[0.99] transition-all inline-flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #61D17B, #3FA85A)' }}
          >
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : 'Salvar'}
          </button>
          <button type="button" onClick={onClose}
                  className="h-12 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
