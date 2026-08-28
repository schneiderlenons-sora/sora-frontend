'use client';

// =============================================================================
// Estoque — "onde está meu dinheiro parado".
//
// A ordem da tela não é alfabética: é por URGÊNCIA. Zerado (perdeu venda hoje)
// vem antes de baixo (vai faltar), que vem antes do resto. E o número que
// planilha nenhuma mostra sozinha — o DINHEIRO PARADO em item que não gira há
// 90 dias — fica no topo, porque é o que financia a reposição do que vende.
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import ModalAjusteEstoque from '@/components/negocios/ModalAjusteEstoque';
import { corEmpresa } from '@/lib/empresas';
import { fmtCent, type ItemEstoque, type ResumoEstoque } from '@/lib/lancamentos';
import {
  Boxes, Search, AlertTriangle, PackageX, Clock,
  TrendingDown, Package, Settings2,
} from 'lucide-react';

type Filtro = 'todos' | 'zerado' | 'baixo' | 'parado';

const dataBr = (iso?: string | null) => {
  if (!iso) return 'nunca';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

export default function EstoquePage() {
  const { phone, temNegocios } = useAuth();
  const { empresa, carregando: carregandoEmpresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [busca, setBusca]   = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ajuste, setAjuste] = useState<ItemEstoque | null>(null);

  const { data, mutate, isLoading } = useApi(
    (phone && temNegocios && empresa) ? `neg:estoque:${empresa.id}` : null,
    () => api.negocios.estoque.listar(phone, empresa!.id),
  );
  const produtos: ItemEstoque[] = useMemo(() => data?.produtos || [], [data]);
  const resumo: ResumoEstoque | null = data?.resumo || null;

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let ls = produtos;
    if (filtro === 'zerado') ls = ls.filter(p => p.status === 'zerado');
    if (filtro === 'baixo')  ls = ls.filter(p => p.status === 'baixo');
    if (filtro === 'parado') ls = ls.filter(p => p.parado);
    if (q) ls = ls.filter(p => p.nome.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
    // Urgência primeiro: zerado → baixo → parado → resto.
    const peso = (p: ItemEstoque) =>
      p.status === 'zerado' ? 0 : p.status === 'baixo' ? 1 : p.parado ? 2 : 3;
    return [...ls].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome));
  }, [produtos, busca, filtro]);

  if (!temNegocios) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Recurso do plano Platinum.</p>;
  }

  const carregando = carregandoEmpresa || isLoading;

  return (
    <div className="pb-20 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">Estoque</h1>
          <p className="text-sm text-muted-foreground mt-1">O que tem na prateleira e quanto vale</p>
        </div>
        <a href="/negocios/produtos"
           className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-sm font-semibold border border-border text-foreground hover:bg-muted/50 transition-colors"
           style={{ minHeight: 44 }}>
          <Settings2 size={15} /> Produtos
        </a>
      </header>

      {carregando ? (
        <Esqueleto />
      ) : !resumo || resumo.itens === 0 ? (
        <SemControle cor={cor} semControle={resumo?.sem_controle || 0} />
      ) : (
        <>
          {/* Os quatro números do estoque */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Cartao rotulo="Valor em estoque" valor={fmtCent(resumo.valor_total)}
                    sub={`${resumo.itens} ${resumo.itens === 1 ? 'item' : 'itens'}`}
                    icone={Boxes} tom={cor} />
            <Cartao rotulo="Sem estoque" valor={String(resumo.zerados)}
                    sub="perdendo venda" icone={PackageX} tom="#ef4444"
                    ativo={filtro === 'zerado'} onClick={() => setFiltro(f => f === 'zerado' ? 'todos' : 'zerado')} />
            <Cartao rotulo="Vai acabar" valor={String(resumo.baixos)}
                    sub="abaixo do mínimo" icone={AlertTriangle} tom="#f59e0b"
                    ativo={filtro === 'baixo'} onClick={() => setFiltro(f => f === 'baixo' ? 'todos' : 'baixo')} />
            {/* O número que dói: dinheiro preso no que não gira */}
            <Cartao rotulo="Dinheiro parado" valor={fmtCent(resumo.valor_parado)}
                    sub={`${resumo.parados} sem vender há 90d`} icone={Clock} tom="#8b5cf6"
                    ativo={filtro === 'parado'} onClick={() => setFiltro(f => f === 'parado' ? 'todos' : 'parado')} />
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input value={busca} onChange={e => setBusca(e.target.value)}
                   placeholder="Buscar produto" aria-label="Buscar no estoque"
                   className="input w-full pl-10" style={{ minHeight: 44 }} />
          </div>

          {filtro !== 'todos' && (
            <button onClick={() => setFiltro('todos')}
                    className="text-xs font-semibold" style={{ color: cor, minHeight: 32 }}>
              ← Ver todos os {produtos.length} itens
            </button>
          )}

          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum item neste filtro.
            </p>
          ) : (
            <ul className="space-y-2">
              {lista.map(p => <LinhaEstoque key={p.id} p={p} cor={cor} onAjustar={() => setAjuste(p)} />)}
            </ul>
          )}

          {resumo.sem_controle > 0 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              {resumo.sem_controle} {resumo.sem_controle === 1 ? 'produto está' : 'produtos estão'} sem controle de
              estoque. Ative em <a href="/negocios/produtos" className="font-semibold underline" style={{ color: cor }}>Produtos</a>.
            </p>
          )}
        </>
      )}

      {ajuste && empresa && (
        <ModalAjusteEstoque
          empresaId={empresa.id} cor={cor} produto={ajuste}
          onClose={() => setAjuste(null)}
          onAjustado={() => { setAjuste(null); mutate(); }}
        />
      )}
    </div>
  );
}

