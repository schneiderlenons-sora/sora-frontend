'use client';

// Editor de nota do Drive — tela cheia no celular, painel grande no computador.
//
// Pedido de cliente: "Eu escrevo muito!". Por isso:
//   · SALVA SOZINHO enquanto a pessoa digita (sem botão "Salvar" pra esquecer);
//     o estado aparece no topo ("Salvando…", "Salvo", "Não salvou").
//   · as gravações vão em FILA: nunca duas ao mesmo tempo, e a nota nova só é
//     criada uma vez (a 1ª gravação devolve o id, as seguintes editam).
//   · fechar ESPERA a última gravação; se ela falhar, o editor não fecha
//     calado — oferece tentar de novo.
//   · nota esvaziada por inteiro é apagada ao fechar (como no app de notas
//     do celular), e nota nova que ficou vazia nem chega a existir.
//
// ⚠️ Portal no body: o Drive vive dentro de cards com backdrop-blur, que
// prenderiam um `fixed` (ver CLAUDE.md, "Modal/overlay").

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Pin, Trash2, Copy, Check, Loader2, CloudOff, BookMarked } from 'lucide-react';
import { api } from '@/lib/api';
import { type Nota, contarPalavras } from '@/lib/notas';

type Status = 'salvo' | 'pendente' | 'salvando' | 'erro';
type Valores = { titulo: string; texto: string; caderno: string };

const ESPERA_MS = 800;

