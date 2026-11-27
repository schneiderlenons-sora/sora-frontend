'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

// Peças comuns entre a tela do afiliado e a aba Afiliados do /admin.

// Preço e comissão da Sora são sempre em real.
export const reais = (centavos: number) =>
  (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const diaBR = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit' });

export const linkDoAfiliado = (codigo: string) => `https://www.forsora.com/?af=${codigo}`;

export const NOME_TIPO: Record<string, string> = {
  primeira: '1ª cobrança', renovacao: 'Renovação', vitalicio: 'Vitalício',
};

export function situacao(l: { status: string; valor_centavos: number; liberada_em: string; repassada_em?: string | null }) {
  if (l.status === 'paga') return { texto: 'Paga', cor: 'text-muted-foreground' };
  if (l.status === 'cancelada') return { texto: 'Cancelada (reembolso)', cor: 'text-muted-foreground' };
  if (l.valor_centavos < 0) return { texto: 'Desconto por reembolso', cor: 'text-red-600 dark:text-red-400' };
  if (new Date(l.liberada_em).getTime() <= Date.now()) return { texto: 'Liberada', cor: 'text-emerald-600 dark:text-emerald-400' };
  return { texto: `Libera em ${diaBR(l.liberada_em)}`, cor: 'text-amber-600 dark:text-amber-400' };
}

export function Totais({ resumo }: { resumo: { aReceber: number; emCarencia: number; recebido: number } }) {
  const itens = [
    ['A receber', resumo.aReceber], ['Em carência', resumo.emCarencia], ['Já recebido', resumo.recebido],
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-2">
      {itens.map(([rotulo, v]) => (
        <div key={rotulo} className="rounded-2xl border border-border/60 p-3 min-w-0">
          <dt className="text-[11px] text-muted-foreground leading-tight">{rotulo}</dt>
          <dd className="text-sm sm:text-lg font-bold text-foreground tabular-nums mt-1 break-words">{reais(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function BotaoCopiar({ texto, rotulo }: { texto: string; rotulo: string }) {
  const [feito, setFeito] = useState(false);
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setFeito(true); setTimeout(() => setFeito(false), 2000); }
    catch { /* sem permissão: o texto continua selecionável na tela */ }
  }
  return (
    <button type="button" onClick={copiar} aria-live="polite"
      className="inline-flex items-center justify-center gap-1.5 px-3 h-11 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted/50 flex-shrink-0">
      {feito ? <Check size={14} /> : <Copy size={14} />} {feito ? 'Copiado' : rotulo}
    </button>
  );
}