function LinhaEstoque({ p, cor, onAjustar }: { p: ItemEstoque; cor: string; onAjustar: () => void }) {
  const tom = p.status === 'zerado' ? '#ef4444' : p.status === 'baixo' ? '#f59e0b' : p.parado ? '#8b5cf6' : cor;

  return (
    <li className="rounded-2xl border bg-card p-3.5 flex items-center gap-3"
        style={{ borderColor: p.status === 'ok' && !p.parado ? 'hsl(var(--border))' : `color-mix(in srgb, ${tom} 30%, transparent)` }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${tom} 13%, transparent)` }}>
        <Package size={17} style={{ color: tom }} />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{p.nome}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
          {/* Estado em TEXTO, não só cor */}
          {p.status === 'zerado' && <b style={{ color: tom }}>sem estoque</b>}
          {p.status === 'baixo'  && <b style={{ color: tom }}>abaixo do mínimo{p.estoque_min != null ? ` (${p.estoque_min})` : ''}</b>}
          {p.parado && p.status === 'ok' && (
            <span className="inline-flex items-center gap-1" style={{ color: tom }}>
              <TrendingDown size={10} /> sem vender há 90d
            </span>
          )}
          <span>última saída {dataBr(p.ultima_saida)}</span>
          {p.valor_estoque > 0 && <span className="tabular-nums">· {fmtCent(p.valor_estoque)} parados</span>}
        </p>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-lg font-bold tabular-nums" style={{ color: p.status === 'zerado' ? tom : 'hsl(var(--foreground))' }}>
          {p.estoque_atual}
        </p>
        <p className="text-[10px] text-muted-foreground">{p.unidade || 'un'}</p>
      </div>

      <button onClick={onAjustar} aria-label={`Ajustar estoque de ${p.nome}`}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
              style={{ minWidth: 40, minHeight: 40 }}>
        <Settings2 size={16} />
      </button>
    </li>
  );
}

function Cartao({ rotulo, valor, sub, icone: Icone, tom, ativo, onClick }: {
  rotulo: string; valor: string; sub?: string; icone: any; tom: string;
  ativo?: boolean; onClick?: () => void;
}) {
  const conteudo = (
    <>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icone size={13} style={{ color: tom }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{rotulo}</span>
      </div>
      <p className="text-lg sm:text-xl font-bold text-foreground tabular-nums truncate">{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </>
  );

  if (!onClick) {
    return <div className="rounded-2xl border border-border bg-card p-4">{conteudo}</div>;
  }
  return (
    <button onClick={onClick} aria-pressed={ativo}
            className="rounded-2xl border bg-card p-4 text-left transition-colors"
            style={{
              minHeight: 44,
              borderColor: ativo ? tom : 'hsl(var(--border))',
              background: ativo ? `color-mix(in srgb, ${tom} 7%, transparent)` : undefined,
            }}>
      {conteudo}
    </button>
  );
}

function SemControle({ cor, semControle }: { cor: string; semControle: number }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        <Boxes size={24} style={{ color: cor }} />
      </span>
      <p className="text-base font-bold text-foreground">Nenhum produto com controle de estoque</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
        {semControle > 0
          ? <>Você tem <b className="text-foreground">{semControle}</b> {semControle === 1 ? 'produto cadastrado' : 'produtos cadastrados'}. Ligue o controle
              de estoque em cada um que quiser acompanhar — a venda passa a dar baixa sozinha.</>
          : <>Cadastre seus produtos e ligue o controle de estoque naqueles que você
              quer acompanhar. A venda dá baixa sozinha e a compra dá entrada.</>}
      </p>
      <a href="/negocios/produtos"
         className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold"
         style={{ background: cor, minHeight: 44 }}>
        <Package size={16} /> Ir para Produtos
      </a>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-muted" />)}
      </div>
      <div className="h-11 rounded-xl bg-muted" />
      <ul className="space-y-2">
        {[0, 1, 2, 3].map(i => (
          <li key={i} className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 rounded bg-muted" style={{ width: `${55 - i * 5}%` }} />
              <div className="h-3 w-40 rounded bg-muted" />
            </div>
            <div className="h-6 w-10 rounded bg-muted flex-shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}
