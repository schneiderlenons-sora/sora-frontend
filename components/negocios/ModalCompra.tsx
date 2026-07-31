'use client';

// =============================================================================
// Registrar compra do fornecedor.
//
// A compra faz TRÊS coisas de uma vez, e a tela deixa isso explícito antes de
// confirmar: entra no estoque, atualiza o custo médio de cada item e gera a
// conta a pagar. O usuário precisa saber disso — senão vai lançar a mesma
// compra de novo no caixa, e a despesa conta em dobro.
//
// "Já recebi" é o padrão (a maioria compra e leva). "Só pedi" existe porque
// mercadoria encomendada não pode aparecer como disponível pra vender.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, Check, AlertCircle, Plus, Minus, Trash2, Search,
  Package, Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import {
  fmtCent, type ProdutoNegocio, type FornecedorNegocio,
} from '@/lib/lancamentos';

type ItemCompra = {
  chave: string; produto_id: string | null; nome: string;
  quantidade: number; custo_unit: number;
};

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export default function ModalCompra({
  empresaId, cor, onClose, onSalvo,
}: {
  empresaId: string; cor: string; onClose: () => void; onSalvo: () => void;
}) {
  const { phone } = useAuth();

  const [itens, setItens]   = useState<ItemCompra[]>([]);
  const [busca, setBusca]   = useState('');
  const [fornecedorId, setFornecedorId] = useState<string | null>(null);
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [recebida, setRecebida] = useState(true);
  const [aPrazo, setAPrazo]     = useState(false);
  const [vencimento, setVencimento] = useState(hojeSP());
  const [data, setData]     = useState(hojeSP());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]     = useState('');

  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const { data: produtosData } = useApi(
    phone ? `neg:produtos:${empresaId}` : null,
    () => api.negocios.produtos.listar(phone, empresaId),
  );
  const produtos: ProdutoNegocio[] = useMemo(() => Array.isArray(produtosData) ? produtosData : [], [produtosData]);

  const { data: fornData } = useApi(
    phone ? `neg:fornecedores:${empresaId}` : null,
    () => api.negocios.fornecedores.listar(phone, empresaId),
  );
  const fornecedores: FornecedorNegocio[] = useMemo(() => Array.isArray(fornData) ? fornData : [], [fornData]);

  const sugestoes = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return [];
    return produtos
      .filter(p => p.nome.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
      .slice(0, 6);
  }, [produtos, busca]);

  const total = itens.reduce((s, i) => s + Math.round(i.custo_unit * i.quantidade), 0);

  function adicionar(p: ProdutoNegocio) {
    setBusca('');
    setItens(prev => {
      const i = prev.findIndex(x => x.chave === p.id);
      if (i >= 0) {
        const c = [...prev];
        c[i] = { ...c[i], quantidade: c[i].quantidade + 1 };
        return c;
      }
      // Sugere o último custo conhecido — quase sempre é o mesmo, e digitar de
      // novo a cada compra é onde o usuário desiste do controle.
      return [...prev, {
        chave: p.id, produto_id: p.id, nome: p.nome,
        quantidade: 1, custo_unit: p.custo || 0,
      }];
    });
  }

  const mudar = (chave: string, campo: 'quantidade' | 'custo_unit', valor: number) =>
    setItens(prev => prev.map(i => (i.chave === chave ? { ...i, [campo]: valor } : i)));

  async function salvar() {
    if (salvando || !itens.length) return;
    setErro(''); setSalvando(true);
    try {
      await api.negocios.compras.criar({
        empresa_id: empresaId,
        itens: itens.map(i => ({
          produto_id: i.produto_id, nome: i.nome,
          quantidade: i.quantidade, custo_unit: i.custo_unit,
        })),
        fornecedor_id: fornecedorId,
        fornecedor_nome: fornecedorNome.trim() || undefined,
        status: recebida ? 'recebida' : 'pedida',
        a_prazo: aPrazo,
        vencimento: aPrazo ? vencimento : undefined,
        data,
      });
      onSalvo();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui registrar a compra.');
      setSalvando(false);
    }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] flex flex-col"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-bold text-foreground">Nova compra</h2>
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {erro && (
            <p className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {erro}
            </p>
          )}

          {/* Fornecedor */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Fornecedor
            </span>
            {fornecedores.length > 0 && (
              <select value={fornecedorId || ''} aria-label="Escolher fornecedor"
                      onChange={e => {
                        const id = e.target.value || null;
                        setFornecedorId(id);
                        setFornecedorNome(id ? (fornecedores.find(f => f.id === id)?.nome || '') : '');
                      }}
                      className="input w-full mb-2" style={{ minHeight: 44 }}>
                <option value="">Escolher…</option>
                {fornecedores.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            )}
            {!fornecedorId && (
              <input value={fornecedorNome} onChange={e => setFornecedorNome(e.target.value)}
                     placeholder="Ou digite o nome" aria-label="Nome do fornecedor"
                     className="input w-full" style={{ minHeight: 44 }} />
            )}
          </div>

          {/* Itens */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              O que você comprou
            </span>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                     placeholder="Buscar produto" aria-label="Buscar produto"
                     className="input w-full pl-10" style={{ minHeight: 44 }} />
            </div>

            {sugestoes.length > 0 && (
              <ul className="mt-1.5 rounded-xl border border-border overflow-hidden">
                {sugestoes.map(p => (
                  <li key={p.id}>
                    <button onClick={() => adicionar(p)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                            style={{ minHeight: 44 }}>
                      <Package size={14} className="text-muted-foreground flex-shrink-0" />
                      <span className="flex-1 min-w-0 text-sm text-foreground truncate">{p.nome}</span>
                      <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                        custo {fmtCent(p.custo)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {itens.length > 0 && (
              <ul className="mt-3 space-y-2">
                {itens.map(i => (
                  <li key={i.chave} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{i.nome}</span>
                      <button onClick={() => setItens(prev => prev.filter(x => x.chave !== i.chave))}
                              aria-label={`Remover ${i.nome}`}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 flex-shrink-0"
                              style={{ minWidth: 36, minHeight: 36 }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Quantidade</span>
                        <span className="flex items-center gap-1 mt-1">
                          <button onClick={() => mudar(i.chave, 'quantidade', Math.max(0.001, i.quantidade - 1))}
                                  aria-label="Diminuir" className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground flex-shrink-0"
                                  style={{ minWidth: 36, minHeight: 36 }}>
                            <Minus size={14} />
                          </button>
                          <input inputMode="decimal" value={i.quantidade}
                                 onChange={e => mudar(i.chave, 'quantidade', parseFloat(e.target.value.replace(',', '.')) || 0)}
                                 className="input flex-1 text-center tabular-nums" style={{ minHeight: 36 }} />
                          <button onClick={() => mudar(i.chave, 'quantidade', i.quantidade + 1)}
                                  aria-label="Aumentar" className="w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground flex-shrink-0"
                                  style={{ minWidth: 36, minHeight: 36 }}>
                            <Plus size={14} />
                          </button>
                        </span>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Custo unitário</span>
                        <input inputMode="numeric" value={i.custo_unit}
                               onChange={e => mudar(i.chave, 'custo_unit', parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
                               className="input w-full tabular-nums mt-1" style={{ minHeight: 36 }} />
                        <span className="text-[10px] text-muted-foreground tabular-nums">{fmtCent(i.custo_unit)}</span>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recebida × pedida — muda se entra no estoque agora */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
            {([
              { v: true,  l: 'Já recebi' },
              { v: false, l: 'Só pedi' },
            ] as const).map(o => {
              const on = recebida === o.v;
              return (
                <button key={o.l} onClick={() => setRecebida(o.v)} aria-pressed={on}
                        className={`h-11 rounded-xl text-sm font-bold transition-all ${
                          on ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        style={{ minHeight: 44 }}>
                  {o.l}
                </button>
              );
            })}
          </div>

          <button onClick={() => setAPrazo(v => !v)} role="switch" aria-checked={aPrazo}
                  className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border text-left"
                  style={{ minHeight: 44 }}>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Vou pagar depois</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">Entra em &ldquo;A pagar&rdquo;</span>
            </span>
            <span className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-colors ${aPrazo ? '' : 'bg-muted'}`}
                  style={aPrazo ? { background: cor } : undefined}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${aPrazo ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="cp-data" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
              <input id="cp-data" type="date" value={data} onChange={e => setData(e.target.value)}
                     className="input w-full" style={{ minHeight: 44 }} />
            </div>
            {aPrazo && (
              <div>
                <label htmlFor="cp-venc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Vence em</label>
                <input id="cp-venc" type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
                       className="input w-full" style={{ minHeight: 44 }} />
              </div>
            )}
          </div>

          {/* O que vai acontecer — evita o lançamento duplicado no caixa */}
          {itens.length > 0 && (
            <div className="rounded-2xl p-3.5 flex items-start gap-2.5"
                 style={{ background: `color-mix(in srgb, ${cor} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${cor} 22%, transparent)` }}>
              <Info size={15} style={{ color: cor }} className="flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {recebida
                  ? <>Os itens <b className="text-foreground">entram no estoque</b> e o custo médio de cada um é recalculado. </>
                  : <>Como você só pediu, <b className="text-foreground">nada entra no estoque</b> ainda — marque como recebida quando chegar. </>}
                {aPrazo
                  ? <>A compra vira uma <b className="text-foreground">conta a pagar</b>.</>
                  : <>A saída de <b className="text-foreground">{fmtCent(total)}</b> entra no caixa. Não precisa lançar de novo.</>}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="text-xl font-bold text-foreground tabular-nums">{fmtCent(total)}</p>
          </div>
          <button onClick={salvar} disabled={salvando || !itens.length}
                  className="h-12 px-5 rounded-2xl text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-50"
                  style={{ background: cor, minHeight: 48 }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
            Registrar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
