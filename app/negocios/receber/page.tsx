'use client';

// =============================================================================
// Contas a RECEBER — o lado que faltava.
//
// Não existe tabela própria: recebível é `lancamentos_negocio` com
// tipo='entrada' e status='pendente', o espelho exato de "conta a pagar =
// saída pendente". Uma tabela paralela seria uma segunda máquina pro mesmo
// fato (baixa, vencimento, conta, DRE) e duas chances de divergir.
//
// A tela é ordenada por URGÊNCIA, não por data: o que já venceu vem primeiro.
// Em ordem cronológica pura, a cobrança atrasada some no meio da lista — e é
// justamente ela que precisa de ação hoje.
// =============================================================================

import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import { useEmpresa } from '@/components/negocios/EmpresaContext';
import ModalLancamento from '@/components/negocios/ModalLancamento';
import SugestoesBaixaBanco from '@/components/negocios/SugestoesBaixaBanco';
import { corEmpresa } from '@/lib/empresas';
import { fmtCent, labelCategoria, type Lancamento } from '@/lib/lancamentos';
import {
  situacaoReceber, agruparPorCliente, csvCobrancas, csvPorCliente, nomeArquivo,
  diasAte as diasAteEm, type ResumoCliente,
} from '@/lib/receber';
import {
  HandCoins, Plus, AlertTriangle, CalendarClock, Check, Loader2,
  MessageCircle, Inbox, Repeat, Download, ChevronDown, UserRound,
} from 'lucide-react';

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

const diaMes = (iso?: string | null) => {
  if (!iso) return 'sem data';
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
};

/** Dias até o vencimento (negativo = venceu há N dias). Regra em lib/receber. */
const diasAte = (iso?: string | null) => diasAteEm(iso, hojeSP());

type Visao = 'vencimento' | 'cliente';

