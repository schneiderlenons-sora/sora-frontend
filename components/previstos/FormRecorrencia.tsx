'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, Loader2, Repeat, CircleDashed, Bell, BellOff, CalendarDays, Pencil,
} from 'lucide-react';
import { mutate as mutateGlobal } from 'swr';
import { api, type ModoLancamentoFixo } from '@/lib/api';
import { nomeCategoria } from '@/lib/categorias';
import { calcularDataFim, hojeSP, type Frequencia } from '@/lib/frequencia-recorrencia';

/**
 * Formulário de conta fixa — frequência, duração e antecedência do aviso.
 *
 * ⚠️ É FOLHA ÚNICA, usada pela aba Previstos E pela seção da aba Transações.
 * Nasceu de um `AddForm` que morava dentro do `GastosFixosSection`; deixar uma
 * cópia lá e outra aqui garantiria divergência no primeiro ajuste — e um
 * formulário que salva campos diferentes conforme a tela de onde foi aberto é
 * um bug que ninguém reporta, só sente.
 *
 * ⚠️ `createPortal` PARA O BODY, não negociável: os cards do painel usam
 * `backdrop-blur`, e um ancestral com `backdrop-filter` vira o containing block
 * de `position: fixed` — o sheet ficaria preso e ATRÁS do card. z-index não
 * resolve. (Memória `feedback-modal-portal-backdrop-blur`.)
 *
 * Sheet por baixo no celular e diálogo centrado no desktop: a mão alcança o
 * rodapé no telefone, e é lá que fica a ação principal.
 */

const BRAND = 'hsl(var(--primary))';

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const DIAS_SEMANA = [
  { id: 0, curto: 'D', nome: 'domingo' },
  { id: 1, curto: 'S', nome: 'segunda-feira' },
  { id: 2, curto: 'T', nome: 'terça-feira' },
  { id: 3, curto: 'Q', nome: 'quarta-feira' },
  { id: 4, curto: 'Q', nome: 'quinta-feira' },
  { id: 5, curto: 'S', nome: 'sexta-feira' },
  { id: 6, curto: 'S', nome: 'sábado' },
];

const FREQUENCIAS: { id: Frequencia; label: string }[] = [
  { id: 'semanal', label: 'Semanal' },
  { id: 'mensal',  label: 'Mensal' },
  { id: 'anual',   label: 'Anual' },
];

/** `null` = para sempre. É o default — e o comportamento de toda conta fixa
 *  que já existe, então quem não mexer aqui não sente diferença nenhuma. */
const DURACOES: { id: number | null; label: string }[] = [
  { id: null, label: 'Sempre' },
  { id: 3,    label: '3x' },
  { id: 6,    label: '6x' },
  { id: 12,   label: '12x' },
  { id: 24,   label: '24x' },
];

const AVISOS: { id: number; label: string; ajuda: string }[] = [
  { id: 0, label: 'No dia',  ajuda: 'Aviso no próprio dia do vencimento' },
  { id: 1, label: '1 dia',   ajuda: 'Aviso 1 dia antes' },
  { id: 3, label: '3 dias',  ajuda: 'Aviso 3 dias antes' },
  { id: 5, label: '5 dias',  ajuda: 'Aviso 5 dias antes' },
  { id: 7, label: '7 dias',  ajuda: 'Aviso 7 dias antes' },
];

const MODOS: { id: ModoLancamentoFixo; label: string; ajuda: string }[] = [
  { id: 'lancar',     label: 'Lançar',     ajuda: 'Cria a transação já paga e desconta do saldo.' },
  { id: 'prever',     label: 'Só prever',  ajuda: 'Cria como previsto e deixa a cobrança do seu banco confirmar o valor. Evita o gasto contar duas vezes.' },
  { id: 'nao_lancar', label: 'Não lançar', ajuda: 'Não cria nada. Serve só pra você somar seus custos fixos.' },
];

