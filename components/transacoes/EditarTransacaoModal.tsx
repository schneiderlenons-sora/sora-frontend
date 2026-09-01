'use client';

import { useEffect, useState } from 'react';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import SeletorCategoria, { type CatItem } from '@/components/transacoes/SeletorCategoria';
import RegraForm from '@/components/agentes/RegraForm';

type Wallet = { id: string; nome: string; tipo?: string };

interface Props {
  tx: any;
  phone: string;
  wallets: Wallet[];
  onClose: () => void;
  onSaved: () => void;
  /** Opt-in (#6 otimista): se fornecido, o modal fecha na HORA e delega o save
   *  — o pai troca a linha no cache na hora e chama `doSave()` em segundo plano
   *  (rollback no erro). Ausente → fluxo await padrão. */
  onOptimisticSave?: (optimisticRow: any, doSave: () => Promise<any>) => void;
}

// Modal de edição de uma transação — principal uso: corrigir a categoria
// (Open Finance traz muita coisa como "Outros"). Também ajusta tipo, valor,
// descrição, conta, data e status. Usa PUT /api/transacoes/:id.
export default function EditarTransacaoModal({ tx, phone, wallets, onClose, onSaved, onOptimisticSave }: Props) {
  const [tipo,       setTipo]       = useState<'Gasto' | 'Recebimento'>(tx.tipo === 'Recebimento' ? 'Recebimento' : 'Gasto');
  const [categoria,  setCategoria]  = useState<string>(tx.categoria || '');
  const [valor,      setValor]      = useState<string>(String(tx.valor ?? ''));
  const [observacao, setObservacao] = useState<string>(tx.observacao || '');
  const [carteira,   setCarteira]   = useState<string>(tx.carteira_nome || tx.wallet_nome || '');
  const [data,       setData]       = useState<string>((tx.data || '').slice(0, 10));
  const [pago,       setPago]       = useState<boolean>(tx.pago !== false);

  // ⚠️ Guarda a CATEGORIA INTEIRA, não só o nome. O seletor precisa de `tipo`
  // (pra separar despesa de receita) e de `parent_id` (pra agrupar por
  // categoria-pai) — jogar fora esses campos aqui era o que obrigava o
  // <select> a listar tudo achatado e em ordem alfabética.
  const [cats,     setCats]     = useState<CatItem[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro,     setErro]     = useState('');
  // "Vale pra todas": vira regra do estabelecimento — reclassifica as antigas e
  // passa a valer nas próximas importações (maquininha de barbearia/dentista
  // vem com nome de pessoa, e o usuário corrigiria o mesmo nome todo mês).
  const [aplicarTodas, setAplicarTodas] = useState(false);
  const mudouCategoria = (categoria || '') !== (tx.categoria || '');
  const estabelecimento = (tx.observacao || '').trim();
  // Formulário completo de regra, aberto a partir desta transação. O toggle
  // abaixo resolve o caso simples (categoria); isto abre as MESMAS telas do
  // card do Watson pra quem quer renomear, marcar recorrente ou mandar o
  // lançamento parar de contar.
  const [regraAberta, setRegraAberta] = useState(false);
  const [regraFeita, setRegraFeita]   = useState('');

  // Carrega o catálogo de categorias do grupo pro seletor.
  useEffect(() => {
    api.categorias.listar(phone)
      .then((cs: any[]) => setCats((cs || []).filter(c => c?.nome)))
      .catch(() => { /* sem catálogo o seletor ainda mostra a categoria atual */ });
  }, [phone]);

  async function salvar() {
    if (salvando) return;
    setErro('');
    const v = parseFloat(String(valor).replace(',', '.'));
    if (isNaN(v) || v <= 0) { setErro('Informe um valor válido.'); return; }

    const querRegra = aplicarTodas && mudouCategoria && !!estabelecimento;
    const payload = {
      phone, tipo, categoria: categoria || 'Outros', valor: v,
      observacao, carteira_nome: carteira || undefined, data, pago,
      ...(querRegra ? { aplicar_todas: true } : {}),
    };

    // #6 otimista (opt-in): fecha na hora e delega o save pro pai, que troca a
    // linha no cache imediatamente e chama a API em segundo plano.
    // ⚠️ Com "vale pra todas" NÃO usamos o caminho otimista: o servidor mexe em
    // várias linhas e só ele sabe quantas — fechar antes mostraria a tela com
    // uma transação corrigida e as outras ainda erradas.
    if (onOptimisticSave && !querRegra) {
      const optimisticRow = { ...tx, ...payload, wallet_nome: carteira || undefined };
      onOptimisticSave(optimisticRow, () => api.transacoes.editar(tx.id, payload));
      onClose();
      return;
    }

    setSalvando(true);
    try {
      await api.transacoes.editar(tx.id, payload);
      onSaved();
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
         onClick={() => !salvando && onClose()}>
      <div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border/60 shadow-2xl max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Editar transação</h2>
          <button onClick={() => !salvando && onClose()} className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-muted/50 border border-border/60">
            {(['Gasto', 'Recebimento'] as const).map(t => (
              <button key={t} onClick={() => setTipo(t)}
                      className={`h-10 rounded-xl text-sm font-bold transition-all ${
                        tipo === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}>
                {t === 'Gasto' ? '🔴 Gasto' : '🟢 Recebimento'}
              </button>
            ))}
          </div>

          {/* Categoria (destaque) */}
          <div>
            <label htmlFor="cat-sel" className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Categoria</label>
            <SeletorCategoria
              id="cat-sel"
              valor={categoria}
              onChange={setCategoria}
              cats={cats}
              tipoLancamento={tipo}
            />

            {/* Só aparece quando a categoria mudou de verdade — oferecer isso
                sem mudança nenhuma seria ruído. Vira regra do estabelecimento:
                corrige o histórico e vale pras próximas importações. */}
            {mudouCategoria && estabelecimento && (
              <button type="button" onClick={() => setAplicarTodas(v => !v)}
                      role="switch" aria-checked={aplicarTodas}
                      className={`mt-2.5 w-full flex items-start gap-2.5 p-3 rounded-xl text-left transition-colors ${
                        aplicarTodas ? 'bg-primary/10' : 'bg-muted/40 hover:bg-muted/60'}`}
                      style={{ border: `1px solid ${aplicarTodas ? 'hsl(var(--primary) / 0.4)' : 'hsl(var(--border))'}`, minHeight: 44 }}>
                <span className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                        aplicarTodas ? 'bg-primary text-white' : 'bg-card'}`}
                      style={aplicarTodas ? undefined : { border: '1px solid hsl(var(--border))' }}>
                  {aplicarTodas && <Check size={13} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    Valer para todas de &ldquo;{estabelecimento.slice(0, 28)}{estabelecimento.length > 28 ? '…' : ''}&rdquo;
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Corrige as anteriores e as próximas entram já em{' '}
                    <b className="text-foreground">{nomeCategoria(categoria) || 'Outros'}</b>.
                  </span>
                </span>
              </button>
            )}

            {/* Regra COMPLETA a partir deste lançamento — a descrição já entra
                preenchida com o texto do banco, então não há o que adivinhar.
                O toggle acima resolve o caso simples (só a categoria); isto
                abre as MESMAS telas do card do Watson, pra quem quer renomear,
                marcar como recorrente ou fazer o lançamento parar de contar. */}
            {estabelecimento && !regraAberta && !regraFeita && (
              <button type="button" onClick={() => setRegraAberta(true)}
                      className="mt-2 w-full rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      style={{ minHeight: 44 }}>
                Criar regra a partir deste lançamento
              </button>
            )}
            {regraFeita && (
              <p role="status" className="mt-2 text-[12px] text-green-600 dark:text-green-400">{regraFeita}</p>
            )}
            {regraAberta && (
              <div className="mt-2 rounded-2xl border border-border/60 p-3.5"
                   style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
                <RegraForm
                  phone={phone}
                  categorias={cats.map((c) => ({ id: String(c.id ?? c.nome), nome: c.nome }))}
                  descricaoInicial={estabelecimento}
                  categoriaInicial={categoria}
                  onCancelar={() => setRegraAberta(false)}
                  onPronto={({ atualizadas }) => {
                    setRegraAberta(false);
                    setRegraFeita(atualizadas > 0
                      ? `Regra criada — ${atualizadas} lançamento(s) ajustado(s).`
                      : 'Regra criada. Vale pros próximos lançamentos.');
                  }}
                />
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Descrição</label>
            <input value={observacao} onChange={e => setObservacao(e.target.value)} className="input w-full" placeholder="Ex.: Mercado, Uber…" />
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Valor (R$)</label>
              <input type="number" step="any" value={valor} onChange={e => setValor(e.target.value)} className="input w-full tabular" />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full" />
            </div>
          </div>

          {/* Conta */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">Conta / cartão</label>
            <select value={carteira} onChange={e => setCarteira(e.target.value)} className="input w-full">
              {carteira && !wallets.some(w => w.nome === carteira) && <option value={carteira}>{carteira}</option>}
              {wallets.map(w => <option key={w.id} value={w.nome}>{w.nome}</option>)}
            </select>
          </div>

          {/* Pago */}
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
            <span className="text-sm font-medium text-foreground">Pago</span>
            <input type="checkbox" checked={pago} onChange={e => setPago(e.target.checked)} className="w-5 h-5 accent-primary" />
          </label>

          {erro && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60">
              <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20 sticky bottom-0">
          <button onClick={() => !salvando && onClose()} className="btn-ghost px-4 py-2 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={salvando}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-60">
            {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
