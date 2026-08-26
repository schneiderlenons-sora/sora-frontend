'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Repeat, Plus, Trash2, Loader2, Check, X, Calendar,
  ArrowDownRight, ArrowUpRight, Sparkles, CircleDashed, Pencil,
  Bell, ChevronDown, Link2, EyeOff, TrendingUp, Wallet as WalletIcon,
} from 'lucide-react';
import { api, type ModoLancamentoFixo, type SugestaoCategoriaFixa } from '@/lib/api';
import { mutate as mutateGlobal } from 'swr';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import { calcularSaldoProjetado, diaHojeSP } from '@/lib/saldo-projetado';

const BRAND = 'hsl(var(--primary))';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Tipo = 'Gasto' | 'Recebimento';

type Recorrencia = {
  id:             string;
  tipo:           Tipo;
  valor:          number;
  dia_vencimento: number;
  descricao:      string;
  carteira:       string | null;
  categoria:      string | null;
  valor_variavel?: boolean;
  // Migration 112 — o que a Sora faz no vencimento, por conta fixa.
  modo_lancamento?: ModoLancamento;
  lembrete?:        boolean;
};

/** Fatura em aberto de um cartão, como o card de previstos precisa dela.
 *  Vem de `GET /api/wallets/faturas` — mesma fonte da aba Cartão de crédito. */
type FaturaPrevista = {
  cartao_id:      string;
  nome:           string;
  /** Fatura − pago. É o que ainda vai sair. */
  restante:       number;
  /** Vencimento em ISO (YYYY-MM-DD) — o dia sai daqui. */
  venc?:          string;
  of?:            boolean;
  /** Migration 123. Ausente = conta (o padrão). */
  nos_previstos?: boolean;
};

/** `lancar` cria a transação paga · `prever` cria [Previsto] pra reconciliar
 *  com a cobrança do banco · `nao_lancar` não cria nada (só lembra). */
type ModoLancamento = ModoLancamentoFixo;

const MODOS: { id: ModoLancamento; label: string; ajuda: string }[] = [
  { id: 'lancar',     label: 'Lançar',     ajuda: 'Cria a transação já paga e desconta do saldo.' },
  { id: 'prever',     label: 'Só prever',  ajuda: 'Cria como previsto e deixa a cobrança do seu banco confirmar o valor. Evita o gasto contar duas vezes.' },
  { id: 'nao_lancar', label: 'Não lançar', ajuda: 'Não cria nada. Serve só pra você somar seus custos fixos.' },
];

// `saldo` sempre vem (a rota faz `select('*')`) — o tipo é que não declarava,
// e sem ele o saldo projetado somaria `undefined` e daria sempre zero.
type Wallet = { id: string; nome: string; tipo?: string; saldo?: number };

type Sugestao = {
  descricao: string; valor: number; dia: number;
  tipo: Tipo; categoria: string; ocorrencias: number; meses: number;
};

interface Props {
  phone?:  string;
  wallets: Wallet[];
}

