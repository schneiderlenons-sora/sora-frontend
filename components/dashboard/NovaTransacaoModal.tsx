'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Wallet, CreditCard, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';

interface CatItem { id?: string; emoji: string; nome: string; filhos?: CatItem[] }

interface Props {
  phone: string;
  wallets: any[];
  onClose: () => void;
  onSuccess: () => void;
}

// Fallback usado se o user ainda não tiver categorias (DB antiga sem coluna tipo)
const FALLBACK_DESPESA: CatItem[] = [
  { emoji: '🛒', nome: 'Mercado'       },
  { emoji: '🍽️', nome: 'Restaurante'   },
  { emoji: '🚗', nome: 'Transporte'    },
  { emoji: '💊', nome: 'Saúde'         },
  { emoji: '🏠', nome: 'Aluguel'       },
  { emoji: '📺', nome: 'Assinaturas'   },
  { emoji: '🎬', nome: 'Lazer'         },
  { emoji: '📚', nome: 'Educação'      },
  { emoji: '👕', nome: 'Vestuário'     },
  { emoji: '🐶', nome: 'Pet'           },
  { emoji: '🥖', nome: 'Padaria'       },
  { emoji: '🛜', nome: 'Internet'      },
  { emoji: '✈️', nome: 'Viagem'        },
  { emoji: '🔄', nome: 'Transferência' },
  { emoji: '📦', nome: 'Outros'        },
];

const FALLBACK_RECEITA: CatItem[] = [
  { emoji: '💼', nome: 'Salário'          },
  { emoji: '💻', nome: 'Freelance'        },
  { emoji: '🎁', nome: 'Bônus'            },
  { emoji: '🏘️', nome: 'Aluguel Recebido' },
  { emoji: '📈', nome: 'Rendimentos'      },
  { emoji: '💰', nome: 'Dividendos'       },
  { emoji: '🎀', nome: 'Presente'         },
  { emoji: '📦', nome: 'Venda de itens'   },
  { emoji: '🪙', nome: 'Outras receitas'  },
];

