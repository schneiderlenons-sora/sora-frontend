'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Calendar, ChevronRight, ChevronLeft, ExternalLink, Loader2, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import { bancoLogo, loadCartaoMeta } from './AdicionarCartaoModal';

const BRAND = '#61D17B';
const MES_NOMES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const MES_ABREV = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

// Reconhecimento de marcas em estabelecimentos populares
const MERCH_BRANDS: Record<string, { bg: string; text: string }> = {
  shopee:  { bg: '#EE4D2D', text: 'S' },
  shein:   { bg: '#000000', text: 'S' },
  spotify: { bg: '#1DB954', text: '♪' },
  netflix: { bg: '#E50914', text: 'N' },
  amazon:  { bg: '#FF9900', text: 'a' },
  ifood:   { bg: '#EA1D2C', text: 'iF' },
  uber:    { bg: '#000000', text: 'U' },
  rappi:   { bg: '#FF441F', text: 'R' },
  google:  { bg: '#4285F4', text: 'G' },
  apple:   { bg: '#000000', text: '' },
  steam:   { bg: '#171A21', text: 'St' },
  microsoft: { bg: '#00A4EF', text: 'M' },
};

function reconhecerMarca(obs: string): { bg: string; text: string } | null {
  const lower = (obs || '').toLowerCase();
  for (const [key, theme] of Object.entries(MERCH_BRANDS)) {
    if (lower.includes(key)) return theme;
  }
  return null;
}

