'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Wallet, CreditCard, AlertCircle, Check, Repeat, Users, CalendarClock, Undo2 } from 'lucide-react';
import { api } from '@/lib/api';
// Conta em moeda estrangeira (migration 144): o valor digitado está na moeda
// DA CONTA, e é o backend que converte. Aqui só rotulamos o campo.
import { normalizarMoeda, ehEstrangeira, MOEDAS, formatarMoeda } from '@/lib/moeda';
import { bancoLogo } from '@/components/cartoes/AdicionarCartaoModal';
import { getCategoriaTheme } from '@/lib/categorias';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import IconeMarca from '@/components/ui/IconeMarca';
import { hojeSP } from '@/lib/ciclo-fatura';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

// Valor sentinela do picker de conta pra "compra parcelada SEM cartão".
const SEM_CARTAO = '__sem_cartao__';

interface CatItem { id?: string; emoji: string; nome: string; filhos?: CatItem[] }

interface Props {
  phone: string;
  wallets: any[];
  onClose: () => void;
  onSuccess: () => void;
  /** Opt-in (#6 otimista): se fornecido, o modal fecha na HORA e delega a
   *  criação — o pai insere a linha no cache na hora e chama `doCreate()` em
   *  segundo plano (rollback no erro). Se ausente, usa o fluxo await padrão
   *  (dashboard continua igual). Só o caminho NÃO-parcelado é otimista. */
  onOptimisticCreate?: (optimisticRow: any, doCreate: () => Promise<any>) => void;
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

export default function NovaTransacaoModal({ phone, wallets, onClose, onSuccess, onOptimisticCreate }: Props) {
  const [tipo,       setTipo]       = useState<'Gasto' | 'Recebimento'>('Gasto');
  const [valor,      setValor]      = useState('');
  const [descricao,  setDescricao]  = useState('');
  const [categoria,  setCategoria]  = useState('');
  const [catEmoji,   setCatEmoji]   = useState('');
  const [walletId,   setWalletId]   = useState<string>('');
  // ⚠️ 'en-CA' + timeZone, NUNCA toISOString(): este é UTC, e depois das 21h no
  // Brasil ele devolve AMANHÃ. A data padrão virava futura sozinha, e um
  // lançamento futuro nasce pendente (pago=false) sem ninguém ter pedido.
  const [data,       setData]       = useState(hojeSP());
  const [recorrente, setRecorrente] = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [erro,       setErro]       = useState('');

  // ── Compra parcelada (cartão de crédito OU "sem cartão", só despesa) ──
  const [parcelado,   setParcelado]   = useState(false);
  const [estorno,     setEstorno]     = useState(false);
  const [numParcelas, setNumParcelas] = useState(2);
  const [pagas,       setPagas]       = useState<Set<number>>(new Set());
  const [avisoParcela, setAvisoParcela] = useState(''); // aviso ao tentar parcelar sem conta válida

  // ⚠️ ESPELHA A REGRA DO BACKEND (routes/transacoes.js): com `recorrente` E
  // data futura o servidor cria SÓ a recorrência e NÃO cria transação nenhuma —
  // de propósito, porque um gasto que ainda não aconteceu não pode debitar o
  // saldo hoje. O problema nunca foi essa regra, foi ela ser invisível: a linha
  // entrava otimista na lista, a API respondia SUCESSO (`somente_recorrencia`),
  // e a revalidação do SWR apagava a linha. Pro usuário, "lancei e sumiu".
  const ehFuturo    = !!data && data > hojeSP();
  const viraFixa    = recorrente && ehFuturo && !parcelado;
  // Parcelamento SEM cartão (parcelei com alguém): vira um parcelamento em Dívidas.
  const [credor,        setCredor]        = useState('');   // "de quem comprou" (opcional)
  const [diaVencimento, setDiaVencimento] = useState('');   // dia do mês do vencimento

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

  // Se tipo virou Receita e a wallet selecionada era cartão OU "sem cartão", troca
  useEffect(() => {
    const atual = wallets.find(w => w.id === walletId);
    if (tipo === 'Recebimento' && (atual?.tipo === 'Crédito' || walletId === SEM_CARTAO)) {
      const nova = walletsVisiveis[0];
      setWalletId(nova?.id || '');
    }
  }, [tipo, walletId, wallets, walletsVisiveis]);

  // ── Compra parcelada ─────────────────────────────────────────────
  // Cartão selecionado? (parcelado vale pra cartão de crédito OU "sem cartão", só despesa)
  const walletSel = useMemo(() => wallets.find(w => w.id === walletId), [wallets, walletId]);

  // ⚠️ O CAMPO PRECISA DIZER EM QUE MOEDA A PESSOA ESTÁ DIGITANDO. O backend
  //    já lê o valor na moeda DA CONTA desde a migration 144 — quem lança na
  //    conta em coroa digita kr e o BRL é derivado. Só que a tela dizia "R$"
  //    fixo, então quem tinha conta estrangeira achava que a Sora não
  //    suportava e convertia tudo na mão. Era feature pronta e invisível.
  const moedaConta = normalizarMoeda(walletSel?.moeda);
  const contaEstrangeira = ehEstrangeira(moedaConta);

  // Equivalente em real, só como referência — o valor gravado é derivado no
  // servidor com a cotação do momento, não com esta. `taxa_brl` da wallet vem
  // do mesmo lugar, então o número aqui é o mesmo que ele vai ver depois.
  const equivalenteBRL = useMemo(() => {
    if (!contaEstrangeira) return null;
    const t = Number(walletSel?.taxa_brl);
    const v = parseInt(valor || '0', 10) / 100;
    if (!Number.isFinite(t) || t <= 0 || !v) return null;
    return v * t;
  }, [contaEstrangeira, walletSel?.taxa_brl, valor]);
  const ehCartaoSel = walletSel?.tipo === 'Crédito' && tipo === 'Gasto';
  // "Sem cartão" = parcelei com alguém (vira parcelamento em Dívidas). Só p/ despesa.
  const semCartao   = walletId === SEM_CARTAO && tipo === 'Gasto';
  const podeParcelar = ehCartaoSel || semCartao;

  // Estorno = crédito na fatura (reembolso, cashback, compra cancelada). Vira um
  // `Recebimento` com `transferencia: true`, que ABATE a fatura e devolve limite
  // sem contar como receita. Só faz sentido num cartão — e o seletor esconde
  // cartão quando o tipo é Recebimento, então a porta de entrada é esta.
  const podeEstornar = ehCartaoSel && !parcelado;
  useEffect(() => { if (!podeEstornar) setEstorno(false); }, [podeEstornar]);

  // Sai de cartão/sem-cartão ou vira receita → desliga o parcelado. Voltando pra
  // uma opção válida, limpa o aviso.
  useEffect(() => { if (podeParcelar) setAvisoParcela(''); else setParcelado(false); }, [podeParcelar]);

  // Datas das parcelas (parcela i = data da 1ª + (i-1) meses) + quais já venceram.
  const parcelasInfo = useMemo(() => {
    const base = data ? new Date(`${data}T12:00:00`) : new Date();
    const hojeStr = new Date().toISOString().slice(0, 10);
    return Array.from({ length: numParcelas }, (_, idx) => {
      const d = new Date(base.getFullYear(), base.getMonth() + idx, base.getDate(), 12);
      const iso = d.toISOString().slice(0, 10);
      return { num: idx + 1, venceu: iso <= hojeStr, label: d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) };
    });
  }, [data, numParcelas]);

