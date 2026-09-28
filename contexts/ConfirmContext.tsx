'use client';

// ─────────────────────────────────────────────────────────────
// Confirmação e aviso DENTRO do app — no lugar de window.confirm/alert.
//
// Relato de cliente (28/09/2026): "o botão de excluir não está funcionando" na
// aba Transações. O print mostrava o cabeçalho "OK · WhatsApp · forsora.com":
// ele abriu o painel pelo link que a Sora manda no WhatsApp, ou seja, dentro
// do NAVEGADOR EMBUTIDO do WhatsApp — um WebView.
//
// ⚠️ WEBVIEWS NÃO MOSTRAM window.confirm/alert/prompt. Quando o app que hospeda
// não implementa o painel de diálogo do JavaScript, o WebView descarta a
// chamada e devolve o valor padrão na hora: `confirm()` → `false`,
// `alert()` → nada. Com `if (!confirm('Excluir?')) return;` o clique morre no
// `return`, sem erro, sem diálogo, e o menu segue aberto (foi exatamente o que
// o print mostrou). Pior: o `alert('Erro ao excluir')` do catch some pelo mesmo
// motivo — então nem a FALHA aparecia.
//
// A Sora é justamente o app que MANDA link por WhatsApp o tempo todo (boas-
// vindas, resposta de chamado, lembretes), então este não é um caso de canto:
// é por onde muita gente chega.
//
// ⚠️ ASSÍNCRONO DE PROPÓSITO. `confirm()` é síncrono e bloqueia; um diálogo em
// React não tem como ser. Por isso o uso muda de `if (!confirm(x)) return` pra
// `if (!(await confirmar({...}))) return` — o resto da função continua igual.
//
// Sem o provider (teste, SSR) o hook cai no comportamento antigo, em vez de
// quebrar: degradar pro pior caso conhecido é melhor que estourar.
// ─────────────────────────────────────────────────────────────
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';

export type OpcoesDialogo = {
  titulo: string;
  mensagem?: React.ReactNode;
  /** Rótulo da ação principal. Padrão: "Confirmar" (ou "Entendi" num aviso). */
  confirmar?: string;
  /** Segunda ação, ex.: "Todas as parcelas". Com ela o diálogo tem 3 saídas. */
  alternativa?: string;
  cancelar?: string;
  /** Ação destrutiva: botão vermelho e o foco nasce em "Cancelar". */
  perigo?: boolean;
};

export type Resposta = 'confirmar' | 'alternativa' | 'cancelar';

type Pedido = {
  id: number;
  op: OpcoesDialogo;
  aviso: boolean;
  resolver: (r: Resposta) => void;
};

type Ctx = {
  decidir: (op: OpcoesDialogo) => Promise<Resposta>;
  avisar: (op: OpcoesDialogo) => Promise<void>;
};

// Fallback SEM provider: o comportamento antigo (nativo).
const CtxPadrao: Ctx = {
  decidir: async (op) => {
    if (typeof window === 'undefined') return 'cancelar';
    return window.confirm(op.titulo) ? 'confirmar' : 'cancelar';
  },
  avisar: async (op) => {
    if (typeof window !== 'undefined') window.alert(op.titulo);
  },
};

const ConfirmContext = createContext<Ctx>(CtxPadrao);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  // Fila: dois pedidos seguidos (ex.: erro logo depois de uma confirmação) não
  // podem se atropelar nem cancelar um ao outro em silêncio.
  //
  // ⚠️ O pedido em curso vive num REF, além do estado que o desenha. Resolver a
  // promise de dentro de um updater de `setState` seria efeito colateral em
  // função que o React pode rodar duas vezes (StrictMode), e o ref também é o
  // que impede o mesmo pedido de ser respondido duas vezes.
  const fila = useRef<Pedido[]>([]);
  const seq = useRef(0);
  const emCurso = useRef<Pedido | null>(null);
  const [visivel, setVisivel] = useState<Pedido | null>(null);
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const mostrarProximo = useCallback(() => {
    const p = fila.current.shift() ?? null;
    emCurso.current = p;
    setVisivel(p);
  }, []);

  const enfileirar = useCallback((op: OpcoesDialogo, aviso: boolean) =>
    new Promise<Resposta>((resolve) => {
      const pedido: Pedido = { id: ++seq.current, op, aviso, resolver: resolve };
      if (emCurso.current) { fila.current.push(pedido); return; }
      emCurso.current = pedido;
      setVisivel(pedido);
    }), []);

  const valor = useMemo<Ctx>(() => ({
    decidir: (op) => enfileirar(op, false),
    avisar: async (op) => { await enfileirar(op, true); },
  }), [enfileirar]);

  const responder = useCallback((pedido: Pedido, r: Resposta) => {
    // Só responde o pedido que está NA TELA: um clique atrasado num diálogo que
    // já fechou não pode cair no próximo da fila.
    if (emCurso.current !== pedido) return;
    emCurso.current = null;
    pedido.resolver(r);
    mostrarProximo();
  }, [mostrarProximo]);

  return (
    <ConfirmContext.Provider value={valor}>
      {children}
      {montado && visivel && createPortal(
        <Dialogo key={visivel.id} pedido={visivel}
                 onResponder={(r) => responder(visivel, r)} />,
        document.body,
      )}
    </ConfirmContext.Provider>
  );
}

