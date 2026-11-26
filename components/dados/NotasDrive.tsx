'use client';

// Aba "Notas" do Drive. Pedido de cliente (nov/2026): "Poderia ter um espaço
// para notas! Eu escrevo muito!".
//
// As notas são a MESMA tabela do "anota que …" do WhatsApp — o que a pessoa
// anota pelo zap aparece aqui, e o que escreve aqui o zap encontra ("o que
// anotei sobre …"). Regras puras em lib/notas.ts (eval:notas).
//
// Organização: fixadas no topo, cadernos (filtro em pílulas), busca que ignora
// acento. O editor (EditorNota) salva sozinho enquanto a pessoa escreve.

import { useMemo, useState } from 'react';
import { Plus, Search, X, Pin, BookMarked, Mic, AlertCircle, NotebookPen } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import {
  type Nota, cadernos as listarCadernos, filtrarNotas, cabecalhoDaNota, quandoMudou, comNota, semNota, chave,
} from '@/lib/notas';
import EditorNota from './EditorNota';

type Aberta = { nota: Nota | null } | null;

export default function NotasDrive({ phone }: { phone: string }) {
  // ⚠️ portao: false — a aba de notas não pode cobrir a tela inteira com o
  // esqueleto da rota enquanto carrega: ela tem o próprio esqueleto aqui.
  const { data, error, mutate } = useApi<Nota[]>(`dados:notas:${phone}`, () => api.dados.notas.listar(phone), { portao: false });
  const [busca, setBusca] = useState('');
  const [caderno, setCaderno] = useState<string | null>(null);
  const [soFixadas, setSoFixadas] = useState(false);
  const [aberta, setAberta] = useState<Aberta>(null);

  const notas = useMemo(() => data ?? [], [data]);
  const cads = useMemo(() => listarCadernos(notas), [notas]);
  const temFixadas = notas.some((n) => n.fixada);

  // Caderno filtrado que deixou de existir (a última nota dele mudou de
  // caderno): a tela volta a "Todas" sozinha, sem estado a sincronizar.
  const cadernoValido = caderno && cads.some((c) => chave(c.nome) === chave(caderno)) ? caderno : null;
  const filtradas = filtrarNotas(notas, { termo: busca, caderno: cadernoValido, soFixadas });
  const separarFixadas = !busca.trim() && !soFixadas && filtradas.some((n) => n.fixada) && filtradas.some((n) => !n.fixada);

  const salvou = (n: Nota) => { void mutate((lista) => comNota(lista, n), { revalidate: false }); };
  const apagou = (id: string) => { void mutate((lista) => semNota(lista, id), { revalidate: false }); };

  const editor = aberta && (
    <EditorNota
      nota={aberta.nota}
      cadernosExistentes={cads.map((c) => c.nome)}
      cadernoInicial={cadernoValido}
      onSalva={salvou}
      onApagada={apagou}
      onFechar={() => { setAberta(null); void mutate(); }}
    />
  );

  // ⚠️ O EDITOR FICA SEMPRE NO MESMO LUGAR DA ÁRVORE (ao lado do corpo). Se
  // cada estado da tela (vazio / lista) o renderizasse dentro do seu próprio
  // bloco, o 1º salvamento da 1ª nota trocaria "vazio" por "lista" e o React
  // montaria o editor DE NOVO: o que já estava escrito sumia da tela e a nota
  // se partia em duas (achado testando em produção).
  return <>{corpo()}{editor}</>;

  function corpo() {
  // ── Falhou a leitura: diz e oferece tentar de novo (nunca "nenhuma nota") ──
  if (error && !data) {
    return (
      <div className="rounded-2xl border border-border/40 p-6 text-center" style={{ background: 'hsl(var(--bg-card) / 0.5)' }}>
        <AlertCircle size={22} className="mx-auto text-red-500" aria-hidden />
        <p className="mt-2 text-sm text-foreground">Não consegui carregar suas notas agora. Elas continuam salvas.</p>
        <button onClick={() => void mutate()} className="mt-3 h-11 px-4 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted">
          Tentar de novo
        </button>
      </div>
    );
  }

  // ── Carregando ──
  if (!data) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-12 rounded-xl bg-muted/50 animate-pulse" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-36 rounded-2xl bg-muted/40 animate-pulse" />)}
        </div>
      </div>
    );
  }

  // ── Nenhuma nota ainda: um convite, não um vazio ──
  if (!notas.length) {
    return (
        <div className="rounded-3xl border border-dashed border-border/60 px-6 py-12 text-center">
          <span className="inline-flex w-14 h-14 rounded-2xl items-center justify-center"
                style={{ background: 'color-mix(in srgb, hsl(var(--primary)) 14%, transparent)' }}>
            <NotebookPen size={24} style={{ color: 'hsl(var(--primary))' }} aria-hidden />
          </span>
          <h2 className="mt-4 text-lg font-bold text-foreground">Seu espaço pra escrever</h2>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Ideias, listas, rascunhos, o que for. Salva sozinho enquanto você escreve, e dá pra separar por cadernos.
          </p>
          <button onClick={() => setAberta({ nota: null })}
                  className="mt-5 inline-flex items-center gap-1.5 h-12 px-5 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/25 active:scale-95">
            <Plus size={16} aria-hidden /> Escrever a primeira nota
          </button>
          <p className="mt-4 text-xs text-muted-foreground">
            Pelo WhatsApp também: mande <b className="text-foreground">anota que …</b> e a nota aparece aqui.
          </p>
        </div>
    );
  }

  const pilula = (ativa: boolean) =>
    `inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-colors ${
      ativa ? 'bg-primary text-white border-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'}`;

  const cartao = (n: Nota, i: number) => {
    const { titulo, previa } = cabecalhoDaNota(n);
    return (
      <button
        key={n.id}
        onClick={() => setAberta({ nota: n })}
        className="group text-left rounded-2xl p-4 border border-border/40 hover:border-border hover:-translate-y-0.5 transition-all flex flex-col min-h-[8.5rem] animate-[slide-up_400ms_ease-out_both]"
        style={{ background: 'hsl(var(--bg-card) / 0.6)', animationDelay: `${Math.min(i, 8) * 35}ms` }}
      >
        <div className="flex items-start gap-2">
          <p className="flex-1 min-w-0 font-semibold text-[15px] text-foreground leading-snug line-clamp-2 break-words">{titulo}</p>
          {n.fixada && <Pin size={14} className="mt-0.5 flex-shrink-0" fill="currentColor" style={{ color: 'hsl(var(--primary))' }} aria-label="Fixada" />}
        </div>
        {previa && (
          <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-line break-words">{previa}</p>
        )}
        <div className="mt-auto pt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          {n.categoria && (
            <span className="inline-flex items-center gap-1 max-w-[60%] px-2 py-0.5 rounded-md bg-muted/70 text-foreground/80">
              <BookMarked size={11} className="flex-shrink-0" aria-hidden /><span className="truncate">{n.categoria}</span>
            </span>
          )}
          {n.origem === 'audio' && <span className="inline-flex items-center gap-0.5" title="Anotada por áudio no WhatsApp"><Mic size={11} aria-hidden /> áudio</span>}
          <span className="ml-auto tabular-nums whitespace-nowrap">{quandoMudou(n.updated_at || n.created_at)}</span>
        </div>
      </button>
    );
  };

  const fixadas = separarFixadas ? filtradas.filter((n) => n.fixada) : [];
  const outras = separarFixadas ? filtradas.filter((n) => !n.fixada) : filtradas;

  return (
    <div className="space-y-4">
      {/* Busca + nova nota */}
      <div className="flex items-center gap-2">
        <label className="flex-1 flex items-center gap-2 h-12 rounded-xl border border-border/60 bg-background px-3.5 focus-within:border-primary">
          <Search size={16} className="text-muted-foreground flex-shrink-0" aria-hidden />
          <span className="sr-only">Buscar nas notas</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nas notas…"
                 className="flex-1 min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          {busca && (
            <button onClick={() => setBusca('')} aria-label="Limpar busca" className="w-8 h-8 -mr-1 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground">
              <X size={15} aria-hidden />
            </button>
          )}
        </label>
        <button onClick={() => setAberta({ nota: null })}
                className="h-12 px-4 rounded-xl bg-primary text-white text-sm font-bold inline-flex items-center gap-1.5 shadow-lg shadow-primary/25 active:scale-95 flex-shrink-0">
          <Plus size={16} aria-hidden /> <span className="hidden sm:inline">Nova nota</span><span className="sm:hidden">Nova</span>
        </button>
      </div>

      {/* Cadernos (só quando há o que filtrar) */}
      {(cads.length > 0 || temFixadas) && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar notas">
          <button onClick={() => { setCaderno(null); setSoFixadas(false); }} className={pilula(!cadernoValido && !soFixadas)} aria-pressed={!cadernoValido && !soFixadas}>
            Todas <span className="opacity-70 tabular-nums">{notas.length}</span>
          </button>
          {temFixadas && (
            <button onClick={() => { setSoFixadas((v) => !v); setCaderno(null); }} className={pilula(soFixadas)} aria-pressed={soFixadas}>
              <Pin size={12} aria-hidden /> Fixadas
            </button>
          )}
          {cads.map((c) => {
            const ativa = !!cadernoValido && chave(cadernoValido) === chave(c.nome);
            return (
              <button key={c.nome} onClick={() => { setCaderno(ativa ? null : c.nome); setSoFixadas(false); }} className={pilula(ativa)} aria-pressed={ativa}>
                <BookMarked size={12} aria-hidden /> {c.nome} <span className="opacity-70 tabular-nums">{c.quantidade}</span>
              </button>
            );
          })}
        </div>
      )}

      {filtradas.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {busca.trim() ? <>Nenhuma nota com “{busca.trim()}”.</> : 'Nenhuma nota aqui.'}
        </p>
      ) : (
        <>
          {fixadas.length > 0 && (
            <section aria-labelledby="notas-fixadas">
              <h3 id="notas-fixadas" className="mb-2 text-xs font-semibold text-muted-foreground inline-flex items-center gap-1.5">
                <Pin size={12} aria-hidden /> Fixadas
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fixadas.map(cartao)}</div>
            </section>
          )}
          <section aria-label="Notas">
            {fixadas.length > 0 && <h3 className="mb-2 mt-1 text-xs font-semibold text-muted-foreground">Outras</h3>}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{outras.map(cartao)}</div>
          </section>
        </>
      )}

    </div>
  );
  }
}