  // Pré-marca como pagas as parcelas que já venceram até hoje (reseta ao mudar
  // a data ou o nº de parcelas). O usuário ajusta nos checkboxes.
  useEffect(() => {
    if (!parcelado) return;
    setPagas(new Set(parcelasInfo.filter(p => p.venceu).map(p => p.num)));
  }, [parcelado, parcelasInfo]);

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
    if (!valor || valor === '0') { setErro(parcelado ? 'Informe o valor de cada parcela.' : 'Informe o valor.'); return; }
    // Parcelamento sem cartão vira Dívida — categoria não se aplica.
    // Estorno tem categoria fixa ('Reembolso'); parcelamento sem cartão vira Dívida.
    if (!categoria && !estorno && !(parcelado && semCartao)) { setErro('Selecione uma categoria.'); return; }
    if (walletsVisiveis.length > 0 && !walletId) { setErro('Selecione a conta de origem.'); return; }

    const walletNome = wallets.find(w => w.id === walletId)?.nome;

    // #6 otimista (opt-in, só o caminho NÃO-parcelado): fecha na hora e delega
    // a criação pro pai, que insere a linha no cache e chama a API em segundo
    // plano. Salvar "parece" instantâneo mesmo com o Render em ~500ms.
    // `!viraFixa`: a linha otimista seria MENTIRA — o servidor não vai criar
    // transação alguma, então ela apareceria e sumiria sozinha.
    if (onOptimisticCreate && !parcelado && !viraFixa) {
      const valorNum = parseInt(valor, 10) / 100;
      // Estorno entra como crédito na fatura, não como despesa nem receita.
      const tipoFinal = estorno ? 'Recebimento' : tipo;
      const catFull = estorno ? '↩️ Reembolso' : `${catEmoji} ${categoria}`;
      const optimisticRow = {
        id: `tmp-${Date.now()}`,
        tipo: tipoFinal, valor: valorNum, observacao: descricao, categoria: catFull,
        carteira_nome: walletNome, wallet_nome: walletNome, data,
        pago: true, recorrente, transferencia: estorno, _otimista: true,
      };
      const doCreate = () => api.transacoes.criar({
        phone, tipo: tipoFinal, valor: valorNum, observacao: descricao, categoria: catFull,
        wallet_id: walletId || undefined, carteira_nome: walletNome, data, recorrente,
        transferencia: estorno,
      });
      onOptimisticCreate(optimisticRow, doCreate);
      onClose();
      return;
    }

