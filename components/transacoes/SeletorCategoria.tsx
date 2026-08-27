'use client';

// ═════════════════════════════════════════════════════════════════════════
// Seletor de categoria — substitui o <select> nativo.
//
// POR QUE TROCAR O NATIVO: ele lista TUDO em ordem alfabética, num só nível e
// sem separar despesa de receita. Numa taxonomia de ~130 categorias em dois
// níveis, isso vira uma parede: "Academia, Acessórios, Adidas, Água, AiqFome,
// Ajuste, Ajuste recebido, Aliexpress…" — e o pior, com o lançamento marcado
// como Recebimento a lista abria em "BCAA". A hierarquia que existe no banco
// (pai → filhas) some, e o dropdown do sistema ainda estoura pra fora do modal.
//
// Aqui: busca, agrupamento por categoria-pai e filtro pelo TIPO do lançamento.
//
// ⚠️ A CATEGORIA ATUAL NUNCA SOME DA LISTA. Existe lançamento gravado com
// categoria do tipo oposto (o "Recebimento com categoria BCAA" foi o caso que
// originou esta tela). Filtrar por tipo sem essa garantia esconderia o valor
// que está selecionado — e o seletor mostraria uma coisa e a lista, outra.
// ═════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { getCategoriaTheme, nomeCategoria } from '@/lib/categorias';
import CategoriaIcon from '@/components/ui/CategoriaIcon';

export type CatItem = {
  id?: string;
  nome: string;
  tipo?: string | null;
  parent_id?: string | null;
  icone?: string | null;
};

/** Sem acento e minúsculo — pra "agua" achar "Água" e "educacao" achar "Educação". */
const chave = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const tipoDe = (c: CatItem) => (c.tipo === 'receita' ? 'receita' : 'despesa');

