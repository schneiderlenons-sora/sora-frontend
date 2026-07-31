'use client';

// =============================================================================
// Ajuste manual de estoque — contagem, perda/quebra e devolução.
//
// Mostra o saldo ANTES e o DEPOIS enquanto o usuário digita. Ajuste é a
// operação em que mais se erra o sinal (somar quando queria subtrair), e ver o
// resultado antes de confirmar evita o acerto que estraga o saldo.
//
// O motivo importa e não é decoração: "perda" e "contagem" contam histórias
// diferentes pro dono quando ele for entender por que o estoque encolheu.
// =============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Check, AlertCircle, Plus, Minus } from 'lucide-react';
import { api } from '@/lib/api';
import type { ItemEstoque } from '@/lib/lancamentos';

const MOTIVOS = [
  { v: 'ajuste',    label: 'Contagem',  desc: 'Conferi a prateleira' },
  { v: 'perda',     label: 'Perda',     desc: 'Quebrou, venceu, sumiu' },
  { v: 'devolucao', label: 'Devolução', desc: 'Cliente devolveu' },
] as const;

export default function ModalAjusteEstoque({
  empresaId, cor, produto, onClose, onAjustado,
}: {
  empresaId: string; cor: string; produto: ItemEstoque;
  onClose: () => void; onAjustado: () => void;
}) {
  const [tipo, setTipo]   = useState<'entrada' | 'saida'>('entrada');
  const [motivo, setMotivo] = useState<'ajuste' | 'perda' | 'devolucao'>('ajuste');
  const [qtd, setQtd]     = useState('');
  const [obs, setObs]     = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]   = useState('');

  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const quantidade = parseFloat((qtd || '0').replace(',', '.')) || 0;
  const saldoAtual = Number(produto.estoque_atual) || 0;
  const depois = tipo === 'entrada' ? saldoAtual + quantidade : saldoAtual - quantidade;

  // Perda é sempre saída; forçar o sinal evita o acerto que soma sem querer.
  function escolherMotivo(m: typeof motivo) {
    setMotivo(m);
    if (m === 'perda') setTipo('saida');
    if (m === 'devolucao') setTipo('entrada');
  }

  async function salvar() {
    if (salvando || quantidade <= 0) return;
    setErro(''); setSalvando(true);
    try {
      await api.negocios.estoque.ajustar({
        empresa_id: empresaId, produto_id: produto.id,
        tipo, quantidade, motivo, observacao: obs.trim() || undefined,
      });
      onAjustado();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui ajustar.');
      setSalvando(false);
    }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground truncate">{produto.nome}</h2>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {saldoAtual} {produto.unidade || 'un'} em estoque
            </p>
          </div>
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {erro && (
            <p className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {erro}
            </p>
          )}

          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Motivo</span>
            <div className="space-y-1.5">
              {MOTIVOS.map(m => {
                const on = motivo === m.v;
                return (
                  <button key={m.v} onClick={() => escolherMotivo(m.v)} aria-pressed={on}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors"
                    style={{
                      minHeight: 44,
                      borderColor: on ? cor : 'hsl(var(--border))',
                      background: on ? `color-mix(in srgb, ${cor} 9%, transparent)` : 'transparent',
                    }}>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">{m.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{m.desc}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contagem pode ir nos dois sentidos; perda/devolução já têm o seu */}
          {motivo === 'ajuste' && (
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
              {([
                { v: 'entrada', l: 'Tinha mais', Icon: Plus },
                { v: 'saida',   l: 'Tinha menos', Icon: Minus },
              ] as const).map(o => {
                const on = tipo === o.v;
                return (
                  <button key={o.v} onClick={() => setTipo(o.v)} aria-pressed={on}
                          className={`h-11 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
                            on ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                          style={{ minHeight: 44 }}>
                    <o.Icon size={15} /> {o.l}
                  </button>
                );
              })}
            </div>
          )}

          <div>
            <label htmlFor="aj-qtd" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Quantidade
            </label>
            <input id="aj-qtd" inputMode="decimal" value={qtd} autoFocus
                   onChange={e => setQtd(e.target.value.replace(/[^\d,.]/g, ''))}
                   placeholder="0" className="input w-full tabular-nums text-lg" style={{ minHeight: 44 }} />
          </div>

          {/* Antes → depois: onde o erro de sinal aparece antes de virar bug */}
          {quantidade > 0 && (
            <div className="rounded-2xl bg-muted/40 p-3.5 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Vai ficar com</span>
              <span className="text-lg font-bold tabular-nums"
                    style={{ color: depois < 0 ? '#ef4444' : 'hsl(var(--foreground))' }}>
                {depois} {produto.unidade || 'un'}
              </span>
            </div>
          )}
          {depois < 0 && (
            <p className="text-[11px] text-red-500">
              O saldo ficaria negativo. Confira a quantidade — ou registre a entrada que faltou.
            </p>
          )}

          <div>
            <label htmlFor="aj-obs" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Observação <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <input id="aj-obs" value={obs} onChange={e => setObs(e.target.value)}
                   placeholder="Ex.: caixa danificada" className="input w-full" style={{ minHeight: 44 }} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border">
          <button onClick={salvar} disabled={salvando || quantidade <= 0}
                  className="w-full h-11 rounded-2xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: cor, minHeight: 44 }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
            Confirmar ajuste
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