export default function NovaTransacaoModal({ phone, wallets, onClose, onSuccess }: Props) {
  const [tipo,       setTipo]       = useState<'Gasto' | 'Recebimento'>('Gasto');
  const [valor,      setValor]      = useState('');
  const [descricao,  setDescricao]  = useState('');
  const [categoria,  setCategoria]  = useState('');
  const [catEmoji,   setCatEmoji]   = useState('');
  const [walletId,   setWalletId]   = useState<string>('');
  const [data,       setData]       = useState(new Date().toISOString().slice(0, 10));
  const [recorrente, setRecorrente] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [erro,       setErro]       = useState('');

  // Categorias do usuário (carregadas da API)
  const [catsDespesa, setCatsDespesa] = useState<CatItem[]>([]);
  const [catsReceita, setCatsReceita] = useState<CatItem[]>([]);
  const [carregandoCats, setCarregandoCats] = useState(true);
  // ID da categoria-pai selecionada (pra mostrar subcategorias)
  const [parentId, setParentId] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) return;
    let cancelado = false;
    setCarregandoCats(true);
    api.categorias.listar(phone)
      .then(cats => {
        if (cancelado) return;
        const todas = cats || [];
        // Monta árvore: raiz + filhos por parent_id
        const construir = (tipoFiltro: 'despesa' | 'receita'): CatItem[] => {
          const raiz = todas.filter((c: any) => !c.parent_id && (c.tipo || 'despesa') === tipoFiltro);
          return raiz.map((p: any) => ({
            id: p.id,
            emoji: p.icone || '📦',
            nome: p.nome,
            filhos: todas
              .filter((c: any) => c.parent_id === p.id)
              .map((f: any) => ({ id: f.id, emoji: f.icone || '📦', nome: f.nome })),
          }));
        };
        setCatsDespesa(construir('despesa'));
        setCatsReceita(construir('receita'));
      })
      .catch(() => { /* mantém fallback */ })
      .finally(() => { if (!cancelado) setCarregandoCats(false); });
    return () => { cancelado = true; };
  }, [phone]);

  // Default da carteira: primeira conta não-crédito (em receita não faz sentido cartão)
  useEffect(() => {
    if (walletId) return;
    const padrao = wallets.find(w => w.tipo !== 'Crédito') || wallets[0];
    if (padrao) setWalletId(padrao.id);
  }, [wallets, walletId]);

  // Ao trocar tipo, limpa categoria pra forçar nova escolha
  useEffect(() => {
    setCategoria('');
    setCatEmoji('');
    setParentId(null);
  }, [tipo]);

  // Filtra wallets disponíveis:
  // - Receita: contas (não cartão), porque receita não cai em cartão de crédito
  // - Despesa: todas
  const walletsVisiveis = useMemo(() => {
    if (tipo === 'Recebimento') return wallets.filter(w => w.tipo !== 'Crédito');
    return wallets;
  }, [wallets, tipo]);

  // Se tipo virou Receita e a wallet selecionada era cartão, troca
  useEffect(() => {
    const atual = wallets.find(w => w.id === walletId);
    if (tipo === 'Recebimento' && atual?.tipo === 'Crédito') {
      const nova = walletsVisiveis[0];
      setWalletId(nova?.id || '');
    }
  }, [tipo, walletId, wallets, walletsVisiveis]);

  const categoriasMostrar: CatItem[] = useMemo(() => {
    if (tipo === 'Gasto') {
      return catsDespesa.length ? catsDespesa : FALLBACK_DESPESA;
    }
    return catsReceita.length ? catsReceita : FALLBACK_RECEITA;
  }, [tipo, catsDespesa, catsReceita]);

  function handleValorInput(e: React.ChangeEvent<HTMLInputElement>) {
    setValor(e.target.value.replace(/\D/g, ''));
  }

  function formatValorDisplay(raw: string) {
    if (!raw) return '0,00';
    const num = parseInt(raw, 10) / 100;
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function handleSalvar() {
    setErro('');
    if (!valor || valor === '0') { setErro('Informe o valor.'); return; }
    if (!categoria) { setErro('Selecione uma categoria.'); return; }
    if (walletsVisiveis.length > 0 && !walletId) { setErro('Selecione a conta de origem.'); return; }

    setLoading(true);
    try {
      const walletNome = wallets.find(w => w.id === walletId)?.nome;
      await api.transacoes.criar({
        phone,
        tipo,
        valor: parseInt(valor, 10) / 100,
        observacao: descricao,
        categoria: `${catEmoji} ${categoria}`,
        wallet_id: walletId || undefined,
        carteira_nome: walletNome,
        data,
        recorrente,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar transação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Nova Transação</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Toggle Despesa / Receita */}
          <div className="relative flex bg-muted rounded-2xl p-1">
            <div
              className="absolute top-1 bottom-1 rounded-xl transition-all duration-200"
              style={{
                width: 'calc(50% - 4px)',
                left: tipo === 'Gasto' ? '4px' : 'calc(50%)',
                background: tipo === 'Gasto' ? 'hsl(0 72% 58%)' : '#61D17B',
              }}
            />
            {(['Gasto', 'Recebimento'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={`relative flex-1 py-2 text-sm font-semibold rounded-xl transition-colors duration-200 ${tipo === t ? 'text-white' : 'text-muted-foreground'}`}
              >
                {t === 'Gasto' ? '💸 Despesa' : '💰 Receita'}
              </button>
            ))}
          </div>

          {/* Valor */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Valor</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">R$</span>
              <input
                type="tel"
                inputMode="numeric"
                value={formatValorDisplay(valor)}
                onChange={handleValorInput}
                className="text-5xl font-bold text-foreground bg-transparent border-none outline-none text-center w-full tabular"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
              Descrição
            </p>
            <input
              type="text"
              placeholder={tipo === 'Gasto'
                ? 'Ex: Supermercado, Academia, Netflix...'
                : 'Ex: Salário, Freelance, Bônus...'}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              className="input"
            />
          </div>

          {/* Categorias (filtradas por tipo) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                Categoria
              </p>
              {carregandoCats && (
                <Loader2 size={10} className="animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {categoriasMostrar.map(cat => {
                const ehPaiSelecionado = parentId === cat.id;
                const ativo = (categoria === cat.nome && !parentId) || ehPaiSelecionado;
                const temFilhos = (cat.filhos?.length || 0) > 0;
                return (
                  <button
                    key={cat.id || cat.nome}
                    onClick={() => {
                      setCategoria(cat.nome);
                      setCatEmoji(cat.emoji);
                      setParentId(temFilhos ? (cat.id || null) : null);
                    }}
                    className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                      ativo
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40 hover:bg-muted'
                    }`}
                  >
                    <span className="text-xl">{cat.emoji}</span>
                    <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{cat.nome}</span>
                    {temFilhos && (
                      <span className="absolute top-1 right-1 text-[8px] font-bold text-muted-foreground bg-muted/80 px-1 rounded-full">
                        {cat.filhos!.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Subcategorias do pai selecionado */}
            {parentId && (() => {
              const pai = categoriasMostrar.find(c => c.id === parentId);
              if (!pai?.filhos?.length) return null;
              return (
                <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border animate-fade-in">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
                    Subcategoria de <span className="text-foreground">{pai.nome}</span> — opcional
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {/* Botão para manter só a categoria-pai */}
                    <button
                      onClick={() => { setCategoria(pai.nome); setCatEmoji(pai.emoji); }}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                        categoria === pai.nome
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-dashed border-border hover:border-primary/40 hover:bg-card'
                      }`}
                    >
                      <span className="text-xl">{pai.emoji}</span>
                      <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">Só {pai.nome}</span>
                    </button>
                    {pai.filhos.map(sub => {
                      const ativo = categoria === sub.nome;
                      return (
                        <button
                          key={sub.id || sub.nome}
                          onClick={() => { setCategoria(sub.nome); setCatEmoji(sub.emoji); }}
                          className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                            ativo
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <span className="text-xl">{sub.emoji}</span>
                          <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{sub.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Conta / Cartão — picker visual */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
              {tipo === 'Recebimento' ? <Wallet size={11} /> : <><Wallet size={11} /> ou <CreditCard size={11} /></>}
              {tipo === 'Recebimento' ? 'Conta de destino' : 'Conta / Cartão usado'}
            </p>

            {walletsVisiveis.length === 0 ? (
              <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2.5">
                <AlertCircle size={14} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed">
                  Você não tem {tipo === 'Recebimento' ? 'contas bancárias' : 'contas ou cartões'} cadastrados.{' '}
                  <a href="/contas-bancarias" className="font-semibold underline">Cadastrar agora</a>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto">
                {walletsVisiveis.map(w => {
                  const ativa = w.id === walletId;
                  const ehCartao = w.tipo === 'Crédito';
                  const logo = bancoLogo(w.nome);
                  return (
                    <button
                      key={w.id}
                      onClick={() => setWalletId(w.id)}
                      className={`relative flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        ativa
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                        style={{ background: logo.bg }}
                      >
                        {logo.text}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{w.nome}</p>
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-0.5 ${
                          ehCartao
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                        }`}>
                          {ehCartao ? <><CreditCard size={9} /> Cartão</> : <><Wallet size={9} /> {w.tipo}</>}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Data */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">Data</p>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className="input" />
          </div>

          {/* Recorrente */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-medium text-foreground">Recorrente</p>
              <p className="text-xs text-muted-foreground">Se repete todo mês</p>
            </div>
            <button
              onClick={() => setRecorrente(v => !v)}
              className="relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0"
              style={{ background: recorrente ? '#61D17B' : 'hsl(var(--fg-muted) / .3)' }}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${recorrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}

          <button
            onClick={handleSalvar}
            disabled={loading || !valor || valor === '0'}
            className="btn btn-primary w-full"
            style={{ padding: '12px 16px', fontSize: '15px' }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : 'Salvar transação'}
          </button>
        </div>
      </div>
    </div>
  );
}