export default function SeletorCategoria({
  valor, onChange, cats, tipoLancamento, id,
}: {
  valor: string;
  onChange: (nome: string) => void;
  cats: CatItem[];
  /** 'Gasto' | 'Recebimento' — decide qual metade da taxonomia abre primeiro. */
  tipoLancamento: 'Gasto' | 'Recebimento';
  id?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [verOutroTipo, setVerOutroTipo] = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  const tipoAlvo = tipoLancamento === 'Recebimento' ? 'receita' : 'despesa';

  // Abrir foca a busca: quem abre o seletor quase sempre já sabe o nome, e
  // digitar 3 letras é mais rápido que rolar 130 linhas.
  useEffect(() => {
    if (aberto) buscaRef.current?.focus();
    else { setBusca(''); setVerOutroTipo(false); }
  }, [aberto]);

  // Esc fecha o PAINEL, não o modal. Sem isto o Esc não faria nada aqui e a
  // única saída seria clicar fora — que fecharia o modal inteiro e jogaria a
  // edição fora.
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); setAberto(false); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [aberto]);

  // Clique fora do painel fecha só ele.
  useEffect(() => {
    if (!aberto) return;
    const onDoc = (e: MouseEvent) => {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [aberto]);

  const porId = useMemo(() => new Map(cats.filter(c => c.id).map(c => [c.id!, c])), [cats]);

  /** Grupos: cada categoria-pai com as filhas embaixo. */
  const grupos = useMemo(() => {
    const doTipo = cats.filter(c => tipoDe(c) === tipoAlvo || verOutroTipo);
    const pais = doTipo.filter(c => !c.parent_id)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const lista = pais.map(p => ({
      pai: p,
      filhas: doTipo.filter(c => c.parent_id && c.parent_id === p.id)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }));

    // Filha cujo pai ficou de fora (pai de outro tipo, ou catálogo incompleto)
    // não pode sumir — juntamos num grupo solto no fim.
    const orfas = doTipo.filter(c => c.parent_id && !porId.has(c.parent_id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    if (orfas.length) lista.push({ pai: { nome: 'Outras' } as CatItem, filhas: orfas });

    return lista;
  }, [cats, tipoAlvo, verOutroTipo, porId]);

  /** Busca: some com os grupos e mostra uma lista rasa, com o pai como contexto. */
  const resultados = useMemo(() => {
    const q = chave(busca);
    if (!q) return null;
    return cats
      .filter(c => chave(nomeCategoria(c.nome)).includes(q)
        // Procurar pelo pai também: "aliment" tem de trazer Restaurante e
        // Lanches, que são o que a pessoa quer e não têm a palavra no nome.
        || (c.parent_id && chave(nomeCategoria(porId.get(c.parent_id)?.nome || '')).includes(q)))
      .sort((a, b) => {
        // Quem começa com o termo vem antes de quem só o contém.
        const ia = chave(nomeCategoria(a.nome)).startsWith(q) ? 0 : 1;
        const ib = chave(nomeCategoria(b.nome)).startsWith(q) ? 0 : 1;
        // Dentro do empate, o tipo do lançamento primeiro.
        const ta = tipoDe(a) === tipoAlvo ? 0 : 1;
        const tb = tipoDe(b) === tipoAlvo ? 0 : 1;
        return ia - ib || ta - tb || a.nome.localeCompare(b.nome, 'pt-BR');
      })
      .slice(0, 40);
  }, [busca, cats, porId, tipoAlvo]);

  const atualNaLista = cats.some(c => c.nome === valor);
  const outroTipoQtd = cats.filter(c => tipoDe(c) !== tipoAlvo).length;

  function escolher(nome: string) {
    onChange(nome);
    setAberto(false);
  }

  const Linha = ({ c, indentada }: { c: CatItem; indentada?: boolean }) => {
    const nome = nomeCategoria(c.nome);
    const tema = getCategoriaTheme(c.nome);
    const ativa = c.nome === valor;
    const paiNome = c.parent_id ? nomeCategoria(porId.get(c.parent_id)?.nome || '') : '';
    return (
      <button
        type="button"
        role="option"
        aria-selected={ativa}
        onClick={() => escolher(c.nome)}
        // 44px de alvo (regra de toque), com o indent das filhas marcando a
        // hierarquia sem precisar de linha-guia.
        className={`w-full flex items-center gap-2.5 py-2 pr-3 rounded-xl text-left transition-colors min-h-[44px] ${
          indentada ? 'pl-8' : 'pl-3'
        } ${ativa ? 'bg-primary/10' : 'hover:bg-muted/70'}`}
      >
        <CategoriaIcon nome={c.nome} icone={c.icone || tema.emoji} bg={tema.bg} color={tema.color} size={26} rounded="rounded-lg" />
        <span className={`flex-1 min-w-0 text-sm truncate ${indentada ? 'text-foreground' : 'font-semibold text-foreground'}`}>
          {nome}
          {/* Na busca os grupos somem, então o pai vira sufixo — senão
              "Juros" apareceria duas vezes (Financeiro e Investimentos)
              sem nada que as diferencie. */}
          {busca && paiNome && (
            <span className="text-muted-foreground font-normal"> · {paiNome}</span>
          )}
        </span>
        {ativa && <Check size={15} className="text-primary flex-shrink-0" />}
      </button>
    );
  };

  const temaAtual = getCategoriaTheme(valor || 'Outros');

  return (
    <div className="relative" ref={painelRef}>
      {/* ── Botão ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        id={id}
        onClick={() => setAberto(a => !a)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className="input w-full flex items-center gap-2.5 text-left"
        style={{ minHeight: 44 }}
      >
        {valor ? (
          <>
            <CategoriaIcon nome={valor} icone={temaAtual.emoji} bg={temaAtual.bg} color={temaAtual.color} size={24} rounded="rounded-lg" />
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">{nomeCategoria(valor)}</span>
          </>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">Escolher categoria…</span>
        )}
        <ChevronDown size={16} className={`text-muted-foreground flex-shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Painel ────────────────────────────────────────────────────────
          ⚠️ FLUXO NORMAL, não `absolute`. O modal é `overflow-y-auto`: um
          painel posicionado por cima seria CORTADO na borda dele — que é
          justamente o defeito do dropdown nativo, que vazava pra fora do
          modal. Empurrando o conteúdo, a lista sempre cabe e o modal rola
          normalmente. */}
      {aberto && (
        <div className="mt-2 rounded-2xl border border-border bg-card shadow-lg overflow-hidden">
          {/* Busca */}
          <div className="relative border-b border-border/60">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              ref={buscaRef}
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar categoria…"
              aria-label="Buscar categoria"
              className="w-full bg-transparent pl-9 pr-9 py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            {busca && (
              <button type="button" onClick={() => { setBusca(''); buscaRef.current?.focus(); }}
                      aria-label="Limpar busca"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Lista — altura fixa e rolagem PRÓPRIA: sem isso o painel cresceria
              130 linhas e empurraria valor, data e conta pra muito abaixo. */}
          <div role="listbox" aria-label="Categorias" className="max-h-[280px] overflow-y-auto p-1.5">
            {/* A atual, quando não está no catálogo (categoria antiga, ou de
                outro tipo com o filtro ligado). Fica no topo, rotulada. */}
            {valor && !atualNaLista && (
              <>
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Atual</p>
                <Linha c={{ nome: valor }} />
              </>
            )}

            {resultados ? (
              resultados.length ? (
                resultados.map(c => <Linha key={(c.id || '') + c.nome} c={c} />)
              ) : (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Nada com &ldquo;{busca}&rdquo;.
                </p>
              )
            ) : (
              grupos.map(g => (
                <div key={(g.pai.id || '') + g.pai.nome} className="mb-0.5">
                  {/* O pai É selecionável (lançamento pode ficar na categoria-pai),
                      por isso é uma linha, não um cabeçalho morto. */}
                  {g.pai.id ? <Linha c={g.pai} /> : (
                    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {g.pai.nome}
                    </p>
                  )}
                  {g.filhas.map(f => <Linha key={(f.id || '') + f.nome} c={f} indentada />)}
                </div>
              ))
            )}
          </div>

          {/* Ponte pro outro tipo. Não escondo de vez: a categoria certa às
              vezes está do outro lado (estorno lançado como Recebimento, por
              exemplo), e um seletor que esconde a opção que a pessoa procura é
              pior que um longo. */}
          {!busca && outroTipoQtd > 0 && (
            <button
              type="button"
              onClick={() => setVerOutroTipo(v => !v)}
              className="w-full px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 border-t border-border/60 transition-colors text-left"
            >
              {verOutroTipo
                ? `Ocultar categorias de ${tipoAlvo === 'despesa' ? 'receita' : 'despesa'}`
                : `Mostrar também as de ${tipoAlvo === 'despesa' ? 'receita' : 'despesa'} (${outroTipoQtd})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
