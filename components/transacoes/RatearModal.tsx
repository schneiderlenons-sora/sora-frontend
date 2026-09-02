'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import { X, Plus, Trash2, Loader2, SplitSquareHorizontal, AlertTriangle } from 'lucide-react';

// =============================================================================
// Dividir um lançamento em várias categorias (migration 151).
//
// ⚠️ O RATEIO SUBSTITUI a transação por N linhas normais que somam o mesmo
// valor — não existe linha-pai. É o que impede a compra de aparecer duas vezes
// no dashboard, nas categorias, nos limites e na fatura. A tela diz isso ao
// usuário, porque a operação NÃO é reversível com um clique: depois de dividir,
// as partes são lançamentos comuns (editáveis e apagáveis um a um).
//
// ⚠️ A soma tem de FECHAR NO CENTAVO. O botão só habilita quando falta zero —
// aceitar uma divisão que não fecha seria criar ou sumir com dinheiro.
// Trabalhamos em CENTAVOS INTEIROS: com float, 0,10 + 0,20 dá
// 0.30000000000000004 e uma divisão correta seria recusada.
//
// ⚠️ createPortal(document.body): a lista de transações vive em card com
// backdrop-blur, que vira containing block do position:fixed. Regra do CLAUDE.md.
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const fmt = (c: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);

type Parte = { categoria: string; valorRaw: string };

const paraCentavos = (raw: string) => {
  const so = String(raw).replace(/\D/g, '');
  return so ? parseInt(so, 10) : 0;
};
const mascara = (raw: string) =>
  (paraCentavos(raw) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RatearModal({
  phone, tx, onClose, onSuccess,
}: { phone: string; tx: any; onClose: () => void; onSuccess: () => void }) {
  const [montado, setMontado] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const [partes, setPartes] = useState<Parte[]>([
    { categoria: tx.categoria || '', valorRaw: '' },
    { categoria: '', valorRaw: '' },
  ]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => { setMontado(true); }, []);
  useEffect(() => {
    api.categorias.listar(phone)
      .then((r: any) => setCats((Array.isArray(r) ? r : r?.categorias || []).map((c: any) => c.nome).filter(Boolean)))
      .catch(() => {});
  }, [phone]);

  const totalCent = Math.round((Number(tx.valor) || 0) * 100);
  const somaCent = useMemo(() => partes.reduce((s, p) => s + paraCentavos(p.valorRaw), 0), [partes]);
  const faltaCent = totalCent - somaCent;
  const semCategoria = partes.some((p) => !p.categoria);
  const comZero = partes.some((p) => paraCentavos(p.valorRaw) <= 0);
  const podeSalvar = faltaCent === 0 && !semCategoria && !comZero && partes.length >= 2;

  function set(i: number, patch: Partial<Parte>) {
    setPartes((p) => p.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  // Preenche a última parte com o que falta — o atalho que evita a conta de cabeça.
  function completar(i: number) {
    const outros = partes.reduce((s, p, j) => (j === i ? s : s + paraCentavos(p.valorRaw)), 0);
    const resto = Math.max(0, totalCent - outros);
    set(i, { valorRaw: String(resto) });
  }

  async function salvar() {
    if (!podeSalvar) return;
    setSalvando(true); setErro('');
    try {
      await api.transacoes.ratear(tx.id, {
        phone,
        partes: partes.map((p) => ({ categoria: p.categoria, valor: paraCentavos(p.valorRaw) / 100 })),
      });
      onSuccess(); onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui dividir. Tente de novo.');
    } finally { setSalvando(false); }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border animate-fade-in max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="Dividir lançamento por categoria"
      >
        <header className="flex items-start gap-3 p-5 pb-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
            <SplitSquareHorizontal size={18} style={{ color: BRAND }} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground leading-tight">Dividir por categoria</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {tx.observacao || nomeCategoria(tx.categoria)} · <span className="tabular">{fmt(totalCent)}</span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar"
            className="grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
            style={{ width: 40, height: 40 }}>
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-3 space-y-2.5">
          {partes.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <select
                className="input flex-1 min-w-0" value={p.categoria}
                onChange={(e) => set(i, { categoria: e.target.value })}
                aria-label={`Categoria da parte ${i + 1}`}
                style={{ minHeight: 44 }}
              >
                <option value="">Categoria…</option>
                {cats.map((c) => <option key={c} value={c}>{nomeCategoria(c)}</option>)}
              </select>
              <div className="relative" style={{ width: 128 }}>
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                <input
                  className="input w-full text-right tabular" inputMode="numeric"
                  value={p.valorRaw ? mascara(p.valorRaw) : ''}
                  onChange={(e) => set(i, { valorRaw: e.target.value })}
                  onFocus={() => { if (!p.valorRaw && faltaCent > 0) completar(i); }}
                  placeholder="0,00" aria-label={`Valor da parte ${i + 1}`}
                  style={{ minHeight: 44, paddingLeft: 30 }}
                />
              </div>
              <button
                onClick={() => setPartes((ps) => ps.filter((_, j) => j !== i))}
                disabled={partes.length <= 2}
                aria-label={`Remover parte ${i + 1}`}
                className="grid place-items-center rounded-xl text-muted-foreground hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                style={{ width: 44, height: 44 }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}

          <button
            onClick={() => setPartes((ps) => [...ps, { categoria: '', valorRaw: '' }])}
            disabled={partes.length >= 20}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
            style={{ minHeight: 44 }}
          >
            <Plus size={15} /> Adicionar parte
          </button>
        </div>

        <div className="px-5 pb-5 pt-2 border-t border-border/60 space-y-3">
          {/* O que falta, sempre visível: é a informação que decide se dá pra salvar. */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {faltaCent === 0 ? 'Fecha certinho' : faltaCent > 0 ? 'Falta distribuir' : 'Passou do valor'}
            </span>
            <span className="font-bold tabular"
                  style={{ color: faltaCent === 0 ? BRAND : 'hsl(var(--destructive, 0 72% 55%))' }}>
              {fmt(Math.abs(faltaCent))}
            </span>
          </div>

          <div className="flex items-start gap-2 rounded-2xl p-3 bg-muted/40 border border-border/60">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-[12px] leading-snug text-muted-foreground">
              O lançamento original é <strong className="text-foreground">substituído</strong> por estas partes —
              é assim que o valor não conta duas vezes nos relatórios. Depois de dividir, cada parte
              vira um lançamento comum, que você edita ou apaga separadamente.
            </p>
          </div>

          {erro && <p className="text-[13px] text-red-600 dark:text-red-400 leading-snug">{erro}</p>}

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="btn-ghost px-4 text-sm flex-1" style={{ minHeight: 44 }}>
              Cancelar
            </button>
            <button
              onClick={salvar} disabled={!podeSalvar || salvando}
              className="btn btn-primary px-4 text-sm flex-1 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: 44, background: BRAND }}
            >
              {salvando ? <><Loader2 size={15} className="animate-spin" /> Dividindo…</>
                : `Dividir em ${partes.length}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
