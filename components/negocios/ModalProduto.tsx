'use client';

// =============================================================================
// Cadastro de produto/serviço.
//
// A margem é calculada AO VIVO enquanto o usuário digita preço e custo. É o
// jeito de ele descobrir na hora — e não no fim do mês — que aquele preço não
// paga o custo. Sem isso, "margem" vira um número que só aparece no relatório,
// quando já não dá pra desfazer a venda.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Loader2, AlertCircle, Trash2, Package, Wrench, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { fmtCent, margemProduto, type ProdutoNegocio } from '@/lib/lancamentos';

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'm', 'm²', 'h', 'cx', 'pct'];

export default function ModalProduto({
  empresaId, cor, produto, onClose, onSalvo,
}: {
  empresaId: string; cor: string;
  produto?: ProdutoNegocio | null;   // null = criar
  onClose: () => void; onSalvo: () => void;
}) {
  const editando = !!produto?.id;

  const [nome, setNome]         = useState(produto?.nome || '');
  const [preco, setPreco]       = useState(produto ? String(produto.preco) : '');
  const [custo, setCusto]       = useState(produto ? String(produto.custo) : '');
  const [sku, setSku]           = useState(produto?.sku || '');
  const [codigo, setCodigo]     = useState(produto?.codigo_barras || '');
  const [categoria, setCategoria] = useState(produto?.categoria || '');
  const [unidade, setUnidade]   = useState(produto?.unidade || 'un');
  const [ehServico, setEhServico] = useState(!!produto?.eh_servico);
  const [estoqueMin, setEstoqueMin] = useState(produto?.estoque_min != null ? String(produto.estoque_min) : '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState('');

  // Portal: `fixed` dentro de card com backdrop-blur fica preso no card.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const precoCent = parseInt(preco || '0', 10) || 0;
  const custoCent = parseInt(custo || '0', 10) || 0;

  const previa = useMemo(() => {
    const lucro = precoCent - custoCent;
    return { lucro, margem: margemProduto({ preco: precoCent, custo: custoCent }) };
  }, [precoCent, custoCent]);

  async function salvar() {
    if (salvando) return;
    setErro('');
    if (!nome.trim()) { setErro('Dê um nome ao produto.'); return; }
    if (precoCent <= 0) { setErro('Informe o preço de venda.'); return; }

    setSalvando(true);
    try {
      const body = {
        empresa_id: empresaId,
        nome: nome.trim(),
        preco: precoCent,
        custo: custoCent,
        sku: sku.trim() || undefined,
        codigo_barras: codigo.trim() || undefined,
        categoria: categoria.trim() || undefined,
        unidade,
        eh_servico: ehServico,
        estoque_min: estoqueMin ? parseInt(estoqueMin, 10) : null,
      };
      if (editando) await api.negocios.produtos.editar(produto!.id, body);
      else await api.negocios.produtos.criar(body);
      onSalvo();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar.');
    } finally { setSalvando(false); }
  }

  async function arquivar() {
    if (!editando) return;
    if (!confirm(`Arquivar "${produto!.nome}"?\n\nAs vendas antigas continuam com ele — só some das próximas.`)) return;
    setSalvando(true);
    try { await api.negocios.produtos.arquivar(produto!.id); onSalvo(); }
    catch (e: any) { setErro(e?.message || 'Não consegui arquivar.'); setSalvando(false); }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[92vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-base font-bold text-foreground">
            {editando ? 'Editar produto' : 'Novo produto'}
          </h2>
          <button onClick={() => !salvando && onClose()} aria-label="Fechar"
                  className="w-11 h-11 -mr-2 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {erro && (
            <p className="flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl p-3">
              <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {erro}
            </p>
          )}

          {/* Produto × serviço: muda o controle de estoque (fase 3) */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
            {([
              { v: false, l: 'Produto', Icon: Package },
              { v: true,  l: 'Serviço', Icon: Wrench },
            ] as const).map(o => {
              const on = ehServico === o.v;
              return (
                <button key={o.l} onClick={() => setEhServico(o.v)} aria-pressed={on}
                        className={`h-11 rounded-xl text-sm font-bold transition-all inline-flex items-center justify-center gap-1.5 ${
                          on ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        style={{ minHeight: 44 }}>
                  <o.Icon size={15} /> {o.l}
                </button>
              );
            })}
          </div>

          <div>
            <label htmlFor="pr-nome" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Nome
            </label>
            <input id="pr-nome" value={nome} onChange={e => setNome(e.target.value)} autoFocus
                   placeholder={ehServico ? 'Ex.: Corte de cabelo' : 'Ex.: Bolo de cenoura'}
                   className="input w-full" style={{ minHeight: 44 }} />
          </div>

          {/* Preço e custo lado a lado: a comparação é o ponto */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pr-preco" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Preço de venda
              </label>
              <input id="pr-preco" inputMode="numeric" value={preco}
                     onChange={e => setPreco(e.target.value.replace(/\D/g, ''))}
                     placeholder="0" className="input w-full tabular-nums" style={{ minHeight: 44 }} />
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{fmtCent(precoCent)}</p>
            </div>
            <div>
              <label htmlFor="pr-custo" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Custo
              </label>
              <input id="pr-custo" inputMode="numeric" value={custo}
                     onChange={e => setCusto(e.target.value.replace(/\D/g, ''))}
                     placeholder="0" className="input w-full tabular-nums" style={{ minHeight: 44 }} />
              <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{fmtCent(custoCent)}</p>
            </div>
          </div>

          {/* Margem ao vivo — descobrir aqui, não no fim do mês */}
          {precoCent > 0 && (
            <div className="rounded-2xl p-3.5 flex items-center justify-between gap-3"
                 style={previa.lucro > 0
                   ? { background: 'color-mix(in srgb, #10b981 8%, transparent)', border: '1px solid color-mix(in srgb, #10b981 25%, transparent)' }
                   : { background: 'color-mix(in srgb, #ef4444 8%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 25%, transparent)' }}>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider"
                   style={{ color: previa.lucro > 0 ? '#10b981' : '#ef4444' }}>
                  {custoCent === 0 ? 'Sem custo informado' : previa.lucro > 0 ? 'Lucro por unidade' : 'Prejuízo por unidade'}
                </p>
                <p className="text-xl font-bold tabular-nums mt-0.5"
                   style={{ color: previa.lucro > 0 ? '#10b981' : '#ef4444' }}>
                  {fmtCent(Math.abs(previa.lucro))}
                </p>
              </div>
              {custoCent > 0 && (
                <span className="text-sm font-bold tabular-nums flex-shrink-0"
                      style={{ color: previa.lucro > 0 ? '#10b981' : '#ef4444' }}>
                  {previa.margem.toFixed(1).replace('.', ',')}%
                </span>
              )}
            </div>
          )}

          {/* Campos secundários — divulgação progressiva: o essencial é o de cima */}
          <details className="group">
            <summary className="text-xs font-semibold text-muted-foreground cursor-pointer list-none inline-flex items-center gap-1.5"
                     style={{ minHeight: 32 }}>
              <span className="transition-transform group-open:rotate-90">›</span> Mais detalhes
            </summary>
            <div className="space-y-4 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pr-cat" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Categoria</label>
                  <input id="pr-cat" value={categoria} onChange={e => setCategoria(e.target.value)}
                         placeholder="Ex.: Doces" className="input w-full" style={{ minHeight: 44 }} />
                </div>
                <div>
                  <label htmlFor="pr-un" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Unidade</label>
                  <select id="pr-un" value={unidade} onChange={e => setUnidade(e.target.value)}
                          className="input w-full" style={{ minHeight: 44 }}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pr-sku" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">SKU</label>
                  <input id="pr-sku" value={sku} onChange={e => setSku(e.target.value)}
                         placeholder="opcional" className="input w-full" style={{ minHeight: 44 }} />
                </div>
                <div>
                  <label htmlFor="pr-cod" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Cód. barras</label>
                  <input id="pr-cod" inputMode="numeric" value={codigo} onChange={e => setCodigo(e.target.value)}
                         placeholder="opcional" className="input w-full tabular-nums" style={{ minHeight: 44 }} />
                </div>
              </div>
              {!ehServico && (
                <div>
                  <label htmlFor="pr-min" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                    Estoque mínimo <span className="font-normal normal-case tracking-normal">(avisa quando chegar nele)</span>
                  </label>
                  <input id="pr-min" inputMode="numeric" value={estoqueMin}
                         onChange={e => setEstoqueMin(e.target.value.replace(/\D/g, ''))}
                         placeholder="opcional" className="input w-full tabular-nums" style={{ minHeight: 44 }} />
                </div>
              )}
            </div>
          </details>
        </div>

        <div className="flex items-center gap-2 px-5 py-4 border-t border-border sticky bottom-0 bg-card">
          {editando && (
            <button onClick={arquivar} disabled={salvando} aria-label="Arquivar produto"
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    style={{ minHeight: 44 }}>
              <Trash2 size={17} />
            </button>
          )}
          <button onClick={salvar} disabled={salvando}
                  className="flex-1 h-11 rounded-2xl text-white text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                  style={{ background: cor, minHeight: 44 }}>
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
            {editando ? 'Salvar' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
