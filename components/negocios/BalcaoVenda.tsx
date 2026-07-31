'use client';

// =============================================================================
// MODO BALCÃO — registrar uma venda em poucos toques.
//
// A premissa: o vendedor está com o cliente na frente. Cada campo obrigatório a
// mais é uma pessoa esperando no caixa. Por isso:
//   · toque no produto = item no carrinho (sem abrir formulário);
//   · cliente é OPCIONAL — venda de balcão quase nunca tem cadastro;
//   · "à vista" é o padrão, porque é a maioria;
//   · dá pra vender item que não está cadastrado (valor avulso), senão o
//     vendedor trava justo na hora em que não pode travar.
//
// Mobile-first de verdade: no celular a grade ocupa a tela e o carrinho é uma
// barra fixa embaixo que expande — o polegar alcança tudo.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Search, Plus, Minus, Trash2, Loader2, Check, ShoppingCart,
  Package, Wrench, AlertCircle, Tag,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/lib/useApi';
import {
  fmtCent, FORMAS_PAGAMENTO,
  type ProdutoNegocio, type ClienteNegocio,
} from '@/lib/lancamentos';

type ItemCarrinho = {
  chave:      string;          // produto_id ou um id local (item avulso)
  produto_id: string | null;
  nome:       string;
  quantidade: number;
  preco_unit: number;
  custo_unit: number;
};

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export default function BalcaoVenda({
  empresaId, cor, onClose, onVendido,
}: {
  empresaId: string; cor: string; onClose: () => void; onVendido: () => void;
}) {
  const { phone } = useAuth();

  const [busca, setBusca]       = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [aberto, setAberto]     = useState(false);   // carrinho expandido (mobile)
  const [etapa, setEtapa]       = useState<'itens' | 'pagamento'>('itens');

  const [forma, setForma]         = useState('dinheiro');
  const [aPrazo, setAPrazo]       = useState(false);
  const [vencimento, setVencimento] = useState(hojeSP());
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState('');
  const [desconto, setDesconto]   = useState('');
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState('');

  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const { data: produtosData } = useApi(
    phone ? `neg:produtos:${empresaId}` : null,
    () => api.negocios.produtos.listar(phone, empresaId),
  );
  const produtos: ProdutoNegocio[] = useMemo(() => Array.isArray(produtosData) ? produtosData : [], [produtosData]);

  const { data: clientesData } = useApi(
    (phone && etapa === 'pagamento') ? `neg:clientes:${empresaId}` : null,
    () => api.negocios.clientes.listar(phone, empresaId),
  );
  const clientes: ClienteNegocio[] = useMemo(() => Array.isArray(clientesData) ? clientesData : [], [clientesData]);

  // Quem vendeu — só aparece se existir alguém que ganha comissão. Num balcão
  // sem comissão, esse campo seria só mais um toque entre o cliente e o troco.
  const { data: equipeData } = useApi(
    (phone && etapa === 'pagamento') ? `neg:func:${empresaId}` : null,
    () => api.negocios.funcionarios.listar(phone, empresaId),
  );
  const comissionados = useMemo(
    () => (Array.isArray(equipeData) ? equipeData : []).filter(f => (f.comissao_pct || 0) > 0),
    [equipeData]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      (p.codigo_barras || '') === busca.trim());
  }, [produtos, busca]);

  const subtotal    = carrinho.reduce((s, i) => s + Math.round(i.preco_unit * i.quantidade), 0);
  const descontoCent = parseInt(desconto || '0', 10) || 0;
  const total       = Math.max(0, subtotal - descontoCent);
  const qtdItens    = carrinho.reduce((s, i) => s + i.quantidade, 0);

  function adicionar(p: ProdutoNegocio) {
    setCarrinho(prev => {
      const i = prev.findIndex(x => x.chave === p.id);
      if (i >= 0) {
        const copia = [...prev];
        copia[i] = { ...copia[i], quantidade: copia[i].quantidade + 1 };
        return copia;
      }
      return [...prev, {
        chave: p.id, produto_id: p.id, nome: p.nome,
        quantidade: 1, preco_unit: p.preco, custo_unit: p.custo,
      }];
    });
  }

  // Item que não está no cadastro. Sem isso, o vendedor trava justo quando não
  // pode travar — e a venda acaba não sendo registrada.
  function adicionarAvulso() {
    const valor = prompt('Valor do item (em centavos, ex.: 1500 = R$ 15,00)');
    if (!valor) return;
    const cent = parseInt(valor.replace(/\D/g, ''), 10);
    if (!cent) return;
    const nome = prompt('Descrição do item') || 'Item avulso';
    setCarrinho(prev => [...prev, {
      chave: `avulso-${Date.now()}`, produto_id: null,
      nome: nome.trim() || 'Item avulso', quantidade: 1,
      preco_unit: cent, custo_unit: 0,
    }]);
  }

  const mudarQtd = (chave: string, delta: number) =>
    setCarrinho(prev => prev
      .map(i => (i.chave === chave ? { ...i, quantidade: i.quantidade + delta } : i))
      .filter(i => i.quantidade > 0));

  const remover = (chave: string) => setCarrinho(prev => prev.filter(i => i.chave !== chave));

  async function finalizar() {
    if (salvando || !carrinho.length) return;
    setErro('');
    setSalvando(true);
    try {
      await api.negocios.vendas.criar({
        empresa_id: empresaId,
        itens: carrinho.map(i => ({
          produto_id: i.produto_id, nome: i.nome,
          quantidade: i.quantidade, preco_unit: i.preco_unit, custo_unit: i.custo_unit,
        })),
        cliente_id: clienteId,
        cliente_nome: clienteNome.trim() || undefined,
        desconto: descontoCent,
        forma_pagamento: forma,
        status: aPrazo ? 'pendente' : 'pago',
        vencimento: aPrazo ? vencimento : undefined,
        vendedor_id: vendedorId || undefined,
      });
      onVendido();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui registrar a venda.');
      setSalvando(false);
    }
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] bg-background flex flex-col">
      {/* Topo */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border flex-shrink-0"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground">
            {etapa === 'itens' ? 'Nova venda' : 'Como foi pago?'}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            {etapa === 'itens' ? 'Toque nos produtos para adicionar' : `${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'} · ${fmtCent(total)}`}
          </p>
        </div>
        <button onClick={onClose} aria-label="Fechar"
                className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-muted flex-shrink-0">
          <X size={20} />
        </button>
      </div>

      {erro && (
        <p className="mx-4 mt-3 flex items-start gap-2 text-sm text-red-500 bg-red-500/10 rounded-xl p-3 flex-shrink-0">
          <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {erro}
        </p>
      )}

      {etapa === 'itens' ? (
        <>
          {/* Busca */}
          <div className="px-4 py-3 flex-shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input value={busca} onChange={e => setBusca(e.target.value)}
                     placeholder="Buscar produto ou bipar código"
                     aria-label="Buscar produto"
                     className="input w-full pl-10" style={{ minHeight: 44 }} />
            </div>
          </div>

          {/* Grade de produtos — toque = adiciona */}
          <div className="flex-1 overflow-y-auto px-4 pb-40">
            {produtos.length === 0 ? (
              <div className="text-center py-16">
                <Package size={28} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground">Nenhum produto cadastrado</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Você ainda pode vender usando &ldquo;valor avulso&rdquo; abaixo.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {filtrados.map(p => {
                  const noCarrinho = carrinho.find(i => i.chave === p.id);
                  return (
                    <button key={p.id} onClick={() => adicionar(p)}
                      className="relative rounded-2xl border p-3 text-left transition-all active:scale-[0.97]"
                      style={{
                        minHeight: 88,
                        borderColor: noCarrinho ? cor : 'hsl(var(--border))',
                        background: noCarrinho ? `color-mix(in srgb, ${cor} 8%, transparent)` : 'hsl(var(--bg-card))',
                      }}>
                      {/* Quantidade já no carrinho: feedback imediato do toque */}
                      {noCarrinho && (
                        <span className="absolute top-2 right-2 min-w-6 h-6 px-1.5 rounded-full text-white text-xs font-bold flex items-center justify-center tabular-nums"
                              style={{ background: cor }}>
                          {noCarrinho.quantidade}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 mb-1.5">
                        {p.eh_servico
                          ? <Wrench size={13} className="text-muted-foreground flex-shrink-0" />
                          : <Package size={13} className="text-muted-foreground flex-shrink-0" />}
                        {p.categoria && (
                          <span className="text-[10px] text-muted-foreground truncate">{p.categoria}</span>
                        )}
                      </span>
                      <span className="block text-sm font-semibold text-foreground leading-tight line-clamp-2">{p.nome}</span>
                      <span className="block text-sm font-bold tabular-nums mt-1" style={{ color: cor }}>
                        {fmtCent(p.preco)}
                      </span>
                    </button>
                  );
                })}

                <button onClick={adicionarAvulso}
                  className="rounded-2xl border border-dashed border-border p-3 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  style={{ minHeight: 88 }}>
                  <Tag size={18} />
                  <span className="text-xs font-semibold text-center leading-tight">Valor avulso</span>
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Pagamento ─────────────────────────────────────────── */
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-40 space-y-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
              Forma de pagamento
            </span>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS_PAGAMENTO.map(f => {
                const on = forma === f.v;
                return (
                  <button key={f.v} onClick={() => setForma(f.v)} aria-pressed={on}
                    className="h-12 rounded-xl text-sm font-semibold border transition-colors"
                    style={{
                      minHeight: 48,
                      borderColor: on ? cor : 'hsl(var(--border))',
                      background: on ? `color-mix(in srgb, ${cor} 12%, transparent)` : 'transparent',
                      color: on ? cor : 'hsl(var(--foreground))',
                    }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* À vista é o padrão porque é a maioria — "a prazo" é o desvio */}
          <button onClick={() => setAPrazo(v => !v)} role="switch" aria-checked={aPrazo}
            className="w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-border text-left"
            style={{ minHeight: 44 }}>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">Vai receber depois</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                Entra em &ldquo;A receber&rdquo; com data de vencimento
              </span>
            </span>
            <span className={`w-11 h-6 rounded-full flex-shrink-0 relative transition-colors ${aPrazo ? '' : 'bg-muted'}`}
                  style={aPrazo ? { background: cor } : undefined}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${aPrazo ? 'left-6' : 'left-1'}`} />
            </span>
          </button>

          {aPrazo && (
            <div>
              <label htmlFor="bv-venc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Recebe em
              </label>
              <input id="bv-venc" type="date" value={vencimento} onChange={e => setVencimento(e.target.value)}
                     className="input w-full" style={{ minHeight: 44 }} />
            </div>
          )}

          {/* Cliente é OPCIONAL — mas a prazo sem saber de quem é não ajuda */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Cliente {!aPrazo && <span className="font-normal normal-case tracking-normal">(opcional)</span>}
            </span>
            {clientes.length > 0 && (
              <select value={clienteId || ''} aria-label="Escolher cliente"
                      onChange={e => {
                        const id = e.target.value || null;
                        setClienteId(id);
                        setClienteNome(id ? (clientes.find(c => c.id === id)?.nome || '') : '');
                      }}
                      className="input w-full mb-2" style={{ minHeight: 44 }}>
                <option value="">Sem cliente / balcão</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {!clienteId && (
              <input value={clienteNome} onChange={e => setClienteNome(e.target.value)}
                     placeholder="Ou digite o nome" aria-label="Nome do cliente"
                     className="input w-full" style={{ minHeight: 44 }} />
            )}
          </div>

          {/* Quem vendeu — só quando alguém ganha comissão */}
          {comissionados.length > 0 && (
            <div>
              <label htmlFor="bv-vend" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
                Quem vendeu <span className="font-normal normal-case tracking-normal">(opcional)</span>
              </label>
              <select id="bv-vend" value={vendedorId || ''}
                      onChange={e => setVendedorId(e.target.value || null)}
                      className="input w-full" style={{ minHeight: 44 }}>
                <option value="">Ninguém / não gera comissão</option>
                {comissionados.map(f => (
                  <option key={f.id} value={f.id}>{f.nome} · {f.comissao_pct}%</option>
                ))}
              </select>
              {vendedorId && (
                <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                  Comissão desta venda: {fmtCent(Math.round(total * ((comissionados.find(f => f.id === vendedorId)?.comissao_pct || 0) / 100)))}
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="bv-desc" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
              Desconto <span className="font-normal normal-case tracking-normal">(centavos)</span>
            </label>
            <input id="bv-desc" inputMode="numeric" value={desconto}
                   onChange={e => setDesconto(e.target.value.replace(/\D/g, ''))}
                   placeholder="0" className="input w-full tabular-nums" style={{ minHeight: 44 }} />
          </div>
        </div>
      )}

      {/* ── Carrinho fixo no rodapé (o polegar alcança) ──────────── */}
      <div className="border-t border-border bg-card flex-shrink-0"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {aberto && carrinho.length > 0 && (
          <ul className="max-h-52 overflow-y-auto border-b border-border divide-y divide-border/60">
            {carrinho.map(i => (
              <li key={i.chave} className="flex items-center gap-2 px-4 py-2.5">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">{i.nome}</span>
                  <span className="block text-[11px] text-muted-foreground tabular-nums">
                    {fmtCent(i.preco_unit)} cada
                  </span>
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => mudarQtd(i.chave, -1)} aria-label="Diminuir"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
                          style={{ minWidth: 36, minHeight: 36 }}>
                    <Minus size={15} />
                  </button>
                  <span className="w-7 text-center text-sm font-bold tabular-nums">{i.quantidade}</span>
                  <button onClick={() => mudarQtd(i.chave, 1)} aria-label="Aumentar"
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
                          style={{ minWidth: 36, minHeight: 36 }}>
                    <Plus size={15} />
                  </button>
                </span>
                <span className="w-20 text-right text-sm font-bold tabular-nums text-foreground flex-shrink-0">
                  {fmtCent(Math.round(i.preco_unit * i.quantidade))}
                </span>
                <button onClick={() => remover(i.chave)} aria-label={`Remover ${i.nome}`}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 flex-shrink-0"
                        style={{ minWidth: 36, minHeight: 36 }}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={() => setAberto(v => !v)} disabled={!carrinho.length}
                  aria-expanded={aberto} aria-label="Ver itens da venda"
                  className="flex-1 min-w-0 text-left disabled:opacity-50" style={{ minHeight: 44 }}>
            <span className="flex items-center gap-2">
              <ShoppingCart size={16} style={{ color: cor }} className="flex-shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {qtdItens === 0 ? 'Carrinho vazio' : `${qtdItens} ${qtdItens === 1 ? 'item' : 'itens'}`}
              </span>
            </span>
            <span className="block text-2xl font-bold text-foreground tabular-nums leading-tight mt-0.5">
              {fmtCent(total)}
            </span>
            {descontoCent > 0 && (
              <span className="block text-[11px] text-muted-foreground tabular-nums">
                {fmtCent(subtotal)} − {fmtCent(descontoCent)} de desconto
              </span>
            )}
          </button>

          {etapa === 'itens' ? (
            <button onClick={() => setEtapa('pagamento')} disabled={!carrinho.length}
                    className="h-12 px-5 rounded-2xl text-white text-sm font-bold flex-shrink-0 disabled:opacity-40 transition-transform active:scale-[0.98]"
                    style={{ background: cor, minHeight: 48 }}>
              Continuar
            </button>
          ) : (
            <span className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setEtapa('itens')} disabled={salvando}
                      className="h-12 px-4 rounded-2xl text-sm font-semibold border border-border text-muted-foreground"
                      style={{ minHeight: 48 }}>
                Voltar
              </button>
              <button onClick={finalizar} disabled={salvando || !carrinho.length}
                      className="h-12 px-5 rounded-2xl text-white text-sm font-bold inline-flex items-center gap-2 disabled:opacity-60 transition-transform active:scale-[0.98]"
                      style={{ background: cor, minHeight: 48 }}>
                {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
                Finalizar
              </button>
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