export default function EditorNota({
  nota, cadernosExistentes, cadernoInicial, onSalva, onApagada, onFechar,
}: {
  /** `null` = nota nova. */
  nota: Nota | null;
  cadernosExistentes: string[];
  /** Nota nova aberta com um caderno filtrado já entra nele. */
  cadernoInicial?: string | null;
  onSalva: (n: Nota) => void;
  onApagada: (id: string) => void;
  onFechar: () => void;
}) {
  const inicial: Valores = {
    titulo: nota?.titulo || '',
    texto: nota?.texto || '',
    caderno: nota ? (nota.categoria || '') : (cadernoInicial || ''),
  };
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [texto, setTexto] = useState(inicial.texto);
  const [caderno, setCaderno] = useState(inicial.caderno);
  const [fixada, setFixada] = useState(!!nota?.fixada);
  const [status, setStatus] = useState<Status>('salvo');
  const [erro, setErro] = useState('');
  const [confirmarApagar, setConfirmarApagar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [fechando, setFechando] = useState(false);
  const [montado, setMontado] = useState(false);
  /** A nota já existe no servidor (a nova passa a existir na 1ª gravação). */
  const [existe, setExiste] = useState(!!nota);

  const valores = useRef<Valores>(inicial);
  const ultimoSalvo = useRef(JSON.stringify(inicial));
  const idRef = useRef<string | null>(nota?.id || null);
  const fixadaRef = useRef(!!nota?.fixada);
  const fila = useRef<Promise<boolean>>(Promise.resolve(true));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** O clique começou no fundo escuro? Arrastar uma seleção de texto e soltar
   *  fora do painel gera um "click" no fundo — isso não pode fechar a nota. */
  const comecouNoFundo = useRef(false);
  const onSalvaRef = useRef(onSalva);
  useEffect(() => { onSalvaRef.current = onSalva; }, [onSalva]);

  useEffect(() => { const t = setTimeout(() => setMontado(true), 0); return () => clearTimeout(t); }, []);

  /** Grava o que está na tela (em fila). Devolve se ficou salvo. */
  const salvar = useCallback((): Promise<boolean> => {
    fila.current = fila.current.then(async () => {
      const v = valores.current;
      const snap = JSON.stringify(v);
      if (snap === ultimoSalvo.current) { setStatus('salvo'); return true; }
      const vazia = !v.titulo.trim() && !v.texto.trim();
      // Nota nova ainda vazia: nada pra criar.
      if (!idRef.current && vazia) { ultimoSalvo.current = snap; setStatus('salvo'); return true; }
      setStatus('salvando');
      try {
        const corpo = { titulo: v.titulo, texto: v.texto, categoria: v.caderno };
        const r = idRef.current
          ? await api.dados.notas.editar(idRef.current, corpo)
          : await api.dados.notas.criar({ ...corpo, ...(fixadaRef.current ? { fixada: true } : {}) });
        idRef.current = r.id;
        setExiste(true);
        ultimoSalvo.current = snap;
        onSalvaRef.current(r);
        setErro('');
        // Se a pessoa continuou digitando durante a gravação, ainda falta uma.
        setStatus(JSON.stringify(valores.current) === snap ? 'salvo' : 'pendente');
        return true;
      } catch (e) {
        setStatus('erro');
        setErro((e instanceof Error && e.message) || 'Não consegui salvar agora.');
        return false;
      }
    });
    return fila.current;
  }, []);

  const mudou = useCallback((parcial: Partial<Valores>) => {
    valores.current = { ...valores.current, ...parcial };
    setStatus('pendente');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void salvar(); }, ESPERA_MS);
  }, [salvar]);

  const fechar = useCallback(async (forcar = false) => {
    if (fechando && !forcar) return;
    setFechando(true);
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const ok = await salvar();
    if (!ok && !forcar) { setFechando(false); return; }
    const v = valores.current;
    // Esvaziou a nota inteira: some, como no app de notas do celular.
    if (ok && idRef.current && !v.titulo.trim() && !v.texto.trim()) {
      try { await api.dados.notas.deletar(idRef.current); onApagada(idRef.current); } catch { /* fica vazia; dá pra apagar depois */ }
    }
    onFechar();
  }, [fechando, salvar, onApagada, onFechar]);

  const alternarFixada = async () => {
    const nova = !fixadaRef.current;
    fixadaRef.current = nova;
    setFixada(nova);
    // Pela FILA: se a nota nova está sendo criada agora, espera a criação e
    // fixa depois. Ainda não criada: vai junto na criação (fixadaRef).
    fila.current = fila.current.then(async () => {
      if (!idRef.current) return true;
      try {
        const r = await api.dados.notas.editar(idRef.current as string, { fixada: nova });
        onSalvaRef.current(r);
        return true;
      } catch (e) {
        fixadaRef.current = !nova;
        setFixada(!nova);
        setErro((e instanceof Error && e.message) || 'Não consegui fixar agora.');
        return true; // o texto não ficou sem salvar por isso
      }
    });
  };

  const apagar = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await fila.current;
    if (idRef.current) {
      try {
        await api.dados.notas.deletar(idRef.current);
        onApagada(idRef.current);
      } catch (e) {
        setConfirmarApagar(false);
        setErro((e instanceof Error && e.message) || 'Não consegui apagar agora.');
        return;
      }
    }
    onFechar();
  };

  const copiar = async () => {
    const v = valores.current;
    try {
      await navigator.clipboard.writeText([v.titulo.trim(), v.texto].filter(Boolean).join('\n\n'));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { /* navegador sem permissão: nada a fazer */ }
  };

  // Esc fecha (salvando); Ctrl/⌘+S salva na hora.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (confirmarApagar) setConfirmarApagar(false); else void fechar();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (timer.current) { clearTimeout(timer.current); timer.current = null; }
        void salvar();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [fechar, salvar, confirmarApagar]);

  // Sair da página com algo por salvar: o navegador pergunta antes.
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(valores.current) !== ultimoSalvo.current) e.preventDefault();
    };
    window.addEventListener('beforeunload', aviso);
    return () => window.removeEventListener('beforeunload', aviso);
  }, []);

  // A tela de trás não rola enquanto o editor está aberto.
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);

  if (!montado) return null;

  const palavras = contarPalavras(texto);
  const criadaEm = nota?.created_at
    ? new Date(nota.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })
    : null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex sm:items-center sm:justify-center sm:p-6 bg-black/50 backdrop-blur-sm animate-fade-in"
         onPointerDown={(e) => { comecouNoFundo.current = e.target === e.currentTarget; }}
         onClick={(e) => { if (comecouNoFundo.current && e.target === e.currentTarget) void fechar(); comecouNoFundo.current = false; }}>
      <div
        role="dialog" aria-modal="true" aria-label={titulo.trim() || 'Nota'}
        className="relative flex flex-col w-full h-[100dvh] sm:h-[88vh] sm:max-w-3xl bg-card sm:rounded-3xl sm:border border-border shadow-2xl overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Topo: voltar, estado da gravação, ações ── */}
        <div className="flex items-center gap-1 px-2 sm:px-3 h-14 border-b border-border/60 flex-shrink-0">
          <button onClick={() => void fechar()} disabled={fechando}
                  className="h-11 px-2.5 rounded-xl inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60">
            <ArrowLeft size={18} aria-hidden /> Notas
          </button>
          <span className="ml-1 text-xs inline-flex items-center gap-1.5 min-w-0" aria-live="polite">
            {status === 'salvando' || fechando
              ? <><Loader2 size={12} className="animate-spin text-muted-foreground" aria-hidden /><span className="text-muted-foreground">Salvando…</span></>
              : status === 'pendente'
                ? <span className="text-muted-foreground">Editando…</span>
                : status === 'erro'
                  ? <><CloudOff size={13} className="text-red-500" aria-hidden /><span className="text-red-500">Não salvou</span></>
                  : existe
                    ? <><Check size={13} className="text-primary" aria-hidden /><span className="text-muted-foreground">Salvo</span></>
                    : null}
          </span>
          <div className="ml-auto flex items-center">
            <button onClick={() => void alternarFixada()} aria-pressed={fixada}
                    title={fixada ? 'Desafixar' : 'Fixar no topo'} aria-label={fixada ? 'Desafixar nota' : 'Fixar nota no topo'}
                    className="w-11 h-11 rounded-xl flex items-center justify-center hover:bg-muted"
                    style={fixada ? { color: 'hsl(var(--primary))' } : undefined}>
              {fixada ? <Pin size={17} fill="currentColor" aria-hidden /> : <Pin size={17} className="text-muted-foreground" aria-hidden />}
            </button>
            <button onClick={() => void copiar()} title="Copiar texto" aria-label="Copiar o texto da nota"
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted">
              {copiado ? <Check size={17} className="text-primary" aria-hidden /> : <Copy size={17} aria-hidden />}
            </button>
            <button onClick={() => setConfirmarApagar(true)} title="Apagar" aria-label="Apagar nota"
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
              <Trash2 size={17} aria-hidden />
            </button>
          </div>
        </div>

        {/* ── Confirmar apagar (sem window.confirm: some no navegador do WhatsApp) ── */}
        {confirmarApagar && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-red-500/10 border-b border-red-500/20" role="alert">
            <p className="text-sm text-foreground flex-1 min-w-[12rem]">Apagar esta nota? Não dá pra desfazer.</p>
            <button onClick={() => setConfirmarApagar(false)} className="h-10 px-3 rounded-xl text-sm font-semibold text-foreground hover:bg-muted">Cancelar</button>
            <button onClick={() => void apagar()} className="h-10 px-3.5 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700">Apagar</button>
          </div>
        )}

        {/* ── Erro de gravação: diz o quê e dá a saída ── */}
        {status === 'erro' && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-red-500/10 border-b border-red-500/20" role="alert">
            <p className="text-xs text-foreground flex-1 min-w-[12rem]">{erro} O texto continua aqui.</p>
            <button onClick={() => void salvar()} className="h-9 px-3 rounded-lg text-xs font-bold text-foreground border border-border hover:bg-muted">Tentar de novo</button>
            {fechando === false && (
              <button onClick={() => void fechar(true)} className="h-9 px-3 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Fechar sem salvar</button>
            )}
          </div>
        )}
        {status !== 'erro' && erro && (
          <p className="px-4 py-2 text-xs text-red-500 border-b border-border/60" role="alert">{erro}</p>
        )}

        {/* ── Escrita ── */}
        <div className="flex-1 min-h-0 flex flex-col px-5 sm:px-10 pt-4 sm:pt-6">
          <label className="inline-flex items-center gap-1.5 self-start max-w-full rounded-lg px-2 py-1 -ml-2 text-xs text-muted-foreground hover:bg-muted focus-within:bg-muted">
            <BookMarked size={13} aria-hidden />
            <span className="sr-only">Caderno</span>
            <input
              value={caderno} list="notas-cadernos" maxLength={40}
              onChange={(e) => { setCaderno(e.target.value); mudou({ caderno: e.target.value }); }}
              placeholder="Sem caderno"
              className="bg-transparent outline-none text-xs text-foreground placeholder:text-muted-foreground w-40 sm:w-56"
            />
            <datalist id="notas-cadernos">
              {cadernosExistentes.map((c) => <option key={c} value={c} />)}
            </datalist>
          </label>

          <input
            value={titulo} maxLength={200} autoFocus={!nota}
            onChange={(e) => { setTitulo(e.target.value); mudou({ titulo: e.target.value }); }}
            placeholder="Título"
            aria-label="Título da nota"
            className="mt-2 w-full bg-transparent outline-none text-2xl sm:text-3xl font-bold text-foreground placeholder:text-muted-foreground/60 tracking-tight"
          />
          <textarea
            value={texto}
            onChange={(e) => { setTexto(e.target.value); mudou({ texto: e.target.value }); }}
            placeholder="Comece a escrever…"
            aria-label="Texto da nota"
            className="mt-3 flex-1 min-h-0 w-full resize-none bg-transparent outline-none text-[15px] sm:text-base leading-7 text-foreground placeholder:text-muted-foreground/60 pb-6"
          />
        </div>

        {/* ── Rodapé ── */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-10 h-10 border-t border-border/60 text-[11px] text-muted-foreground flex-shrink-0 tabular-nums">
          <span>{palavras.toLocaleString('pt-BR')} {palavras === 1 ? 'palavra' : 'palavras'}</span>
          {criadaEm && <span className="truncate">Criada em {criadaEm}</span>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
