'use client';

// ═════════════════════════════════════════════════════════════════════════
// Tarefas do Sora Grow.
//
// O que mudou e por quê (ago/2026):
//
// ⚠️ A ABA ESCONDIA DADO QUE JÁ EXISTIA. `data_vencimento`, `recorrente`,
// `frequencia_recorrencia` e `categoria` existem na tabela desde sempre — a IA
// do WhatsApp já preenchia categoria e prazo — mas o painel não tinha campo
// pra nenhum deles. Medido antes de mexer: 52 tarefas na base, TODAS com
// categoria e prazo nulos. Não era falta de recurso, era falta de porta.
//
// Estrutura da tela, de cima pra baixo, na ordem da pergunta que a pessoa faz:
//   1. "O que eu faço agora?"      → faixa HOJE (atrasadas + vencendo hoje)
//   2. "Onde isso se encaixa?"     → filtros de projeto (com progresso) e categoria
//   3. "Como está tudo?"           → Lista (por prazo) ou Quadro (kanban)
//
// A faixa Hoje só aparece quando tem algo — banda vazia todo dia treinaria a
// pessoa a ignorar aquele espaço.
// ═════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import {
  Plus, Loader2, X, Check, Trash2, Tag, AlertCircle, FolderPlus,
  CalendarClock, Repeat, LayoutGrid, List as ListIcon, Flame,
  Plane, ShoppingCart, Briefcase, HeartPulse, GraduationCap,
  Home as HomeIcon, Phone, Wallet, CircleDashed, ArrowRight, Circle,
} from 'lucide-react';
import GrowHero from '@/components/grow/GrowHero';

const BRAND = 'hsl(var(--primary))';
const VISAO_KEY = 'sora-grow-tarefas-visao';

const PRIORIDADES = [
  { v: 'urgente', l: 'Urgente', cor: '#ef4444', desc: 'Faça agora' },
  { v: 'alta',    l: 'Alta',    cor: '#f97316', desc: 'Hoje' },
  { v: 'media',   l: 'Média',   cor: '#eab308', desc: 'Esta semana' },
  { v: 'baixa',   l: 'Baixa',   cor: '#22c55e', desc: 'Quando der' },
];
const priDe = (v: string) => PRIORIDADES.find(p => p.v === v) || PRIORIDADES[2];
/** Peso pra ordenar: urgente primeiro. */
const PESO_PRI: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };

// As MESMAS 8 categorias que o classificador do WhatsApp usa
// (`CAT_TAREFA` em sora-backend/src/handlers/grow.js). Mexeu lá, mexa aqui —
// senão a tarefa criada pelo zap cai numa categoria que a tela não sabe pintar.
const CATEGORIAS = [
  { v: 'Viagem',     icon: Plane,          cor: '#0ea5e9' },
  { v: 'Compras',    icon: ShoppingCart,   cor: '#ec4899' },
  { v: 'Trabalho',   icon: Briefcase,      cor: '#6366f1' },
  { v: 'Saúde',      icon: HeartPulse,     cor: '#14b8a6' },
  { v: 'Estudos',    icon: GraduationCap,  cor: '#8b5cf6' },
  { v: 'Casa',       icon: HomeIcon,       cor: '#d97706' },
  { v: 'Contatos',   icon: Phone,          cor: '#f43f5e' },
  { v: 'Financeiro', icon: Wallet,         cor: '#16a34a' },
];
const catDe = (v?: string | null) => CATEGORIAS.find(c => c.v === v) || null;

const FREQUENCIAS = [
  { v: 'diaria',   l: 'Todo dia' },
  { v: 'semanal',  l: 'Toda semana' },
  { v: 'quinzenal',l: 'A cada 15 dias' },
  { v: 'mensal',   l: 'Todo mês' },
];
const freqDe = (v?: string | null) => FREQUENCIAS.find(f => f.v === v)?.l || 'Toda semana';

const COLUNAS: { v: 'a_fazer' | 'em_progresso' | 'concluida'; l: string; sub: string }[] = [
  { v: 'a_fazer',      l: 'A fazer',      sub: 'Aguardando' },
  { v: 'em_progresso', l: 'Em progresso', sub: 'Trabalhando' },
  { v: 'concluida',    l: 'Concluídas',   sub: 'Feito' },
];

// ── Datas ───────────────────────────────────────────────────────────────
// Sempre em fuso LOCAL. `toISOString()` é UTC: depois das 21h no Brasil ele já
// devolve o dia seguinte, e uma tarefa de hoje apareceria como "amanhã".
const hojeISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const diasAte = (iso: string) => {
  const a = new Date(hojeISO() + 'T12:00:00');
  const b = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};
/** Rótulo humano do prazo. Atrasado NUNCA é só cor — vem escrito. */
function rotuloPrazo(iso: string) {
  const d = diasAte(iso);
  if (d < -1) return { txt: `atrasada há ${Math.abs(d)} dias`, tom: 'atraso' as const };
  if (d === -1) return { txt: 'atrasada 1 dia',                tom: 'atraso' as const };
  if (d === 0)  return { txt: 'vence hoje',                    tom: 'hoje'   as const };
  if (d === 1)  return { txt: 'amanhã',                        tom: 'perto'  as const };
  if (d <= 7)   return { txt: `em ${d} dias`,                  tom: 'perto'  as const };
  const dt = new Date(String(iso).slice(0, 10) + 'T12:00:00');
  return { txt: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), tom: 'longe' as const };
}
const TOM_COR = { atraso: '#ef4444', hoje: '#f97316', perto: '#eab308', longe: 'hsl(var(--muted-foreground))' };