export default function GastosFixosSection({ phone, wallets }: Props) {
  const [itens, setItens]         = useState<Recorrencia[]>([]);
  const [carregando, setCarreg]   = useState(true);
  const [confirmando, setConfirm] = useState<string | null>(null); // id em confirmação de cancelamento
  const [removendo, setRemovendo] = useState<string | null>(null);
  // 'novo' = form de criação aberto; um item = editando ESSE item; null = fechado.
  const [formTarget, setFormTarget] = useState<'novo' | Recorrencia | null>(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [dividas, setDividas]     = useState<any[]>([]);
  const [tirando, setTirando]     = useState<string | null>(null); // dívida saindo da previsão
  // Faturas de cartão: as que CONTAM e as que o usuário tirou (pra poder voltar).
  const [faturas, setFaturas]     = useState<FaturaPrevista[]>([]);
  const [mexendoCartao, setMexendoCartao] = useState<string | null>(null);

  // Seção recolhida — a lista é longa e fica no TOPO da aba de transações;
  // quem já configurou os fixos quer passar por ela, não relê toda visita.
  // A escolha é lembrada (localStorage): recolher e a seção reabrir no próximo
  // acesso seria o mesmo que não ter o botão.
  //
  // Começa SEMPRE aberta no 1º render e só então lê o storage, com
  // `useLayoutEffect`: ler no `useState` inicial faria o HTML do servidor
  // (que não tem localStorage) divergir do cliente — hydration mismatch.
  const [recolhida, setRecolhida] = useState(false);
  useLayoutEffect(() => {
    try { setRecolhida(localStorage.getItem('sora-previstos-recolhida') === '1'); } catch { /* modo privado */ }
  }, []);
  const alternarRecolhida = useCallback(() => {
    setRecolhida((v) => {
      const novo = !v;
      try { localStorage.setItem('sora-previstos-recolhida', novo ? '1' : '0'); } catch { /* noop */ }
      return novo;
    });
  }, []);
  const [aceitando, setAceitando] = useState<string | null>(null); // descricao em processamento
  // Sugestões de CATEGORIA pras contas fixas que ficaram em "Outros",
  // indexadas por id da recorrência (a linha consulta pelo próprio id).
  const [sugCats, setSugCats] = useState<Record<string, SugestaoCategoriaFixa>>({});

  const carregar = useCallback(async () => {
    if (!phone) { setCarreg(false); return; }
    try {
      const data = await api.recorrencias.listar(phone);
      setItens(Array.isArray(data) ? (data as Recorrencia[]) : []);
    } catch {
      setItens([]);
    } finally {
      setCarreg(false);
    }
  }, [phone]);

  /** Dívidas que entram na PREVISÃO do mês.
   *
   *  A parcela de um financiamento é gasto previsto igual à luz — o card só
   *  olhava `recorrencias`, então quem tem dívida via um total menor que a
   *  realidade. Aqui elas entram como leitura: dá pra tirar do card, mas não
   *  pra criar (dívida precisa de nº de parcelas, credor, juros… que não cabem
   *  no formulário de conta fixa).
   *
   *  Filtro: ativa (nem quitada nem sem parcela) e não removida da previsão
   *  (`nos_previstos`, migration 115). `!== false` e não `=== true` porque
   *  antes da migration a coluna não vem — e o certo é MOSTRAR. */
  const carregarDividas = useCallback(async () => {
    if (!phone) return;
    try {
      const r = await api.dividas.listar(phone);
      setDividas((r?.dividas || []).filter((d: any) =>
        d.status !== 'quitada' && Number(d.valor_parcela) > 0 && d.nos_previstos !== false));
    } catch { setDividas([]); }
  }, [phone]);

  /** Faturas de cartão que entram na PREVISÃO do mês.
   *
   *  Pedido de usuário: "por que os valores de cartão de crédito não aparecem
   *  como previsto no mês? Isso ajudaria na previsão de saldos." Ele tem razão:
   *  a fatura costuma ser a maior saída previsível e ficava fora justamente do
   *  card que existe pra prever o mês.
   *
   *  `GET /api/wallets/faturas` já devolve tudo pronto (`restante` = fatura −
   *  pago, `venc`, `quitada`) — a mesma fonte da aba Cartão de crédito, então
   *  não há risco de os dois números divergirem.
   *
   *  ⚠️ Só entra o que AINDA É PREVISÃO: fatura quitada (`restante <= 0`) sai
   *  sozinha. E `nos_previstos !== false` (migration 123) respeita quem tirou
   *  da previsão — `!== false` e não `=== true` porque antes da migration a
   *  coluna não vem, e o certo é MOSTRAR. */
  const carregarFaturas = useCallback(async () => {
    if (!phone) return;
    try {
      const r = await api.wallets.faturas(phone, 0);
      const lista = (r?.faturas || []) as FaturaPrevista[];
      setFaturas(lista.filter((f) => Number(f.restante) > 0.01));
    } catch { setFaturas([]); }
  }, [phone]);

  const carregarSugestoes = useCallback(async () => {
    try { const r = await api.recorrencias.sugestoes(); setSugestoes(r.sugestoes || []); }
    catch { setSugestoes([]); }
  }, []);

  const carregarSugCats = useCallback(async () => {
    try {
      const r = await api.recorrencias.categoriasSugeridas();
      const ix: Record<string, SugestaoCategoriaFixa> = {};
      for (const s of r.sugestoes || []) ix[s.id] = s;
      setSugCats(ix);
    } catch { setSugCats({}); }
  }, []);

  useEffect(() => { carregar(); carregarSugestoes(); carregarSugCats(); carregarDividas(); carregarFaturas(); },
    [carregar, carregarSugestoes, carregarSugCats, carregarDividas, carregarFaturas]);

  /** Tira/coloca a fatura do cartão na previsão (migration 123).
   *
   *  Diferente da dívida, aqui dá pra VOLTAR pela própria tela — o usuário
   *  pediu isso explicitamente. Otimista nos dois sentidos: muda na hora e
   *  recarrega do servidor se falhar (sem a migration o PUT recusa com
   *  mensagem, e a lista volta ao que era — comportamento honesto). */
  async function alternarCartao(cartaoId: string, entrar: boolean) {
    setMexendoCartao(cartaoId);
    setFaturas((prev) => prev.map((f) =>
      f.cartao_id === cartaoId ? { ...f, nos_previstos: entrar } : f));
    try {
      await api.wallets.editar(cartaoId, { nos_previstos: entrar });
    } catch {
      await carregarFaturas();   // servidor recusou → mostra a verdade
    } finally {
      setMexendoCartao(null);
    }
  }

  /** Tira a dívida da PREVISÃO (não apaga a dívida). Otimista: some da lista na
   *  hora e volta se o servidor recusar — se a migration 115 não rodou, o PUT
   *  falha e a linha reaparece, que é o comportamento honesto. */
  async function tirarDosPrevistos(d: any) {
    setTirando(d.id);
    const backup = dividas;
    setDividas((prev) => prev.filter((x) => x.id !== d.id));
    try {
      await api.dividas.editar(d.id, { nos_previstos: false });
    } catch {
      setDividas(backup);
    }
    setTirando(null);
  }

  /** Aceita a categoria sugerida pra UMA conta fixa. Otimista, e some da lista
   *  de sugestões na hora — o backend ainda propaga a categoria pro lançamento
   *  deste mês (`propagadas`), então revalida o cache global quando isso ocorre. */
  async function aceitarCategoria(s: SugestaoCategoriaFixa) {
    setSugCats((prev) => { const n = { ...prev }; delete n[s.id]; return n; });
    setItens((prev) => prev.map((i) => (i.id === s.id ? { ...i, categoria: s.sugerida } : i)));
    try {
      const r: { propagadas?: number } = await api.recorrencias.editar(s.id, { categoria: s.sugerida });
      if (r?.propagadas) mutateGlobal(() => true, undefined, { revalidate: true });
    } catch {
      carregar(); carregarSugCats();   // servidor recusou: volta ao estado real
    }
  }

  /** Ignora a sugestão só nesta sessão — não vale gravar "dispensada" no banco
   *  por uma categoria; se a conta continuar em "Outros", faz sentido ela voltar
   *  a aparecer na próxima visita. */
  function ignorarCategoria(id: string) {
    setSugCats((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  // Aprova uma sugestão (1 clique) → vira recorrência fixa.
  async function aceitarSugestao(s: Sugestao) {
    if (!phone) return;
    setAceitando(s.descricao);
    setSugestoes((prev) => prev.filter((x) => x.descricao !== s.descricao)); // otimista
    try {
      await api.recorrencias.criar({
        phone, tipo: s.tipo, descricao: s.descricao, valor: s.valor,
        dia_vencimento: s.dia, categoria: s.categoria,
      });
      carregar(); // mostra na lista
    } catch {
      carregarSugestoes(); // reverte (recoloca a sugestão)
    }
    setAceitando(null);
  }

  function dispensarSugestao(descricao: string) {
    setSugestoes((prev) => prev.filter((x) => x.descricao !== descricao));
    // Persiste no backend pra NÃO voltar no próximo carregamento.
    api.recorrencias.dispensarSugestao(descricao).catch(() => { /* tolerante */ });
  }

  // ── 4 grupos: gasto/receita × fixo/variável. Só rendo os não-vazios. ──
  const gastosFixos   = useMemo(() => itens.filter((i) => i.tipo === 'Gasto'       && !i.valor_variavel), [itens]);
  const gastosVar     = useMemo(() => itens.filter((i) => i.tipo === 'Gasto'       &&  i.valor_variavel), [itens]);
  const receitasFixas = useMemo(() => itens.filter((i) => i.tipo === 'Recebimento' && !i.valor_variavel), [itens]);
  const receitasVar   = useMemo(() => itens.filter((i) => i.tipo === 'Recebimento' &&  i.valor_variavel), [itens]);
  // Uma parcela por dívida por mês — é assim que a dívida pesa no mês.
  const totalDividas  = useMemo(() => dividas.reduce((s, d) => s + (Number(d.valor_parcela) || 0), 0), [dividas]);

  // Cartões: só os que o usuário deixou entrar na previsão somam.
  const cartoesNaPrevisao = useMemo(() => faturas.filter((f) => f.nos_previstos !== false), [faturas]);
  const cartoesDeFora     = useMemo(() => faturas.filter((f) => f.nos_previstos === false), [faturas]);
  const totalCartoes      = useMemo(
    () => cartoesNaPrevisao.reduce((s, f) => s + (Number(f.restante) || 0), 0), [cartoesNaPrevisao]);

  const totalGastos   = useMemo(
    () => itens.filter((i) => i.tipo === 'Gasto').reduce((s, i) => s + (i.valor || 0), 0)
      + totalDividas + totalCartoes,
    [itens, totalDividas, totalCartoes]);
  const temVariavel   = useMemo(() => itens.some((i) => i.valor_variavel), [itens]);

  /** ⚠️ Fatura JÁ CADASTRADA como conta fixa contaria DUAS VEZES.
   *  O CLAUDE.md orienta cadastrar contas de valor variável — inclusive cartão
   *  — como recorrência, então a sobreposição é possível. Medido na base: de
   *  240 recorrências ativas, só 1 é fatura de cartão. Raro, mas quando
   *  acontece o card AVISA em vez de somar calado. */
  const cartaoDuplicado = useMemo(() => {
    if (!cartoesNaPrevisao.length) return null;
    const re = /\bfatura\b|cart[ãa]o/i;
    const rec = itens.find((i) => i.tipo === 'Gasto' && re.test(i.descricao || ''));
    return rec ? rec.descricao : null;
  }, [itens, cartoesNaPrevisao]);

  // ── SALDO PROJETADO ────────────────────────────────────────────────────
  // "Com o que ainda vai entrar e sair, como eu termino o mês?" — pedido de
  // cliente. A aritmética (e o cuidado de não contar duas vezes o que já
  // venceu) mora em lib/saldo-projetado.ts, com eval próprio.
  const projecao = useMemo(
    () => calcularSaldoProjetado(
      wallets,
      itens,
      [
        ...dividas.map((d) => ({
          tipo: 'Gasto' as const,
          valor: Number(d.valor_parcela) || 0,
          dia_vencimento: Number(d.dia_vencimento) || 0,
        })),
        // Fatura do cartão entra como despesa prevista — era o que faltava pra
        // a projeção fechar. O DIA vem do vencimento (`venc` é ISO), pra a
        // regra "já venceu × ainda vem" valer igual pro resto.
        ...cartoesNaPrevisao.map((f) => ({
          tipo: 'Gasto' as const,
          valor: Number(f.restante) || 0,
          dia_vencimento: parseInt(String(f.venc || '').slice(8, 10), 10) || 0,
          // A data inteira manda: sem ela a fatura do mês que vem some da
          // projeção (ver ItemPrevisto.venc em lib/saldo-projetado.ts).
          venc: f.venc ? String(f.venc).slice(0, 10) : undefined,
        })),
      ],
    ),
    [wallets, itens, dividas, cartoesNaPrevisao]);

  // Despesas e receitas separadas (não um `grupos` só): dívida é DESPESA e
  // precisa ficar entre "Gastos variáveis" e "Receitas fixas" — antes ela
  // vinha depois de tudo, inclusive das receitas, porque o bloco de dívidas
  // era renderizado fora do laço, sempre por último (queixa real do usuário).
  // ── "AINDA VEM" × "JÁ PASSOU" ──────────────────────────────────────────
  //
  // Dúvida real de cliente: "cadastrei todas as recorrências, mas meu mês já
  // está todo pago — não consigo marcar que já foi pago?". Nada estava errado
  // (o cron só lança NO dia do vencimento, então cadastrar no meio do mês não
  // cria nada retroativo) — o card é que listava tudo achatado, e o total
  // parecia dívida em aberto.
  //
  // Ordenar por "ainda vem" primeiro e marcar o que já venceu resolve sem
  // botão nenhum. ⚠️ NENHUM número muda: o "Total previsto" continua sendo o
  // custo fixo do mês inteiro. O que entra é o subtotal do que FALTA — que é a
  // pergunta que o cliente estava tentando responder.
  //
  // `diaHojeSP` vem de lib/saldo-projetado (já testado, fuso de SP): com
  // `getDate()` local a virada do dia sairia errada pra quem não está em SP.
  const hoje = useMemo(() => diaHojeSP(), []);
  // Data inteira pra quem tem vencimento com mês (cartão). Ver o filtro abaixo.
  const hojeISO = useMemo(() => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }), []);
  const jaPassou = useCallback(
    (dia?: number | null) => !!dia && Number(dia) < hoje, [hoje]);

  /** Ainda a vencer primeiro; dentro de cada bloco, por dia. */
  const ordenar = useCallback((lista: Recorrencia[]) => [...lista].sort((a, b) => {
    const pa = jaPassou(a.dia_vencimento) ? 1 : 0;
    const pb = jaPassou(b.dia_vencimento) ? 1 : 0;
    if (pa !== pb) return pa - pb;
    return (a.dia_vencimento || 0) - (b.dia_vencimento || 0);
  }), [jaPassou]);

  /** Quanto ainda falta sair — o subtotal que responde "o que eu ainda devo?". */
  const faltaPagar = useMemo(() => {
    const recs = itens
      .filter((i) => i.tipo === 'Gasto' && !jaPassou(i.dia_vencimento))
      .reduce((s, i) => s + (i.valor || 0), 0);
    const divs = dividas
      .filter((d) => !jaPassou(Number(d.dia_vencimento)))
      .reduce((s, d) => s + (Number(d.valor_parcela) || 0), 0);
    const carts = cartoesNaPrevisao
      // ⚠️ CARTÃO SE COMPARA POR DATA INTEIRA, não pelo dia. A recorrência é
      // mensal (dia 20 é sempre deste mês); a fatura não — o ciclo cruza meses
      // e ela pode vencer no mês que vem. Reduzida ao dia, uma fatura que vence
      // 13/09 virava "13" e, com hoje = 19, saía daqui como se já tivesse
      // vencido: entrava no "Total previsto" e sumia do "ainda falta sair", que
      // é a incoerência que o cliente viu na tela.
      .filter((f) => !f.venc || String(f.venc).slice(0, 10) >= hojeISO)
      .reduce((s, f) => s + (Number(f.restante) || 0), 0);
    return recs + divs + carts;
  }, [itens, dividas, cartoesNaPrevisao, jaPassou]);

  /** Sobrou algo já vencido? Só então vale mostrar os dois números. */
  const temJaPassou = useMemo(
    () => itens.some((i) => jaPassou(i.dia_vencimento))
      || dividas.some((d) => jaPassou(Number(d.dia_vencimento))),
    [itens, dividas, jaPassou]);

  const gruposDespesas = useMemo(() => ([
    { key: 'gf', label: 'Gastos fixos',       hint: '',                      itens: ordenar(gastosFixos) },
    { key: 'gv', label: 'Gastos variáveis',   hint: 'você confirma no dia',  itens: ordenar(gastosVar)   },
  ].filter((g) => g.itens.length > 0)), [gastosFixos, gastosVar, ordenar]);
  const gruposReceitas = useMemo(() => ([
    { key: 'rf', label: 'Receitas fixas',     hint: '',                      itens: ordenar(receitasFixas) },
    { key: 'rv', label: 'Receitas variáveis', hint: 'você confirma no dia',  itens: ordenar(receitasVar)   },
  ].filter((g) => g.itens.length > 0)), [receitasFixas, receitasVar, ordenar]);

  async function cancelar(id: string) {
    if (!phone) return;
    setRemovendo(id);
    const backup = itens;
    setItens((prev) => prev.filter((i) => i.id !== id)); // otimista
    setConfirm(null);
    try {
      await api.recorrencias.cancelar(id, phone);
    } catch {
      setItens(backup); // reverte se falhar
    }
    setRemovendo(null);
  }

  /** Muda o modo de lançamento / o lembrete de UMA conta fixa. Otimista: a
   *  UI responde na hora e reverte se o servidor recusar (são toggles, o
   *  usuário costuma mexer em vários seguidos). */
  async function mudarModo(id: string, patch: { modo_lancamento?: ModoLancamento; lembrete?: boolean }) {
    const backup = itens;
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      await api.recorrencias.editar(id, patch);
    } catch {
      setItens(backup);
    }
  }

  return (
    <section
      className="rounded-3xl border border-border/60 bg-card overflow-hidden animate-fade-in"
      aria-label="Contas previstas do mês"
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-b border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)` }}
          >
            <Repeat size={18} style={{ color: BRAND }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground leading-tight flex items-center gap-2">
              Previstos do mês
              {!carregando && itens.length + dividas.length > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                      style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)`, color: BRAND }}>
                  {itens.length + dividas.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {totalGastos > 0
                ? <>Contas que se repetem todo mês · <span className="tabular-nums font-medium text-foreground/80">{temVariavel ? '≈ ' : ''}{fmt(totalGastos)}</span>/mês</>
                : 'Contas que se repetem todo mês — fixas ou de valor variável'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => setFormTarget((v) => (v ? null : 'novo'))}
            className="flex items-center gap-1.5 px-3 h-11 rounded-xl text-sm font-semibold transition-all
                       hover:-translate-y-0.5 active:translate-y-0 flex-shrink-0"
            style={{ background: formTarget ? 'hsl(var(--bg-muted))' : `color-mix(in srgb, ${BRAND} 10%, transparent)`, color: formTarget ? undefined : BRAND }}
            aria-expanded={!!formTarget}
          >
            {formTarget ? <X size={16} /> : <Plus size={16} />}
            <span className="hidden sm:inline">{formTarget ? 'Fechar' : 'Adicionar'}</span>
          </button>

          {/* Recolher a seção. Fica SEPARADO do "Adicionar" (não é um menu
              escondido) porque é o controle que o usuário vai usar toda vez
              que a lista estiver no caminho. */}
          <button
            type="button"
            onClick={alternarRecolhida}
            aria-expanded={!recolhida}
            aria-controls="previstos-conteudo"
            aria-label={recolhida ? 'Mostrar os previstos do mês' : 'Recolher os previstos do mês'}
            title={recolhida ? 'Mostrar' : 'Recolher'}
            className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0
                       text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ChevronDown size={18} className={`transition-transform duration-200 ${recolhida ? '-rotate-90' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tudo daqui pra baixo é o conteúdo recolhível.
          Render CONDICIONAL em vez de esconder por CSS: a lista tem N itens,
          cada um com ícone e estado próprio — mantê-los montados só pra ficarem
          invisíveis é trabalho à toa justo na aba mais pesada do painel.
          Por isso não animo a altura: `0fr→1fr` exigiria o conteúdo montado. */}
      {!recolhida && (
      <div id="previstos-conteudo">

      {/* ── Form de adicionar/editar (progressive disclosure) ── */}
      {formTarget && (
        <AddForm
          phone={phone}
          contas={wallets}
          editItem={formTarget === 'novo' ? null : formTarget}
          onCancel={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); carregar(); }}
        />
      )}

      {/* ── Sugestões detectadas (Open Finance / extratos) ───── */}
      {sugestoes.length > 0 && (
        <div className="px-4 sm:px-6 py-4 border-b border-border/60"
             style={{ background: `color-mix(in srgb, ${BRAND} 5%, transparent)` }}>
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5">
            <Sparkles size={12} style={{ color: BRAND }} /> Encontramos possíveis fixos
          </p>
          <p className="text-xs text-muted-foreground mb-3">
            Cobranças que se repetem nas suas transações. Adicione com 1 toque pra a Sora acompanhar todo mês.
          </p>
          <ul className="space-y-2">
            {sugestoes.map((s) => {
              const theme = getCategoriaTheme(s.categoria || '', []);
              const ehGasto = s.tipo === 'Gasto';
              return (
                <li key={s.descricao}
                    className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3">
                  <CategoriaIcon nome={s.descricao} icone={theme.emoji}
                    bg={ehGasto ? '#ef444418' : `color-mix(in srgb, ${BRAND} 9%, transparent)`}
                    color={ehGasto ? '#ef4444' : BRAND} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{s.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums font-medium text-foreground/80">{fmt(s.valor)}</span>
                      {' · '}todo dia {s.dia}{' · '}
                      <span className="text-muted-foreground/80">{s.meses}× nos últimos meses</span>
                    </p>
                  </div>
                  <button
                    onClick={() => aceitarSugestao(s)}
                    disabled={aceitando === s.descricao}
                    className="flex items-center gap-1.5 px-3 h-10 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex-shrink-0"
                    style={{ background: BRAND, minHeight: 40 }}
                  >
                    {aceitando === s.descricao ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                    <span className="hidden sm:inline">Adicionar</span>
                  </button>
                  <button
                    onClick={() => dispensarSugestao(s.descricao)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0"
                    aria-label="Dispensar sugestão"
                  >
                    <X size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Lista ────────────────────────────────────────────── */}
      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : itens.length === 0 && dividas.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 px-6 py-10">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--bg-muted))' }}>
            <Calendar size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma conta prevista ainda</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            <strong className="text-foreground/80">Fixas</strong> (aluguel, Netflix, salário) a Sora lança sozinha no dia certo.
            {' '}<strong className="text-foreground/80">Variáveis</strong> (luz, água, cartão) ela te lembra pra você confirmar o valor.
          </p>
          {!formTarget && (
            <button
              onClick={() => setFormTarget('novo')}
              className="mt-1 flex items-center gap-1.5 px-3 h-11 rounded-xl text-sm font-semibold"
              style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)`, color: BRAND }}
            >
              <Plus size={16} /> Adicionar conta
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* ── DESPESAS: fixas → variáveis → dívidas → total ─────────────
              Nessa ordem de propósito (dívida é DESPESA — antes ela vinha
              depois até das receitas, porque o bloco era renderizado fora do
              laço, sempre por último; queixa real do usuário). */}
          {gruposDespesas.map((g, gi) => (
            <div key={g.key}>
              <p className={`px-4 sm:px-6 pt-4 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ${gi > 0 ? 'border-t border-border/50' : ''}`}>
                {g.label}
                {g.hint && (
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal font-medium text-muted-foreground/70">
                    <CircleDashed size={11} /> {g.hint}
                  </span>
                )}
              </p>
              <ul className="divide-y divide-border/50">
                {g.itens.map((item, idx) => (
                  <Linha key={item.id} item={item} idx={idx}
                    confirmando={confirmando} removendo={removendo}
                    onPedir={setConfirm} onCancelar={cancelar}
                    onEditar={() => setFormTarget(item)}
                    onModo={mudarModo}
                    sugCat={sugCats[item.id]}
                    onAceitarCat={aceitarCategoria}
                    onIgnorarCat={ignorarCategoria}
                    jaPassou={jaPassou(item.dia_vencimento)} />
                ))}
              </ul>
            </div>
          ))}

          {/* ── DÍVIDAS ────────────────────────────────────────────────────
              A parcela do mês de cada dívida ativa. Só aparece se existir
              dívida — quem não tem nem sabe que o bloco existe.

              É LEITURA: não dá pra criar dívida por aqui (precisa de nº de
              parcelas, credor, juros… que não cabem no form de conta fixa) nem
              de mudar o modo de lançamento. A única ação é TIRAR da previsão,
              que não apaga nada — a dívida segue inteira na aba Dívidas. */}
          {dividas.length > 0 && (
            <div>
              <p className={`px-4 sm:px-6 pt-4 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ${gruposDespesas.length > 0 ? 'border-t border-border/50' : ''}`}>
                Dívidas
                <span className="inline-flex items-center gap-1 normal-case tracking-normal font-medium text-muted-foreground/70">
                  <CircleDashed size={11} /> parcela deste mês
                </span>
              </p>
              <ul className="divide-y divide-border/50">
                {dividas.map((d, idx) => (
                  <LinhaDivida key={d.id} divida={d} idx={idx}
                    saindo={tirando === d.id} onTirar={() => tirarDosPrevistos(d)} />
                ))}
              </ul>
              <p className="px-4 sm:px-6 pb-4 pt-2 text-[11px] leading-snug text-muted-foreground">
                Gerencie as dívidas na aba <a href="/dividas" className="font-medium underline underline-offset-2 hover:text-foreground">Dívidas</a>.
                Tirar daqui não apaga a dívida — é só pra ela não contar na previsão.
              </p>
            </div>
          )}

          {/* ── CARTÕES DE CRÉDITO ─────────────────────────────────────────
              Pedido de usuário: "por que os valores de cartão não aparecem
              como previsto no mês?". A fatura é a maior saída previsível de
              muita gente e ficava fora do card que existe pra prever o mês.

              É LEITURA, como as dívidas: o valor vem da mesma fonte da aba
              Cartão de crédito (`restante` = fatura − pago), então os dois
              números nunca divergem. A única ação é tirar/colocar na previsão. */}
          {faturas.length > 0 && (
            <div>
              <p className={`px-4 sm:px-6 pt-4 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ${
                gruposDespesas.length > 0 || dividas.length > 0 ? 'border-t border-border/50' : ''
              }`}>
                Cartões de crédito
                <span className="inline-flex items-center gap-1 normal-case tracking-normal font-medium text-muted-foreground/70">
                  <CircleDashed size={11} /> fatura em aberto
                </span>
              </p>

              {cartaoDuplicado && (
                <div className="mx-4 sm:mx-6 mt-1.5 mb-1 p-2.5 rounded-xl border text-[11.5px] leading-snug"
                     style={{ borderColor: 'color-mix(in srgb, #f59e0b 40%, transparent)',
                              background: 'color-mix(in srgb, #f59e0b 8%, transparent)' }}>
                  <strong className="text-foreground">Atenção:</strong> você tem a conta fixa
                  {' '}<strong className="text-foreground">&ldquo;{cartaoDuplicado}&rdquo;</strong> que parece ser
                  fatura de cartão. Se for a mesma coisa, o valor está contando duas vezes — tire uma das duas
                  da previsão.
                </div>
              )}

              <ul className="divide-y divide-border/50">
                {cartoesNaPrevisao.map((f, idx) => (
                  <LinhaCartao key={f.cartao_id} fatura={f} idx={idx}
                    mexendo={mexendoCartao === f.cartao_id}
                    onTirar={() => alternarCartao(f.cartao_id, false)} />
                ))}
              </ul>

              {/* Os que ele tirou — com a volta, que foi o pedido explícito. */}
              {cartoesDeFora.length > 0 && (
                <div className="px-4 sm:px-6 py-3 space-y-2 border-t border-border/50">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                    Fora da previsão
                  </p>
                  {cartoesDeFora.map((f) => (
                    <div key={f.cartao_id} className="flex items-center justify-between gap-3">
                      <span className="text-[13px] text-muted-foreground truncate">
                        {f.nome} · <span className="tabular-nums">{fmt(Number(f.restante) || 0)}</span>
                      </span>
                      <button
                        onClick={() => alternarCartao(f.cartao_id, true)}
                        disabled={mexendoCartao === f.cartao_id}
                        className="inline-flex items-center gap-1.5 px-3 rounded-lg text-[12px] font-bold shrink-0 disabled:opacity-50 transition-colors"
                        style={{ background: `color-mix(in srgb, ${BRAND} 12%, transparent)`, color: BRAND, minHeight: 36 }}
                      >
                        {mexendoCartao === f.cartao_id ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                        Voltar pra previsão
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="px-4 sm:px-6 pb-4 pt-2 text-[11px] leading-snug text-muted-foreground">
                Valor da fatura ainda em aberto, igual à aba{' '}
                <a href="/cartao-de-credito" className="font-medium underline underline-offset-2 hover:text-foreground">Cartão de crédito</a>.
                Fatura paga sai daqui sozinha.
              </p>
            </div>
          )}

          {/* ── TOTAL PREVISTO (despesas) ──────────────────────────────────
              Soma gastos fixos + variáveis + dívidas — mesmo `totalGastos`
              que já alimenta o resumo do cabeçalho do card, então não existe
              risco de os dois números divergirem. Só aparece quando há
              alguma despesa prevista (senão seria "Total: R$ 0,00" solto). */}
          {totalGastos > 0 && (
            <div className="px-4 sm:px-6 py-3 border-t border-border/50 flex items-center justify-between gap-3"
                 style={{ background: 'hsl(var(--bg-muted) / 0.4)' }}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Total previsto
                <span className="block normal-case tracking-normal font-medium text-muted-foreground/70 mt-0.5">
                  custo fixo do mês inteiro
                </span>
              </p>
              <div className="text-right">
                <p className="text-[13px] sm:text-sm font-bold tabular-nums inline-flex items-center gap-0.5 text-red-500">
                  <ArrowDownRight size={12} />
                  {temVariavel ? '≈ ' : ''}{fmt(totalGastos)}
                </p>
                {/* ⚠️ O número que o cliente estava procurando. Só aparece
                    quando ALGO já venceu — senão os dois totais seriam iguais
                    e a linha viraria ruído. O "Total previsto" acima não muda:
                    ele continua sendo o custo do mês inteiro. */}
                {temJaPassou && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    ainda falta sair: <strong className="text-foreground">{temVariavel ? '≈ ' : ''}{fmt(faltaPagar)}</strong>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── RECEITAS: fixas → variáveis ──────────────────────────────── */}
          {gruposReceitas.map((g, gi) => (
            <div key={g.key}>
              <p className={`px-4 sm:px-6 pt-4 pb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2 ${
                gi > 0 || gruposDespesas.length > 0 || dividas.length > 0 ? 'border-t border-border/50' : ''
              }`}>
                {g.label}
                {g.hint && (
                  <span className="inline-flex items-center gap-1 normal-case tracking-normal font-medium text-muted-foreground/70">
                    <CircleDashed size={11} /> {g.hint}
                  </span>
                )}
              </p>
              <ul className="divide-y divide-border/50">
                {g.itens.map((item, idx) => (
                  <Linha key={item.id} item={item} idx={idx}
                    confirmando={confirmando} removendo={removendo}
                    onPedir={setConfirm} onCancelar={cancelar}
                    onEditar={() => setFormTarget(item)}
                    onModo={mudarModo}
                    sugCat={sugCats[item.id]}
                    onAceitarCat={aceitarCategoria}
                    onIgnorarCat={ignorarCategoria}
                    jaPassou={jaPassou(item.dia_vencimento)} />
                ))}
              </ul>
            </div>
          ))}

          {/* ── SALDO PROJETADO ───────────────────────────────────────────
              A conta que o cliente pediu: saldo de hoje + o que ainda entra
              − o que ainda sai. Fica no FIM do card de propósito — é a
              conclusão de tudo que está listado acima, não um número solto.

              ⚠️ Só aparece quando há item a projetar. Sem conta prevista, a
              projeção seria só o saldo atual repetido, que já está no
              dashboard — repetir número não informa nada. */}
          {projecao.itens > 0 && (
            <div className="border-t border-border/50 px-4 sm:px-6 py-4"
                 style={{ background: 'hsl(var(--bg-muted) / 0.4)' }}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={13} className="text-muted-foreground" />
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                  Se tudo acontecer como previsto
                </p>
              </div>

              {/* A conta, aberta — o usuário precisa ver de onde saiu o número,
                  senão é só mais um total em que ele tem que confiar. */}
              <dl className="flex flex-col gap-1.5 mb-3">
                <LinhaConta
                  icone={<WalletIcon size={12} />}
                  rotulo="Saldo hoje"
                  valor={fmt(projecao.saldoHoje)}
                  dica="soma das contas (cartão não entra)"
                />
                {projecao.aReceber > 0 && (
                  <LinhaConta
                    icone={<ArrowUpRight size={12} />}
                    rotulo="Ainda entra"
                    valor={`+ ${fmt(projecao.aReceber)}`}
                    cor="text-green-600 dark:text-green-400"
                  />
                )}
                {projecao.aPagar > 0 && (
                  <LinhaConta
                    icone={<ArrowDownRight size={12} />}
                    rotulo="Ainda sai"
                    valor={`− ${fmt(projecao.aPagar)}`}
                    cor="text-red-500"
                  />
                )}
              </dl>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/50">
                <p className="text-sm font-semibold text-foreground">
                  Sobra no fim do mês
                </p>
                {/* Ícone + valor: o sinal nunca é comunicado só pela cor. */}
                <p className={`text-lg font-bold tabular-nums inline-flex items-center gap-1 ${
                  projecao.projetado >= 0 ? 'text-foreground' : 'text-red-500'
                }`}>
                  {projecao.projetado < 0 && <ArrowDownRight size={15} />}
                  {projecao.aproximado ? '≈ ' : ''}{fmt(projecao.projetado)}
                </p>
              </div>

              <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                {projecao.projetado < 0
                  ? 'Do jeito que está, o mês fecha no vermelho. Dá tempo de ajustar.'
                  : 'Conta só o que ainda não venceu — o que já passou está dentro do saldo de hoje.'}
                {projecao.aproximado && ' Tem conta de valor variável, então o número é uma estimativa.'}
              </p>
            </div>
          )}
        </div>
      )}

      </div>
      )}{/* fim do conteúdo recolhível */}
    </section>
  );
}

// Uma linha da conta do saldo projetado (rótulo à esquerda, valor à direita).
function LinhaConta({ icone, rotulo, valor, dica, cor }: {
  icone: React.ReactNode; rotulo: string; valor: string; dica?: string; cor?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5 min-w-0">
        <span className="text-muted-foreground/70 shrink-0">{icone}</span>
        <span className="truncate">{rotulo}</span>
        {dica && <span className="hidden sm:inline text-[11px] text-muted-foreground/60 truncate">· {dica}</span>}
      </dt>
      <dd className={`text-[13px] font-semibold tabular-nums shrink-0 ${cor || 'text-foreground'}`}>{valor}</dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Linha de uma recorrência (gasto ou receita, fixa ou variável)
// ─────────────────────────────────────────────────────────────
function Linha({
  item, idx, confirmando, removendo, onPedir, onCancelar, onEditar, onModo,
  sugCat, onAceitarCat, onIgnorarCat, jaPassou,
}: {
  /** Vencimento já passou neste mês? Só muda a APRESENTAÇÃO — a conta segue
   *  igual, e o "Total previsto" continua sendo o custo do mês inteiro. */
  jaPassou?:   boolean;
  item:        Recorrencia;
  idx:         number;
  confirmando: string | null;
  removendo:   string | null;
  onPedir:     (id: string | null) => void;
  onCancelar:  (id: string) => void;
  onEditar:    () => void;
  onModo:      (id: string, patch: { modo_lancamento?: ModoLancamento; lembrete?: boolean }) => void;
  sugCat?:     SugestaoCategoriaFixa;
  onAceitarCat: (s: SugestaoCategoriaFixa) => void;
  onIgnorarCat: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const modo = item.modo_lancamento || 'lancar';
  const modoInfo = MODOS.find((m) => m.id === modo) || MODOS[0];
  const querLembrete = item.lembrete !== false;
  const tema = getCategoriaTheme(item.descricao);
  // Emoji da categoria (se tiver) OU o do tema da descrição — ex.: "academia" → 💪
  // (antes caía no 📦 genérico do CategoriaIcon quando a recorrência era "Outros").
  const emoji = (item.categoria?.match(/^\p{Extended_Pictographic}/u)?.[0]) ?? tema.emoji;
  const ehGasto = item.tipo === 'Gasto';
  const ehVariavel = !!item.valor_variavel;
  const semEstimativa = ehVariavel && !(item.valor > 0);
  const emConfirm = confirmando === item.id;
  const saindo = removendo === item.id;
  return (
    <li
      className="group transition-colors hover:bg-muted/30 animate-fade-in"
      // Já vencido fica levemente recuado (0.65) — o suficiente pra o olho ir
      // primeiro no que falta, sem sumir: a linha continua clicável e editável.
      style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`,
               opacity: saindo ? 0.5 : (jaPassou ? 0.65 : undefined) }}
    >
    {/* ── Layout em 3 faixas ────────────────────────────────────────────────
        Antes era UMA linha com 8 elementos disputando espaço (ícone, título,
        chip de dia, conta, valor, chip de modo, editar, excluir). Em 375px a
        coluna do meio sobrava com ~130px: o nome da conta virava "Mercado …" e
        o chip de modo quebrava em duas linhas ("Não / lançar"), que é a bagunça
        que o usuário reportou.

        Agora cada faixa tem um trabalho:
          1. identidade + valor  → o que a pessoa lê primeiro, lado a lado
          2. metadados           → dia e conta, com espaço pra caber inteiros
          3. controles           → modo à esquerda, ações à direita

        Vale nos dois tamanhos de tela de propósito: manter dois layouts
        diferentes é o tipo de coisa que volta a desalinhar na próxima mexida. */}
    <div className="px-3 sm:px-6 py-2.5 sm:py-3">
      <div className="flex items-start gap-2.5 sm:gap-3">
        {/* ⚠️ O ícone encolhe SÓ no mobile via `scale`, não por prop: o
            `CategoriaIcon` recebe um número e não aceita breakpoint. A caixa
            externa acompanha (w-[32px]) pra não sobrar buraco ao lado. */}
        <div className="w-[32px] sm:w-[38px] flex-shrink-0">
          <div className="scale-[0.842] sm:scale-100 origin-top-left">
            <CategoriaIcon nome={item.descricao} icone={emoji} size={38} bg={tema.bg} color={tema.color} rounded="rounded-xl" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {/* 1. Título + valor */}
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] sm:text-sm font-medium text-foreground truncate min-w-0">{item.descricao}</p>
            <div className="flex-shrink-0 text-right">
              {semEstimativa ? (
                <p className="text-[13px] sm:text-sm font-semibold tabular-nums inline-flex items-center gap-1 text-muted-foreground">
                  <CircleDashed size={12} /> a definir
                </p>
              ) : (
                <p className={`text-[13px] sm:text-sm font-bold tabular-nums inline-flex items-center gap-0.5 ${ehGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                  {ehGasto ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                  {ehVariavel ? '~' : ''}{fmt(item.valor)}
                </p>
              )}
            </div>
          </div>

          {/* 2. Metadados — agora com a largura toda, o nome da conta cabe */}
          <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
              <Calendar size={9} /> dia {item.dia_vencimento}
            </span>
            {/* ⚠️ Ícone + TEXTO, nunca só a cor/opacidade — quem não distingue
                tons precisa ler que já passou. Responde direto a "meu mês já
                está todo pago, não consigo marcar?": não precisa marcar nada. */}
            {jaPassou && (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md font-medium"
                    style={{ background: 'color-mix(in srgb, #10b981 13%, transparent)', color: '#047857' }}>
                <Check size={9} /> já passou
              </span>
            )}
            {ehVariavel && (
              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md font-medium"
                    style={{ background: 'color-mix(in srgb, #f59e0b 14%, transparent)', color: '#b45309' }}>
                <CircleDashed size={9} /> estimado
              </span>
            )}
            {item.carteira && <span className="truncate max-w-[60%]">· {item.carteira}</span>}
          </div>

          {/* 3. Controles: modo à esquerda, ações à direita */}
          <div className="flex items-center justify-between gap-2 mt-1.5 sm:mt-2">
            {/* Chip do modo — abre os controles. `whitespace-nowrap` impede o
                "Não / lançar" em duas linhas que aparecia no mobile.

                ⚠️ ALVO DE TOQUE PRESERVADO. A pílula ficou visualmente menor no
                mobile (h-8), mas `-my-1 py-1 box-content` devolve a área tocável
                de 40px — encolher o retângulo clicável junto seria trocar
                bagunça por erro de toque, que é pior. */}
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-label={`Lançamento de ${item.descricao}: ${modoInfo.label}. Toque para mudar.`}
              className={`inline-flex items-center gap-1 pl-2 pr-1.5 sm:pl-2.5 sm:pr-2 h-8 sm:h-9
                          -my-1 py-1 sm:my-0 sm:py-0 box-content sm:box-border
                          rounded-lg text-[10px] sm:text-[11px] font-semibold
                          whitespace-nowrap flex-shrink-0 transition-colors active:scale-[0.98] ${
                modo === 'nao_lancar'
                  ? 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  : modo === 'prever'
                    ? 'bg-amber-500/12 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                    : 'bg-primary/12 text-primary hover:bg-primary/20'
              }`}
            >
              {modo === 'nao_lancar' ? <CircleDashed size={10} /> : modo === 'prever' ? <Link2 size={10} /> : <Check size={10} />}
              {modoInfo.label}
              {querLembrete && <Bell size={10} className="opacity-70" />}
              <ChevronDown size={12} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
            </button>

      {emConfirm ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onCancelar(item.id)}
            disabled={saindo}
            className="h-9 px-2.5 rounded-lg bg-red-500 text-white text-xs font-semibold flex items-center gap-1 hover:bg-red-600 transition-colors"
            aria-label={`Confirmar cancelamento de ${item.descricao}`}
          >
            {saindo ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Cancelar
          </button>
          <button
            onClick={() => onPedir(null)}
            className="h-9 w-9 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors"
            aria-label="Voltar"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-0.5 flex-shrink-0 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={onEditar}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-muted-foreground
                       hover:text-foreground hover:bg-muted transition-colors"
            aria-label={`Editar ${item.descricao}`}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onPedir(item.id)}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-muted-foreground
                       hover:text-red-500 hover:bg-red-500/10 transition-colors"
            aria-label={`Cancelar ${item.descricao}`}
            title="Cancelar"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
          </div>{/* fim faixa 3: controles */}
        </div>{/* fim coluna de conteúdo */}
      </div>{/* fim linha ícone + conteúdo */}
    </div>

    {/* Sugestão de categoria pra conta fixa que ficou em "Outros". A ORIGEM
        vem escrita: "você categorizou assim 5 de 5 vezes" pesa diferente de
        "pelo nome da conta", e quem aceita com 1 clique merece saber a
        diferença. Nunca aplica sozinha — categoria mexe em relatório,
        limite e Wrapped. */}
    {sugCat && (
      <div className="mx-4 sm:mx-6 mb-3 -mt-1 flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl
                      bg-primary/[0.07] border border-primary/20 animate-fade-in">
        <Sparkles size={14} className="text-primary flex-shrink-0" />
        <p className="text-xs text-foreground flex-1 min-w-0">
          Categorizar como <strong className="font-semibold">{nomeCategoria(sugCat.sugerida)}</strong>?
          <span className="text-muted-foreground"> — {sugCat.motivo}</span>
        </p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onAceitarCat(sugCat)}
            className="h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold
                       hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => onIgnorarCat(sugCat.id)}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-muted-foreground
                       hover:bg-muted transition-colors"
            aria-label={`Ignorar sugestão para ${item.descricao}`}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    )}

    {/* Controles do vencimento. Anima a altura com grid 0fr→1fr (sem
        max-height mágico) — mesmo padrão dos chips do hero do dashboard. */}
    <div className="grid transition-all duration-300 ease-out px-4 sm:px-6"
         style={{ gridTemplateRows: aberto ? '1fr' : '0fr', opacity: aberto ? 1 : 0 }}>
      <div className="overflow-hidden">
        {aberto && (
          <div className="pb-3 pt-0.5 space-y-2.5 animate-fade-in">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                No dia {item.dia_vencimento}, a Sora deve:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MODOS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onModo(item.id, { modo_lancamento: m.id })}
                    aria-pressed={modo === m.id}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] ${
                      modo === m.id
                        ? 'bg-primary text-white shadow-glow-sm'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{modoInfo.ajuda}</p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={querLembrete}
              onClick={() => onModo(item.id, { lembrete: !querLembrete })}
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-muted/40
                         hover:bg-muted/70 transition-colors active:scale-[0.99]"
            >
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Bell size={13} className="text-muted-foreground" />
                Lembrar no WhatsApp
              </span>
              <span className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                querLembrete ? 'bg-primary' : 'bg-muted-foreground/30'
              }`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  querLembrete ? 'left-[1.125rem]' : 'left-0.5'
                }`} />
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// Form inline de adicionar recorrência (fixa ou variável)
// ─────────────────────────────────────────────────────────────
function AddForm({
  phone, contas, editItem, onCancel, onSaved,
}: {
  phone?:    string;
  contas:    Wallet[];
  /** Presente = editando esse item (tipo/valor-variável ficam travados —
   *  são estruturais; categoria/valor/dia/conta são editáveis). */
  editItem?: Recorrencia | null;
  onCancel:  () => void;
  onSaved:   () => void;
}) {
  const editando = !!editItem;
  const [tipo, setTipo]                   = useState<Tipo>(editItem?.tipo || 'Gasto');
  const [valorVariavel, setValorVariavel] = useState(!!editItem?.valor_variavel);
  const [descricao, setDescricao]         = useState(editItem?.descricao || '');
  const [valor, setValor]                 = useState(editItem?.valor ? String(editItem.valor).replace('.', ',') : '');
  const [dia, setDia]                     = useState(editItem ? String(editItem.dia_vencimento) : '5');
  const [categoria, setCategoria]         = useState(editItem?.categoria || '');
  const [cats, setCats]                   = useState<string[]>(editItem?.categoria ? [editItem.categoria] : []);
  const [salvando, setSalvando]           = useState(false);
  const [erro, setErro]                   = useState('');
  const descRef = useRef<HTMLInputElement>(null);

  // Catálogo de categorias do grupo, filtrado pelo tipo (despesa/receita) —
  // mesmo padrão do EditarTransacaoModal. Recarrega se o tipo mudar (só ao criar;
  // ao editar, tipo é fixo).
  useEffect(() => {
    if (!phone) return;
    api.categorias.listar(phone, tipo === 'Recebimento' ? 'receita' : 'despesa')
      .then((cs: any[]) => {
        const nomes = (cs || []).map((c) => c.nome).filter(Boolean);
        setCats(Array.from(new Set([editItem?.categoria, ...nomes].filter(Boolean) as string[])));
      })
      .catch(() => { /* mantém ao menos a atual */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, tipo]);

  // Contas válidas pro tipo: receita fixa não cai em cartão de crédito.
  // Garante "Dinheiro" como opção e remove duplicatas por nome.
  const opcoesContas = useMemo(() => {
    const base = tipo === 'Recebimento'
      ? contas.filter((c) => c.tipo !== 'Crédito')
      : contas;
    const nomes = base.map((c) => c.nome);
    const lista = [...base];
    if (!nomes.some((n) => n.toLowerCase() === 'dinheiro')) {
      lista.push({ id: '__dinheiro__', nome: 'Dinheiro' });
    }
    // Dedup por nome (case-insensitive), preservando ordem
    const vistos = new Set<string>();
    return lista.filter((c) => {
      const k = c.nome.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }, [contas, tipo]);

  const [carteira, setCarteira] = useState(editItem?.carteira || opcoesContas[0]?.nome || 'Dinheiro');

  // O QUE FAZER NO DIA — já na criação. Antes só dava pra escolher DEPOIS de
  // salvar (o seletor da linha), então todo previsto nascia como "Lançar" e
  // quem queria só somar custo fixo tinha de criar e corrigir em seguida.
  const [modo, setModo] = useState<ModoLancamento>(editItem?.modo_lancamento || 'lancar');

  useEffect(() => { descRef.current?.focus(); }, []);

  // Se a conta selecionada deixou de ser válida (ex.: trocou pra receita e
  // estava num cartão), volta pra primeira opção disponível.
  useEffect(() => {
    if (!opcoesContas.some((c) => c.nome === carteira)) {
      setCarteira(opcoesContas[0]?.nome || 'Dinheiro');
    }
  }, [opcoesContas, carteira]);

  const valorNum = parseFloat(valor.replace(',', '.'));
  const temValor = !isNaN(valorNum) && valorNum > 0;
  // Fixo exige valor; variável não (valor é só estimativa opcional).
  const valido = !!descricao.trim() && (valorVariavel || temValor);

  // 1–31. Dia que não existe no mês (31 em abr, 29-31 em fev) → o cron lança no
  // último dia do mês, então não trava em 28 (isso mudava a intenção calada).
  const diaLimpo = Math.max(1, Math.min(31, parseInt(dia, 10) || 5));

  async function salvar() {
    if (!valido || !phone) return;
    setErro('');
    setSalvando(true);
    try {
      if (editando && editItem) {
        const r: any = await api.recorrencias.editar(editItem.id, {
          categoria:      categoria || undefined,
          descricao:      descricao.trim(),
          valor:          temValor ? valorNum : 0,
          dia_vencimento: diaLimpo,
          carteira:       carteira || 'Dinheiro',
          modo_lancamento: modo,
        });
        // O backend propaga a categoria nova pro lançamento deste mês; sem
        // invalidar o cache, a lista de transações continuaria com a antiga.
        if (r?.propagadas) mutateGlobal(() => true, undefined, { revalidate: true });
      } else {
        await api.recorrencias.criar({
          phone,
          tipo,
          descricao:      descricao.trim(),
          valor:          temValor ? valorNum : 0,   // variável sem estimativa → 0
          dia_vencimento: diaLimpo,
          carteira:       carteira || 'Dinheiro',
          valor_variavel: valorVariavel,
          modo_lancamento: modo,
          categoria:      categoria || undefined,
        });
      }
      onSaved();
    } catch {
      setErro('Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const eixo = (
    ativo: boolean, label: string, onClick: () => void, ariaLabel?: string,
  ) => (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`px-3.5 h-9 rounded-lg text-xs font-bold transition-all ${
        ativo ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 sm:p-6 bg-muted/20 border-b border-border/60 animate-fade-in">
      {editando && (
        <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
          <Pencil size={12} /> Editando {tipo === 'Gasto' ? 'gasto' : 'receita'} {valorVariavel ? 'variável' : 'fixo'}
        </p>
      )}
      {/* Dois eixos: tipo (gasto/receita) × valor (fixo/variável) — travados ao
          editar (são estruturais; mudar isso é como criar outro item). */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className={`inline-flex p-1 rounded-xl bg-muted/60 ${editando ? 'opacity-60' : ''}`} role="group" aria-label="Tipo">
          {eixo(tipo === 'Gasto', 'Gasto', () => !editando && setTipo('Gasto'))}
          {eixo(tipo === 'Recebimento', 'Receita', () => !editando && setTipo('Recebimento'))}
        </div>
        <div className={`inline-flex p-1 rounded-xl bg-muted/60 ${editando ? 'opacity-60' : ''}`} role="group" aria-label="Valor">
          {eixo(!valorVariavel, 'Valor fixo', () => !editando && setValorVariavel(false))}
          {eixo(valorVariavel, 'Valor varia', () => !editando && setValorVariavel(true))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_92px] gap-2.5">
        <input
          ref={descRef}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valido && salvar()}
          placeholder={
            valorVariavel
              ? (tipo === 'Gasto' ? 'Ex.: Luz, Água, Cartão' : 'Ex.: Freela, Comissão')
              : (tipo === 'Gasto' ? 'Ex.: Aluguel, Netflix' : 'Ex.: Salário')
          }
          aria-label="Descrição"
          className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm
                     placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valido && salvar()}
          placeholder={valorVariavel ? 'Estimativa (opc.)' : 'R$ 0,00'}
          aria-label={valorVariavel ? 'Valor estimado (opcional)' : 'Valor'}
          className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm tabular-nums
                     placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
        <div className="flex items-center gap-1.5 px-3 h-11 rounded-xl bg-background border border-border text-sm">
          <span className="text-muted-foreground text-xs">Dia</span>
          <input
            inputMode="numeric"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            aria-label="Dia do vencimento"
            className="w-full bg-transparent focus:outline-none tabular-nums"
          />
        </div>
      </div>

      {/* Categoria — se não escolher, a Sora tenta auto-categorizar pela
          descrição (senão cai em "Outros"). Escolher aqui garante o certo. */}
      <div className="mt-2.5">
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="w-full sm:w-auto px-3.5 h-11 rounded-xl bg-background border border-border text-sm
                     focus:outline-none focus:border-primary transition-colors"
          aria-label="Categoria"
        >
          <option value="">Categoria automática (pela descrição)</option>
          {cats.map((c) => <option key={c} value={c}>{nomeCategoria(c)}</option>)}
        </select>
      </div>

      {/* Conta de origem */}
      <div className="mt-2.5">
        <select
          value={carteira}
          onChange={(e) => setCarteira(e.target.value)}
          className="w-full sm:w-auto px-3.5 h-11 rounded-xl bg-background border border-border text-sm
                     focus:outline-none focus:border-primary transition-colors"
          aria-label={tipo === 'Gasto' ? 'Conta de pagamento' : 'Conta de recebimento'}
        >
          {opcoesContas.map((c) => (
            <option key={c.id} value={c.nome}>{c.nome}</option>
          ))}
        </select>
      </div>

      {/* O QUE FAZER NO DIA — mesma escolha que a linha já oferece depois de
          salva, agora disponível desde a criação. Sem isto todo previsto
          nascia como "Lançar" e quem só queria somar custo fixo precisava
          criar e corrigir em seguida.
          Mesmo controle segmentado dos outros eixos (role=group + switch),
          pra não introduzir um terceiro padrão de seleção no mesmo formulário. */}
      <div className="mt-2.5">
        <div className="inline-flex p-1 rounded-xl bg-muted/60" role="group" aria-label="O que fazer no dia do vencimento">
          {MODOS.map((m) => eixo(modo === m.id, m.label, () => setModo(m.id), m.ajuda))}
        </div>
      </div>

      {/* Helper: explica o comportamento conforme fixo/variável (progressive disclosure) */}
      <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5 leading-relaxed">
        {/* ⚠️ O texto TEM de acompanhar o modo. Ele dizia "lanço automático"
            sempre — e depois que o modo virou escolha da criação, isso
            passaria a mentir pra quem marcasse "Só prever" ou "Não lançar". */}
        {modo === 'nao_lancar'
          ? <><CircleDashed size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
              Não lanço nada — entra só na soma dos seus custos fixos do mês.</>
          : valorVariavel
            ? <><CircleDashed size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
                Todo dia <strong className="text-foreground/80 tabular-nums">{diaLimpo}</strong> eu te lembro e você confirma o valor real{temValor ? <> (estimei <span className="tabular-nums">{fmt(valorNum)}</span>)</> : ''} — nada é debitado antes disso.</>
            : modo === 'prever'
              ? <><CircleDashed size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
                  Todo dia <strong className="text-foreground/80 tabular-nums">{diaLimpo}</strong> crio como previsto e deixo a cobrança do seu banco confirmar — assim o gasto não conta duas vezes.</>
              : <><Repeat size={14} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
                  Lanço automático todo dia <strong className="text-foreground/80 tabular-nums">{diaLimpo}</strong> com esse valor.</>}
      </p>

      {erro && <p className="text-xs text-red-500 mt-2" role="alert">{erro}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={salvar}
          disabled={!valido || salvando}
          className="flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold text-white transition-all
                     hover:-translate-y-0.5 active:translate-y-0 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
          style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {editando ? 'Salvar alterações' : 'Salvar'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 h-11 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Linha de uma DÍVIDA no card de previstos.
//
// Mesmo desenho de 3 faixas da Linha de recorrência (título+valor / meta /
// ação), pra as duas listas não parecerem componentes de telas diferentes.
// A diferença é o que ela NÃO tem: sem editar, sem modo de lançamento, sem
// excluir. A única ação é sair da previsão.
// ─────────────────────────────────────────────────────────────
// Linha de uma FATURA de cartão no card de previstos.
// Espelha a LinhaDivida: leitura + a única ação de tirar da previsão.
function LinhaCartao({ fatura, idx, mexendo, onTirar }: {
  fatura: { cartao_id: string; nome: string; restante: number; venc?: string; of?: boolean };
  idx: number;
  mexendo: boolean;
  onTirar: () => void;
}) {
  const dia = String(fatura.venc || '').slice(8, 10);
  return (
    <li className="group flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors hover:bg-muted/30 animate-fade-in"
        style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`, opacity: mexendo ? 0.5 : undefined }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
           style={{ background: 'color-mix(in srgb, #8b5cf6 13%, transparent)' }}>
        <WalletIcon size={16} style={{ color: '#8b5cf6' }} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground truncate">{fatura.nome}</p>
        <p className="text-[11px] text-muted-foreground">
          Fatura{dia ? ` · vence dia ${dia}` : ''}
        </p>
      </div>

      <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
        {fmt(Number(fatura.restante) || 0)}
      </span>

      <button
        onClick={onTirar}
        disabled={mexendo}
        title="Não contar esta fatura nos previstos do mês"
        aria-label={`Tirar a fatura do ${fatura.nome} da previsão`}
        className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 shrink-0"
      >
        {mexendo ? <Loader2 size={14} className="animate-spin" /> : <EyeOff size={14} />}
      </button>
    </li>
  );
}

function LinhaDivida({
  divida, idx, saindo, onTirar,
}: { divida: any; idx: number; saindo: boolean; onTirar: () => void }) {
  const parcelas = Number(divida.parcelas_total) || 0;
  const pagas    = Number(divida.parcelas_pagas) || 0;
  const restantes = Math.max(0, parcelas - pagas);
  const tema = getCategoriaTheme(divida.titulo);

  return (
    <li
      className="group transition-colors hover:bg-muted/30 animate-fade-in"
      style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`, opacity: saindo ? 0.5 : undefined }}
    >
      <div className="px-4 sm:px-6 py-3">
        <div className="flex items-start gap-3">
          <CategoriaIcon nome={divida.titulo} icone="💳" size={38}
            bg="#ef444418" color="#ef4444" rounded="rounded-xl" />

          <div className="flex-1 min-w-0">
            {/* 1. Título + valor da parcela */}
            <div className="flex items-start justify-between gap-3">
              <p className="text-[13px] sm:text-sm font-medium text-foreground truncate min-w-0">{divida.titulo}</p>
              <p className="flex-shrink-0 text-[13px] sm:text-sm font-bold tabular-nums inline-flex items-center gap-0.5 text-red-500">
                <ArrowDownRight size={12} />{fmt(divida.valor_parcela)}
              </p>
            </div>

            {/* 2. Quando vence, quanto falta e pra quem */}
            <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground flex-wrap">
              {divida.dia_vencimento && (
                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
                  <Calendar size={9} /> dia {divida.dia_vencimento}
                </span>
              )}
              {parcelas > 0 && (
                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
                  {restantes} de {parcelas} restantes
                </span>
              )}
              {divida.credor && <span className="truncate max-w-[55%]">· {divida.credor}</span>}
            </div>

            {/* 3. Única ação: sair da previsão (NÃO apaga a dívida) */}
            <div className="flex items-center justify-end mt-2">
              <button
                type="button"
                onClick={onTirar}
                disabled={saindo}
                aria-label={`Não contar ${divida.titulo} nos previstos do mês`}
                className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg text-[11px] font-semibold
                           text-muted-foreground hover:text-foreground hover:bg-muted transition-colors
                           disabled:opacity-50"
              >
                {saindo ? <Loader2 size={12} className="animate-spin" /> : <EyeOff size={12} />}
                Não contar aqui
              </button>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