export type Tipo = 'Gasto' | 'Recebimento';

export type RecorrenciaForm = {
  id:             string;
  tipo:           Tipo;
  valor:          number;
  dia_vencimento: number;
  descricao:      string;
  carteira:       string | null;
  categoria:      string | null;
  valor_variavel?: boolean;
  modo_lancamento?: ModoLancamentoFixo;
  lembrete?:        boolean;
  // Migration 157.
  frequencia?:     Frequencia | null;
  dia_semana?:     number | null;
  mes_vencimento?: number | null;
  repeticoes?:     number | null;
  data_fim?:       string | null;
  lembrete_dias?:  number | null;
};

type Wallet = { id: string; nome: string; tipo?: string; saldo?: number };

// ─────────────────────────────────────────────────────────────────────────────
// Controles reutilizados — um só padrão de seleção no formulário inteiro.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grupo de escolha única.
 *
 * ⚠️ `radiogroup`/`radio`, não `switch`. Switch descreve um liga-desliga
 * independente; num leitor de tela, cinco switches num grupo soam como cinco
 * opções que podem estar todas ligadas ao mesmo tempo.
 */
function Pills<T>({
  label, valor, opcoes, onChange, colunas, labelOculto,
}: {
  label: string;
  valor: T;
  opcoes: { id: T; label: string; ajuda?: string }[];
  onChange: (v: T) => void;
  /** Quando presente, vira grid — é o que evita 7 pílulas espremidas em 375px. */
  colunas?: number;
  /** Some da tela mas continua no leitor de tela: use quando o bloco de fora
   *  já nomeia a escolha e o rótulo repetido vira ruído visual. */
  labelOculto?: boolean;
}) {
  // ⚠️ MEDIDO A 375px: o sheet tem 335px úteis; com 5 colunas e `px-3` sobram
  // ~34px de conteúdo e "No dia" e "Sempre" quebram em duas linhas. Daí o
  // padding e o corpo menores a partir de 4 colunas.
  const apertado = (colunas || 0) >= 4;
  return (
    <div>
      <p className={`text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2 ${
        labelOculto ? 'sr-only' : ''
      }`}>{label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        className={colunas ? 'grid gap-1.5' : 'flex flex-wrap gap-1.5'}
        style={colunas ? { gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` } : undefined}
      >
        {opcoes.map((o) => {
          const ativo = o.id === valor;
          return (
            <button
              key={String(o.id)}
              type="button"
              role="radio"
              aria-checked={ativo}
              title={o.ajuda}
              aria-label={o.ajuda}
              onClick={() => onChange(o.id)}
              className={`${apertado ? 'px-1.5 text-[12px]' : 'px-3 text-[13px]'} rounded-xl font-bold
                          transition-all duration-200 motion-safe:active:scale-[0.97] ${
                ativo
                  ? 'text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted/70'
              }`}
              style={{
                minHeight: 44,
                background: ativo ? BRAND : undefined,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Campo de texto com rótulo VISÍVEL (placeholder não é rótulo). */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-3.5 rounded-xl bg-background border border-border text-sm ' +
  'placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary ' +
  'focus-visible:ring-2 focus-visible:ring-primary/40 transition-colors';

// ─────────────────────────────────────────────────────────────────────────────

export default function FormRecorrencia({
  phone, contas, editItem, onCancel, onSaved,
}: {
  phone?:    string;
  contas:    Wallet[];
  /** Presente = editando. Tipo e valor-fixo/variável ficam travados: são
   *  estruturais, e mudá-los é criar outra conta fixa, não editar esta. */
  editItem?: RecorrenciaForm | null;
  onCancel:  () => void;
  onSaved:   () => void;
}) {
  const editando = !!editItem;

  // SSR não tem `document` — sem esta guarda o portal quebra na hidratação.
  const [montado, setMontado] = useState(false);
  // Um frame depois de montar, pra o fundo TRANSICIONAR em vez de aparecer
  // pronto (ver a nota no `<button>` do fundo).
  const [entrou, setEntrou] = useState(false);
  useEffect(() => {
    setMontado(true);
    const r = requestAnimationFrame(() => setEntrou(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const [tipo, setTipo]                   = useState<Tipo>(editItem?.tipo || 'Gasto');
  const [valorVariavel, setValorVariavel] = useState(!!editItem?.valor_variavel);
  const [descricao, setDescricao]         = useState(editItem?.descricao || '');
  // Valor em CENTAVOS: digitar num teclado numérico é mais rápido e não tem
  // como produzir "12.34,5". A máscara formata na saída.
  const [centavos, setCentavos]           = useState(Math.round((editItem?.valor || 0) * 100));
  const [dia, setDia]                     = useState(editItem ? String(editItem.dia_vencimento) : '5');
  const [categoria, setCategoria]         = useState(editItem?.categoria || '');
  const [cats, setCats]                   = useState<string[]>(editItem?.categoria ? [editItem.categoria] : []);
  const [modo, setModo]                   = useState<ModoLancamentoFixo>(editItem?.modo_lancamento || 'lancar');

  // Migration 157.
  const [frequencia, setFrequencia] = useState<Frequencia>(editItem?.frequencia || 'mensal');
  const [diaSemana, setDiaSemana]   = useState<number>(editItem?.dia_semana ?? 1);
  const [mesVenc, setMesVenc]       = useState<number>(editItem?.mes_vencimento ?? 1);
  const [repeticoes, setRepeticoes] = useState<number | null>(editItem?.repeticoes ?? null);
  const [avisoDias, setAvisoDias]   = useState<number>(editItem?.lembrete_dias ?? 0);
  const [querAviso, setQuerAviso]   = useState<boolean>(editItem?.lembrete !== false);

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro]         = useState('');
  const [sujo, setSujo]         = useState(false);
  const descRef  = useRef<HTMLInputElement>(null);
  const valorRef = useRef<HTMLInputElement>(null);

  const marcar = <T,>(set: (v: T) => void) => (v: T) => { setSujo(true); set(v); };

  // Catálogo de categorias do grupo, filtrado pelo tipo. Recarrega quando o
  // tipo muda (só ao criar — ao editar o tipo é fixo).
  useEffect(() => {
    if (!phone) return;
    api.categorias.listar(phone, tipo === 'Recebimento' ? 'receita' : 'despesa')
      .then((cs: { nome?: string }[]) => {
        const nomes = (cs || []).map((c) => c.nome).filter(Boolean) as string[];
        setCats(Array.from(new Set([editItem?.categoria, ...nomes].filter(Boolean) as string[])));
      })
      .catch(() => { /* mantém ao menos a atual */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, tipo]);

  // Receita fixa não cai em cartão de crédito. Garante "Dinheiro" e remove
  // nomes repetidos (o seletor casa por NOME, não por id).
  const opcoesContas = useMemo(() => {
    const base = tipo === 'Recebimento' ? contas.filter((c) => c.tipo !== 'Crédito') : contas;
    const lista = [...base];
    if (!base.some((c) => c.nome.toLowerCase() === 'dinheiro')) {
      lista.push({ id: '__dinheiro__', nome: 'Dinheiro' });
    }
    const vistos = new Set<string>();
    return lista.filter((c) => {
      const k = c.nome.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
  }, [contas, tipo]);

  const [carteira, setCarteira] = useState(editItem?.carteira || opcoesContas[0]?.nome || 'Dinheiro');

  useEffect(() => {
    if (!opcoesContas.some((c) => c.nome === carteira)) {
      setCarteira(opcoesContas[0]?.nome || 'Dinheiro');
    }
  }, [opcoesContas, carteira]);

  // Foco: no valor ao criar (é o primeiro dado que a pessoa tem na cabeça),
  // na descrição ao editar (o valor já está lá).
  useEffect(() => {
    const t = setTimeout(() => (editando ? descRef : valorRef).current?.focus(), 60);
    return () => clearTimeout(t);
  }, [editando]);

  // Trava a rolagem do fundo enquanto o sheet está aberto — sem isso, rolar
  // dentro dele "vaza" pra página no iOS e a lista de trás anda sozinha.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  const valorNum = centavos / 100;
  const temValor = centavos > 0;
  const valido = !!descricao.trim() && (valorVariavel || temValor);

  // 1–31. Dia que não existe no mês (31 em abril, 29–31 em fevereiro) faz o
  // cron lançar no ÚLTIMO dia — por isso não trava em 28: travar mudaria a
  // intenção da pessoa em silêncio.
  const diaLimpo = Math.max(1, Math.min(31, parseInt(dia, 10) || 5));

  function fechar() {
    // ⚠️ Só confirma se houve mudança. Perguntar "descartar?" num formulário
    // intocado treina a pessoa a clicar "sim" sem ler — e aí o dia em que a
    // pergunta importa ela também não lê.
    if (sujo && !window.confirm('Descartar as alterações?')) return;
    onCancel();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sujo]);

  // ── Frase do que vai acontecer ────────────────────────────────────────────
  // Ela existe porque frequência + duração + aviso são três escolhas que só
  // fazem sentido juntas: "semanal, 12x, 3 dias antes" não se lê em pílulas.
  // ⚠️ `diaSemana`/`mesVencimento` entram no cálculo: sem eles a data final
  // conta a partir de HOJE em vez da primeira ocorrência, e a tela prometeria
  // um mês diferente do que o servidor grava.
  const fim = useMemo(() => calcularDataFim({
    frequencia, repeticoes, dataInicio: hojeSP(), diaVencimento: diaLimpo,
    diaSemana, mesVencimento: mesVenc,
  }), [frequencia, repeticoes, diaLimpo, diaSemana, mesVenc]);

  const quando = frequencia === 'semanal'
    ? `toda ${DIAS_SEMANA[diaSemana]?.nome}`
    : frequencia === 'anual'
      ? `todo dia ${diaLimpo} de ${MESES[mesVenc - 1]}`
      : `todo dia ${diaLimpo}`;

  const duracaoTxt = !repeticoes
    ? 'sem data pra acabar'
    : fim
      ? `${repeticoes}x — termina em ${MESES[Number(fim.slice(5, 7)) - 1]} de ${fim.slice(0, 4)}`
      : `${repeticoes}x`;

  async function salvar() {
    if (!valido || !phone) return;
    setErro('');
    setSalvando(true);
    const comum = {
      descricao:      descricao.trim(),
      valor:          temValor ? valorNum : 0,
      dia_vencimento: diaLimpo,
      carteira:       carteira || 'Dinheiro',
      modo_lancamento: modo,
      categoria:      categoria || undefined,
      frequencia,
      dia_semana:     frequencia === 'semanal' ? diaSemana : null,
      mes_vencimento: frequencia === 'anual' ? mesVenc : null,
      repeticoes:     repeticoes ?? null,
      lembrete:       querAviso,
      lembrete_dias:  querAviso ? avisoDias : 0,
    };
    try {
      if (editando && editItem) {
        const r: { propagadas?: number } = await api.recorrencias.editar(editItem.id, comum);
        // O backend propaga a categoria nova pro lançamento deste mês; sem
        // invalidar, a lista de transações continuaria com a antiga.
        if (r?.propagadas) mutateGlobal(() => true, undefined, { revalidate: true });
      } else {
        await api.recorrencias.criar({ phone, tipo, valor_variavel: valorVariavel, ...comum });
      }
      onSaved();
    } catch {
      setErro('Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (!montado) return null;

  const corpo = (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={editando ? 'Editar conta fixa' : 'Nova conta fixa'}
    >
      {/* Fundo: escurece e desfoca — o desfoque é o sinal de que tocar aqui sai.

          ⚠️ TRANSIÇÃO DE OPACIDADE, não o keyframe `fade-in` da casa: aquele
          keyframe também desloca 8px no eixo Y, e num elemento que cobre a
          tela inteira isso abre uma faixa sem escurecimento no topo durante a
          animação. Aqui só a opacidade muda. */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={fechar}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200"
        style={{ opacity: entrou ? 1 : 0 }}
      />

      <div
        className="relative w-full sm:max-w-lg max-h-[92dvh] sm:max-h-[88dvh] flex flex-col
                   rounded-t-3xl sm:rounded-3xl border border-border/60 bg-card shadow-2xl
                   motion-safe:animate-[slide-up_280ms_cubic-bezier(0.22,1,0.36,1)_both]"
      >
        {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 sm:px-6 pt-4 pb-3 border-b border-border/50">
          {/* Alça: no celular ela é o que diz "isto arrasta/fecha". */}
          <div className="absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
          <div className="min-w-0 flex-1 mt-1 sm:mt-0">
            <h2 className="text-base font-bold text-foreground leading-tight">
              {editando ? 'Editar conta fixa' : 'Nova conta fixa'}
            </h2>
            <p className="text-[11.5px] text-muted-foreground leading-snug">
              {editando
                ? <><Pencil className="inline w-3 h-3 mr-1 -mt-0.5" />{tipo === 'Gasto' ? 'Gasto' : 'Receita'} {valorVariavel ? 'de valor variável' : 'fixa'}</>
                : 'Algo que se repete — assinatura, aluguel, salário, IPVA.'}
            </p>
          </div>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            className="flex-shrink-0 grid place-items-center rounded-xl text-muted-foreground
                       hover:text-foreground hover:bg-muted/60 transition-colors"
            style={{ width: 44, height: 44 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Corpo rolável ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-5">
          {/* Tipo — travado ao editar (estrutural). */}
          <Pills
            label={editando ? 'Tipo (não muda depois de criado)' : 'Gasto ou receita'}
            valor={tipo}
            opcoes={[{ id: 'Gasto' as Tipo, label: 'Gasto' }, { id: 'Recebimento' as Tipo, label: 'Receita' }]}
            onChange={(v) => { if (!editando) { setSujo(true); setTipo(v); } }}
            colunas={2}
          />

          {/* ── Valor: o herói da tela ────────────────────────────────────
              Número grande e tabular. É o dado que a pessoa veio digitar; tudo
              o mais no formulário tem um padrão razoável, este não tem. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {valorVariavel ? 'Estimativa (opcional)' : 'Valor'}
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={valorVariavel}
                disabled={editando}
                onClick={() => { setSujo(true); setValorVariavel((v) => !v); }}
                className={`text-[11.5px] font-bold px-2.5 h-8 rounded-lg transition-colors ${
                  valorVariavel ? 'text-amber-600 bg-amber-500/12' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {valorVariavel ? '~ o valor varia' : 'o valor varia?'}
              </button>
            </div>
            <div
              className="flex items-baseline gap-2 px-4 py-3 rounded-2xl border transition-colors"
              style={{
                borderColor: temValor ? `color-mix(in srgb, ${BRAND} 40%, transparent)` : 'hsl(var(--border))',
                background: temValor ? `color-mix(in srgb, ${BRAND} 6%, transparent)` : 'hsl(var(--bg-muted) / 0.35)',
              }}
            >
              <span className="text-lg font-bold text-muted-foreground">R$</span>
              <input
                ref={valorRef}
                inputMode="numeric"
                value={centavos ? (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}
                onChange={(e) => {
                  setSujo(true);
                  const digitos = e.target.value.replace(/[^0-9]/g, '').slice(0, 11);
                  setCentavos(Number(digitos) || 0);
                }}
                placeholder="0,00"
                aria-label={valorVariavel ? 'Valor estimado' : 'Valor'}
                className="flex-1 min-w-0 bg-transparent text-3xl font-bold tabular-nums text-foreground
                           placeholder:text-muted-foreground/35 focus:outline-none"
              />
            </div>
          </div>

          <Campo label="O que é">
            <input
              ref={descRef}
              value={descricao}
              onChange={(e) => { setSujo(true); setDescricao(e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && valido) salvar(); }}
              placeholder={tipo === 'Gasto' ? 'Ex.: Aluguel, Netflix, IPVA' : 'Ex.: Salário, Aluguel recebido'}
              aria-label="Descrição"
              className={inputCls}
              style={{ height: 48 }}
            />
          </Campo>

          <div className="h-px bg-border/50" />

          {/* ── QUANDO ────────────────────────────────────────────────────── */}
          <Pills
            label="Com que frequência"
            valor={frequencia}
            opcoes={FREQUENCIAS}
            onChange={marcar(setFrequencia)}
            colunas={3}
          />

          {frequencia === 'semanal' ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Em que dia</p>
              <div role="radiogroup" aria-label="Dia da semana" className="grid grid-cols-7 gap-1.5">
                {DIAS_SEMANA.map((d) => {
                  const ativo = diaSemana === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      // ⚠️ Rótulo por extenso: as iniciais repetem S, Q e S. Num
                      // leitor de tela "S, S, S" não é uma escolha, é adivinhação.
                      aria-label={d.nome}
                      onClick={() => { setSujo(true); setDiaSemana(d.id); }}
                      className={`rounded-xl text-[13px] font-bold transition-all duration-200 motion-safe:active:scale-[0.97] ${
                        ativo ? 'text-white shadow-sm' : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted/70'
                      }`}
                      style={{ minHeight: 44, background: ativo ? BRAND : undefined }}
                    >
                      {d.curto}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {frequencia === 'anual' && (
                <Campo label="Em que mês">
                  <select
                    value={mesVenc}
                    onChange={(e) => { setSujo(true); setMesVenc(Number(e.target.value)); }}
                    aria-label="Mês do vencimento"
                    className={inputCls}
                    style={{ height: 48 }}
                  >
                    {MESES.map((m, i) => (
                      <option key={m} value={i + 1}>{m[0].toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </Campo>
              )}
              <Campo label="Dia do vencimento">
                <input
                  inputMode="numeric"
                  value={dia}
                  onChange={(e) => { setSujo(true); setDia(e.target.value.replace(/[^0-9]/g, '').slice(0, 2)); }}
                  onBlur={() => setDia(String(diaLimpo))}
                  aria-label="Dia do vencimento"
                  className={`${inputCls} tabular-nums`}
                  style={{ height: 48 }}
                />
              </Campo>
            </div>
          )}

          <Pills
            label="Por quanto tempo"
            valor={repeticoes}
            opcoes={DURACOES}
            onChange={marcar(setRepeticoes)}
            colunas={5}
          />

          {/* ── AVISO ─────────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Aviso no WhatsApp
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={querAviso}
                onClick={() => { setSujo(true); setQuerAviso((v) => !v); }}
                className={`inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 h-8 rounded-lg transition-colors ${
                  querAviso ? 'text-foreground bg-muted/60' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                {/* ⚠️ Ícone + texto, nunca só a cor: é a diferença entre "vou te
                    avisar" e "não vou", e ela não pode depender de enxergar tom. */}
                {querAviso ? <><Bell size={12} /> Ligado</> : <><BellOff size={12} /> Desligado</>}
              </button>
            </div>
            {querAviso ? (
              <Pills
                label="Quando avisar"
                labelOculto
                valor={avisoDias}
                opcoes={AVISOS}
                onChange={marcar(setAvisoDias)}
                colunas={5}
              />
            ) : (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Não te mando nada — a conta fixa continua valendo e entrando nas somas.
              </p>
            )}
          </div>

          <div className="h-px bg-border/50" />

          {/* ── DETALHES ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Campo label="Categoria">
              <select
                value={categoria}
                onChange={(e) => { setSujo(true); setCategoria(e.target.value); }}
                aria-label="Categoria"
                className={inputCls}
                style={{ height: 48 }}
              >
                <option value="">Automática (pela descrição)</option>
                {cats.map((c) => <option key={c} value={c}>{nomeCategoria(c)}</option>)}
              </select>
            </Campo>
            <Campo label={tipo === 'Gasto' ? 'Sai de qual conta' : 'Entra em qual conta'}>
              <select
                value={carteira}
                onChange={(e) => { setSujo(true); setCarteira(e.target.value); }}
                aria-label={tipo === 'Gasto' ? 'Conta de pagamento' : 'Conta de recebimento'}
                className={inputCls}
                style={{ height: 48 }}
              >
                {opcoesContas.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            </Campo>
          </div>

          <Pills
            label="O que faço no dia"
            valor={modo}
            opcoes={MODOS}
            onChange={marcar(setModo)}
            colunas={3}
          />

          {/* ── O que vai acontecer ────────────────────────────────────────
              Frequência, duração e aviso só fazem sentido lidos juntos. Sem
              esta frase a pessoa sai da tela sem saber o que combinou. */}
          <div
            className="rounded-2xl p-3.5 border text-xs leading-relaxed"
            style={{
              borderColor: `color-mix(in srgb, ${BRAND} 25%, transparent)`,
              background: `color-mix(in srgb, ${BRAND} 6%, transparent)`,
            }}
          >
            <p className="flex items-start gap-2 text-foreground/85">
              <CalendarDays size={14} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />
              <span>
                <strong className="font-bold">{quando}</strong>, {duracaoTxt}.
                {querAviso && (avisoDias > 0
                  ? <> Te aviso <strong className="font-bold">{avisoDias} {avisoDias === 1 ? 'dia' : 'dias'} antes</strong>.</>
                  : <> Te aviso no dia.</>)}
              </span>
            </p>
            <p className="flex items-start gap-2 mt-2 text-muted-foreground">
              {modo === 'nao_lancar'
                ? <><CircleDashed size={14} className="mt-0.5 flex-shrink-0" />Não lanço nada — entra só na soma dos seus custos fixos.</>
                : valorVariavel
                  ? <><CircleDashed size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />Você confirma o valor real quando eu avisar — nada é debitado antes disso.</>
                  : modo === 'prever'
                    ? <><CircleDashed size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />Crio como previsto e deixo a cobrança do seu banco confirmar — assim o gasto não conta duas vezes.</>
                    : <><Repeat size={14} className="mt-0.5 flex-shrink-0" style={{ color: BRAND }} />{temValor ? <>Lanço automático de {fmt(valorNum)} em {carteira}.</> : <>Lanço automático em {carteira} assim que você puser o valor.</>}</>}
            </p>
          </div>

          {erro && (
            <p className="text-xs text-red-500 flex items-center gap-1.5" role="alert" aria-live="polite">
              <X size={13} /> {erro}
            </p>
          )}
        </div>

        {/* ── Rodapé fixo ───────────────────────────────────────────────────
            No celular a ação principal tem de estar ao alcance do polegar, e
            não no fim de um formulário de sete blocos. */}
        <div
          className="flex items-center gap-2 px-5 sm:px-6 py-3 border-t border-border/50 bg-card sm:rounded-b-3xl"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            type="button"
            onClick={fechar}
            className="px-4 rounded-xl text-sm font-semibold text-muted-foreground
                       hover:text-foreground hover:bg-muted/60 transition-colors"
            style={{ height: 48 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!valido || salvando}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white
                       transition-all duration-200 shadow-sm motion-safe:active:scale-[0.985]
                       disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ height: 48, background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
          >
            {salvando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {editando ? 'Salvar alterações' : 'Criar conta fixa'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(corpo, document.body);
}
