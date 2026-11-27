'use client';

// =============================================================================
// Dividir uma compra do cartão que já existe (menu da linha em Transações).
// Com parcelas, "aplicar nas outras parcelas" vem ligado: dividir a geladeira
// é dividir as 10 parcelas. O servidor confere tudo de novo (routes/divisoes.js).
// =============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useDinheiro, useMoedaBase } from '@/lib/moeda-base';
import { unidadesDoValor } from '@/lib/moeda';
import { divisaoDaLinha, parteDoOutro, pedidoDoFormulario } from '@/lib/divisao';
import CamposDivisao, { valorDoEstado, type EstadoDivisao } from './CamposDivisao';

export default function DividirCompraModal({ tx, onClose, onSalvo }: {
  tx: any;
  onClose: () => void;
  onSalvo: (msg: string) => void;
}) {
  const fmt = useDinheiro();
  const moeda = useMoedaBase();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const atual = divisaoDaLinha(tx);
  const [estado, setEstado] = useState<EstadoDivisao>(() => ({
    ativo: true,
    com: atual?.com ?? '',
    modo: atual?.modo ?? 'metade',
    valorRaw: atual?.modo === 'valor' && atual.valor ? String(unidadesDoValor(atual.valor, moeda)) : '',
  }));
  const temParcelas = Number(tx.parcela_total) > 1 && !!tx.parcela_grupo;
  const [aplicarParcelas, setAplicarParcelas] = useState(temParcelas);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const valorLinha = Number(tx.valor) || 0;
  const nome = (tx.observacao || tx.categoria || 'Compra').trim();

  async function salvar(tirar = false) {
    setErro('');
    let divisao = null;
    if (!tirar) {
      const p = pedidoDoFormulario({ ...estado, valor: valorDoEstado(estado, moeda) });
      if (!p.ok) { setErro(p.erro); return; }
      divisao = p.divisao;
      if (divisao && parteDoOutro(valorLinha, divisao) == null) { setErro('A parte da outra pessoa não pode ser maior que a compra.'); return; }
    }
    setSalvando(true);
    try {
      const r = await api.divisoes.dividir(tx.id, { divisao, aplicar_parcelas: temParcelas && aplicarParcelas });
      const qtd = r.atualizadas;
      onSalvo(divisao
        ? `✓ Dividida com ${divisao.com}${qtd > 1 ? ` (${qtd} parcelas)` : ''}.`
        : `✓ Divisão tirada${qtd > 1 ? ` (${qtd} parcelas)` : ''}.`);
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar agora. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div role="dialog" aria-modal="true" aria-label="Dividir compra"
           className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border max-h-[90dvh] flex flex-col animate-fade-in"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2"><Users size={18} className="text-primary" aria-hidden /> Dividir compra</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="w-10 h-10 -mr-2 rounded-xl flex items-center justify-center hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          <div className="rounded-xl bg-muted/40 px-3.5 py-3">
            <p className="text-sm font-semibold text-foreground truncate">{nome}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {fmt(valorLinha)}{temParcelas ? ` · parcela ${tx.parcela_num}/${tx.parcela_total}` : ''}{tx.carteira_nome ? ` · ${tx.carteira_nome}` : ''}
            </p>
          </div>

          <CamposDivisao
            estado={estado}
            onChange={(patch) => setEstado((e) => ({ ...e, ...patch }))}
            valorLinha={valorLinha}
            moeda={moeda}
            parcelado={temParcelas && aplicarParcelas}
            permitirDesligar={false}
          />

          {temParcelas && (
            <label className="flex items-start gap-3 cursor-pointer min-h-11">
              <input type="checkbox" checked={aplicarParcelas} onChange={(e) => setAplicarParcelas(e.target.checked)} className="mt-1 w-4 h-4 accent-[hsl(var(--primary))]" />
              <span className="text-sm text-foreground">
                Aplicar nas outras parcelas desta compra
                <span className="block text-xs text-muted-foreground">As {tx.parcela_total} parcelas ficam divididas do mesmo jeito.</span>
              </span>
            </label>
          )}

          <p className="text-xs text-muted-foreground leading-relaxed">
            A compra continua inteira na fatura. A parte da outra pessoa aparece no detalhe da fatura, com o botão de cobrar pelo WhatsApp.
          </p>
          {erro && <p className="text-xs text-red-600" role="alert">{erro}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-2">
          {atual ? (
            <button type="button" onClick={() => salvar(true)} disabled={salvando}
              className="h-11 px-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50">
              Tirar a divisão
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-11 px-4 rounded-xl text-sm font-semibold text-foreground hover:bg-muted">Cancelar</button>
            <button type="button" onClick={() => salvar(false)} disabled={salvando}
              className="h-11 px-4 rounded-xl text-sm font-bold text-white bg-primary inline-flex items-center gap-1.5 disabled:opacity-60">
              {salvando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
