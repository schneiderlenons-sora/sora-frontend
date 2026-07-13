'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, ChevronRight, ChevronLeft, ExternalLink, Loader2, ArrowDownRight, ArrowUpRight, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';

const BRAND = 'hsl(var(--primary))';
const MES_NOMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

interface Props {
  phone: string;
  conta: any;               // wallet: { id, nome, tipo, saldo }
  onClose: () => void;
  onExcluir?: () => void;
}

// Extrato de uma CONTA bancária: entradas + saídas do mês, resumo e movimentações.
// Espelha o DetalhesCartaoModal, mas mostra os dois fluxos (débito sai da conta).
export default function DetalhesContaModal({ phone, conta, onClose, onExcluir }: Props) {
  const hoje = new Date();
  const [mesRef, setMesRef] = useState(`${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`);
  const [txs, setTxs]         = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [verTudo, setVerTudo] = useState(false);
  const [offsetMes, setOffsetMes] = useState(0); // 0 = mês atual (só passado/atual)

  const logo = bancoLogo(conta.nome);

  useEffect(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + offsetMes, 1);
    setMesRef(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetMes]);

  // Movimentações da conta no mês (as transações guardam carteira_nome, não wallet_id)
  useEffect(() => {
    if (!phone || !conta?.id) return;
    setLoading(true);
    api.transacoes.listar(phone, { mes: mesRef, limit: 500 })
      .then((r: any) => {
        const todas = r?.transacoes || [];
        const nomeConta = (conta.nome || '').trim().toLowerCase();
        setTxs(todas.filter((t: any) =>
          t.wallet_id === conta.id ||
          (t.carteira_nome || t.wallet_nome || '').trim().toLowerCase() === nomeConta
        ));
      })
      .catch(() => setTxs([]))
      .finally(() => setLoading(false));
  }, [phone, conta?.id, mesRef]);

  const entradas = useMemo(() => txs.filter(t => t.tipo === 'Recebimento').reduce((s, t) => s + (t.valor || 0), 0), [txs]);
  const saidas   = useMemo(() => txs.filter(t => t.tipo === 'Gasto').reduce((s, t) => s + (t.valor || 0), 0), [txs]);
  const saldoMes = entradas - saidas;

  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    txs.filter(t => t.tipo === 'Gasto').forEach(t => {
      const cat = t.categoria || '📦 Outros';
      acc[cat] = (acc[cat] || 0) + (t.valor || 0);
    });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]).map(([cat, total]) => ({ cat, total }));
  }, [txs]);
  const maiorCategoria = porCategoria[0]?.total || 1;
  const topCategorias  = porCategoria.slice(0, 5);
  const restantes      = porCategoria.length - 5;

  const txsOrdenadas = useMemo(
    () => [...txs].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [txs]
  );

  const [ano, m] = mesRef.split('-').map(Number);
  const mesNome  = MES_NOMES[m - 1];
  const saldoNeg = (conta.saldo || 0) < 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:justify-end p-0 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative w-full md:max-w-md h-[90dvh] md:h-auto md:max-h-[90vh] bg-card rounded-t-3xl md:rounded-3xl shadow-2xl overflow-hidden animate-fade-in flex flex-col border-t md:border border-border"
           onClick={e => e.stopPropagation()}>

        {/* Alça (mobile) */}
        <div className="md:hidden flex justify-center pt-2.5 pb-1 flex-shrink-0">
          <span className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
        </div>
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4 md:pt-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0" style={{ background: logo.bg }}>
              {logo.text}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{conta.nome}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{conta.tipo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">

          {/* Saldo atual */}
          <div className="rounded-2xl p-4 border border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">Saldo atual</p>
            <p className={`text-3xl font-bold tabular tracking-tight ${saldoNeg ? 'text-red-500' : 'text-foreground'}`}>
              {fmt(conta.saldo || 0)}
            </p>
          </div>

          {/* Navegação de mês */}
          <div className="flex items-center justify-between bg-muted/40 rounded-xl p-1">
            <button onClick={() => setOffsetMes(o => o - 1)} className="p-1.5 rounded-lg hover:bg-card transition-colors" title="Mês anterior">
              <ChevronLeft size={16} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">
              {mesNome} {ano}{offsetMes === 0 ? ' · atual' : ''}
            </span>
            <button onClick={() => setOffsetMes(o => Math.min(0, o + 1))} disabled={offsetMes >= 0}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors disabled:opacity-40" title="Próximo mês">
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Resumo do mês */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl p-3 border border-border bg-muted/20">
              <div className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400 font-semibold"><ArrowUpRight size={12} /> Entradas</div>
              <p className="text-sm font-bold text-foreground tabular mt-1">{fmt(entradas)}</p>
            </div>
            <div className="rounded-2xl p-3 border border-border bg-muted/20">
              <div className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-semibold"><ArrowDownRight size={12} /> Saídas</div>
              <p className="text-sm font-bold text-foreground tabular mt-1">{fmt(saidas)}</p>
            </div>
            <div className="rounded-2xl p-3 border border-border bg-muted/20">
              <div className="text-[11px] text-muted-foreground font-semibold">Saldo do mês</div>
              <p className={`text-sm font-bold tabular mt-1 ${saldoMes < 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{fmt(saldoMes)}</p>
            </div>
          </div>

          {/* Saídas por categoria */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Saídas por categoria</p>
              <span className="text-xs text-muted-foreground">{txs.length} movimentaç{txs.length === 1 ? 'ão' : 'ões'}</span>
            </div>
            {loading ? (
              <div className="py-6 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
            ) : porCategoria.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">Sem saídas neste mês.</p>
            ) : (
              <div className="space-y-3">
                {topCategorias.map(({ cat, total }) => {
                  const theme = getCategoriaTheme(cat);
                  const pct = Math.round((total / maiorCategoria) * 100);
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base flex-shrink-0">{theme.emoji}</span>
                          <span className="text-sm text-foreground truncate">{nomeCategoria(cat)}</span>
                        </div>
                        <span className="text-sm font-semibold text-foreground tabular flex-shrink-0">{fmt(total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: theme.color }} />
                      </div>
                    </div>
                  );
                })}
                {restantes > 0 && <p className="text-center text-xs text-muted-foreground py-1">+{restantes} categoria{restantes !== 1 ? 's' : ''}</p>}
              </div>
            )}
          </div>

          {/* Movimentações (entradas + saídas) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Movimentações</p>
              <a href={`/transacoes?conta=${conta.id}&mes=${mesRef}`} className="text-xs font-semibold inline-flex items-center gap-1" style={{ color: BRAND }}>
                Ver todas <ExternalLink size={11} />
              </a>
            </div>
            {loading ? (
              <div className="py-6 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-muted-foreground" /></div>
            ) : txsOrdenadas.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">Sem movimentações neste mês.</p>
            ) : (
              <div className="space-y-2">
                {(verTudo ? txsOrdenadas : txsOrdenadas.slice(0, 10)).map((tx, i) => {
                  const entrada = tx.tipo === 'Recebimento';
                  const theme = getCategoriaTheme(tx.categoria || '');
                  const data = new Date(tx.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
                  return (
                    <div key={tx.id || i} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0" style={{ background: theme.bg, color: theme.color }}>
                        {theme.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.observacao || nomeCategoria(tx.categoria || '')}</p>
                        <p className="text-[11px] text-muted-foreground">{data}</p>
                      </div>
                      <p className={`text-sm font-semibold tabular flex-shrink-0 inline-flex items-center gap-0.5 ${entrada ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {entrada ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{fmt(tx.valor)}
                      </p>
                    </div>
                  );
                })}
                {!verTudo && txsOrdenadas.length > 10 && (
                  <button onClick={() => setVerTudo(true)} className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2">
                    Mostrar mais {txsOrdenadas.length - 10}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Excluir conta — acessível também no mobile */}
          {onExcluir && (
            <div className="pt-2 border-t border-border/60">
              <button
                onClick={onExcluir}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-red-600 dark:text-red-400 font-semibold text-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                style={{ minHeight: 44 }}
              >
                <Trash2 size={16} /> Excluir conta
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