export default function TarefasPage() {
  const { phone } = useAuth();
  const [novaOpen, setNovaOpen] = useState(false);
  const [editando, setEditando] = useState<any | null>(null);
  const [novoProjeto, setNovoProjeto] = useState(false);
  const [filtroProjeto, setFiltroProjeto] = useState<string | null>(null);
  const [filtroCat, setFiltroCat] = useState<string | null>(null);
  const [visao, setVisao] = useState<'lista' | 'quadro'>('lista');

  // Visão preferida por aparelho. ⚠️ Lida DEPOIS da montagem: ler
  // localStorage no primeiro render dá hydration mismatch (o servidor não tem
  // localStorage). Sem valor salvo, o padrão vem da largura da tela — quadro
  // no desktop, lista no celular, onde 3 colunas empilhadas viram um rolo.
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(VISAO_KEY);
      if (salvo === 'lista' || salvo === 'quadro') { setVisao(salvo); return; }
    } catch { /* modo privado */ }
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) setVisao('quadro');
  }, []);
  const trocarVisao = (v: 'lista' | 'quadro') => {
    setVisao(v);
    try { localStorage.setItem(VISAO_KEY, v); } catch { /* noop */ }
  };

  // ── Dados via SWR: revisitar a tela é instantâneo (cache em memória). ──
  const { data: tData, mutate: mT } = useApi(phone ? `grow:tarefas-all:${phone}` : null, () => api.grow.tarefas.listar(phone));
  const { data: pData, mutate: mP } = useApi(phone ? `grow:projetos:${phone}` : null,    () => api.grow.projetos.listar(phone));

  const tarefas: any[]  = (tData as any) ?? [];
  const projetos: any[] = (pData as any) ?? [];
  const loading = tData === undefined;

  const carregar = useCallback(() => Promise.all([mT(), mP()]), [mT, mP]);

  const tarefasFiltradas = useMemo(() => tarefas.filter(t =>
    (!filtroProjeto || t.projeto_id === filtroProjeto) &&
    (!filtroCat || t.categoria === filtroCat),
  ), [tarefas, filtroProjeto, filtroCat]);

  // ── Faixa "Hoje": atrasadas + vencendo hoje, nunca concluídas ─────────
  // Ordena por atraso (mais velha primeiro) e depois por prioridade: o que
  // está parado há mais tempo é o que trava o resto.
  const agora = useMemo(() => tarefasFiltradas
    .filter(t => !t.concluida && t.data_vencimento && diasAte(t.data_vencimento) <= 0)
    .sort((a, b) => diasAte(a.data_vencimento) - diasAte(b.data_vencimento)
      || PESO_PRI[a.prioridade] - PESO_PRI[b.prioridade]),
  [tarefasFiltradas]);

  const porColuna = useMemo(() => {
    const m: any = { a_fazer: [], em_progresso: [], concluida: [] };
    tarefasFiltradas.forEach(t => {
      const col = t.concluida ? 'concluida' : (t.status_kanban || 'a_fazer');
      (m[col] || m.a_fazer).push(t);
    });
    // Dentro da coluna: quem tem prazo antes, e o mais urgente na frente.
    for (const k of Object.keys(m)) {
      m[k].sort((a: any, b: any) => {
        if (!!a.data_vencimento !== !!b.data_vencimento) return a.data_vencimento ? -1 : 1;
        if (a.data_vencimento && b.data_vencimento && a.data_vencimento !== b.data_vencimento)
          return a.data_vencimento < b.data_vencimento ? -1 : 1;
        return PESO_PRI[a.prioridade] - PESO_PRI[b.prioridade];
      });
    }
    return m;
  }, [tarefasFiltradas]);

  // ── Lista: agrupada por PRAZO, que é como a pessoa pensa o dia ────────
  const grupos = useMemo(() => {
    const abertas = tarefasFiltradas.filter(t => !t.concluida);
    const g: { chave: string; titulo: string; cor: string; itens: any[] }[] = [
      { chave: 'atraso',  titulo: 'Atrasadas',    cor: '#ef4444', itens: [] },
      { chave: 'hoje',    titulo: 'Hoje',         cor: '#f97316', itens: [] },
      { chave: 'semana',  titulo: 'Próximos 7 dias', cor: '#eab308', itens: [] },
      { chave: 'depois',  titulo: 'Mais pra frente', cor: BRAND,   itens: [] },
      { chave: 'semdata', titulo: 'Sem prazo',    cor: 'hsl(var(--muted-foreground))', itens: [] },
    ];
    const ix = Object.fromEntries(g.map((x, i) => [x.chave, i]));
    for (const t of abertas) {
      if (!t.data_vencimento) { g[ix.semdata].itens.push(t); continue; }
      const d = diasAte(t.data_vencimento);
      if (d < 0)      g[ix.atraso].itens.push(t);
      else if (d === 0) g[ix.hoje].itens.push(t);
      else if (d <= 7)  g[ix.semana].itens.push(t);
      else              g[ix.depois].itens.push(t);
    }
    for (const x of g) x.itens.sort((a, b) => PESO_PRI[a.prioridade] - PESO_PRI[b.prioridade]);
    const feitas = tarefasFiltradas.filter(t => t.concluida);
    if (feitas.length) g.push({ chave: 'feitas', titulo: 'Concluídas', cor: '#22c55e', itens: feitas });
    return g.filter(x => x.itens.length);
  }, [tarefasFiltradas]);

  // Progresso por projeto — de graça visualmente e responde "quanto falta?".
  const progressoProjeto = useMemo(() => {
    const m: Record<string, { feitas: number; total: number }> = {};
    for (const t of tarefas) {
      if (!t.projeto_id) continue;
      const p = (m[t.projeto_id] = m[t.projeto_id] || { feitas: 0, total: 0 });
      p.total++; if (t.concluida) p.feitas++;
    }
    return m;
  }, [tarefas]);

  // Categorias que REALMENTE aparecem nas tarefas — filtro que oferece opção
  // vazia é filtro que devolve "nenhum resultado" e parece quebrado.
  const catsEmUso = useMemo(() => {
    const usadas = new Set(tarefas.map(t => t.categoria).filter(Boolean));
    return CATEGORIAS.filter(c => usadas.has(c.v));
  }, [tarefas]);

  // ── Mutações otimistas ────────────────────────────────────────────────
  const patchLocal = (id: string, patch: any) => (cur: any) =>
    (cur || []).map((x: any) => x.id === id ? { ...x, ...patch } : x);

  async function moverTarefa(t: any, novaCol: string) {
    const patch = { status_kanban: novaCol, concluida: novaCol === 'concluida' };
    try {
      await mT(async () => { await api.grow.tarefas.editar(t.id, patch); return undefined; },
        { optimisticData: patchLocal(t.id, patch), rollbackOnError: true, populateCache: false, revalidate: false });
    } catch (e: any) { alert(e.message); }
  }

  /** Concluir/reabrir direto no card — o caminho curto pro gesto mais comum. */
  async function alternarConcluida(t: any) {
    const concluida = !t.concluida;
    const patch = { concluida, status_kanban: concluida ? 'concluida' : 'a_fazer' };
    try {
      await mT(async () => { await api.grow.tarefas.editar(t.id, patch); return undefined; },
        { optimisticData: patchLocal(t.id, patch), rollbackOnError: true, populateCache: false, revalidate: false });
    } catch (e: any) { alert(e.message); }
  }

  async function deletarTarefa(t: any) {
    if (!phone) return;
    if (!confirm(`Excluir "${t.titulo}"?`)) return;
    try {
      await mT(async () => { await api.grow.tarefas.deletar(t.id, phone); return undefined; },
        { optimisticData: (cur: any) => (cur || []).filter((x: any) => x.id !== t.id),
          rollbackOnError: true, populateCache: false, revalidate: false });
    } catch (e: any) { alert(e.message); }
  }

  const abrirEdicao = (t: any) => { setEditando(t); setNovaOpen(true); };
  const temFiltro = !!filtroProjeto || !!filtroCat;

  return (
    <div className="max-w-7xl mx-auto pb-20 space-y-6">
      <GrowHero
        badge="Tarefas"
        titulo="Tarefas"
        subtitulo="Prazo, prioridade e projeto num lugar só. O que vence hoje aparece primeiro."
      >
        <button onClick={() => setNovoProjeto(true)}
                className="btn-ghost px-3 py-2 text-sm gap-2 inline-flex items-center">
          <FolderPlus size={14} /> Novo projeto
        </button>
        <button onClick={() => { setEditando(null); setNovaOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white text-sm font-bold shadow-lg shadow-primary/30">
          <Plus size={16} /> Nova tarefa
        </button>
      </GrowHero>

      {/* ══ FAIXA HOJE ══════════════════════════════════════════════════
          Só existe quando tem algo. Banda vazia todo dia ensina a ignorar
          aquele espaço — e aí ela não serve nem quando importa. */}
      {!loading && agora.length > 0 && (
        <FaixaHoje itens={agora} onConcluir={alternarConcluida} onAbrir={abrirEdicao} />
      )}

      {/* ══ FILTROS ═════════════════════════════════════════════════════ */}
      {(projetos.length > 0 || catsEmUso.length > 0) && (
        <div className="space-y-2.5 animate-fade-in" style={{ animationDelay: '60ms' }}>
          {projetos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <PillFiltro ativo={filtroProjeto === null} onClick={() => setFiltroProjeto(null)}>Todos</PillFiltro>
              {projetos.map(p => {
                const pr = progressoProjeto[p.id];
                return (
                  <PillFiltro key={p.id} ativo={filtroProjeto === p.id} cor={p.cor}
                              onClick={() => setFiltroProjeto(filtroProjeto === p.id ? null : p.id)}>
                    <span aria-hidden>{p.icone}</span> {p.nome}
                    {pr && pr.total > 0 && (
                      <span className="tabular opacity-70">{pr.feitas}/{pr.total}</span>
                    )}
                  </PillFiltro>
                );
              })}
            </div>
          )}
          {catsEmUso.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {catsEmUso.map(c => {
                const Icone = c.icon;
                return (
                  <PillFiltro key={c.v} ativo={filtroCat === c.v} cor={c.cor}
                              onClick={() => setFiltroCat(filtroCat === c.v ? null : c.v)}>
                    <Icone size={12} /> {c.v}
                  </PillFiltro>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Barra de progresso do projeto filtrado — some quando "Todos". */}
      {filtroProjeto && progressoProjeto[filtroProjeto]?.total > 0 && (
        <BarraProjeto
          projeto={projetos.find(p => p.id === filtroProjeto)}
          {...progressoProjeto[filtroProjeto]}
        />
      )}

      {/* ══ TROCA DE VISÃO ══════════════════════════════════════════════ */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          <span className="tabular font-semibold text-foreground">{tarefasFiltradas.filter(t => !t.concluida).length}</span> em aberto
          {temFiltro && <> · <button onClick={() => { setFiltroProjeto(null); setFiltroCat(null); }}
                                    className="underline hover:text-foreground">limpar filtro</button></>}
        </p>
        <div role="tablist" aria-label="Modo de visualização"
             className="inline-flex p-1 rounded-xl border border-border/60 bg-card/60 backdrop-blur-xl">
          {([['lista', ListIcon, 'Lista'], ['quadro', LayoutGrid, 'Quadro']] as const).map(([v, Icone, label]) => (
            <button key={v} role="tab" aria-selected={visao === v} onClick={() => trocarVisao(v)}
                    className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-all ${
                      visao === v ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}>
              <Icone size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ CONTEÚDO ════════════════════════════════════════════════════ */}
      {loading ? (
        <Skeleton visao={visao} />
      ) : tarefasFiltradas.length === 0 ? (
        <Vazio temFiltro={temFiltro}
               onLimpar={() => { setFiltroProjeto(null); setFiltroCat(null); }}
               onCriar={() => { setEditando(null); setNovaOpen(true); }} />
      ) : visao === 'lista' ? (
        <div className="space-y-6">
          {grupos.map((g, gi) => (
            <section key={g.chave} className="animate-[slide-up_500ms_ease-out_both]"
                     style={{ animationDelay: `${gi * 50}ms` }}>
              <div className="flex items-center gap-2 mb-2.5 px-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: g.cor }} aria-hidden />
                <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: g.cor }}>{g.titulo}</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular">
                  {g.itens.length}
                </span>
              </div>
              <div className="space-y-2">
                {g.itens.map((t, i) => (
                  <CardTarefa key={t.id} t={t} i={i} modo="lista"
                              onConcluir={alternarConcluida} onAbrir={abrirEdicao}
                              onDeletar={deletarTarefa} onMover={moverTarefa} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        // ⚠️ No celular o quadro ROLA NA HORIZONTAL com snap, em vez de
        // empilhar as 3 colunas — empilhado, chegar em "Concluídas" exige
        // rolar a lista inteira duas vezes. `snap-x` faz cada coluna parar
        // certinho, e a coluna a 85vw deixa a próxima aparecendo na borda,
        // que é o que sinaliza "tem mais pro lado".
        <div className="flex lg:grid lg:grid-cols-3 gap-4 overflow-x-auto lg:overflow-visible
                        snap-x snap-mandatory scrollbar-none -mx-1 px-1 pb-2">
          {COLUNAS.map((col, ci) => (
            <div key={col.v}
                 className="snap-start shrink-0 w-[85vw] sm:w-[60vw] lg:w-auto rounded-3xl border border-border/40 backdrop-blur-xl p-4 min-h-[260px] animate-[slide-up_500ms_ease-out_both]"
                 style={{ background: 'hsl(var(--bg-card) / 0.5)', animationDelay: `${ci * 60}ms` }}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div>
                  <h2 className="text-sm font-bold text-foreground">{col.l}</h2>
                  <p className="text-[10px] text-muted-foreground">{col.sub}</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground tabular">
                  {porColuna[col.v]?.length || 0}
                </span>
              </div>
              <div className="space-y-2">
                {porColuna[col.v]?.length === 0 ? (
                  <p className="text-center py-8 text-xs text-muted-foreground">Nada aqui.</p>
                ) : porColuna[col.v].map((t: any, i: number) => (
                  <CardTarefa key={t.id} t={t} i={i} modo="quadro" colunaAtual={col.v}
                              onConcluir={alternarConcluida} onAbrir={abrirEdicao}
                              onDeletar={deletarTarefa} onMover={moverTarefa} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {novaOpen && phone && (
        <ModalTarefa
          phone={phone} tarefa={editando} projetos={projetos}
          onClose={() => { setNovaOpen(false); setEditando(null); }}
          onSuccess={() => { carregar(); setNovaOpen(false); setEditando(null); }}
        />
      )}
      {novoProjeto && phone && (
        <ModalProjeto phone={phone} onClose={() => setNovoProjeto(false)}
                      onSuccess={() => { carregar(); setNovoProjeto(false); }} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   FAIXA HOJE — a resposta pra "o que eu faço agora?"
   ═══════════════════════════════════════════════════════════════════════ */
function FaixaHoje({ itens, onConcluir, onAbrir }: any) {
  const atrasadas = itens.filter((t: any) => diasAte(t.data_vencimento) < 0).length;
  const cor = atrasadas > 0 ? '#ef4444' : '#f97316';

  return (
    <section
      className="relative overflow-hidden rounded-3xl border backdrop-blur-xl p-5 animate-[slide-up_500ms_ease-out_both]"
      style={{ background: 'hsl(var(--bg-card) / 0.5)', borderColor: `color-mix(in srgb, ${cor} 35%, transparent)` }}
      aria-label="Tarefas para agora"
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${cor} 20%, transparent) 0%, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3.5">
          <span className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `color-mix(in srgb, ${cor} 15%, transparent)` }}>
            <Flame size={16} style={{ color: cor }} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground leading-tight">Pra agora</h2>
            {/* Ícone + texto, nunca só a cor: quem não distingue vermelho de
                laranja precisa ler quantas estão atrasadas. */}
            <p className="text-[11px] text-muted-foreground leading-tight">
              {atrasadas > 0
                ? <><span className="font-bold" style={{ color: cor }}>{atrasadas} atrasada{atrasadas > 1 ? 's' : ''}</span>
                    {itens.length > atrasadas && <> · {itens.length - atrasadas} vencendo hoje</>}</>
                : <>{itens.length} vencendo hoje</>}
            </p>
          </div>
        </div>

        <ul className="space-y-1.5">
          {itens.slice(0, 5).map((t: any) => {
            const pri = priDe(t.prioridade);
            const pz = rotuloPrazo(t.data_vencimento);
            return (
              <li key={t.id} className="flex items-center gap-2.5 rounded-2xl bg-card/60 border border-border/40 pl-1 pr-3 py-1">
                <BotaoConcluir t={t} onConcluir={onConcluir} />
                <button onClick={() => onAbrir(t)} className="flex-1 min-w-0 text-left py-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{t.titulo}</p>
                  <p className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: TOM_COR[pz.tom] }}>
                    <CalendarClock size={10} /> {pz.txt}
                    <span className="text-muted-foreground">· {pri.l}</span>
                  </p>
                </button>
                <ArrowRight size={13} className="text-muted-foreground/50 flex-shrink-0" aria-hidden />
              </li>
            );
          })}
        </ul>
        {itens.length > 5 && (
          <p className="text-[11px] text-muted-foreground mt-2.5 px-1">
            + {itens.length - 5} na lista abaixo
          </p>
        )}
      </div>
    </section>
  );
}

/** Alvo de 44px de propósito: é o gesto mais repetido da tela. */
function BotaoConcluir({ t, onConcluir }: any) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onConcluir(t); }}
      role="checkbox" aria-checked={!!t.concluida}
      aria-label={t.concluida ? `Reabrir ${t.titulo}` : `Concluir ${t.titulo}`}
      className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-xl hover:bg-muted/60 transition-colors active:scale-90"
    >
      <span className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
        t.concluida ? 'bg-emerald-500' : 'border-2 border-muted-foreground/40'
      }`}>
        {t.concluida && <Check size={12} className="text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CARD DE TAREFA
   ═══════════════════════════════════════════════════════════════════════ */
function CardTarefa({ t, i, modo, colunaAtual, onConcluir, onAbrir, onDeletar, onMover }: any) {
  const pri = priDe(t.prioridade);
  const cat = catDe(t.categoria);
  const pz = t.data_vencimento ? rotuloPrazo(t.data_vencimento) : null;
  const atrasada = !t.concluida && pz?.tom === 'atraso';
  const IconeCat = cat?.icon;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border backdrop-blur-xl transition-all
                 hover:border-primary/40 animate-[slide-up_400ms_ease-out_both]"
      style={{
        background: 'hsl(var(--bg-card) / 0.5)',
        // A prioridade vira o clima do card, não só um pontinho. Atrasada
        // rouba o clima pra vermelho — é a informação mais urgente ali.
        borderColor: atrasada ? 'color-mix(in srgb, #ef4444 45%, transparent)' : 'hsl(var(--border) / 0.5)',
        animationDelay: `${Math.min(i * 35, 280)}ms`,
      }}
    >
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{ background: `radial-gradient(circle at top right, color-mix(in srgb, ${atrasada ? '#ef4444' : pri.cor} 14%, transparent) 0%, transparent 70%)` }} />
      {/* Faixa de prioridade na lateral: legível de longe sem depender de ler. */}
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: pri.cor }} />

      <div className="relative flex items-start gap-1 pl-1 pr-2 py-1">
        <BotaoConcluir t={t} onConcluir={onConcluir} />

        <button onClick={() => onAbrir(t)} className="flex-1 min-w-0 text-left py-2 pr-1">
          <p className={`text-sm font-medium leading-snug ${t.concluida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {t.titulo}
          </p>

          {/* Metadados: só o que existe. Linha vazia de chip é ruído.
              ⚠️ `!!` OBRIGATÓRIO no fim da condição. Sem ele, uma tarefa sem
              prazo, categoria, projeto e recorrência caía em `t.tags?.length`,
              que numa lista VAZIA vale `0` — e o `&&` devolvia esse `0`, que o
              React IMPRIME como texto. Era o "0" solto que aparecia embaixo do
              título das tarefas sem nenhum chip (as com tag não mostravam,
              porque aí o length era 1 e virava true). */}
          {!!(pz || cat || t.projetos || t.recorrente || t.tags?.length) && (
            <div className="flex items-center gap-1.5 gap-y-1 mt-1.5 flex-wrap">
              {pz && !t.concluida && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ color: TOM_COR[pz.tom], background: `color-mix(in srgb, ${TOM_COR[pz.tom]} 12%, transparent)` }}>
                  <CalendarClock size={9} /> {pz.txt}
                </span>
              )}
              {t.recorrente && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                  <Repeat size={9} /> {freqDe(t.frequencia_recorrencia)}
                </span>
              )}
              {cat && IconeCat && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ color: cat.cor, background: `color-mix(in srgb, ${cat.cor} 12%, transparent)` }}>
                  <IconeCat size={9} /> {cat.v}
                </span>
              )}
              {t.projetos && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{ background: `color-mix(in srgb, ${t.projetos.cor} 13%, transparent)`, color: t.projetos.cor }}>
                  <span aria-hidden>{t.projetos.icone}</span> {t.projetos.nome}
                </span>
              )}
              {t.tags?.map((tag: string, k: number) => (
                <span key={k} className="text-[10px] text-muted-foreground inline-flex items-center gap-0.5">
                  <Tag size={8} /> {tag}
                </span>
              ))}
            </div>
          )}
        </button>

        {/* ⚠️ `lg:opacity-0` e não `opacity-0`: no celular não existe hover, e
            o botão ficaria invisível pra sempre. */}
        <button onClick={(e) => { e.stopPropagation(); onDeletar(t); }}
                aria-label={`Excluir ${t.titulo}`}
                className="w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-xl
                           lg:opacity-0 lg:group-hover:opacity-100 transition-opacity
                           hover:bg-red-500/10 active:scale-90">
          <Trash2 size={13} className="text-red-500" />
        </button>
      </div>

      {/* Mover entre colunas — só no quadro, onde a coluna é o assunto. Na
          lista o agrupamento é por PRAZO, e um botão "> A fazer" ali seria
          uma ação sem contexto visível. */}
      {modo === 'quadro' && (
        <div className="relative flex items-center gap-1 px-3 pb-2 pl-12">
          {COLUNAS.filter(c => c.v !== colunaAtual).map(c => (
            <button key={c.v} onClick={(e) => { e.stopPropagation(); onMover(t, c.v); }}
                    className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-muted/50 hover:bg-primary/10
                               text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
              <ArrowRight size={9} /> {c.l}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Peças menores
   ═══════════════════════════════════════════════════════════════════════ */
function PillFiltro({ ativo, cor, onClick, children }: any) {
  return (
    <button onClick={onClick} aria-pressed={ativo}
      className={`inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-semibold transition-all ${
        ativo ? 'text-white shadow-sm' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
      }`}
      style={ativo ? { background: cor || BRAND } : (cor ? { color: cor } : undefined)}>
      {children}
    </button>
  );
}

function BarraProjeto({ projeto, feitas, total }: any) {
  if (!projeto) return null;
  const pct = Math.round((feitas / total) * 100);
  return (
    <div className="rounded-2xl border border-border/40 backdrop-blur-xl p-4 animate-fade-in"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-foreground inline-flex items-center gap-1.5">
          <span aria-hidden>{projeto.icone}</span> {projeto.nome}
        </p>
        <p className="text-xs font-bold tabular" style={{ color: projeto.cor }}>
          {feitas}/{total} · {pct}%
        </p>
      </div>
      <div className="h-2 rounded-full bg-muted/60 overflow-hidden"
           role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
           aria-label={`Progresso do projeto ${projeto.nome}`}>
        <div className="h-full rounded-full transition-all duration-500"
             style={{ width: `${pct}%`, background: projeto.cor }} />
      </div>
    </div>
  );
}

function Skeleton({ visao }: { visao: 'lista' | 'quadro' }) {
  if (visao === 'lista') {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[0, 1, 2].map(c => (
        <div key={c} className="rounded-3xl border border-border/40 p-4 min-h-[260px] space-y-3 animate-pulse"
             style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
          <div className="h-5 w-24 rounded bg-muted/50" />
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/40" />)}
        </div>
      ))}
    </div>
  );
}

function Vazio({ temFiltro, onLimpar, onCriar }: any) {
  return (
    <div className="rounded-3xl border border-border/40 backdrop-blur-xl p-10 text-center"
         style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
      <CircleDashed size={28} className="mx-auto text-muted-foreground/50 mb-3" />
      <p className="text-sm font-semibold text-foreground">
        {temFiltro ? 'Nada com esse filtro.' : 'Nenhuma tarefa por aqui.'}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
        {temFiltro
          ? 'Tente outro projeto ou categoria.'
          : 'Crie aqui ou mande pela Sora no WhatsApp: “lembra de comprar as passagens”.'}
      </p>
      <button onClick={temFiltro ? onLimpar : onCriar}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-primary text-white text-sm font-bold">
        {temFiltro ? <>Limpar filtro</> : <><Plus size={15} /> Nova tarefa</>}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAL DE TAREFA
   ═══════════════════════════════════════════════════════════════════════ */
function ModalTarefa({ phone, tarefa, projetos, onClose, onSuccess }: any) {
  const ed = !!tarefa;
  const [titulo, setTitulo] = useState(tarefa?.titulo || '');
  const [descricao, setDescricao] = useState(tarefa?.descricao || '');
  const [prioridade, setPrioridade] = useState(tarefa?.prioridade || 'media');
  const [projetoId, setProjetoId] = useState(tarefa?.projeto_id || '');
  const [categoria, setCategoria] = useState<string>(tarefa?.categoria || '');
  const [prazo, setPrazo] = useState<string>((tarefa?.data_vencimento || '').slice(0, 10));
  const [recorrente, setRecorrente] = useState<boolean>(!!tarefa?.recorrente);
  const [frequencia, setFrequencia] = useState<string>(tarefa?.frequencia_recorrencia || 'semanal');
  const [tagsStr, setTagsStr] = useState((tarefa?.tags || []).join(', '));
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  async function salvar() {
    setErro('');
    if (!titulo.trim()) { setErro('Dê um título pra tarefa — é como ela vai aparecer na lista.'); return; }
    setLoading(true);
    const tags = tagsStr.split(',').map((t: string) => t.trim()).filter(Boolean);
    const corpo = {
      titulo: titulo.trim(), descricao, prioridade,
      projeto_id: projetoId || null,
      categoria: categoria || null,
      data_vencimento: prazo || null,
      recorrente,
      frequencia_recorrencia: recorrente ? frequencia : null,
      tags,
    };
    try {
      if (ed) await api.grow.tarefas.editar(tarefa.id, corpo);
      else    await api.grow.tarefas.criar({ phone, ...corpo });
      onSuccess();
    } catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  const atalhoPrazo = (dias: number | null) => {
    if (dias === null) { setPrazo(''); return; }
    const d = new Date(); d.setDate(d.getDate() + dias);
    setPrazo(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full md:max-w-md bg-card rounded-t-3xl md:rounded-3xl shadow-2xl border border-border max-h-[92vh] overflow-y-auto animate-fade-in"
           onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-base font-bold text-foreground">{ed ? 'Editar tarefa' : 'Nova tarefa'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <Campo label="Título">
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="O que precisa fazer?" className="input" autoFocus />
          </Campo>

          <Campo label="Descrição" opcional>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} placeholder="Detalhes…" className="input" />
          </Campo>

          {/* ── PRAZO — o campo que faltava e por isso ninguém usava ──── */}
          <Campo label="Prazo" opcional>
            {/* Atalhos primeiro: "hoje/amanhã/semana" cobre quase todo caso e
                evita abrir o seletor de data pra escolher amanhã. */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {([['Hoje', 0], ['Amanhã', 1], ['Em 7 dias', 7]] as const).map(([l, d]) => (
                <button key={l} type="button" onClick={() => atalhoPrazo(d)}
                        className="px-3 h-9 rounded-xl text-xs font-semibold bg-muted/50 hover:bg-primary/10 hover:text-primary transition-colors">
                  {l}
                </button>
              ))}
              {prazo && (
                <button type="button" onClick={() => atalhoPrazo(null)}
                        className="px-3 h-9 rounded-xl text-xs font-semibold text-muted-foreground hover:text-red-500 transition-colors inline-flex items-center gap-1">
                  <X size={12} /> Sem prazo
                </button>
              )}
            </div>
            <input type="date" value={prazo} onChange={e => setPrazo(e.target.value)} className="input" />
            {prazo && (
              <p className="text-[11px] mt-1.5 inline-flex items-center gap-1" style={{ color: TOM_COR[rotuloPrazo(prazo).tom] }}>
                <CalendarClock size={11} /> {rotuloPrazo(prazo).txt} · aparece na Agenda
              </p>
            )}
          </Campo>

          {/* ── RECORRÊNCIA ─────────────────────────────────────────── */}
          <div>
            <button type="button" onClick={() => setRecorrente(v => !v)}
                    role="switch" aria-checked={recorrente}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-colors text-left ${
                      recorrente ? 'bg-primary/10 border-primary/40' : 'bg-muted/30 border-border hover:bg-muted/50'
                    }`} style={{ minHeight: 44 }}>
              <span className={`w-9 h-5 rounded-full flex items-center px-0.5 transition-colors flex-shrink-0 ${
                recorrente ? 'bg-primary justify-end' : 'bg-muted-foreground/30 justify-start'
              }`}>
                <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground inline-flex items-center gap-1.5">
                  <Repeat size={13} /> Tarefa que se repete
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  {recorrente ? freqDe(frequencia) : 'Acontece uma vez só'}
                </span>
              </span>
            </button>

            {/* Progressive disclosure: a frequência só aparece quando faz
                sentido — mostrá-la desligada seria escolha morta na tela. */}
            {recorrente && (
              <div className="grid grid-cols-2 gap-1.5 mt-2">
                {FREQUENCIAS.map(f => (
                  <button key={f.v} type="button" onClick={() => setFrequencia(f.v)}
                          aria-pressed={frequencia === f.v}
                          className={`h-11 rounded-xl text-xs font-bold transition-all ${
                            frequencia === f.v ? 'bg-primary text-white shadow-sm' : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                          }`}>
                    {f.l}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Campo label="Prioridade">
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORIDADES.map(p => (
                <button key={p.v} type="button" onClick={() => setPrioridade(p.v)}
                  aria-pressed={prioridade === p.v}
                  className={`p-2.5 rounded-xl border transition-all ${prioridade === p.v ? 'ring-1' : 'border-border bg-muted/20 hover:border-primary/40'}`}
                  style={prioridade === p.v ? { borderColor: p.cor, background: `color-mix(in srgb, ${p.cor} 8%, transparent)`, ['--tw-ring-color' as any]: p.cor } : {}}>
                  <span className="w-2 h-2 rounded-full block mx-auto mb-1" style={{ background: p.cor }} />
                  <span className="block text-[10px] font-bold text-foreground">{p.l}</span>
                </button>
              ))}
            </div>
          </Campo>

          {/* ── CATEGORIA — a IA do WhatsApp já preenche; aqui dá pra
                 corrigir ou definir na mão. ─────────────────────────── */}
          <Campo label="Categoria" opcional>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIAS.map(c => {
                const Icone = c.icon;
                const on = categoria === c.v;
                return (
                  <button key={c.v} type="button" aria-pressed={on}
                          onClick={() => setCategoria(on ? '' : c.v)}
                          className={`inline-flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-semibold transition-all ${
                            on ? 'text-white shadow-sm' : 'bg-muted/40 hover:bg-muted'
                          }`}
                          style={on ? { background: c.cor } : { color: c.cor }}>
                    <Icone size={13} /> {c.v}
                  </button>
                );
              })}
            </div>
          </Campo>

          {projetos.length > 0 && (
            <Campo label="Projeto" opcional>
              <select value={projetoId} onChange={e => setProjetoId(e.target.value)} className="input">
                <option value="">— Sem projeto —</option>
                {projetos.map((p: any) => <option key={p.id} value={p.id}>{p.icone} {p.nome}</option>)}
              </select>
            </Campo>
          )}

          <Campo label="Tags" opcional hint="separe por vírgula">
            <input value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="trabalho, urgente" className="input" />
          </Campo>

          {erro && (
            <div role="alert" className="rounded-xl p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 flex items-start gap-2">
              <AlertCircle size={14} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-400">{erro}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 px-6 py-4 border-t border-border bg-card">
          <button onClick={onClose} className="btn-ghost px-4 py-2.5 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !titulo.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {ed ? 'Salvar' : 'Criar tarefa'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, opcional, hint, children }: any) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        {label}
        {opcional && <span className="normal-case tracking-normal font-normal text-muted-foreground/60">(opcional)</span>}
        {hint && <span className="normal-case tracking-normal font-normal text-muted-foreground/60">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MODAL DE PROJETO
   ═══════════════════════════════════════════════════════════════════════ */
function ModalProjeto({ phone, onClose, onSuccess }: any) {
  const [nome, setNome] = useState('');
  const [icone, setIcone] = useState('📋');
  const [cor, setCor] = useState(BRAND);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const ICONES_PROJ = ['📋','💼','🏠','🎓','💪','✈️','🎨','🔬','💻','📚','🎮','🛒'];
  const CORES_PROJ = ['hsl(var(--primary))','#ec4899','#f59e0b','#10b981','#06b6d4','#3b82f6','#ef4444','#84cc16'];

  async function salvar() {
    setErro('');
    if (!nome.trim()) { setErro('Dê um nome ao projeto.'); return; }
    setLoading(true);
    try { await api.grow.projetos.criar({ phone, nome: nome.trim(), icone, cor }); onSuccess(); }
    catch (e: any) { setErro(e.message); } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full md:max-w-sm bg-card rounded-t-3xl md:rounded-3xl shadow-2xl border border-border animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Novo projeto</h2>
          <button onClick={onClose} aria-label="Fechar" className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-muted"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do projeto" className="input" autoFocus />
          <div className="grid grid-cols-6 gap-2">
            {ICONES_PROJ.map(i => (
              <button key={i} onClick={() => setIcone(i)} aria-pressed={icone === i} aria-label={`Ícone ${i}`}
                      className={`w-11 h-11 rounded-xl text-xl transition-all ${icone === i ? 'ring-2 ring-primary bg-primary/10' : 'bg-muted/40 hover:bg-muted'}`}>{i}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {CORES_PROJ.map(c => (
              <button key={c} onClick={() => setCor(c)} aria-pressed={cor === c} aria-label="Cor do projeto"
                className={`w-11 h-11 rounded-xl transition-all ${cor === c ? 'ring-2 ring-offset-2 ring-offset-card' : ''}`}
                style={{ background: c, ['--tw-ring-color' as any]: c }} />
            ))}
          </div>
          {erro && <p role="alert" className="text-xs text-red-600">{erro}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="btn-ghost px-4 py-2.5 text-sm">Cancelar</button>
          <button onClick={salvar} disabled={loading || !nome.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Criar
          </button>
        </div>
      </div>
    </div>
  );
}
