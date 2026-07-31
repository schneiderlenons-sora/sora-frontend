'use client';

// =============================================================================
// Ficha do cliente — o que transforma a lista de nomes em ferramenta.
//
// Responde de relance: quanto ele já gastou, quanto DEU DE LUCRO (não é a mesma
// coisa — um cliente de alto volume e margem baixa pode render menos que um
// pequeno de margem alta), o ticket médio, quando comprou pela última vez e
// quanto está em aberto.
// =============================================================================

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, MessageCircle, Pencil, ShoppingBag, TrendingUp, CalendarClock, AlertTriangle,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import { fmtCent, type ClienteNegocio, type ClienteFicha } from '@/lib/lancamentos';

const dataBr = (iso?: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

export default function FichaCliente({
  clienteId, cor, onClose, onEditar,
}: {
  clienteId: string; cor: string;
  onClose: () => void; onEditar: (c: ClienteNegocio) => void;
}) {
  const { phone } = useAuth();
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const { data, isLoading } = useApi(
    phone ? `neg:cliente:${clienteId}` : null,
    () => api.negocios.clientes.ficha(phone, clienteId),
  );
  const c = data as ClienteFicha | undefined;

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
                  style={{ background: `color-mix(in srgb, ${cor} 14%, transparent)`, color: cor }}>
              {(c?.nome || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{c?.nome || 'Carregando…'}</h2>
              {c?.telefone && <p className="text-[11px] text-muted-foreground tabular-nums">{c.telefone}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {c && (
              <button onClick={() => onEditar(c)} aria-label="Editar cliente"
                      className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
                <Pencil size={16} />
              </button>
            )}
            <button onClick={onClose} aria-label="Fechar"
                    className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {isLoading || !c ? (
            <div className="space-y-3 animate-pulse" aria-busy="true">
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map(i => <div key={i} className="h-20 rounded-2xl bg-muted" />)}
              </div>
              <div className="h-40 rounded-2xl bg-muted" />
            </div>
          ) : (
            <>
              {/* O que ele vale */}
              <div className="grid grid-cols-2 gap-3">
                <Metrica rotulo="Já comprou" valor={fmtCent(c.resumo.total_gasto)}
                         sub={`${c.resumo.compras} ${c.resumo.compras === 1 ? 'compra' : 'compras'}`}
                         icone={ShoppingBag} tom={cor} />
                <Metrica rotulo="Deu de lucro" valor={fmtCent(c.resumo.lucro_gerado)}
                         sub="depois dos custos" icone={TrendingUp} tom="#10b981" />
                <Metrica rotulo="Ticket médio" valor={fmtCent(c.resumo.ticket_medio)}
                         sub="por compra" icone={ShoppingBag} tom="#8b5cf6" />
                <Metrica rotulo="Última compra" valor={dataBr(c.resumo.ultima_compra)}
                         sub={c.resumo.ultima_compra ? '' : 'ainda não comprou'}
                         icone={CalendarClock} tom="#0ea5e9" />
              </div>

              {/* Dívida em aberto vem em destaque: é o que exige ação */}
              {c.resumo.em_aberto > 0 && (
                <div className="rounded-2xl p-4 flex items-center justify-between gap-3"
                     style={{ background: 'color-mix(in srgb, #ef4444 8%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 28%, transparent)' }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AlertTriangle size={17} style={{ color: '#ef4444' }} className="flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: '#ef4444' }}>Em aberto</p>
                      <p className="text-[11px] text-muted-foreground">compras ainda não pagas</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold tabular-nums flex-shrink-0" style={{ color: '#ef4444' }}>
                    {fmtCent(c.resumo.em_aberto)}
                  </span>
                </div>
              )}

              {c.telefone && (
                <a href={`https://wa.me/${c.telefone.length <= 11 ? `55${c.telefone}` : c.telefone}`}
                   target="_blank" rel="noreferrer"
                   className="w-full h-11 rounded-2xl inline-flex items-center justify-center gap-2 text-white text-sm font-bold"
                   style={{ background: cor, minHeight: 44 }}>
                  <MessageCircle size={16} /> Conversar no WhatsApp
                </a>
              )}

              {/* Histórico */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Compras {c.vendas.length > 0 && <span className="font-normal">({c.vendas.length})</span>}
                </p>
                {c.vendas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma compra registrada ainda.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {c.vendas.map(v => (
                      <li key={v.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                        <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0 w-16">{dataBr(v.data)}</span>
                        <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
                          {v.forma_pagamento || '—'}
                          {v.status === 'pendente' && (
                            <b className="ml-1.5" style={{ color: '#ef4444' }}>· a receber</b>
                          )}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">
                          {fmtCent(v.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {c.observacao && (
                <div className="rounded-2xl bg-muted/30 p-3.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Observações</p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{c.observacao}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Metrica({ rotulo, valor, sub, icone: Icone, tom }: {
  rotulo: string; valor: string; sub?: string; icone: any; tom: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-3.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icone size={13} style={{ color: tom }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{rotulo}</span>
      </div>
      <p className="text-base font-bold text-foreground tabular-nums truncate">{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
