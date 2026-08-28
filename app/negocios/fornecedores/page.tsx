'use client';

// =============================================================================
// Compras e fornecedores — de quem você compra e o que já saiu pra eles.
//
// As duas coisas vivem na mesma tela porque são a mesma decisão: "quanto estou
// gastando com o fornecedor X" só faz sentido vendo as compras. Separar em duas
// abas do menu daria dois cliques pra responder uma pergunta só.
//
// Compra PEDIDA (ainda não chegou) fica destacada com o botão de receber: é a
// ação que trava o estoque enquanto não acontece.
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import ModalCompra from '@/components/negocios/ModalCompra';
import { corEmpresa } from '@/lib/empresas';
import {
  fmtCent, type CompraNegocio, type FornecedorNegocio,
} from '@/lib/lancamentos';
import {
  Truck, Plus, PackageCheck, Clock, MessageCircle, Loader2,
  Trash2, ShoppingBag,
} from 'lucide-react';

const dataBr = (iso?: string | null) => {
  if (!iso) return '—';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export default function FornecedoresPage() {
  const { phone, temNegocios } = useAuth();
  const { empresa, carregando: carregandoEmpresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [aba, setAba]       = useState<'compras' | 'fornecedores'>('compras');
  const [novaCompra, setNovaCompra] = useState(false);
  const [recebendo, setRecebendo]   = useState<string | null>(null);
  const [novoForn, setNovoForn]     = useState('');
  const [salvandoForn, setSalvandoForn] = useState(false);

  const { data: comprasData, mutate: mCompras, isLoading: carregandoCompras } = useApi(
    (phone && temNegocios && empresa) ? `neg:compras:${empresa.id}` : null,
    () => api.negocios.compras.listar(phone, empresa!.id),
  );
  const compras: CompraNegocio[] = useMemo(
    () => (Array.isArray(comprasData) ? comprasData : []).filter(c => c.status !== 'cancelada'),
    [comprasData]);

  const { data: fornData, mutate: mForn } = useApi(
    (phone && temNegocios && empresa) ? `neg:fornecedores:${empresa.id}` : null,
    () => api.negocios.fornecedores.listar(phone, empresa!.id),
  );
  const fornecedores: FornecedorNegocio[] = useMemo(() => Array.isArray(fornData) ? fornData : [], [fornData]);

  // Quanto já saiu pra cada fornecedor — a pergunta que a lista tem de responder.
  const totalPorFornecedor = useMemo(() => {
    const m = new Map<string, { total: number; qtd: number }>();
    for (const c of compras) {
      const k = c.fornecedor_id || c.fornecedor_nome || '';
      if (!k) continue;
      const acc = m.get(k) || { total: 0, qtd: 0 };
      acc.total += c.total || 0; acc.qtd += 1;
      m.set(k, acc);
    }
    return m;
  }, [compras]);

  const pendentes = compras.filter(c => c.status === 'pedida');
  const totalMes  = compras.reduce((s, c) => s + (c.total || 0), 0);

  async function receber(c: CompraNegocio) {
    setRecebendo(c.id);
    try { await api.negocios.compras.receber(c.id); await mCompras(); }
    finally { setRecebendo(null); }
  }

  async function criarFornecedor() {
    const nome = novoForn.trim();
    if (!nome || salvandoForn || !empresa) return;
    setSalvandoForn(true);
    try {
      await api.negocios.fornecedores.criar({ empresa_id: empresa.id, nome });
      setNovoForn('');
      mForn();
    } finally { setSalvandoForn(false); }
  }

  if (!temNegocios) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Recurso do plano Platinum.</p>;
  }

  return (
    <div className="pb-20 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Compras</h1>
          <p className="text-sm text-muted-foreground mt-1">De quem você compra e quanto já saiu</p>
        </div>
        <button onClick={() => setNovaCompra(true)}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
          style={{ background: cor, minHeight: 44 }}>
          <Plus size={16} /> Nova compra
        </button>
      </header>

      {/* Mercadoria pedida e não recebida trava o estoque — fica em destaque */}
      {pendentes.length > 0 && (
        <div className="rounded-2xl p-4"
             style={{ background: 'color-mix(in srgb, #f59e0b 8%, transparent)', border: '1px solid color-mix(in srgb, #f59e0b 28%, transparent)' }}>
          <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#b45309' }}>
            <Clock size={15} />
            {pendentes.length} {pendentes.length === 1 ? 'compra pedida' : 'compras pedidas'} aguardando chegar
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            O estoque só entra quando você marcar como recebida.
          </p>
        </div>
      )}

      <div className="flex items-center gap-1 p-1 rounded-2xl bg-muted/50 border border-border/60 w-fit"
           role="tablist" aria-label="Compras ou fornecedores">
        {([['compras', 'Compras'], ['fornecedores', 'Fornecedores']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} role="tab" aria-selected={aba === id}
            className={`h-10 px-4 rounded-xl text-sm font-bold transition-all ${
              aba === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            style={{ minHeight: 40 }}>
            {label}
          </button>
        ))}
      </div>

      {aba === 'compras' ? (
        carregandoCompras || carregandoEmpresa ? (
          <Esqueleto />
        ) : compras.length === 0 ? (
          <Vazio cor={cor} onCriar={() => setNovaCompra(true)}
                 titulo="Nenhuma compra registrada"
                 texto="Registre o que comprou do fornecedor: entra no estoque, atualiza o custo dos produtos e vira conta a pagar." />
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total comprado</p>
              <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{fmtCent(totalMes)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {compras.length} {compras.length === 1 ? 'compra' : 'compras'}
              </p>
            </div>

            <ul className="space-y-2">
              {compras.map(c => {
                const pedida = c.status === 'pedida';
                return (
                  <li key={c.id} className="rounded-2xl border bg-card p-4"
                      style={{ borderColor: pedida ? 'color-mix(in srgb, #f59e0b 35%, transparent)' : 'hsl(var(--border))' }}>
                    <div className="flex items-start gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `color-mix(in srgb, ${pedida ? '#f59e0b' : cor} 13%, transparent)` }}>
                        {pedida ? <Clock size={17} style={{ color: '#f59e0b' }} /> : <PackageCheck size={17} style={{ color: cor }} />}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {c.fornecedor?.nome || c.fornecedor_nome || 'Sem fornecedor'}
                          </p>
                          <span className="text-base font-bold tabular-nums text-foreground flex-shrink-0">
                            {fmtCent(c.total)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {dataBr(c.data)} · {(c.itens || []).length} {(c.itens || []).length === 1 ? 'item' : 'itens'}
                          {/* Estado em texto, não só cor */}
                          {pedida && <b style={{ color: '#b45309' }}> · aguardando chegar</b>}
                          {c.vencimento && <span> · vence {dataBr(c.vencimento)}</span>}
                        </p>
                        {(c.itens || []).length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-1 truncate">
                            {(c.itens || []).map(i => `${i.quantidade}× ${i.nome}`).join(', ')}
                          </p>
                        )}

                        {pedida && (
                          <button onClick={() => receber(c)} disabled={recebendo === c.id}
                            className="mt-2.5 inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl text-white text-xs font-bold disabled:opacity-60"
                            style={{ background: cor, minHeight: 40 }}>
                            {recebendo === c.id ? <Loader2 size={13} className="animate-spin" /> : <PackageCheck size={14} />}
                            Recebi — dar entrada no estoque
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )
      ) : (
        <>
          {/* Cadastro rápido: fornecedor é quase sempre só um nome */}
          <div className="flex gap-2">
            <input value={novoForn} onChange={e => setNovoForn(e.target.value)}
                   onKeyDown={e => { if (e.key === 'Enter') criarFornecedor(); }}
                   placeholder="Nome do fornecedor" aria-label="Novo fornecedor"
                   className="input flex-1" style={{ minHeight: 44 }} />
            <button onClick={criarFornecedor} disabled={!novoForn.trim() || salvandoForn}
                    aria-label="Adicionar fornecedor"
                    className="w-11 rounded-xl flex items-center justify-center text-white disabled:opacity-40 flex-shrink-0"
                    style={{ background: cor, minHeight: 44 }}>
              {salvandoForn ? <Loader2 size={17} className="animate-spin" /> : <Plus size={18} />}
            </button>
          </div>

          {fornecedores.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum fornecedor ainda. Adicione acima ou digite o nome direto na compra.
            </p>
          ) : (
            <ul className="space-y-2">
              {fornecedores.map(f => {
                const t = totalPorFornecedor.get(f.id) || totalPorFornecedor.get(f.nome);
                return (
                  <li key={f.id} className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `color-mix(in srgb, ${cor} 13%, transparent)` }}>
                      <Truck size={17} style={{ color: cor }} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{f.nome}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {t ? `${fmtCent(t.total)} em ${t.qtd} ${t.qtd === 1 ? 'compra' : 'compras'}` : 'sem compras ainda'}
                      </p>
                    </div>
                    {f.telefone && (
                      <a href={`https://wa.me/${f.telefone.length <= 11 ? `55${f.telefone}` : f.telefone}`}
                         target="_blank" rel="noreferrer" aria-label={`Falar com ${f.nome}`}
                         className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
                         style={{ minWidth: 40, minHeight: 40 }}>
                        <MessageCircle size={16} />
                      </a>
                    )}
                    <button onClick={async () => {
                              if (!confirm(`Arquivar "${f.nome}"?\n\nAs compras dele continuam no histórico.`)) return;
                              mForn((cur: any) => (cur || []).filter((x: FornecedorNegocio) => x.id !== f.id), { revalidate: false });
                              try { await api.negocios.fornecedores.arquivar(f.id); } finally { mForn(); }
                            }}
                            aria-label={`Arquivar ${f.nome}`}
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
                            style={{ minWidth: 40, minHeight: 40 }}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      {novaCompra && empresa && (
        <ModalCompra
          empresaId={empresa.id} cor={cor}
          onClose={() => setNovaCompra(false)}
          onSalvo={() => { setNovaCompra(false); mCompras(); }}
        />
      )}
    </div>
  );
}

function Vazio({ cor, onCriar, titulo, texto }: {
  cor: string; onCriar: () => void; titulo: string; texto: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        <ShoppingBag size={24} style={{ color: cor }} />
      </span>
      <p className="text-base font-bold text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">{texto}</p>
      <button onClick={onCriar}
        className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold"
        style={{ background: cor, minHeight: 44 }}>
        <Plus size={16} /> Registrar compra
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
          </div>
        </li>
      ))}
    </ul>
  );
}