interface Props {
  phone: string;
  cartao: any;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function DetalhesCartaoModal({ phone, cartao, onClose, onRefresh }: Props) {
  const hoje = new Date();
  const [mesRef, setMesRef] = useState(
    `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  );
  const [txs,     setTxs]      = useState<any[]>([]);
  const [loading, setLoading]  = useState(false);
  const [verTudo, setVerTudo]  = useState(false);
  const [antecipando, setAntecipando] = useState(false);
  // Quão à frente/atrás do mês atual está a fatura exibida (0 = atual)
  const [offsetMes, setOffsetMes] = useState(0);

  const meta = loadCartaoMeta(cartao.id);
  const logo = bancoLogo(cartao.nome);

  // Recalcula o mês de referência quando navega (offsetMes)
  useEffect(() => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + offsetMes, 1);
    setMesRef(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offsetMes]);

  // Antecipar: marca todas as transações em aberto da fatura exibida como pagas
  async function anteciparFatura() {
    const emAberto = txs.filter(t => t.pago === false);
    if (emAberto.length === 0) return;
    if (!confirm(`Antecipar ${emAberto.length} parcela(s) desta fatura? Elas serão marcadas como pagas e liberam limite.`)) return;
    setAntecipando(true);
    try {
      await Promise.all(emAberto.map(t => api.transacoes.editar(t.id, { phone, pago: true })));
      setTxs(prev => prev.map(t => ({ ...t, pago: true })));
      onRefresh?.();
    } catch (e: any) {
      alert(e.message || 'Erro ao antecipar.');
    } finally {
      setAntecipando(false);
    }
  }

  // Carrega transações do mês atual no cartão
  useEffect(() => {
    if (!phone || !cartao?.id) return;
    setLoading(true);
    api.transacoes.listar(phone, { mes: mesRef, limit: 500 })
      .then((r: any) => {
        const todas = r?.transacoes || [];
        // As transações guardam carteira_nome (string), não wallet_id — match por nome
        const nomeCartao = (cartao.nome || '').trim().toLowerCase();
        const doCartao = todas.filter(
          (t: any) =>
            (t.wallet_id === cartao.id ||
             (t.carteira_nome || '').trim().toLowerCase() === nomeCartao) &&
            t.tipo === 'Gasto'
        );
        setTxs(doCartao);
      })
      .catch(() => setTxs([]))
      .finally(() => setLoading(false));
  }, [phone, cartao?.id, mesRef]);

  // Métricas
  const valorFatura = useMemo(
    () => txs.reduce((s, t) => s + (t.valor || 0), 0),
    [txs]
  );
  const pagoFlag = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`sora-fatura-${cartao.id}-${mesRef}`) === 'paga';
  }, [cartao?.id, mesRef]);

  const dataPagamento = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(`sora-fatura-${cartao.id}-${mesRef}-data`) || '';
  }, [cartao?.id, mesRef]);

  const pagamentoMinimo = valorFatura * 0.15;

  // Gastos por categoria
  const porCategoria = useMemo(() => {
    const acc: Record<string, number> = {};
    txs.forEach(t => {
      const cat = t.categoria || '📦 Outros';
      acc[cat] = (acc[cat] || 0) + (t.valor || 0);
    });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, total]) => ({ cat, total }));
  }, [txs]);

  const maiorCategoria = porCategoria[0]?.total || 1;
  const topCategorias = porCategoria.slice(0, 5);
  const restantes = porCategoria.length - 5;

  // Data formatada
  const [ano, m] = mesRef.split('-').map(Number);
  const mesNome = MES_NOMES[m - 1];

  function togglePaga() {
    const novoFlag = !pagoFlag;
    if (typeof window === 'undefined') return;
    if (novoFlag) {
      localStorage.setItem(`sora-fatura-${cartao.id}-${mesRef}`, 'paga');
      localStorage.setItem(
        `sora-fatura-${cartao.id}-${mesRef}-data`,
        new Date().toISOString()
      );
    } else {
      localStorage.removeItem(`sora-fatura-${cartao.id}-${mesRef}`);
      localStorage.removeItem(`sora-fatura-${cartao.id}-${mesRef}-data`);
    }
    onRefresh?.();
    // re-renderiza forçado
    setMesRef(mesRef);
  }

  function fmtDataPagto() {
    if (!dataPagamento) return '';
    const d = new Date(dataPagamento);
    return `Pago em ${d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }

  // Logo de transação
  function logoTransacao(tx: any) {
    const marca = reconhecerMarca(tx.observacao || '');
    if (marca) {
      return (
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: marca.bg }}
        >
          {marca.text}
        </div>
      );
    }
    const theme = getCategoriaTheme(tx.categoria || '');
    return (
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
        style={{ background: theme.bg, color: theme.color }}
      >
        {theme.emoji}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-end p-0 md:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full md:max-w-md h-full md:h-auto md:max-h-[90vh] bg-card md:rounded-3xl shadow-2xl overflow-hidden animate-fade-in flex flex-col border-l md:border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shadow-sm flex-shrink-0"
              style={{ background: logo.bg }}
            >
              {logo.text}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{cartao.nome}</h2>
              {meta.diaVencimento ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Calendar size={11} />
                  Vence em {meta.diaVencimento} de {MES_ABREV[m - 1]}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">Sem data de vencimento</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors flex-shrink-0">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Navegação entre faturas (passadas e futuras com parcelas) */}
          <div className="flex items-center justify-between bg-muted/40 rounded-xl p-1">
            <button onClick={() => setOffsetMes(o => o - 1)}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors" title="Fatura anterior">
              <ChevronLeft size={16} className="text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold text-foreground capitalize">
              {mesNome} {ano}{offsetMes === 0 ? ' · atual' : offsetMes > 0 ? ' · futura' : ''}
            </span>
            <button onClick={() => setOffsetMes(o => Math.min(12, o + 1))}
                    disabled={offsetMes >= 12}
                    className="p-1.5 rounded-lg hover:bg-card transition-colors disabled:opacity-40" title="Próxima fatura">
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </div>

          {/* Antecipar parcelas em aberto desta fatura */}
          {txs.some(t => t.pago === false) && (
            <button
              onClick={anteciparFatura}
              disabled={antecipando}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 text-primary font-semibold text-sm hover:bg-primary/15 transition-all disabled:opacity-60"
            >
              {antecipando ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Antecipar {txs.filter(t => t.pago === false).length} parcela(s) desta fatura
            </button>
          )}

          {/* Alerta: data de fechamento não cadastrada */}
          {!meta.diaFechamento && (
            <div className="rounded-2xl p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                <Calendar size={18} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                  Data de fechamento não cadastrada
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                  Configure a data de fechamento do cartão para poder ver faturas mais recentes
                </p>
              </div>
              <ChevronRight size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-2.5" />
            </div>
          )}

          {/* Card: Valor da fatura */}
          <div className="rounded-2xl p-4 border border-border bg-muted/20">
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">Valor da fatura</p>
              <button
                onClick={togglePaga}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-all ${
                  pagoFlag
                    ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: pagoFlag ? '#16a34a' : '#d97706' }} />
                {pagoFlag ? 'Paga' : 'Em aberto'}
              </button>
            </div>
            <p className="text-3xl font-bold text-foreground tabular tracking-tight">
              {fmt(valorFatura)}
            </p>

            <div className="mt-4 pt-3 border-t border-border/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Valor pago</span>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400 tabular">
                  {pagoFlag ? fmt(valorFatura) : fmt(0)}
                </span>
              </div>
              {pagoFlag && dataPagamento && (
                <p className="text-[11px] text-muted-foreground">
                  {fmtDataPagto()}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Pagamento mínimo</span>
                <span className="text-xs font-semibold text-foreground tabular">
                  {fmt(pagamentoMinimo)}
                </span>
              </div>
            </div>
          </div>

          {/* Gastos por categoria */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Gastos por categoria</p>
              <span className="text-xs text-muted-foreground">{txs.length} transaç{txs.length === 1 ? 'ão' : 'ões'}</span>
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : porCategoria.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Sem gastos neste mês.
              </p>
            ) : (
              <>
                <div className="space-y-3">
                  {topCategorias.map(({ cat, total }) => {
                    const theme = getCategoriaTheme(cat);
                    const nome = nomeCategoria(cat);
                    const pct = Math.round((total / maiorCategoria) * 100);
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base flex-shrink-0">{theme.emoji}</span>
                            <span className="text-sm text-foreground truncate">{nome}</span>
                          </div>
                          <span className="text-sm font-semibold text-foreground tabular flex-shrink-0">
                            {fmt(total)}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: theme.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {restantes > 0 && (
                  <button
                    onClick={() => setVerTudo(v => !v)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-3 mt-1"
                  >
                    +{restantes} categoria{restantes !== 1 ? 's' : ''}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Transações da fatura */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Transações da fatura</p>
              <a
                href={`/transacoes?conta=${cartao.id}&mes=${mesRef}`}
                className="text-xs font-semibold inline-flex items-center gap-1"
                style={{ color: BRAND }}
              >
                Ver todas <ExternalLink size={11} />
              </a>
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center">
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : txs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-3 text-center">
                Sem transações neste mês.
              </p>
            ) : (
              <div className="space-y-2">
                {(verTudo ? txs : txs.slice(0, 8)).map((tx, i) => {
                  const data = new Date(tx.data).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                  }).replace('.', '');
                  return (
                    <div
                      key={tx.id || i}
                      className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted/40 transition-colors"
                    >
                      {logoTransacao(tx)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.observacao || nomeCategoria(tx.categoria || '')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{data}</p>
                      </div>
                      <p className="text-sm font-semibold text-foreground tabular flex-shrink-0">
                        {fmt(tx.valor)}
                      </p>
                    </div>
                  );
                })}
                {!verTudo && txs.length > 8 && (
                  <button
                    onClick={() => setVerTudo(true)}
                    className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2"
                  >
                    Mostrar mais {txs.length - 8}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