function Dialogo({ pedido, onResponder }: { pedido: Pedido; onResponder: (r: Resposta) => void }) {
  const { op, aviso } = pedido;
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const principalRef = useRef<HTMLButtonElement>(null);
  const antes = useRef<HTMLElement | null>(null);
  // ⚠️ ARMA DEPOIS DE 350ms. Quem toca duas vezes seguidas em "Excluir" no menu
  // faria o SEGUNDO toque cair no botão do diálogo que acabou de abrir — e numa
  // exclusão isso significa confirmar sem ter lido. O intervalo é curto demais
  // pra ser sentido e longo o bastante pra cobrir um duplo toque.
  const abertoEm = useRef(Date.now());
  const clicar = (r: Resposta) => {
    if (Date.now() - abertoEm.current < 350) return;
    onResponder(r);
  };

  useEffect(() => {
    antes.current = document.activeElement as HTMLElement | null;
    // ⚠️ Em ação destrutiva o foco nasce em CANCELAR: um Enter dado por reflexo
    // não pode apagar nada. Num aviso, o único botão já é o principal.
    (op.perigo && !aviso ? cancelarRef : principalRef).current?.focus();
    return () => { antes.current?.focus?.(); };
  }, [op.perigo, aviso]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onResponder('cancelar'); }
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [onResponder]);

  const perigo = !!op.perigo && !aviso;
  const rotuloPrincipal = op.confirmar || (aviso ? 'Entendi' : 'Confirmar');

  return (
    // z-[80]: acima dos menus em portal (z-[60]/[61]), do drawer (z-[60]) e dos
    // modais (z-50). Um diálogo de confirmação nunca pode nascer atrás de quem
    // o chamou — é o mesmo defeito do "modal atrás do card com backdrop-blur".
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"
           onClick={() => clicar('cancelar')} />
      <div
        role={aviso ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        aria-labelledby="dlg-titulo"
        aria-describedby={op.mensagem ? 'dlg-msg' : undefined}
        className="relative w-full max-w-sm bg-card rounded-3xl shadow-2xl border border-border p-6
                   pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] md:pb-6
                   animate-[slide-up_220ms_ease-out_both] motion-reduce:animate-none"
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
          perigo ? 'bg-red-500/12 text-red-500' : 'bg-primary/10 text-primary'}`}>
          {perigo ? <AlertTriangle size={22} /> : <Info size={22} />}
        </div>
        <h3 id="dlg-titulo" className="text-base font-bold text-foreground">{op.titulo}</h3>
        {op.mensagem && (
          <div id="dlg-msg" className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{op.mensagem}</div>
        )}

        {/* Empilhados no celular (alvo de 44px e sem clicar no vizinho por
            engano); lado a lado a partir de `sm`. */}
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {!aviso && (
            <button ref={cancelarRef} type="button" onClick={() => clicar('cancelar')}
                    className="h-11 px-4 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              {op.cancelar || 'Cancelar'}
            </button>
          )}
          {!aviso && op.alternativa && (
            <button type="button" onClick={() => clicar('alternativa')}
                    className={`h-11 px-4 rounded-xl text-sm font-semibold border transition-colors ${
                      perigo ? 'border-red-500/40 text-red-500 hover:bg-red-500/10'
                             : 'border-border text-foreground hover:bg-muted/60'}`}>
              {op.alternativa}
            </button>
          )}
          <button ref={principalRef} type="button" onClick={() => clicar('confirmar')}
                  className={`h-11 px-4 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90 ${
                    perigo ? 'bg-red-500' : 'bg-primary'}`}>
            {rotuloPrincipal}
          </button>
        </div>
      </div>
    </div>
  );
}

/** `if (!(await confirmar({ titulo, perigo: true }))) return;` */
export function useConfirmar() {
  const { decidir } = useContext(ConfirmContext);
  return useCallback(
    async (op: OpcoesDialogo) => (await decidir(op)) === 'confirmar',
    [decidir],
  );
}

/** Três saídas: 'confirmar' | 'alternativa' | 'cancelar'. */
export function useDecidir() {
  return useContext(ConfirmContext).decidir;
}

/** Substitui `alert()`. */
export function useAvisar() {
  return useContext(ConfirmContext).avisar;
}
