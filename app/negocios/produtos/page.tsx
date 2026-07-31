'use client';

// =============================================================================
// Produtos e serviços — a base de margem, lucro por item e (fase 3) estoque.
//
// A tela mostra MARGEM em destaque, não só o preço: é o número que o dono
// esquece de olhar e o que decide se vale continuar vendendo aquilo. Produto
// com margem negativa ganha alerta — vender no prejuízo sem perceber é o erro
// mais caro de um comércio pequeno.
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import ModalProduto from '@/components/negocios/ModalProduto';
import { corEmpresa } from '@/lib/empresas';
import { fmtCent, margemProduto, type ProdutoNegocio } from '@/lib/lancamentos';
import {
  Package, Plus, Search, Pencil, AlertTriangle, Wrench, Tag,
} from 'lucide-react';

export default function ProdutosPage() {
  const { phone, isPremium } = useAuth();
  const { empresa, carregando: carregandoEmpresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<ProdutoNegocio | null | undefined>(undefined);

  const { data, mutate, isLoading } = useApi(
    (phone && isPremium && empresa) ? `neg:produtos:${empresa.id}` : null,
    () => api.negocios.produtos.listar(phone, empresa!.id),
  );
  const produtos: ProdutoNegocio[] = useMemo(() => Array.isArray(data) ? data : [], [data]);

  // Filtro no cliente: a lista já veio inteira e assim a busca é instantânea,
  // sem uma ida ao servidor a cada tecla.
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q));
  }, [produtos, busca]);

  const semMargem = produtos.filter(p => p.preco > 0 && p.custo > 0 && p.preco <= p.custo);

  if (!isPremium) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Recurso do plano Premium.</p>;
  }

  return (
    <div className="pb-20 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Produtos</h1>
          <p className="text-sm text-muted-foreground mt-1">O que você vende, com preço, custo e margem</p>
        </div>
        <button onClick={() => setEditando(null)}
          className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
          style={{ background: cor, minHeight: 44 }}>
          <Plus size={16} /> Novo produto
        </button>
      </header>

      {/* Vender no prejuízo sem perceber é o erro mais caro de um comércio
          pequeno — por isso o alerta vem antes da lista. */}
      {semMargem.length > 0 && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
             style={{ background: 'color-mix(in srgb, #ef4444 8%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 28%, transparent)' }}>
          <AlertTriangle size={17} style={{ color: '#ef4444' }} className="flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-bold" style={{ color: '#ef4444' }}>
              {semMargem.length} {semMargem.length === 1 ? 'produto está' : 'produtos estão'} sem lucro
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              O preço está igual ou abaixo do custo: {semMargem.slice(0, 3).map(p => p.nome).join(', ')}
              {semMargem.length > 3 && ` e mais ${semMargem.length - 3}`}.
            </p>
          </div>
        </div>
      )}

      {produtos.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
                 placeholder="Buscar por nome, SKU ou categoria"
                 aria-label="Buscar produto"
                 className="input w-full pl-10" style={{ minHeight: 44 }} />
        </div>
      )}

      {(carregandoEmpresa || isLoading) ? (
        <Esqueleto />
      ) : produtos.length === 0 ? (
        <Vazio cor={cor} onCriar={() => setEditando(null)} />
      ) : filtrados.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          Nenhum produto encontrado para &ldquo;{busca}&rdquo;.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtrados.map(p => (
            <CardProduto key={p.id} p={p} cor={cor} onEditar={() => setEditando(p)} />
          ))}
        </ul>
      )}

      {editando !== undefined && empresa && (
        <ModalProduto
          empresaId={empresa.id}
          cor={cor}
          produto={editando}
          onClose={() => setEditando(undefined)}
          onSalvo={() => { setEditando(undefined); mutate(); }}
        />
      )}
    </div>
  );
}

function CardProduto({ p, cor, onEditar }: { p: ProdutoNegocio; cor: string; onEditar: () => void }) {
  const margem = margemProduto(p);
  const lucro  = p.preco - p.custo;
  const ruim   = p.preco > 0 && p.custo > 0 && lucro <= 0;

  return (
    <li>
      <button onClick={onEditar}
        className="w-full text-left rounded-2xl border border-border bg-card p-4 flex items-start gap-3 transition-colors hover:border-border/80 hover:bg-muted/20"
        style={{ minHeight: 44 }}>
        {p.foto_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.foto_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
        ) : (
          <span className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
            {p.eh_servico ? <Wrench size={19} style={{ color: cor }} /> : <Package size={19} style={{ color: cor }} />}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-foreground truncate">{p.nome}</p>
            <Pencil size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />
          </div>

          <p className="text-lg font-bold text-foreground tabular-nums mt-0.5">{fmtCent(p.preco)}</p>

          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            {/* Margem com ícone + texto, nunca só cor */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums ${
              ruim ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'
                   : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'}`}>
              {ruim && <AlertTriangle size={10} />}
              {p.custo > 0 ? `${margem.toFixed(0)}% de margem` : 'sem custo'}
            </span>
            {p.custo > 0 && (
              <span className="text-[11px] text-muted-foreground tabular-nums">
                lucro {fmtCent(lucro)}
              </span>
            )}
          </div>

          {(p.categoria || p.sku) && (
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 truncate">
              <Tag size={10} className="flex-shrink-0" />
              {[p.categoria, p.sku].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </button>
    </li>
  );
}

function Vazio({ cor, onCriar }: { cor: string; onCriar: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        <Package size={24} style={{ color: cor }} />
      </span>
      <p className="text-base font-bold text-foreground">Nenhum produto cadastrado</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
        Cadastre o que você vende com <b className="text-foreground">preço e custo</b> — é isso que
        permite ver a margem de cada item e o lucro de cada venda.
      </p>
      <button onClick={onCriar}
        className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold"
        style={{ background: cor, minHeight: 44 }}>
        <Plus size={16} /> Cadastrar produto
      </button>
    </div>
  );
}

function Esqueleto() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse" aria-busy="true">
      {[0, 1, 2, 3].map(i => (
        <li key={i} className="rounded-2xl border border-border bg-card p-4 flex gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/3 rounded bg-muted" />
            <div className="h-5 w-24 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
