'use client';

// =============================================================================
// "Dividir com alguém" — o bloco do formulário (Nova transação e Dividir compra).
// Regra em lib/divisao.ts (espelho do backend). A compra continua INTEIRA na
// fatura; a parte da outra pessoa vira o que ela te deve.
// =============================================================================

import useSWR from 'swr';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useDinheiro } from '@/lib/moeda-base';
import { textoDasUnidades, valorDasUnidades } from '@/lib/moeda';
import { parteDoOutro, type ModoDivisao } from '@/lib/divisao';

export type EstadoDivisao = { ativo: boolean; com: string; modo: ModoDivisao; valorRaw: string };
export const DIVISAO_VAZIA: EstadoDivisao = { ativo: false, com: '', modo: 'metade', valorRaw: '' };

/** Valor (na moeda do grupo) digitado no campo "outro valor". */
export function valorDoEstado(e: EstadoDivisao, moeda: string): number {
  return valorDasUnidades(parseInt(e.valorRaw || '0', 10), moeda);
}

export default function CamposDivisao({
  estado, onChange, valorLinha, moeda, parcelado = false, permitirDesligar = true,
}: {
  estado: EstadoDivisao;
  onChange: (patch: Partial<EstadoDivisao>) => void;
  /** Valor da compra (ou de CADA parcela), na moeda do grupo. */
  valorLinha: number;
  moeda: string;
  parcelado?: boolean;
  /** Mostra a chave liga/desliga (no "Dividir compra" ela já vem ligada). */
  permitirDesligar?: boolean;
}) {
  const fmt = useDinheiro();
  // Nomes já usados (sugestão). Só busca com o bloco aberto.
  const { data: pessoasData } = useSWR(estado.ativo ? 'd:divisoes-pessoas' : null, () => api.divisoes.pessoas(),
    { revalidateOnFocus: false });
  const pessoas = pessoasData?.pessoas ?? [];

  const parte = estado.modo === 'metade'
    ? parteDoOutro(valorLinha, { modo: 'metade' })
    : parteDoOutro(valorLinha, { modo: 'valor', valor: valorDoEstado(estado, moeda) });
  const quem = estado.com.trim() || 'A outra pessoa';
  const prefixo = parcelado ? 'Em cada parcela: ' : '';

  return (
    <div className={`rounded-2xl border ${estado.ativo ? 'border-primary/50 bg-primary/5' : 'border-border'} p-3 space-y-3`}>
      {permitirDesligar && (
        <button
          type="button"
          role="switch"
          aria-checked={estado.ativo}
          onClick={() => onChange({ ativo: !estado.ativo })}
          className="w-full flex items-center justify-between gap-3 text-left min-h-11"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"><Users size={15} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Dividir com alguém</span>
              <span className="block text-[11px] text-muted-foreground">A fatura fica inteira; a parte da outra pessoa fica como valor a receber.</span>
            </span>
          </span>
          <span className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors" style={{ background: estado.ativo ? 'hsl(var(--primary))' : 'hsl(var(--fg-muted) / .3)' }}>
            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: estado.ativo ? 'translateX(18px)' : 'translateX(2px)' }} />
          </span>
        </button>
      )}

      {estado.ativo && (
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">Com quem?</span>
            <input
              value={estado.com}
              onChange={(e) => onChange({ com: e.target.value })}
              list="divisao-pessoas"
              maxLength={60}
              placeholder="Ex.: Esposa, Pedro"
              className="input"
              autoComplete="off"
            />
            <datalist id="divisao-pessoas">
              {pessoas.map((p) => <option key={p} value={p} />)}
            </datalist>
          </label>

          <div role="radiogroup" aria-label="Quanto é da outra pessoa" className="flex gap-1 bg-muted/60 rounded-xl p-1">
            {([['metade', 'Metade'], ['valor', 'Outro valor']] as const).map(([m, rotulo]) => (
              <button key={m} type="button" role="radio" aria-checked={estado.modo === m}
                onClick={() => onChange({ modo: m })}
                className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${estado.modo === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}>
                {rotulo}
              </button>
            ))}
          </div>

          {estado.modo === 'valor' && (
            <label className="block">
              <span className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                Parte da outra pessoa{parcelado ? ' (em cada parcela)' : ''}
              </span>
              <input
                value={textoDasUnidades(estado.valorRaw ? parseInt(estado.valorRaw, 10) : 0, moeda)}
                onChange={(e) => onChange({ valorRaw: e.target.value.replace(/\D/g, '') })}
                inputMode="numeric"
                className="input tabular-nums"
              />
            </label>
          )}

          <p className={`text-xs ${parte == null && valorLinha > 0 ? 'text-red-600' : 'text-muted-foreground'}`} aria-live="polite">
            {valorLinha <= 0
              ? 'Informe o valor da compra pra ver a divisão.'
              : parte == null
                ? 'A parte da outra pessoa não pode ser maior que a compra.'
                : <>{prefixo}você <b className="text-foreground tabular-nums">{fmt(Math.round((valorLinha - parte) * 100) / 100)}</b> · {quem} <b className="text-foreground tabular-nums">{fmt(parte)}</b></>}
          </p>
        </div>
      )}
    </div>
  );
}
