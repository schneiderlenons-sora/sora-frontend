'use client';

// =============================================================================
// CONCILIAR COM O BANCO — previsto manual × a cobrança IGUAL que o banco trouxe.
//
// Relato (Vander, out/2026): previsto "Fatura Cartão BTG" R$ 2.911,60 e, no
// mesmo dia, "CardBankslip" R$ 2.911,60 do banco — os dois na lista, contando
// em dobro, e a única saída era achar o Detetive Watson.
//
// ⚠️ SÓ APARECE QUANDO EXISTE A COBRANÇA IGUAL. O par vem do servidor
// (GET /conciliaveis), com a régua do automático: prova do Watson (mesmo valor,
// mesma conta, mesmo tipo, ≤1 dia, origens diferentes) + par 1-pra-1 sem
// disputa. Ambíguo continua com o Watson, que mostra o grupo inteiro. E quem
// junta é o POST /fundir, que RECONFERE a prova — a tela nunca decide dinheiro.
//
// O que acontece ao conciliar (e a folha diz isso antes do toque):
//   · fica a linha do BANCO (ela protege contra reimportação), com o NOME e a
//     CATEGORIA que a pessoa escreveu no previsto;
//   · o previsto pendente sai — nunca debitou, então o SALDO não muda.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Link2, X, Clock, Landmark, CheckCircle2, ChevronRight, Loader2,
} from 'lucide-react';
import type { ParConciliavelTx } from '@/lib/api';
import { fmtDataBR, diaDe } from '@/lib/data-br';
import { nomeCategoria } from '@/lib/categorias';
import { useDinheiro } from '@/lib/moeda-base';
import { useFmt } from '@/lib/valores-ocultos';

export type ParConciliavel = { previsto: ParConciliavelTx; banco: ParConciliavelTx };

// "Não é a mesma" é escolha de QUEM ESTÁ VENDO, não dado da conta: guardado no
// navegador. Pior caso (storage bloqueado) é a sugestão voltar — nunca some
// dinheiro. Chave por par: se o banco trouxer outra cobrança, ela é nova.
const CHAVE_DISPENSADOS = 'sora-conciliar-dispensados-v1';
export const idPar = (p: ParConciliavel) => `${p.previsto.id}:${p.banco.id}`;

export function lerDispensados(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) || '[]');
    return new Set(Array.isArray(v) ? v.map(String) : []);
  } catch { return new Set(); }
}

export function dispensarPar(p: ParConciliavel): void {
  try {
    const s = lerDispensados(); s.add(idPar(p));
    // Teto: lista que só cresce vira lixo no storage.
    localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify([...s].slice(-200)));
  } catch { /* storage bloqueado: só esta sessão */ }
}

/** "Mesmo dia" / "1 dia de diferença" — a prova contada em palavras. */
function distanciaDias(a: string, b: string): string {
  const da = new Date(`${diaDe(a)}T12:00:00Z`).getTime();
  const db = new Date(`${diaDe(b)}T12:00:00Z`).getTime();
  const d = Math.round(Math.abs(da - db) / 86400000);
  return d === 0 ? 'Mesmo dia' : `${d} dia de diferença`;
}

// ⚠️ Texto verde: o `--primary` (verde da marca, 60% de luminosidade) dá ~2,3:1
// sobre branco — abaixo do mínimo de 4,5:1. No claro o texto usa um verde
// escuro; no escuro, o da marca (que ali contrasta bem). Ícone/fundo seguem
// com a cor da marca: é só o TEXTO que precisa ser lido.
const TEXTO_VERDE = 'text-emerald-700 dark:text-[hsl(var(--primary))]';

const titulo = (t: ParConciliavelTx) => (t.observacao || '').trim() || nomeCategoria(t.categoria || '') || 'Sem descrição';

