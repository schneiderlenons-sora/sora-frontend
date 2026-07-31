'use client';

// =============================================================================
// Vendas da loja — a lista, com o LUCRO de cada venda.
//
// Faturamento sozinho engana: R$ 10.000 vendidos com R$ 9.000 de custo é um mês
// ruim disfarçado de bom. Por isso cada linha mostra o lucro, e o resumo do topo
// separa "vendeu" de "lucrou".
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import BalcaoVenda from './BalcaoVenda';
import {
  fmtCent, labelForma, lucroVenda, type VendaNegocio,
} from '@/lib/lancamentos';
import {
  ShoppingCart, Plus, ChevronLeft, ChevronRight, TrendingUp,
  User, CalendarClock, Trash2, Inbox,
} from 'lucide-react';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const dataBr = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export default function VendasLoja({ empresaId, cor, nomeEmpresa }: {
  empresaId: string; cor: string; nomeEmpresa?: string;
}) {
  const { phone } = useAuth();
  const [balcao, setBalcao] = useState(false);

  const [mesIndex, setMesIndex] = useState(0);
  const ref = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + mesIndex, 1);
  }, [mesIndex]);
  const mes = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;

  const { data, mutate, isLoading } = useApi(
    phone ? `neg:vendas:${empresaId}:${mes}` : null,
    () => api.negocios.vendas.listar(phone, empresaId, { mes }),
  );
  const todas: VendaNegocio[] = useMemo(() => Array.isArray(data) ? data : [], [data]);
  const vendas = useMemo(() => todas.filter(v => v.status !== 'cancelada'), [todas]);

  const resumo = useMemo(() => {
    const faturado = vendas.reduce((s, v) => s + (v.total || 0), 0);
    const lucro    = vendas.reduce((s, v) => s + lucroVenda(v), 0);
    return {
      faturado, lucro, qtd: vendas.length,
      ticket: vendas.length ? Math.round(faturado / vendas.length) : 0,
      margem: faturado > 0 ? Math.round((lucro / faturado) * 1000) / 10 : 0,
    };
  }, [vendas]);

  async function cancelar(v: VendaNegocio) {
    if (!confirm('Cancelar esta venda?\n\nEla sai do faturamento e o lançamento no caixa é removido.')) return;
    mutate((cur: any) => (cur || []).filter((x: VendaNegocio) => x.id !== v.id), { revalidate: false });
    try { await api.negocios.vendas.cancelar(v.id); } finally { mutate(); }
  }

  return (
    <div className="pb-20 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {nomeEmpresa || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Vendas</h1>
          <p className="text-sm text-muted-foreground mt-1">O que saiu e quanto sobrou em cada venda</p>
        </div>
        <button onClick={() => setBalcao(true)}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
          style={{ background: cor, minHeight: 44 }}>
          <Plus size={16} /> Nova venda
        </button>
      </header>

      {/* Navegador de mês */}
      <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 w-fit">
        <button onClick={() => setMesIndex(i => i - 1)} aria-label="Mês anterior"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft size={18} />
        </button>
        <span className="px-2 text-sm font-bold text-foreground min-w-[124px] text-center tabular-nums">
          {MESES[ref.getMonth()]} de {ref.getFullYear()}
        </span>
        <button onClick={() => setMesIndex(i => Math.min(i + 1, 0))} disabled={mesIndex >= 0}
          aria-label="Próximo mês"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Faturado × lucrado: a distinção que evita o "mês bom" enganoso */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Resumo rotulo="Vendeu" valor={fmtCent(resumo.faturado)} sub={`${resumo.qtd} ${resumo.qtd === 1 ? 'venda' : 'vendas'}`} tom={cor} icone={ShoppingCart} />
        <Resumo rotulo="Lucrou" valor={fmtCent(resumo.lucro)} sub="depois dos custos" tom="#10b981" icone={TrendingUp} />
        <Resumo rotulo="Margem" valor={`${resumo.margem.toFixed(1).replace('.', ',')}%`} tom="#0ea5e9" icone={TrendingUp} />
        <Resumo rotulo="Ticket médio" valor={fmtCent(resumo.ticket)} sub="por venda" tom="#8b5cf6" icone={ShoppingCart} />
      </div>

      {isLoading ? (
        <Esqueleto />
      ) : vendas.length === 0 ? (
        <Vazio cor={cor} onVender={() => setBalcao(true)} />
      ) : (
        <ul className="space-y-2">
          {vendas.map(v => {
            const lucro = lucroVenda(v);
            const itens = v.itens || [];
            return (
              <li key={v.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
                    <ShoppingCart size={17} style={{ color: cor }} />
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {itens.length === 1
                          ? `${itens[0].quantidade}× ${itens[0].nome}`
                          : `${itens.length} itens`}
                      </p>
                      <span className="text-base font-bold tabular-nums text-foreground flex-shrink-0">
                        {fmtCent(v.total)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-1">
                      <span className="tabular-nums">{dataBr(v.data)}</span>
                      {v.forma_pagamento && <span>· {labelForma(v.forma_pagamento)}</span>}
                      {(v.cliente?.nome || v.cliente_nome) && (
                        <span className="inline-flex items-center gap-1 truncate max-w-[140px]">
                          <User size={10} /> {v.cliente?.nome || v.cliente_nome}
                        </span>
                      )}
                      {/* A prazo em texto, não só cor — é dinheiro que ainda não entrou */}
                      {v.status === 'pendente' && (
                        <span className="inline-flex items-center gap-1 font-bold" style={{ color: '#ef4444' }}>
                          <CalendarClock size={10} /> a receber
                        </span>
                      )}
                    </p>

                    {itens.length > 1 && (
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {itens.map(i => `${i.quantidade}× ${i.nome}`).join(', ')}
                      </p>
                    )}

                    <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-border/60">
                      <span className={`text-xs font-bold tabular-nums ${lucro >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                        {lucro >= 0 ? 'lucro' : 'prejuízo'} {fmtCent(Math.abs(lucro))}
                      </span>
                      <button onClick={() => cancelar(v)} aria-label="Cancelar venda"
                              className="w-9 h-9 -mr-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                              style={{ minWidth: 36, minHeight: 36 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {balcao && (
        <BalcaoVenda
          empresaId={empresaId} cor={cor}
          onClose={() => setBalcao(false)}
          onVendido={() => { setBalcao(false); mutate(); }}
        />
      )}
    </div>
  );
}

function Resumo({ rotulo, valor, sub, tom, icone: Icone }: {
  rotulo: string; valor: string; sub?: string; tom: string; icone: any;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icone size={13} style={{ color: tom }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{rotulo}</span>
      </div>
      <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums truncate">{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function Vazio({ cor, onVender }: { cor: string; onVender: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        <Inbox size={24} style={{ color: cor }} />
      </span>
      <p className="text-base font-bold text-foreground">Nenhuma venda neste mês</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
        Registre a venda em poucos toques — ela entra no caixa sozinha, e a
        prazo vira conta a receber.
      </p>
      <button onClick={onVender}
        className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold"
        style={{ background: cor, minHeight: 44 }}>
        <Plus size={16} /> Registrar venda
      </button>
    </div>
  );
}

function Esqueleto() {
  return (
    <ul className="space-y-2 animate-pulse" aria-busy="true">
      {[0, 1, 2].map(i => (
        <li key={i} className="rounded-2xl border border-border bg-card p-4 flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/2 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
