'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Repeat, Plus, Trash2, Loader2, Check, X, Calendar,
  ArrowDownRight, ArrowUpRight, Sparkles, CircleDashed, Pencil,
  Bell, ChevronDown, Link2, EyeOff, TrendingUp, Wallet as WalletIcon,
} from 'lucide-react';
import { api, type ModoLancamentoFixo, type SugestaoCategoriaFixa } from '@/lib/api';
import { mutate as mutateGlobal } from 'swr';
import FormRecorrencia from '@/components/previstos/FormRecorrencia';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import { calcularSaldoProjetado, diaHojeSP } from '@/lib/saldo-projetado';
import { ocorrenciasNoMes } from '@/lib/frequencia-recorrencia';

const BRAND = 'hsl(var(--primary))';

/** Mês corrente em SP ('YYYY-MM'). Nunca `toISOString()` — é UTC, e depois
 *  das 21h no Brasil o mês pode virar. */
const mesRefSP = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);

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
  // Migration 157. Ausentes = mensal e pra sempre, o comportamento de sempre.
  frequencia?:      'semanal' | 'mensal' | 'anual' | null;
  dia_semana?:      number | null;
  mes_vencimento?:  number | null;
  repeticoes?:      number | null;
  data_inicio?:     string | null;
  data_fim?:        string | null;
  lembrete_dias?:   number | null;
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

  // ── SEÇÃO RECOLHIDA POR PADRÃO, TODA VISITA ─────────────────────────────
  //
  // A seção acumulou fixos, variáveis, cartões, dívidas e sugestões, e virou
  // a maior parte da aba Transações — que é a aba das TRANSAÇÕES. Recolhida,
  // ela mostra o resumo e sai da frente; o detalhe completo tem aba própria.
  //
  // ⚠️ A ESCOLHA NÃO É MAIS LEMBRADA, e isso é o conserto. A versão anterior
  // gravava em `localStorage`, então UM toque pra espiar a lista deixava o
  // card aberto PARA SEMPRE — e o "minimizado por padrão" valia só pra quem
  // nunca tinha aberto. Na prática o card voltou a tomar a aba de quem já
  // usava o app, que é exatamente o que a mudança existia pra evitar.
  //
  // Sem storage também some o motivo de existir o `useLayoutEffect`: servidor
  // e cliente desenham o mesmo estado, então não há hydration mismatch — e o
  // HTML do servidor deixa de carregar a lista inteira que ninguém vai ver.
  const [recolhida, setRecolhida] = useState(true);
  const alternarRecolhida = useCallback(() => setRecolhida((v) => !v), []);
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

  // ⚠️ `× ocorrenciasNoMes`: com a migration 157 a conta fixa pode ser
  // semanal (cai 4 ou 5 vezes) ou anual (não cai neste mês). Somar o valor
  // cru, como era, dizia "R$ 150/mês" pra uma diarista de R$ 150 por SEMANA
  // e cobrava o IPVA todo mês — nos dois casos um número plausível e errado
  // logo abaixo do título da seção.
  const totalGastos   = useMemo(
    () => itens.filter((i) => i.tipo === 'Gasto')
      .reduce((s, i) => s + ((i.valor || 0) * ocorrenciasNoMes(i, mesRefSP())), 0)
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
            onClick={() => setFormTarget('novo')}
            className="flex items-center gap-1.5 px-3 h-11 rounded-xl text-sm font-semibold transition-all
                       hover:-translate-y-0.5 active:translate-y-0 flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)`, color: BRAND }}
            aria-haspopup="dialog"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
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

      {/* ── Form de adicionar/editar ──────────────────────────────────────
          ⚠️ FORA do bloco recolhível. Ele é um sheet em portal (o card usa
          `backdrop-blur`, então `fixed` preso aqui dentro ficaria ATRÁS do
          conteúdo), e o botão que o abre vive no cabeçalho — que continua
          visível com a seção recolhida. Deixá-lo lá dentro fazia "Adicionar"
          não abrir nada quando a seção estava fechada, que é o padrão. */}
      {formTarget && (
        <FormRecorrencia
          phone={phone}
          contas={wallets}
          editItem={formTarget === 'novo' ? null : formTarget}
          onCancel={() => setFormTarget(null)}
          onSaved={() => { setFormTarget(null); carregar(); }}
        />
      )}

      {/* Tudo daqui pra baixo é o conteúdo recolhível.
          Render CONDICIONAL em vez de esconder por CSS: a lista tem N itens,
          cada um com ícone e estado próprio — mantê-los montados só pra ficarem
          invisíveis é trabalho à toa justo na aba mais pesada do painel.
          Por isso não animo a altura: `0fr→1fr` exigiria o conteúdo montado. */}
      {!recolhida && (
      <div id="previstos-conteudo">


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
              {/* REMOVIDO A PEDIDO (ago/2026): o parágrafo "Gerencie as dívidas
                  na aba Dívidas...". O caminho pra aba agora está nos próprios
                  ícones de editar/excluir de cada linha, que levam pra lá. */}
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

              {/* REMOVIDO A PEDIDO (ago/2026): o parágrafo "Valor da fatura ainda
                  em aberto, igual à aba Cartão de crédito. Fatura paga sai daqui
                  sozinha." Ocupava três linhas num card já denso, e o previsto de
                  cartão já se identifica pelo nome + pelo chip "fatura em aberto"
                  logo acima. */}
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
              {/* Subtítulo "custo fixo do mês inteiro" REMOVIDO a pedido: o
                  contraste com o "ainda falta sair" ao lado já diz que um é o
                  mês todo e o outro é o que resta. */}
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Total previsto
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
          {/* ─── FAIXA 1: nome · "já passou" ······ valor ────────────────
              ⚠️ `items-center`, NÃO `items-start`: o chip tem padding próprio e
              o nome tem line-height; encostados no topo eles nunca alinham — foi
              a causa do desalinhamento que aparecia só em alguns itens.

              O SÍMBOLO DO MODO SAIU DAQUI a pedido: lançar/prever/não lançar só
              aparecem na edição. O estado deixa de ser visível de relance, o que
              é uma troca consciente por uma linha mais limpa.

              No lugar dele entrou o "já passou", que responde a pergunta que a
              pessoa realmente faz ao correr o olho pela lista: isso ainda vem ou
              já foi? Fica menor que o nome de propósito — é qualificador, não
              título. */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <p className="min-w-0 truncate text-[12.5px] sm:text-sm font-medium text-foreground leading-none">
                {item.descricao}
              </p>
              {/* Ícone + TEXTO no desktop, nunca só a cor — quem não distingue
                  tons precisa LER que já passou. No mobile fica só o ✓, com
                  `aria-label` mantendo o nome acessível. */}
              {jaPassou && (
                /* ⚠️ SEM CAIXA NO MOBILE: so o ✓ verde. A pilula existia pra
                   segurar o texto "ja passou"; sem o texto ela virava moldura de
                   um icone de 9px, que so somava ruido numa linha ja apertada.
                   No desktop, onde o texto aparece, a caixa volta (`sm:`).
                   O nome acessivel fica no aria-label nos dois casos — icone
                   sozinho nao e rotulo. */
                <span className="flex-shrink-0 inline-flex items-center gap-0.5 sm:gap-1 rounded-md leading-none
                                 text-[9px] sm:text-[10px] font-medium text-emerald-600 dark:text-emerald-400
                                 sm:px-1.5 sm:py-px sm:bg-emerald-500/[0.13] sm:text-emerald-700 sm:dark:text-emerald-400"
                      aria-label="já passou" title="já passou">
                  <Check size={11} className="sm:w-[9px] sm:h-[9px]" /> <span className="hidden sm:inline">já passou</span>
                </span>
              )}
            </div>

            {semEstimativa ? (
              <p className="flex-shrink-0 text-[12.5px] sm:text-sm font-semibold tabular-nums inline-flex items-center gap-1 leading-none text-muted-foreground">
                <CircleDashed size={11} /> a definir
              </p>
            ) : (
              <p className={`flex-shrink-0 text-[12.5px] sm:text-sm font-bold tabular-nums inline-flex items-center gap-0.5 leading-none ${ehGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                {ehGasto ? <ArrowDownRight size={11} /> : <ArrowUpRight size={11} />}
                {ehVariavel ? '~' : ''}{fmt(item.valor)}
              </p>
            )}
          </div>

          {/* ─── FAIXA 2: dia · conta ······ editar · excluir ─────────────────
              As ações vivem AQUI, na escala dos metadados, e não na faixa do
              valor: ao lado de um número em vermelho e negrito, dois ícones de
              14px disputavam a atenção com o que a pessoa veio ler. Aqui elas
              ficam à mão e em segundo plano, que é o peso certo pra "editar". */}
          <div className="flex items-center gap-1 sm:gap-1.5 mt-1 text-[10px] sm:text-xs text-muted-foreground">
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 flex-wrap">
              <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
                <Calendar size={9} /> dia {item.dia_vencimento}
              </span>
              {/* "estimado" REMOVIDO a pedido. O "~" na frente do valor já
                  marca que é estimativa, e o cabeçalho da seção diz "você
                  confirma no dia" — o chip repetia a mesma informação uma
                  terceira vez. */}
              {item.carteira && <span className="truncate">· {item.carteira}</span>}
            </div>

            {emConfirm ? (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => onCancelar(item.id)}
                  disabled={saindo}
                  className="h-6 px-2 rounded-md bg-red-500 text-white text-[10px] font-semibold flex items-center gap-1 hover:bg-red-600 transition-colors"
                  aria-label={`Confirmar cancelamento de ${item.descricao}`}
                >
                  {saindo ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Cancelar
                </button>
                <button
                  onClick={() => onPedir(null)}
                  className="h-6 w-6 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors"
                  aria-label="Voltar"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              /* ⚠️ `-my-2 py-2` devolve os 40px de alvo tocável que o ícone de
                 12px não tem sozinho. O botão parece pequeno; a área não é. */
              <div className="flex items-center gap-0.5 flex-shrink-0 -my-2 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100">
                <button
                  onClick={onEditar}
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={`Editar ${item.descricao}`}
                  title="Editar"
                >
                  <Pencil className="w-[11px] h-[11px] sm:w-3 sm:h-3" />
                </button>
                <button
                  onClick={() => onPedir(item.id)}
                  className="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  aria-label={`Cancelar ${item.descricao}`}
                  title="Cancelar"
                >
                  <Trash2 className="w-[11px] h-[11px] sm:w-3 sm:h-3" />
                </button>
              </div>
            )}
          </div>

          {/* 3. Pílula com o rótulo por extenso — SÓ com o painel aberto.
              Fechado, quem mostra o estado é o símbolo lá em cima, e esta faixa
              inteira deixa de existir. */}
          {aberto && (
          <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
            <button
              type="button"
              onClick={() => setAberto((v) => !v)}
              aria-expanded={aberto}
              aria-label={`Fechar opções de lançamento de ${item.descricao}`}
              className={`inline-flex items-center gap-1 pl-2 pr-1.5 sm:pl-2.5 sm:pr-2 h-8 sm:h-9
                          rounded-lg text-[10px] sm:text-[11px] font-semibold
                          whitespace-nowrap flex-shrink-0 transition-colors active:scale-[0.98] ${
                modo === 'nao_lancar'
                  ? 'bg-muted/70 text-muted-foreground hover:bg-muted'
                  : modo === 'prever'
                    ? 'bg-amber-500/12 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                    : 'bg-primary/12 text-primary hover:bg-primary/20'
              }`}
            >
              {modo === 'nao_lancar' ? <CircleDashed size={10} /> : modo === 'prever' ? <Link2 size={10} /> : <Bell size={10} />}
              {modoInfo.label}
              <ChevronDown size={12} className="rotate-180" />
            </button>
          </div>
          )}
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

