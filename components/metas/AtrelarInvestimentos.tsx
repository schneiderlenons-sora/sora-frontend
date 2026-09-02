'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { X, TrendingUp, Shield, Info, Loader2 } from 'lucide-react';

// =============================================================================
// Atrelar investimentos a uma meta (migration 147).
//
// ⚠️ VIA createPortal(document.body). O card da meta usa `backdrop-blur`, e um
// ancestral com backdrop-filter vira o containing block do `position: fixed` —
// o modal ficaria preso DENTRO do card e atrás do conteúdo de baixo. z-index
// não resolve. Regra registrada no CLAUDE.md.
//
// ⚠️ O vínculo é gravado em `investimentos.meta_id`, um investimento por meta.
// Marcar aqui um investimento que já pertence a OUTRA meta o transfere — é o
// que impede o mesmo dinheiro de aparecer em duas metas somando duas vezes.
// =============================================================================

const BRAND = 'hsl(var(--primary))';
const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function AtrelarInvestimentos({
  phone, meta, onClose, onSuccess,
}: { phone: string; meta: any; onClose: () => void; onSuccess: () => void }) {
  const [montado, setMontado] = useState(false);
  const [salvando, setSalvando] = useState<string | null>(null);
  useEffect(() => { setMontado(true); }, []);

  const { data, mutate } = useApi(
    phone ? `inv:lista:${phone}` : null,
    () => api.investimentos.listar(phone),
  );
  const invs: any[] = (data as any) ?? [];
  const carregando = data === undefined;

  async function alternar(inv: any, ligar: boolean) {
    setSalvando(inv.id);
    // Otimista: a linha muda na hora e o servidor confirma depois.
    mutate((prev: any) => Array.isArray(prev)
      ? prev.map((x: any) => (x.id === inv.id ? { ...x, meta_id: ligar ? meta.id : null } : x))
      : prev, false);
    try {
      await api.investimentos.editar(inv.id, { meta_id: ligar ? meta.id : null });
    } finally {
      setSalvando(null);
      mutate();
      onSuccess();      // a meta recalcula o total no servidor
    }
  }

  // SSR não tem `document` — sem esta guarda o portal quebra na hidratação.
  if (!montado) return null;

  const daMeta   = invs.filter((i) => i.meta_id === meta.id);
  const deOutras = invs.filter((i) => i.meta_id && i.meta_id !== meta.id);
  const livres   = invs.filter((i) => !i.meta_id);
  const total    = daMeta.reduce((s, i) => s + (Number(i.valor_atual) || 0), 0);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl border border-border max-h-[88vh] flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Investimentos da meta ${meta.titulo}`}
      >
        <header className="flex items-start gap-3 p-5 pb-3">
          <span className="grid place-items-center w-10 h-10 rounded-xl flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${BRAND} 13%, transparent)` }}>
            <TrendingUp size={18} style={{ color: BRAND }} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground leading-tight">Investimentos da meta</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta.titulo}</p>
          </div>
          {/* Saída sempre visível — regra `escape-routes`. */}
          <button onClick={onClose} aria-label="Fechar"
            className="grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
            style={{ width: 40, height: 40 }}>
            <X size={18} />
          </button>
        </header>

        <div className="px-5 pb-2">
          <p className="text-sm text-muted-foreground leading-relaxed">
            O valor atual dos investimentos atrelados entra no progresso da meta, somado ao que
            você já guardou.
          </p>
          {daMeta.length > 0 && (
            <p className="mt-2 text-sm">
              <strong className="text-foreground tabular">{fmt(total)}</strong>
              <span className="text-muted-foreground"> em {daMeta.length} investimento{daMeta.length > 1 ? 's' : ''}</span>
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {carregando ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : invs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Você ainda não tem investimentos cadastrados.
            </p>
          ) : (
            <>
              {daMeta.length > 0 && (
                <Bloco titulo="Nesta meta">
                  {daMeta.map((i) => (
                    <Linha key={i.id} inv={i} on salvando={salvando === i.id} onToggle={alternar} />
                  ))}
                </Bloco>
              )}

              {livres.length > 0 && (
                <Bloco titulo="Disponíveis">
                  {livres.map((i) => (
                    <Linha key={i.id} inv={i} salvando={salvando === i.id} onToggle={alternar} />
                  ))}
                </Bloco>
              )}

              {deOutras.length > 0 && (
                <Bloco titulo="Em outras metas">
                  {/* ⚠️ Não some da lista: sumir daria a impressão de que o
                      investimento não existe. Fica visível, explicando que
                      marcar aqui o TRANSFERE — nunca duplica. */}
                  <p className="flex items-start gap-2 text-[12px] text-muted-foreground leading-snug mb-1">
                    <Info size={13} className="mt-0.5 flex-shrink-0" />
                    Marcar um destes o move para esta meta. Um investimento pertence a uma meta só.
                  </p>
                  {deOutras.map((i) => (
                    <Linha key={i.id} inv={i} salvando={salvando === i.id} onToggle={alternar} />
                  ))}
                </Bloco>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1.5">{titulo}</p>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Linha({ inv, on = false, salvando, onToggle }: any) {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30" style={{ minHeight: 56 }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{inv.nome}</p>
        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
          {inv.tipo}
          {/* Aviso da dupla contagem: o mesmo dinheiro também sustenta a
              reserva de emergência. Não é erro — são duas leituras da mesma
              carteira —, mas quem soma as duas telas acha que tem o dobro. */}
          {inv.is_reserva_emergencia && (
            <span className="inline-flex items-center gap-0.5" style={{ color: BRAND }}>
              <Shield size={10} /> também na reserva
            </span>
          )}
        </p>
      </div>
      <p className="text-sm font-bold tabular flex-shrink-0">{fmt(inv.valor_atual)}</p>
      <button
        role="switch"
        aria-checked={on}
        aria-label={`${on ? 'Desatrelar' : 'Atrelar'} ${inv.nome}`}
        disabled={!!salvando}
        onClick={() => onToggle(inv, !on)}
        className="relative rounded-full flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: on ? BRAND : 'hsl(var(--foreground) / 0.15)', width: 48, height: 28, minWidth: 48, minHeight: 28 }}
      >
        <span className="absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform"
              style={{ transform: on ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  );
}