/** Baixa o CSV com BOM (sem ele o Excel lê os acentos errado). */
function baixarCsv(conteudo: string, nome: string) {
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revogar na hora cancela o download em alguns navegadores (Safari/Firefox).
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function ReceberPage() {
  const { phone, temNegocios } = useAuth();
  const { empresa, carregando: carregandoEmpresa } = useEmpresa();
  const cor = corEmpresa(empresa);

  const [modalNovo, setModalNovo] = useState(false);
  const [editando, setEditando]   = useState<Lancamento | null>(null);
  const [baixando, setBaixando]   = useState<string | null>(null);
  const [visao, setVisao]         = useState<Visao>('vencimento');

  const { data, mutate, isLoading } = useApi(
    (phone && temNegocios && empresa) ? `neg:receber:${phone}:${empresa.id}` : null,
    () => api.negocios.lancamentos.listar(phone, {
      empresa_id: empresa!.id, status: 'pendente', tipo: 'entrada',
    }),
  );

  const lista: Lancamento[] = useMemo(() => Array.isArray(data) ? data : [], [data]);

  // Urgência primeiro: vencido → vence hoje → a vencer → sem data.
  const { vencidos, hoje, futuros, semData, total, totalVencido } = useMemo(() => {
    const v: Lancamento[] = [], h: Lancamento[] = [], f: Lancamento[] = [], s: Lancamento[] = [];
    const dia = hojeSP();
    for (const l of lista) {
      const g = situacaoReceber(l.vencimento, dia).grupo;
      if (g === 'sem_data') s.push(l);
      else if (g === 'vencida') v.push(l);
      else if (g === 'hoje') h.push(l);
      else f.push(l);
    }
    const soma = (arr: Lancamento[]) => arr.reduce((acc, l) => acc + (l.valor || 0), 0);
    return {
      vencidos: v, hoje: h, futuros: f, semData: s,
      total: soma(lista), totalVencido: soma(v),
    };
  }, [lista]);

  // Só calcula a visão por cliente quando ela está aberta.
  const porCliente = useMemo(
    () => (visao === 'cliente' ? agruparPorCliente(lista, hojeSP()) : []),
    [lista, visao],
  );

  /** Exporta o que está na tela: as cobranças, ou a posição por cliente. */
  function exportar() {
    if (!lista.length) return;
    const dia = hojeSP();
    if (visao === 'cliente') {
      baixarCsv(csvPorCliente(lista, dia), nomeArquivo('a-receber-por-cliente', empresa?.nome, dia));
    } else {
      baixarCsv(csvCobrancas(lista, dia), nomeArquivo('a-receber', empresa?.nome, dia));
    }
  }

  async function receber(l: Lancamento) {
    if (baixando) return;
    setBaixando(l.id);
    try {
      // Otimista: some da lista na hora. Errou? o revalidate traz de volta.
      mutate((cur: any) => (cur || []).filter((x: Lancamento) => x.id !== l.id), { revalidate: false });
      await api.negocios.lancamentos.editar(l.id, { status: 'pago', pago_em: hojeSP() });
    } catch {
      /* volta ao estado real */
    } finally {
      setBaixando(null);
      mutate();
    }
  }

  if (!temNegocios) {
    return <p className="text-sm text-muted-foreground py-20 text-center">Recurso do plano Platinum.</p>;
  }

  const carregando = carregandoEmpresa || isLoading;

  return (
    <div className="pb-20 space-y-5">
      {/* Cabeçalho */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground truncate">
            {empresa?.nome || 'Negócios'}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mt-0.5">A receber</h1>
          <p className="text-sm text-muted-foreground mt-1">Quem ainda tem que te pagar</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportar} disabled={!lista.length}
            title={visao === 'cliente'
              ? 'Baixa a posição por cliente (abre no Excel)'
              : 'Baixa as cobranças em aberto (abre no Excel)'}
            className="inline-flex items-center gap-1.5 h-11 px-3.5 rounded-2xl text-sm font-bold bg-card border border-border text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: 44 }}>
            <Download size={15} />
            <span className="hidden sm:inline">Exportar para Excel</span>
            <span className="sm:hidden">Exportar</span>
          </button>
          <button onClick={() => setModalNovo(true)}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold shadow-sm transition-transform active:scale-[0.98]"
            style={{ background: cor, minHeight: 44 }}>
            <Plus size={16} /> Novo recebimento
          </button>
        </div>
      </header>

      {/* Totais */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total em aberto</p>
          <p className="text-2xl font-bold text-foreground tabular-nums mt-1">{fmtCent(total)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {lista.length} cobrança{lista.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="rounded-2xl border p-4"
             style={totalVencido > 0
               ? { borderColor: 'color-mix(in srgb, #ef4444 35%, transparent)', background: 'color-mix(in srgb, #ef4444 7%, transparent)' }
               : { borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-card))' }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: totalVencido > 0 ? '#ef4444' : undefined }}>
            Vencido
          </p>
          <p className="text-2xl font-bold tabular-nums mt-1" style={{ color: totalVencido > 0 ? '#ef4444' : 'hsl(var(--foreground))' }}>
            {fmtCent(totalVencido)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {vencidos.length === 0 ? 'nada atrasado' : `${vencidos.length} atrasada${vencidos.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </section>

      {/* Chegou do banco algo parecido com uma conta (valor não bate exato). */}
      {phone && empresa && (
        <SugestoesBaixaBanco phone={phone} empresaId={empresa.id} tipo="entrada" cor={cor} onBaixa={() => mutate()} />
      )}

      {carregando ? (
        <Esqueleto />
      ) : lista.length === 0 ? (
        <VazioReceber cor={cor} onCriar={() => setModalNovo(true)} />
      ) : (
        <div className="space-y-4">
          {/* A mesma lista, vista por vencimento ou por cliente. A exportação
              segue a visão aberta. */}
          <div role="group" aria-label="Organizar a lista"
               className="inline-flex p-1 rounded-2xl border border-border bg-card">
            {([['vencimento', 'Por vencimento'], ['cliente', 'Por cliente']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setVisao(v)} aria-pressed={visao === v}
                className="h-9 px-3.5 rounded-xl text-xs font-bold transition-colors"
                style={visao === v
                  ? { background: cor, color: '#fff', minHeight: 36 }
                  : { color: 'hsl(var(--muted-foreground))', minHeight: 36 }}>
                {label}
              </button>
            ))}
          </div>

          {visao === 'cliente' ? (
            <ListaPorCliente grupos={porCliente} onReceber={receber} onAbrir={setEditando}
                             baixando={baixando} cor={cor} />
          ) : (
        <div className="space-y-5">
          <Grupo titulo="Vencidas" itens={vencidos} tom="#ef4444" alerta
                 onReceber={receber} onAbrir={setEditando} baixando={baixando} cor={cor} />
          <Grupo titulo="Vencem hoje" itens={hoje} tom="#f59e0b"
                 onReceber={receber} onAbrir={setEditando} baixando={baixando} cor={cor} />
          <Grupo titulo="A vencer" itens={futuros} tom={cor}
                 onReceber={receber} onAbrir={setEditando} baixando={baixando} cor={cor} />
          <Grupo titulo="Sem data de vencimento" itens={semData} tom="#71717a"
                 onReceber={receber} onAbrir={setEditando} baixando={baixando} cor={cor} />
        </div>
          )}
        </div>
      )}

      {modalNovo && empresa && (
        <ModalLancamento
          empresaId={empresa.id}
          cor={cor}
          tipoInicial="entrada"
          onClose={() => setModalNovo(false)}
          onSalvo={() => { setModalNovo(false); mutate(); }}
        />
      )}
      {editando && empresa && (
        <ModalLancamento
          empresaId={empresa.id}
          cor={cor}
          lancamento={editando}
          onClose={() => setEditando(null)}
          onSalvo={() => mutate()}
          onExcluido={() => mutate()}
        />
      )}
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────── */

function Grupo({ titulo, itens, tom, alerta, onReceber, onAbrir, baixando, cor }: {
  titulo: string; itens: Lancamento[]; tom: string; alerta?: boolean;
  onReceber: (l: Lancamento) => void; onAbrir: (l: Lancamento) => void; baixando: string | null; cor: string;
}) {
  if (!itens.length) return null;
  const total = itens.reduce((s, l) => s + (l.valor || 0), 0);
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 mb-2 px-1">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: alerta ? tom : 'hsl(var(--foreground))' }}>
          {alerta && <AlertTriangle size={14} />}
          {titulo}
          <span className="text-xs font-normal text-muted-foreground">({itens.length})</span>
        </h2>
        <span className="text-sm font-bold tabular-nums text-foreground">{fmtCent(total)}</span>
      </div>
      <ul className="space-y-2">
        {itens.map(l => (
          <LinhaReceber key={l.id} l={l} tom={tom} onReceber={onReceber} onAbrir={onAbrir} baixando={baixando} cor={cor} />
        ))}
      </ul>
    </section>
  );
}

function LinhaReceber({ l, tom, onReceber, onAbrir, baixando, cor }: {
  l: Lancamento; tom: string; onReceber: (l: Lancamento) => void; onAbrir: (l: Lancamento) => void;
  baixando: string | null; cor: string;
}) {
  const dias = diasAte(l.vencimento);
  const atrasada = dias !== null && dias < 0;
  const ocupado = baixando === l.id;

  // Cobrar por WhatsApp: o canal que o cliente responde. Sem número, o botão
  // não aparece (link vazio seria pior que ausência).
  const zap = (l.contraparte || '').replace(/\D/g, '');
  const linkZap = zap.length >= 10
    ? `https://wa.me/${zap.length <= 11 ? `55${zap}` : zap}?text=${encodeURIComponent(
        `Oi! Passando pra lembrar do pagamento de ${fmtCent(l.valor)}` +
        (l.vencimento ? ` com vencimento em ${diaMes(l.vencimento)}` : '') + '. 🙂')}`
    : null;

  return (
    <li className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `color-mix(in srgb, ${tom} 14%, transparent)` }}>
        <HandCoins size={17} style={{ color: tom }} />
      </span>

      {/* Tocar abre a conta pra editar (e, se ela se repete, pra parar). */}
      <button type="button" onClick={() => onAbrir(l)} className="flex-1 min-w-0 text-left min-h-[44px]"
              aria-label={`Abrir ${l.descricao}`}>
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          {l.serie_id && <Repeat size={12} className="flex-shrink-0 text-muted-foreground" aria-label="se repete" />}
          <span className="truncate">{l.descricao}</span>
        </p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5 flex-wrap">
          {l.contraparte && <span className="truncate max-w-[140px]">{l.contraparte}</span>}
          <span className="inline-flex items-center gap-1">
            <CalendarClock size={10} />
            {diaMes(l.vencimento)}
            {/* Estado em TEXTO, não só na cor — quem não distingue contraste
                precisa saber que está atrasado. */}
            {atrasada && <b style={{ color: '#ef4444' }}>· {Math.abs(dias!)}d de atraso</b>}
            {dias === 0 && <b style={{ color: '#f59e0b' }}>· hoje</b>}
          </span>
          {l.categoria && <span className="hidden sm:inline">· {labelCategoria('entrada', l.categoria)}</span>}
          {l.criado_por_nome && <span className="hidden sm:inline">· por {l.criado_por_nome}</span>}
        </p>
      </button>

      <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{fmtCent(l.valor)}</span>

      <div className="flex items-center gap-1 flex-shrink-0">
        {linkZap && (
          <a href={linkZap} target="_blank" rel="noreferrer"
             aria-label={`Cobrar ${l.contraparte} no WhatsApp`}
             className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
             style={{ minWidth: 40, minHeight: 40 }}>
            <MessageCircle size={16} />
          </a>
        )}
        <button onClick={() => onReceber(l)} disabled={ocupado}
          aria-label={`Marcar ${l.descricao} como recebido`}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white transition-transform active:scale-90 disabled:opacity-60"
          style={{ background: cor, minWidth: 40, minHeight: 40 }}>
          {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Check size={17} />}
        </button>
      </div>
    </li>
  );
}

/** Cor da linha pela situação — a mesma da visão por vencimento. */
function tomDaSituacao(l: Lancamento, cor: string): string {
  const g = situacaoReceber(l.vencimento, hojeSP()).grupo;
  return g === 'vencida' ? '#ef4444' : g === 'hoje' ? '#f59e0b' : g === 'futura' ? cor : '#71717a';
}

function ListaPorCliente({ grupos, onReceber, onAbrir, baixando, cor }: {
  grupos: ResumoCliente[]; onReceber: (l: Lancamento) => void; onAbrir: (l: Lancamento) => void;
  baixando: string | null; cor: string;
}) {
  // Vários abertos ao mesmo tempo: comparar dois clientes é o caso comum.
  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const alternar = (k: string) => setAbertos(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const devendoVencido = grupos.filter(g => !g.semCliente && g.vencido > 0).length;

  return (
    <section className="space-y-2">
      <p className="text-xs text-muted-foreground px-1">
        {grupos.filter(g => !g.semCliente).length} cliente{grupos.filter(g => !g.semCliente).length === 1 ? '' : 's'}
        {devendoVencido > 0 && <> · <b style={{ color: '#ef4444' }}>{devendoVencido} com valor vencido</b></>}
        {' '}· quem tem valor vencido aparece primeiro
      </p>
      <ul className="space-y-2">
        {grupos.map(g => {
          const aberto = abertos.has(g.chave);
          const atrasado = g.vencido > 0;
          return (
            <li key={g.chave || '__sem'} className="rounded-2xl border border-border bg-card overflow-hidden">
              <button type="button" onClick={() => alternar(g.chave)} aria-expanded={aberto}
                className="w-full p-3.5 flex items-center gap-3 text-left min-h-[56px]">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `color-mix(in srgb, ${atrasado ? '#ef4444' : cor} 14%, transparent)` }}>
                  <UserRound size={17} style={{ color: atrasado ? '#ef4444' : cor }} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm font-semibold truncate ${g.semCliente ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                    {g.nome}
                  </span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    {g.quantidade} cobrança{g.quantidade === 1 ? '' : 's'}
                    {g.proximoVencimento && <> · próximo vencimento {diaMes(g.proximoVencimento)}</>}
                  </span>
                  {/* Atraso em TEXTO, não só na cor. */}
                  {atrasado && (
                    <span className="flex items-center gap-1 text-[11px] font-bold mt-0.5" style={{ color: '#ef4444' }}>
                      <AlertTriangle size={11} />
                      {fmtCent(g.vencido)} vencido · {g.maiorAtraso}d de atraso
                    </span>
                  )}
                </span>
                <span className="text-right flex-shrink-0">
                  <span className="block text-sm font-bold tabular-nums text-foreground">{fmtCent(g.total)}</span>
                  <span className="block text-[10px] text-muted-foreground">em aberto</span>
                </span>
                <ChevronDown size={16} className="flex-shrink-0 text-muted-foreground transition-transform"
                             style={{ transform: aberto ? 'rotate(180deg)' : undefined }} />
              </button>

              {aberto && (
                <div className="border-t border-border/60 p-1.5 sm:p-2.5 space-y-2 bg-muted/20">
                  <div className="grid grid-cols-3 gap-2 text-center px-1 pb-1">
                    <Mini label="Vencido" valor={g.vencido} tom={g.vencido > 0 ? '#ef4444' : undefined} />
                    <Mini label="Vence hoje" valor={g.venceHoje} tom={g.venceHoje > 0 ? '#f59e0b' : undefined} />
                    <Mini label="A vencer" valor={g.aVencer} />
                  </div>
                  {g.semData > 0 && (
                    <p className="text-[11px] text-muted-foreground px-1">
                      + {fmtCent(g.semData)} sem data de vencimento
                    </p>
                  )}
                  <ul className="space-y-2">
                    {g.itens.map(l => (
                      <LinhaReceber key={l.id} l={l} tom={tomDaSituacao(l, cor)} onReceber={onReceber}
                                    onAbrir={onAbrir} baixando={baixando} cor={cor} />
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Mini({ label, valor, tom }: { label: string; valor: number; tom?: string }) {
  return (
    <div className="rounded-xl bg-card border border-border/60 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs font-bold tabular-nums mt-0.5" style={{ color: tom || 'hsl(var(--foreground))' }}>
        {fmtCent(valor)}
      </p>
    </div>
  );
}

function VazioReceber({ cor, onCriar }: { cor: string; onCriar: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border p-10 text-center">
      <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ background: `color-mix(in srgb, ${cor} 12%, transparent)` }}>
        <Inbox size={24} style={{ color: cor }} />
      </span>
      <p className="text-base font-bold text-foreground">Ninguém te devendo</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto leading-relaxed">
        Quando você vender a prazo, registre aqui com a data que combinou de
        receber — a Sora avisa quando estiver perto de vencer.
      </p>
      <button onClick={onCriar}
        className="mt-4 inline-flex items-center gap-1.5 h-11 px-4 rounded-2xl text-white text-sm font-bold"
        style={{ background: cor, minHeight: 44 }}>
        <Plus size={16} /> Registrar cobrança
      </button>
    </div>
  );
}

function Esqueleto() {
  return (
    <div className="space-y-2 animate-pulse" aria-busy="true">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 rounded bg-muted" style={{ width: `${60 - i * 6}%` }} />
            <div className="h-3 w-24 rounded bg-muted" />
          </div>
          <div className="h-4 w-16 rounded bg-muted flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}
