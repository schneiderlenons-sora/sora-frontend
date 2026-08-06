'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Repeat, Plus, Trash2, Loader2, Check, X, Calendar,
  ArrowDownRight, ArrowUpRight, Sparkles, CircleDashed, Pencil,
  Bell, ChevronDown, Link2,
} from 'lucide-react';
import { api, type ModoLancamentoFixo } from '@/lib/api';
import { mutate as mutateGlobal } from 'swr';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';

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

/** `lancar` cria a transação paga · `prever` cria [Previsto] pra reconciliar
 *  com a cobrança do banco · `nao_lancar` não cria nada (só lembra). */
type ModoLancamento = ModoLancamentoFixo;

const MODOS: { id: ModoLancamento; label: string; ajuda: string }[] = [
  { id: 'lancar',     label: 'Lançar',     ajuda: 'Cria a transação já paga e desconta do saldo.' },
  { id: 'prever',     label: 'Só prever',  ajuda: 'Cria como previsto e deixa a cobrança do seu banco confirmar o valor. Evita o gasto contar duas vezes.' },
  { id: 'nao_lancar', label: 'Não lançar', ajuda: 'Não cria nada. Serve só pra você somar seus custos fixos.' },
];

type Wallet = { id: string; nome: string; tipo?: string };

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
  const [aceitando, setAceitando] = useState<string | null>(null); // descricao em processamento

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

  const carregarSugestoes = useCallback(async () => {
    try { const r = await api.recorrencias.sugestoes(); setSugestoes(r.sugestoes || []); }
    catch { setSugestoes([]); }
  }, []);

  useEffect(() => { carregar(); carregarSugestoes(); }, [carregar, carregarSugestoes]);

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
  const totalGastos   = useMemo(() => itens.filter((i) => i.tipo === 'Gasto').reduce((s, i) => s + (i.valor || 0), 0), [itens]);
  const temVariavel   = useMemo(() => itens.some((i) => i.valor_variavel), [itens]);

  const grupos = useMemo(() => ([
    { key: 'gf', label: 'Gastos fixos',       hint: '',                      itens: gastosFixos   },
    { key: 'gv', label: 'Gastos variáveis',   hint: 'você confirma no dia',  itens: gastosVar     },
    { key: 'rf', label: 'Receitas fixas',     hint: '',                      itens: receitasFixas },
    { key: 'rv', label: 'Receitas variáveis', hint: 'você confirma no dia',  itens: receitasVar   },
  ].filter((g) => g.itens.length > 0)), [gastosFixos, gastosVar, receitasFixas, receitasVar]);

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
              {!carregando && itens.length > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                      style={{ background: `color-mix(in srgb, ${BRAND} 10%, transparent)`, color: BRAND }}>
                  {itens.length}
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
      </div>

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
      ) : itens.length === 0 ? (
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
          {grupos.map((g, gi) => (
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
                    onModo={mudarModo} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Linha de uma recorrência (gasto ou receita, fixa ou variável)
// ─────────────────────────────────────────────────────────────
function Linha({
  item, idx, confirmando, removendo, onPedir, onCancelar, onEditar, onModo,
}: {
  item:        Recorrencia;
  idx:         number;
  confirmando: string | null;
  removendo:   string | null;
  onPedir:     (id: string | null) => void;
  onCancelar:  (id: string) => void;
  onEditar:    () => void;
  onModo:      (id: string, patch: { modo_lancamento?: ModoLancamento; lembrete?: boolean }) => void;
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
      style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`, opacity: saindo ? 0.5 : undefined }}
    >
    <div className="flex items-center gap-3 px-4 sm:px-6 py-3">
      <CategoriaIcon nome={item.descricao} icone={emoji} size={38} bg={tema.bg} color={tema.color} rounded="rounded-xl" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{item.descricao}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
            <Calendar size={10} /> dia {item.dia_vencimento}
          </span>
          {ehVariavel && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium"
                  style={{ background: 'color-mix(in srgb, #f59e0b 14%, transparent)', color: '#b45309' }}>
              <CircleDashed size={10} /> estimado
            </span>
          )}
          {item.carteira && <span className="truncate">· {item.carteira}</span>}
        </div>

        {/* Chip do modo — abre os controles. Toque ≥44pt e sempre visível
            (não pode ser hover-only: no mobile ficaria inalcançável). */}
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          aria-label={`Lançamento de ${item.descricao}: ${modoInfo.label}. Toque para mudar.`}
          className={`mt-1.5 inline-flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-lg text-[11px] font-semibold
                      transition-colors active:scale-[0.98] ${
            modo === 'nao_lancar'
              ? 'bg-muted/70 text-muted-foreground hover:bg-muted'
              : modo === 'prever'
                ? 'bg-amber-500/12 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                : 'bg-primary/12 text-primary hover:bg-primary/20'
          }`}
        >
          {modo === 'nao_lancar' ? <CircleDashed size={11} /> : modo === 'prever' ? <Link2 size={11} /> : <Check size={11} />}
          {modoInfo.label}
          {querLembrete && <Bell size={10} className="opacity-70" />}
          <ChevronDown size={12} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="text-right flex-shrink-0">
        {semEstimativa ? (
          <p className="text-sm font-semibold tabular-nums inline-flex items-center gap-1 text-muted-foreground">
            <CircleDashed size={13} /> a definir
          </p>
        ) : (
          <p className={`text-sm font-bold tabular-nums inline-flex items-center gap-0.5 ${ehGasto ? 'text-red-500' : 'text-emerald-500'}`}>
            {ehGasto ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
            {ehVariavel ? '~' : ''}{fmt(item.valor)}
          </p>
        )}
      </div>

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
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground
                       hover:text-foreground hover:bg-muted transition-colors"
            aria-label={`Editar ${item.descricao}`}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onPedir(item.id)}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground
                       hover:text-red-500 hover:bg-red-500/10 transition-colors"
            aria-label={`Cancelar ${item.descricao}`}
            title="Cancelar"
          >
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </div>

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

      {/* Helper: explica o comportamento conforme fixo/variável (progressive disclosure) */}
      <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1.5 leading-relaxed">
        {valorVariavel
          ? <><CircleDashed size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
              Todo dia <strong className="text-foreground/80 tabular-nums">{diaLimpo}</strong> eu te lembro e você confirma o valor real{temValor ? <> (estimei <span className="tabular-nums">{fmt(valorNum)}</span>)</> : ''} — nada é debitado antes disso.</>
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
