'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Repeat, Plus, Trash2, Loader2, Check, X, Calendar,
  ArrowDownRight, ArrowUpRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { getCategoriaTheme } from '@/lib/categorias';

const BRAND = '#61D17B';

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
};

type Wallet = { id: string; nome: string; tipo?: string };

interface Props {
  grupoId?: string;
  wallets:  Wallet[];
}

export default function GastosFixosSection({ grupoId, wallets }: Props) {
  const [itens, setItens]         = useState<Recorrencia[]>([]);
  const [carregando, setCarreg]   = useState(true);
  const [confirmando, setConfirm] = useState<string | null>(null); // id em confirmação de cancelamento
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [addOpen, setAddOpen]     = useState(false);

  const carregar = useCallback(async () => {
    if (!grupoId) return;
    const { data } = await supabase
      .from('recorrencias')
      .select('id, tipo, valor, dia_vencimento, descricao, carteira, categoria')
      .eq('grupo_id', grupoId)
      .eq('ativa', true)
      .order('tipo', { ascending: true })
      .order('dia_vencimento', { ascending: true });
    setItens((data as Recorrencia[]) || []);
    setCarreg(false);
  }, [grupoId]);

  useEffect(() => { carregar(); }, [carregar]);

  const totalGastos = useMemo(
    () => itens.filter((i) => i.tipo === 'Gasto').reduce((s, i) => s + (i.valor || 0), 0),
    [itens],
  );

  async function cancelar(id: string) {
    setRemovendo(id);
    const backup = itens;
    setItens((prev) => prev.filter((i) => i.id !== id)); // otimista
    setConfirm(null);
    const { error } = await supabase.from('recorrencias').update({ ativa: false }).eq('id', id);
    if (error) setItens(backup); // reverte se falhar
    setRemovendo(null);
  }

  return (
    <section
      className="rounded-3xl border border-border/60 bg-card overflow-hidden animate-fade-in"
      aria-label="Gastos fixos mensais"
    >
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 p-5 sm:p-6 border-b border-border/60">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${BRAND}1A` }}
          >
            <Repeat size={18} style={{ color: BRAND }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground leading-tight flex items-center gap-2">
              Gastos fixos
              {!carregando && itens.length > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
                      style={{ background: `${BRAND}1A`, color: BRAND }}>
                  {itens.length}
                </span>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {totalGastos > 0
                ? <>Lançados automaticamente todo mês · <span className="tabular-nums font-medium text-foreground/80">{fmt(totalGastos)}</span>/mês</>
                : 'Lançados automaticamente todo mês'}
            </p>
          </div>
        </div>

        <button
          onClick={() => setAddOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 h-11 rounded-xl text-sm font-semibold transition-all
                     hover:-translate-y-0.5 active:translate-y-0 flex-shrink-0"
          style={{ background: addOpen ? 'hsl(var(--bg-muted))' : `${BRAND}1A`, color: addOpen ? undefined : BRAND }}
          aria-expanded={addOpen}
        >
          {addOpen ? <X size={16} /> : <Plus size={16} />}
          <span className="hidden sm:inline">{addOpen ? 'Fechar' : 'Adicionar'}</span>
        </button>
      </div>

      {/* ── Form de adicionar (progressive disclosure) ───────── */}
      {addOpen && (
        <AddForm
          grupoId={grupoId}
          contas={wallets}
          onCancel={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); carregar(); }}
        />
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
          <p className="text-sm font-medium text-foreground">Nenhum gasto fixo ainda</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Aluguel, internet, assinaturas… Cadastre uma vez e a Sora lança todo mês no dia certo.
          </p>
          {!addOpen && (
            <button
              onClick={() => setAddOpen(true)}
              className="mt-1 flex items-center gap-1.5 px-3 h-11 rounded-xl text-sm font-semibold"
              style={{ background: `${BRAND}1A`, color: BRAND }}
            >
              <Plus size={16} /> Adicionar gasto fixo
            </button>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {itens.map((item, idx) => {
            const tema = getCategoriaTheme(item.descricao);
            // Só usa emoji como fallback (não o texto "Outros"); marca é detectada pelo nome.
            const emoji = item.categoria?.match(/^\p{Extended_Pictographic}/u)?.[0] ?? undefined;
            const ehGasto = item.tipo === 'Gasto';
            const emConfirm = confirmando === item.id;
            const saindo = removendo === item.id;
            return (
              <li
                key={item.id}
                className="group flex items-center gap-3 px-4 sm:px-6 py-3 transition-colors hover:bg-muted/30 animate-fade-in"
                style={{ animationDelay: `${Math.min(idx * 40, 240)}ms`, opacity: saindo ? 0.5 : undefined }}
              >
                <CategoriaIcon
                  nome={item.descricao}
                  icone={emoji}
                  size={38}
                  bg={tema.bg}
                  color={tema.color}
                  rounded="rounded-xl"
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.descricao}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted/60 font-medium tabular-nums">
                      <Calendar size={10} /> dia {item.dia_vencimento}
                    </span>
                    {item.carteira && <span className="truncate">· {item.carteira}</span>}
                  </div>
                </div>

                {/* Valor */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold tabular-nums inline-flex items-center gap-0.5 ${ehGasto ? 'text-red-500' : 'text-emerald-500'}`}>
                    {ehGasto ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}
                    {fmt(item.valor)}
                  </p>
                </div>

                {/* Ação cancelar — confirmação inline em 2 passos */}
                {emConfirm ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => cancelar(item.id)}
                      disabled={saindo}
                      className="h-9 px-2.5 rounded-lg bg-red-500 text-white text-xs font-semibold flex items-center gap-1 hover:bg-red-600 transition-colors"
                      aria-label={`Confirmar cancelamento de ${item.descricao}`}
                    >
                      {saindo ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Cancelar
                    </button>
                    <button
                      onClick={() => setConfirm(null)}
                      className="h-9 w-9 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground flex items-center justify-center transition-colors"
                      aria-label="Voltar"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirm(item.id)}
                    className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 text-muted-foreground
                               hover:text-red-500 hover:bg-red-500/10 transition-colors
                               lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100"
                    aria-label={`Cancelar ${item.descricao}`}
                    title="Cancelar gasto fixo"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Form inline de adicionar recorrência
// ─────────────────────────────────────────────────────────────
function AddForm({
  grupoId, contas, onCancel, onSaved,
}: {
  grupoId?:  string;
  contas:    Wallet[];
  onCancel:  () => void;
  onSaved:   () => void;
}) {
  const [tipo, setTipo]           = useState<Tipo>('Gasto');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor]         = useState('');
  const [dia, setDia]             = useState('5');
  const [salvando, setSalvando]   = useState(false);
  const [erro, setErro]           = useState('');
  const descRef = useRef<HTMLInputElement>(null);

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

  const [carteira, setCarteira] = useState(opcoesContas[0]?.nome || 'Dinheiro');

  useEffect(() => { descRef.current?.focus(); }, []);

  // Se a conta selecionada deixou de ser válida (ex.: trocou pra receita e
  // estava num cartão), volta pra primeira opção disponível.
  useEffect(() => {
    if (!opcoesContas.some((c) => c.nome === carteira)) {
      setCarteira(opcoesContas[0]?.nome || 'Dinheiro');
    }
  }, [opcoesContas, carteira]);

  const valido = descricao.trim() && parseFloat(valor.replace(',', '.')) > 0;

  async function salvar() {
    if (!valido || !grupoId) return;
    setErro('');
    setSalvando(true);
    const { error } = await supabase.from('recorrencias').insert({
      grupo_id:       grupoId,
      tipo,
      categoria:      tipo === 'Gasto' ? 'Outros' : '💼 Salário',
      descricao:      descricao.trim(),
      valor:          parseFloat(valor.replace(',', '.')),
      dia_vencimento: Math.max(1, Math.min(28, parseInt(dia) || 5)),
      carteira:       carteira || 'Dinheiro',
      ativa:          true,
    });
    setSalvando(false);
    if (error) { setErro('Não consegui salvar. Tente de novo.'); return; }
    onSaved();
  }

  return (
    <div className="p-4 sm:p-6 bg-muted/20 border-b border-border/60 animate-fade-in">
      {/* Toggle tipo */}
      <div className="inline-flex p-1 rounded-xl bg-muted/60 mb-4">
        {(['Gasto', 'Recebimento'] as Tipo[]).map((t) => (
          <button
            key={t}
            onClick={() => setTipo(t)}
            className={`px-3.5 h-9 rounded-lg text-xs font-bold transition-all ${
              tipo === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'Gasto' ? 'Gasto fixo' : 'Receita fixa'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px_92px] gap-2.5">
        <input
          ref={descRef}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valido && salvar()}
          placeholder={tipo === 'Gasto' ? 'Ex.: Aluguel, Netflix' : 'Ex.: Salário, Aluguel recebido'}
          className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm
                     placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && valido && salvar()}
          placeholder="R$ 0,00"
          className="px-3.5 h-11 rounded-xl bg-background border border-border text-sm tabular-nums
                     placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary transition-colors"
        />
        <div className="flex items-center gap-1.5 px-3 h-11 rounded-xl bg-background border border-border text-sm">
          <span className="text-muted-foreground text-xs">Dia</span>
          <input
            inputMode="numeric"
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className="w-full bg-transparent focus:outline-none tabular-nums"
          />
        </div>
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

      {erro && <p className="text-xs text-red-500 mt-2">{erro}</p>}

      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={salvar}
          disabled={!valido || salvando}
          className="flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold text-white transition-all
                     hover:-translate-y-0.5 active:translate-y-0 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
          style={{ background: `linear-gradient(135deg, ${BRAND}, #3FA85A)` }}
        >
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Salvar
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