// ─────────────────────────────────────────────────────────────────────────────
// CARTÃO DE SUGESTÕES — acima da lista. É o caminho principal no celular, onde
// a tabela rola na horizontal e a coluna de status fica fora da tela.
// ─────────────────────────────────────────────────────────────────────────────
export function ConciliarSugestoes({ pares, onAbrir }: {
  pares: ParConciliavel[];
  onAbrir: (p: ParConciliavel) => void;
}) {
  const fmt = useFmt(useDinheiro());
  const [todos, setTodos] = useState(false);
  if (!pares.length) return null;

  const LIMITE = 3;
  const visiveis = todos ? pares : pares.slice(0, LIMITE);
  const n = pares.length;

  return (
    <section
      aria-labelledby="conciliar-titulo"
      className="card rounded-2xl p-4 sm:p-5 relative overflow-hidden animate-fade-in"
      style={{ boxShadow: 'inset 0 0 0 1px hsl(var(--primary) / 0.35)' }}
    >
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.16) 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
             style={{ background: 'hsl(var(--primary) / 0.14)' }}>
          <Link2 size={18} style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 id="conciliar-titulo" className="font-semibold text-foreground flex items-center gap-2">
            Já chegou do banco
            <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full text-foreground"
                  style={{ background: 'hsl(var(--primary) / 0.18)' }}>
              {n}
            </span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {n === 1 ? 'Este previsto já tem' : 'Estes previstos já têm'} a cobrança igual no banco.
            Concilie para não contar em dobro.
          </p>
        </div>
      </div>

      <ul className="relative mt-3 -mx-1 divide-y divide-border/50">
        {visiveis.map((p) => (
          <li key={idPar(p)}>
            <button
              type="button"
              onClick={() => onAbrir(p)}
              className="w-full min-h-[60px] flex items-center gap-3 px-2 py-2.5 rounded-xl text-left
                         hover:bg-muted/50 active:scale-[0.99] transition-[background-color,transform] duration-150
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))]"
              aria-label={`Conciliar ${titulo(p.previsto)} com a cobrança ${titulo(p.banco)} do banco`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{titulo(p.previsto)}</p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  <Landmark size={11} className="inline -mt-0.5 mr-1" aria-hidden="true" />
                  {titulo(p.banco)} · {p.banco.carteira_nome || 'Conta'} · {fmtDataBR(p.banco.data)}
                </p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0">
                <span className={`text-sm font-bold tabular-nums ${
                  p.previsto.tipo === 'Gasto' ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {p.previsto.tipo === 'Gasto' ? '−' : '+'}{fmt(p.previsto.valor)}
                </span>
                <span className={`text-xs font-semibold inline-flex items-center gap-0.5 mt-0.5 ${TEXTO_VERDE}`}>
                  Conciliar <ChevronRight size={13} aria-hidden="true" />
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {n > LIMITE && (
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="relative mt-1 w-full min-h-[44px] text-xs font-semibold text-muted-foreground hover:text-foreground rounded-xl"
          aria-expanded={todos}
        >
          {todos ? 'Mostrar menos' : `Ver mais ${n - LIMITE}`}
        </button>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SELO DA LINHA — no lugar do "Pendente" do previsto que já tem par. Mesma ação
// do cartão; aqui pra quem chega pela lista (desktop, ou rolando a tabela).
// ─────────────────────────────────────────────────────────────────────────────
export function SeloConciliar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-0.5 inline-flex items-center gap-1 min-h-[28px] px-2 rounded-full text-[11px] font-semibold
                 hover:brightness-110 active:scale-[0.97] transition-[filter,transform] duration-150
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary))] ${TEXTO_VERDE}`}
      style={{ background: 'hsl(var(--primary) / 0.14)' }}
      title="A cobrança igual já chegou do banco — toque para conciliar"
    >
      <Link2 size={11} aria-hidden="true" /> Conciliar
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLHA DE CONFIRMAÇÃO — bottom sheet no celular, diálogo centrado no desktop.
// Portal pro body: os cards do painel têm backdrop-blur, e um `fixed` dentro
// deles fica preso no card (CLAUDE.md).
// ─────────────────────────────────────────────────────────────────────────────
export function ConciliarSheet({ par, onFechar, onConciliar, onDispensar }: {
  par: ParConciliavel;
  onFechar: () => void;
  /** Faz a fusão. Rejeita com a mensagem do servidor quando recusa. */
  onConciliar: (p: ParConciliavel) => Promise<void>;
  onDispensar: (p: ParConciliavel) => void;
}) {
  const fmt = useFmt(useDinheiro());
  const [montado, setMontado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const confirmarRef = useRef<HTMLButtonElement>(null);
  const { previsto, banco } = par;
  const gasto = previsto.tipo === 'Gasto';

  useEffect(() => setMontado(true), []);

  // ⚠️ Em ref: o pai passa uma função nova a cada render, e com ela na lista de
  // dependências o efeito abaixo refaria foco e trava de scroll a cada toast.
  const fecharRef = useRef(onFechar);
  fecharRef.current = onFechar;
  const enviandoRef = useRef(false);
  enviandoRef.current = enviando;

  // Esc fecha (menos durante o envio) + trava o scroll do fundo + foco no CTA.
  // Roda UMA vez por abertura.
  useEffect(() => {
    if (!montado) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !enviandoRef.current) fecharRef.current(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmarRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [montado]);

  async function conciliar() {
    if (enviando) return;
    setEnviando(true); setErro('');
    try {
      await onConciliar(par);
    } catch (e: any) {
      setErro(e?.message || 'Não consegui conciliar agora. Tente de novo em instantes.');
      setEnviando(false);
    }
  }

  if (!montado) return null;

  const categoria = nomeCategoria(previsto.categoria || '');

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-[fade-in_200ms_ease-out]"
        onClick={() => { if (!enviando) onFechar(); }}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="conciliar-folha-titulo"
        aria-describedby="conciliar-folha-desc"
        className="relative w-full sm:max-w-md max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl
                   border border-border/60 shadow-2xl animate-[slide-up_280ms_ease-out]"
        style={{ background: 'hsl(var(--bg-card))' }}
      >
        {/* Alça: diz "isto é uma folha" no celular. */}
        <div className="sm:hidden pt-2.5 flex justify-center" aria-hidden="true">
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="overflow-y-auto px-5 pt-4 sm:pt-6 pb-2">
          {/* Cabeçalho */}
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: 'hsl(var(--primary) / 0.14)' }}>
              <Link2 size={20} style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="conciliar-folha-titulo" className="text-lg font-bold text-foreground leading-tight">
                Conciliar com o banco
              </h2>
              <p id="conciliar-folha-desc" className="text-sm text-muted-foreground mt-0.5">
                É o mesmo lançamento chegando por dois caminhos.
              </p>
            </div>
            <button
              type="button"
              onClick={onFechar}
              disabled={enviando}
              className="-mr-2 -mt-1 w-11 h-11 rounded-xl flex items-center justify-center hover:bg-muted disabled:opacity-40"
              aria-label="Fechar"
            >
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          {/* Valor + a prova em palavras */}
          <div className="mt-5 text-center">
            <p className={`text-3xl font-bold tabular-nums tracking-tight ${
              gasto ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
            }`}>
              {gasto ? '−' : '+'}{fmt(previsto.valor)}
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {['Mesmo valor', 'Mesma conta', distanciaDias(previsto.data, banco.data)].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  <CheckCircle2 size={11} style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" /> {t}
                </span>
              ))}
            </div>
          </div>

          {/* As duas pontas, ligadas */}
          <div className="mt-5">
            <Ponta
              rotulo="Você previu"
              status={<><Clock size={11} aria-hidden="true" /> {gasto ? 'Pendente' : 'A receber'}</>}
              statusClasse="text-amber-700 dark:text-amber-400 bg-amber-500/12"
              titulo={titulo(previsto)}
              detalhe={[categoria, previsto.carteira_nome, fmtDataBR(previsto.data)].filter(Boolean).join(' · ')}
              tracejado
            />
            <div className="flex justify-center -my-2 relative z-10" aria-hidden="true">
              <div className="w-8 h-8 rounded-full flex items-center justify-center border-4"
                   style={{ background: 'hsl(var(--primary))', borderColor: 'hsl(var(--bg-card))' }}>
                <Link2 size={13} className="text-white" />
              </div>
            </div>
            <Ponta
              rotulo="O banco trouxe"
              status={<><Landmark size={11} aria-hidden="true" /> {gasto ? 'Pago' : 'Recebido'}</>}
              statusClasse="text-green-700 dark:text-green-400 bg-green-500/12"
              titulo={titulo(banco)}
              detalhe={[banco.carteira_nome, fmtDataBR(banco.data)].filter(Boolean).join(' · ')}
            />
          </div>

          {/* Como fica — o resultado antes do toque */}
          <div className="mt-5 rounded-2xl p-4" style={{ background: 'hsl(var(--primary) / 0.08)' }}>
            <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Como fica</p>
            <p className="mt-1.5 text-sm text-foreground">
              <span className="font-semibold">Um lançamento só</span>, {gasto ? 'pago' : 'recebido'}, com o
              nome <span className="font-semibold">“{titulo(previsto)}”</span>
              {categoria ? <> e a categoria <span className="font-semibold">{categoria}</span></> : null}.
            </p>
            <ul className="mt-2.5 space-y-1.5">
              {[
                'O saldo não muda — ele já vem do banco.',
                'Não volta duplicado na próxima sincronização.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={13} className="flex-shrink-0 mt-px" style={{ color: 'hsl(var(--primary))' }} aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {erro && (
            <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{erro}</p>
          )}
        </div>

        {/* Ações — fixas no rodapé da folha, com a área do home indicator. */}
        <div className="px-5 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:pb-5 border-t border-border/50
                        flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => { onDispensar(par); onFechar(); }}
            disabled={enviando}
            className="btn-ghost w-full sm:w-auto min-h-[48px] px-4 text-sm text-muted-foreground disabled:opacity-40"
          >
            Não é a mesma
          </button>
          <button
            ref={confirmarRef}
            type="button"
            onClick={conciliar}
            disabled={enviando}
            aria-busy={enviando}
            className="btn-primary w-full sm:flex-1 min-h-[48px] text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {enviando
              ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Conciliando…</>
              : <><Link2 size={16} aria-hidden="true" /> Conciliar</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Ponta({ rotulo, status, statusClasse, titulo, detalhe, tracejado }: {
  rotulo: string;
  status: React.ReactNode;
  statusClasse: string;
  titulo: string;
  detalhe: string;
  tracejado?: boolean;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        border: `1.5px ${tracejado ? 'dashed' : 'solid'} hsl(var(--border))`,
        background: tracejado ? 'transparent' : 'hsl(var(--muted) / 0.4)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">{rotulo}</p>
        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${statusClasse}`}>
          {status}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-foreground break-words">{titulo}</p>
      {detalhe && <p className="text-xs text-muted-foreground mt-0.5">{detalhe}</p>}
    </div>
  );
}