// ⚠️ O `AddForm` que morava AQUI virou `components/previstos/FormRecorrencia`.
// Ele agora é usado pela aba Previstos também, e manter uma cópia em cada
// tela garantiria que as duas passassem a salvar campos diferentes — um bug
// que ninguém reporta, só sente ('criei pelo outro lugar e não ficou igual').

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
    <li className="group flex items-center gap-2.5 sm:gap-3 px-3 sm:px-6 py-2.5 sm:py-3 transition-colors hover:bg-muted/30 animate-fade-in"
        style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`, opacity: mexendo ? 0.5 : undefined }}>
      {/* ⚠️ MESMA ESCALA DAS OUTRAS LINHAS. Esta usava ícone de 36px, nome em
          `text-sm font-semibold` e valor em `text-sm` — enquanto gasto fixo e
          dívida usam 32px e `text-[12.5px] font-medium`. Lado a lado no mesmo
          card, o cartão parecia de outra tela. */}
      {/* ⚠️ ICONE OFICIAL DO BANCO, nao a carteira generica. `CategoriaIcon`
          casa o nome da carteira com o catalogo de marcas (`marcaDe`), entao
          "Nubank Ultravioleta" acha /brands/nubank.png. Era a mesma logica que
          as outras linhas ja usavam — so esta ficou com o icone roxo padrao,
          e por isso o cartao nao parecia do mesmo banco que a conta logo acima.
          Sem marca conhecida, o proprio CategoriaIcon cai no emoji de carteira. */}
      <div className="w-[32px] sm:w-[38px] flex-shrink-0">
        <div className="scale-[0.842] sm:scale-100 origin-top-left">
          <CategoriaIcon nome={fatura.nome} icone="💳" size={38}
            bg="color-mix(in srgb, #8b5cf6 13%, transparent)" color="#8b5cf6" rounded="rounded-xl" />
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="min-w-0 truncate text-[12.5px] sm:text-sm font-medium text-foreground leading-none">
            {fatura.nome}
          </p>
          <span className="flex-shrink-0 text-[12.5px] sm:text-sm font-bold tabular-nums text-foreground ml-auto leading-none">
            {fmt(Number(fatura.restante) || 0)}
          </span>
        </div>

        {/* A ação vive na MESMA linha de "Fatura · vence dia 10" e no tamanho
            dela — igual às linhas de gasto fixo. `-my-2 p-2` devolve os 40px de
            alvo tocável que um ícone de 11px não tem sozinho. */}
        <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-xs text-muted-foreground">
          <span className="flex-1 min-w-0 truncate">Fatura{dia ? ` · vence dia ${dia}` : ''}</span>
          <button
            onClick={onTirar}
            disabled={mexendo}
            title="Não contar esta fatura nos previstos do mês"
            aria-label={`Tirar a fatura do ${fatura.nome} da previsão`}
            className="flex-shrink-0 -my-2 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 disabled:opacity-50"
          >
            {mexendo
              ? <Loader2 className="w-[11px] h-[11px] sm:w-3 sm:h-3 animate-spin" />
              : <EyeOff className="w-[11px] h-[11px] sm:w-3 sm:h-3" />}
          </button>
        </div>
      </div>
    </li>
  );
}

// ⚠️ `onTirar` segue na assinatura de propósito. O botão "Não contar aqui" saiu
// da TELA a pedido, mas `tirarDosPrevistos` continua sendo o único caminho pra
// excluir uma dívida da previsão SEM apagá-la — arrancar o prop junto obrigaria
// a reescrever o fluxo caso o botão volte.
function LinhaDivida({
  divida, idx, saindo, onTirar,
}: { divida: any; idx: number; saindo: boolean; onTirar?: () => void }) {
  void onTirar;
  const parcelas = Number(divida.parcelas_total) || 0;
  const pagas    = Number(divida.parcelas_pagas) || 0;
  const restantes = Math.max(0, parcelas - pagas);
  const tema = getCategoriaTheme(divida.titulo);

  return (
    <li
      className="group transition-colors hover:bg-muted/30 animate-fade-in"
      style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`, opacity: saindo ? 0.5 : undefined }}
    >
      <div className="px-3 sm:px-6 py-2.5 sm:py-3">
        <div className="flex items-start gap-2.5 sm:gap-3">
          {/* ⚠️ MESMO WRAPPER DE ESCALA DAS OUTRAS LINHAS. Esta ficou pra tras
              na compactacao e seguia com o icone cheio (38px), o que a fazia
              parecer maior que gasto fixo e cartao no mesmo card. */}
          <div className="w-[32px] sm:w-[38px] flex-shrink-0">
            <div className="scale-[0.842] sm:scale-100 origin-top-left">
              <CategoriaIcon nome={divida.titulo} icone="💳" size={38}
                bg="#ef444418" color="#ef4444" rounded="rounded-xl" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {/* 1. Título + valor da parcela */}
            <div className="flex items-center gap-1.5">
              <p className="flex-1 min-w-0 truncate text-[12.5px] sm:text-sm font-medium text-foreground leading-none">{divida.titulo}</p>
              <p className="flex-shrink-0 text-[13px] sm:text-sm font-bold tabular-nums inline-flex items-center gap-0.5 text-red-500">
                <ArrowDownRight size={12} />{fmt(divida.valor_parcela)}
              </p>
            </div>

            {/* 2. Quando vence, quanto falta, pra quem — e as ações, na MESMA
                escala dos metadados (igual às linhas de gasto fixo). */}
            <div className="flex items-center gap-1 sm:gap-1.5 mt-1 text-[10px] sm:text-xs text-muted-foreground">
              <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1 flex-wrap">
              {divida.dia_vencimento && (
                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
                  <Calendar size={9} /> dia {divida.dia_vencimento}
                </span>
              )}
              {parcelas > 0 && (
                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-px sm:py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
                  {restantes}/{parcelas}
                </span>
              )}
                {divida.credor && <span className="truncate">· {divida.credor}</span>}
              </div>

              {/* ⚠️ DÍVIDA NÃO SE EDITA NEM SE APAGA AQUI. Estes dois ícones
                  LEVAM pra aba Dívidas, que é a dona do registro — apagar por
                  aqui seria destruir parcelas, histórico de pagamento e foto a
                  partir de um card de previsão, que existe só pra somar o mês.
                  Por isso são <a>, não <button>: o alvo é uma NAVEGAÇÃO, e
                  precisa se comportar como link (abrir em nova aba, mostrar o
                  destino na barra de status). O `title` diz pra onde vai. */}
              <div className="flex items-center gap-0.5 flex-shrink-0 -my-2 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100">
                <a
                  href="/dividas"
                  className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={`Editar ${divida.titulo} na aba Dívidas`}
                  title="Editar na aba Dívidas"
                >
                  <Pencil className="w-[11px] h-[11px] sm:w-3 sm:h-3" />
                </a>
                <a
                  href="/dividas"
                  className="p-2 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  aria-label={`Excluir ${divida.titulo} na aba Dívidas`}
                  title="Excluir na aba Dívidas"
                >
                  <Trash2 className="w-[11px] h-[11px] sm:w-3 sm:h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