    setLoading(true);
    try {
      if (parcelado && semCartao) {
        // Parcelei com alguém, sem cartão → cria um PARCELAMENTO em Dívidas.
        // Sem debitar nada agora; cada parcela é paga (da conta escolhida) no vencimento.
        const diaVenc = diaVencimento
          ? Math.min(31, Math.max(1, parseInt(diaVencimento, 10)))
          : new Date(`${data}T12:00:00`).getDate();
        const vParcela = parseInt(valor, 10) / 100;
        await api.dividas.criar({
          phone,
          titulo:         (descricao || '').trim() || 'Compra parcelada',
          credor:         credor.trim() || undefined,
          tipo:           'parcelamento',
          valor_total:    vParcela * numParcelas,
          valor_parcela:  vParcela,
          parcelas_total: numParcelas,
          parcelas_pagas: 0,
          dia_vencimento: diaVenc,
          data_inicio:    data,
          observacao:     descricao || undefined,
        });
      } else if (parcelado) {
        if (!ehCartaoSel || !walletNome) { setErro('Compra parcelada só pode ser lançada em um cartão de crédito.'); setLoading(false); return; }
        await api.transacoes.criarParcelado({
          phone,
          categoria: `${catEmoji} ${categoria}`,
          observacao: descricao,
          carteira_nome: walletNome,
          valor_parcela: parseInt(valor, 10) / 100,
          num_parcelas: numParcelas,
          data,
          pagas: [...pagas],
        });
      } else {
        await api.transacoes.criar({
          phone,
          tipo: estorno ? 'Recebimento' : tipo,
          valor: parseInt(valor, 10) / 100,
          observacao: descricao,
          categoria: estorno ? '↩️ Reembolso' : `${catEmoji} ${categoria}`,
          wallet_id: walletId || undefined,
          carteira_nome: walletNome,
          data,
          recorrente,
          transferencia: estorno,   // abate a fatura, sem virar receita
        });
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar transação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain" onClick={onClose}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative min-h-full flex items-end sm:items-center justify-center p-4">
        <div
          className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-fade-in border border-border max-h-[90dvh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Nova Transação</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-muted transition-colors">
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">

          {/* 1) Toggle Despesa / Receita */}
          <div className="relative flex bg-muted rounded-2xl p-1">
            <div
              className="absolute top-1 bottom-1 rounded-xl transition-all duration-200"
              style={{
                width: 'calc(50% - 4px)',
                left: tipo === 'Gasto' ? '4px' : 'calc(50%)',
                background: tipo === 'Gasto' ? 'hsl(0 72% 58%)' : 'hsl(var(--primary))',
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

          {/* 2) Conta / Cartão — picker visual (logos oficiais + cards menores) */}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {walletsVisiveis.map(w => {
                  const ativa = w.id === walletId;
                  const ehCartao = w.tipo === 'Crédito';
                  const logo = bancoLogo(w.nome);
                  return (
                    <button
                      key={w.id}
                      onClick={() => setWalletId(w.id)}
                      className={`relative flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        ativa
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      {/* Logo oficial do banco (IconeMarca) — cai nas iniciais coloridas se não reconhecer */}
                      <div
                        className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: logo.bg }}
                      >
                        <IconeMarca nome={w.nome} size={32} className="w-full h-full" fallback={<>{logo.text}</>} />
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
                {/* "Sem cartão" — pra compra parcelada com alguém (vira parcelamento) */}
                {tipo === 'Gasto' && (
                  <button
                    type="button"
                    onClick={() => setWalletId(SEM_CARTAO)}
                    className={`relative flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                      semCartao
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-dashed border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                      <Users size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">Sem cartão</p>
                      <span className="text-[9px] font-medium text-muted-foreground truncate block mt-0.5">Parcelei com alguém</span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3) Recorrente + Compra parcelada (lado a lado, responsivo) */}
          <div className="grid grid-cols-2 gap-2">
            {/* Recorrente */}
            <button
              type="button"
              onClick={() => setRecorrente(v => !v)}
              className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl border text-left transition-all ${recorrente ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Repeat size={15} className="flex-shrink-0 text-muted-foreground" />
                <span className="text-[13px] font-medium text-foreground truncate">Recorrente</span>
              </span>
              <span className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors" style={{ background: recorrente ? 'hsl(var(--primary))' : 'hsl(var(--fg-muted) / .3)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: recorrente ? 'translateX(18px)' : 'translateX(2px)' }} />
              </span>
            </button>

            {/* Compra parcelada — visível sempre; bloqueia se não for cartão */}
            <button
              type="button"
              onClick={() => {
                if (!podeParcelar) { setAvisoParcela('Parcelar: escolha um cartão de crédito ou "Sem cartão" na conta acima.'); return; }
                setAvisoParcela(''); setParcelado(v => !v);
              }}
              className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl border text-left transition-all ${parcelado ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'} ${!podeParcelar ? 'opacity-70' : ''}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <CreditCard size={15} className="flex-shrink-0 text-purple-500" />
                <span className="text-[13px] font-medium text-foreground truncate">Parcelada</span>
              </span>
              <span className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors" style={{ background: parcelado ? 'hsl(var(--primary))' : 'hsl(var(--fg-muted) / .3)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: parcelado ? 'translateX(18px)' : 'translateX(2px)' }} />
              </span>
            </button>
          </div>
          {/* Explica ANTES, não depois: o toggle ligado numa data futura muda o
              que o botão salvar faz, e isso tem de estar na tela onde a escolha
              é feita. Antes o usuário só descobria pela ausência. */}
          {viraFixa && (
            <div className="-mt-2 rounded-xl border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2.5">
              <p className="text-[12px] leading-relaxed text-amber-700 dark:text-amber-300">
                <span className="font-semibold">Isto vira uma conta fixa.</span>{' '}
                Como a data ainda não chegou, a Sora não lança agora — ela lança
                sozinha todo dia {Number(data.slice(8, 10))}. Você acompanha em{' '}
                <span className="font-semibold">Gastos fixos</span>, aqui mesmo
                nesta aba, e não na lista de movimentações.
              </p>
              <p className="mt-1.5 text-[11px] text-amber-700/80 dark:text-amber-300/80">
                Quer que apareça agora como lançamento? Desligue o Recorrente.
              </p>
            </div>
          )}

          {avisoParcela && !parcelado && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1.5 -mt-2">
              <AlertCircle size={12} className="flex-shrink-0" /> {avisoParcela}
            </p>
          )}

          {/* Estorno na fatura — só aparece com um cartão escolhido. Abate a
              fatura e devolve limite, sem contar como receita no relatório. */}
          {podeEstornar && (
            <button
              type="button"
              onClick={() => setEstorno(v => !v)}
              aria-pressed={estorno}
              className={`flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-xl border text-left transition-all -mt-2 ${estorno ? 'border-emerald-500 bg-emerald-500/5' : 'border-border hover:bg-muted/40'}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <Undo2 size={15} className="flex-shrink-0 text-emerald-500" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground truncate">Estorno / crédito na fatura</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    Reembolso, cashback ou compra cancelada — abate a fatura
                  </span>
                </span>
              </span>
              <span className="relative w-9 h-5 rounded-full flex-shrink-0 transition-colors" style={{ background: estorno ? 'hsl(160 84% 39%)' : 'hsl(var(--fg-muted) / .3)' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform" style={{ transform: estorno ? 'translateX(18px)' : 'translateX(2px)' }} />
              </span>
            </button>
          )}

          {/* Config da compra parcelada */}
          {parcelado && (
            <div className="rounded-xl border border-border p-3 space-y-3 animate-fade-in">
              {/* nº de parcelas */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">Número de parcelas</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setNumParcelas(n => Math.max(1, n - 1))}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg leading-none text-foreground hover:bg-muted">−</button>
                  <span className="text-sm font-bold text-foreground tabular w-10 text-center">{numParcelas}x</span>
                  <button type="button" onClick={() => setNumParcelas(n => Math.min(60, n + 1))}
                    className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-lg leading-none text-foreground hover:bg-muted">+</button>
                </div>
              </div>

              {/* total */}
              <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-sm font-bold text-foreground tabular text-right">
                  {fmt((parseInt(valor || '0', 10) / 100) * numParcelas)}
                  <span className="block text-[11px] font-normal text-muted-foreground">{numParcelas}x de {fmt(parseInt(valor || '0', 10) / 100)}</span>
                </span>
              </div>

              {/* SEM CARTÃO: de quem comprou + dia de vencimento */}
              {semCartao && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1"><Users size={11} /> De quem comprou?</label>
                      <input value={credor} maxLength={40} placeholder="Ex.: João (opcional)"
                             onChange={e => setCredor(e.target.value)} className="input py-2 text-sm w-full" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1"><CalendarClock size={11} /> Dia do vencimento</label>
                      <input value={diaVencimento} inputMode="numeric" placeholder="Ex.: 10"
                             onChange={e => setDiaVencimento(e.target.value.replace(/\D/g, '').slice(0, 2))}
                             className="input py-2 text-sm w-full" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                    <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
                    Vira um parcelamento em <b className="text-foreground font-semibold">Dívidas e Parcelamentos</b>. Não desconta de nenhuma conta agora — a cada vencimento você escolhe de qual conta pagar.
                  </p>
                </>
              )}

              {/* parcelas já pagas (só cartão) */}
              {!semCartao && (
              <div>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-1.5">Parcelas já pagas</p>
                <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto">
                  {parcelasInfo.map(p => {
                    const paga = pagas.has(p.num);
                    return (
                      <button key={p.num} type="button"
                        onClick={() => setPagas(s => { const nx = new Set(s); if (nx.has(p.num)) nx.delete(p.num); else nx.add(p.num); return nx; })}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all ${paga ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                        <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${paga ? 'bg-primary text-white' : 'border border-border'}`}>
                          {paga && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="text-[12px] text-foreground tabular truncate">
                          <b>{p.num}/{numParcelas}</b> <span className="text-muted-foreground">· {p.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">Já marcamos as que venceram até hoje. Ajuste se precisar.</p>
              </div>
              )}
            </div>
          )}

          {/* 4) Data */}
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mb-2">
              {parcelado ? 'Data da 1ª parcela' : 'Data'}
            </p>
            <input type="date" value={data} onChange={e => setData(e.target.value)} className="input" />
          </div>

          {/* 5) Valor */}
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">{parcelado ? 'Valor de cada parcela' : 'Valor'}</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-bold text-muted-foreground">{MOEDAS[moedaConta].simbolo}</span>
              <input
                type="tel"
                inputMode="numeric"
                value={formatValorDisplay(valor)}
                onChange={handleValorInput}
                className="text-5xl font-bold text-foreground bg-transparent border-none outline-none text-center w-full tabular"
              />
            </div>
            {/* ⚠️ Só em conta estrangeira. Em real o bloco não existe e a tela
                fica idêntica à de antes. */}
            {contaEstrangeira && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Valor em <b className="text-foreground">{MOEDAS[moedaConta].nome}</b>
                {equivalenteBRL !== null && <> · ≈ {formatarMoeda(equivalenteBRL, 'BRL')}</>}
              </p>
            )}
          </div>

          {/* 6) Descrição */}
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

          {/* 7) Categorias (filtradas por tipo) */}
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
                const theme = getCategoriaTheme(cat.nome);
                return (
                  <button
                    key={cat.id || cat.nome}
                    onClick={() => {
                      setCategoria(cat.nome);
                      setCatEmoji(cat.emoji);
                      setParentId(temFilhos ? (cat.id || null) : null);
                    }}
                    className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                      ativo
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40 hover:bg-muted'
                    }`}
                  >
                    <CategoriaIcon
                      nome={cat.nome}
                      icone={cat.emoji}
                      bg={theme.bg}
                      color={theme.color}
                      size={36}
                    />
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
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        categoria === pai.nome
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-dashed border-border hover:border-primary/40 hover:bg-card'
                      }`}
                    >
                      {(() => {
                        const t = getCategoriaTheme(pai.nome);
                        return (
                          <CategoriaIcon nome={pai.nome} icone={pai.emoji} bg={t.bg} color={t.color} size={32} />
                        );
                      })()}
                      <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">Só {pai.nome}</span>
                    </button>
                    {pai.filhos.map(sub => {
                      const ativo = categoria === sub.nome;
                      const t = getCategoriaTheme(sub.nome);
                      return (
                        <button
                          key={sub.id || sub.nome}
                          onClick={() => { setCategoria(sub.nome); setCatEmoji(sub.emoji); }}
                          className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                            ativo
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                              : 'border-border bg-card hover:border-primary/40'
                          }`}
                        >
                          <CategoriaIcon nome={sub.nome} icone={sub.emoji} bg={t.bg} color={t.color} size={32} />
                          <span className="text-[10px] text-muted-foreground font-medium leading-tight text-center">{sub.nome}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {erro && (
            <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2.5">
              <AlertCircle size={14} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{erro}</p>
            </div>
          )}
        </div>

        {/* Footer fixo — ação sempre visível */}
        <div className="shrink-0 px-5 py-4 border-t border-border bg-muted/20">
          <button
            onClick={handleSalvar}
            disabled={loading || !valor || valor === '0'}
            className="btn btn-primary w-full"
            style={{ padding: '12px 16px', fontSize: '15px' }}
          >
            {loading ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : parcelado ? `Lançar ${numParcelas}x no cartão` : 'Salvar transação'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
