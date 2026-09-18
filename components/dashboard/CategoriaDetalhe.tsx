'use client';

// =============================================================================
// "Quais lançamentos compõem esse valor?" — card "Principais gastos".
//
// Pedido de cliente (set/2026): ao passar o mouse numa categoria, listar os
// lançamentos que formam o total; ou, ao clicar, abrir o detalhe embaixo.
// Os DOIS existem, porque cada um serve um aparelho:
//   · DESKTOP (mouse): passar o mouse abre um painel ao lado, depois de um
//     instante — sem a espera, descer o mouse pela lista abriria sete painéis.
//   · QUALQUER APARELHO: tocar/clicar expande a lista logo abaixo da linha.
//     ⚠️ No toque não existe hover (regra `hover-vs-tap`), então o clique não
//     pode ser só um extra — é o caminho principal no celular.
//
// ⚠️ A LISTA É BUSCADA SÓ QUANDO A PESSOA ABRE. As transações do mês que o
// dashboard já tem vêm SEM descrição (colunas enxutas pelo egress — ver
// COLUNAS_GRAFICO). Carregar descrição de tudo pra todo mundo, a cada visita,
// custaria mais do que buscar uma categoria quando alguém pede.
//
// ⚠️ A LISTA TEM DE SOMAR O TOTAL DA LINHA. O total vem de `por_categoria` do
// resumo, que agrupa pela categoria EXATA e tira transferência, pagamento de
// fatura, ajuste de saldo e "não considerar". O filtro abaixo é a mesma regra
// (`ehTransferencia` do backend) — divergir faria a lista não fechar com o
// número ao lado dela, que é justamente o que a pessoa está conferindo.
// =============================================================================

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { ChevronDown } from 'lucide-react';
import { api } from '@/lib/api';
import { ehPagamentoFatura, ehAjusteSaldo } from '@/lib/categorizar';
import { fmtDataBR } from '@/lib/data-br';

type Tx = { id: string; data: string; valor: number; observacao?: string | null; carteira_nome?: string | null;
  categoria?: string | null; transferencia?: boolean | null; ignorar_em?: unknown };

const MAX_LINHAS = 10;

/** Mesma regra de `resumoTransacoes.ehTransferencia` (backend) e do `ssr-data`. */
const ficaFora = (t: Tx) => !!t.ignorar_em || ehAjusteSaldo(t.categoria || '') || t.transferencia === true
  || ehPagamentoFatura(t.categoria || '') || t.categoria === 'Transferências';

function useLancamentos(phone: string, mes: string, categoria: string, ativo: boolean) {
  return useSWR(
    ativo && phone ? `d:cat-tx:${phone}:${mes}:${categoria}` : null,
    async () => {
      const r = await api.transacoes.listar(phone, { mes, categoria, tipo: 'Gasto', limit: 300 });
      return ((r?.transacoes ?? []) as Tx[])
        .filter((t) => !ficaFora(t))
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    },
    { revalidateOnFocus: false },
  );
}

// Mouse de verdade? (no toque o "hover" é emulado no toque e atrapalharia o clique)
const MQ = '(hover: hover) and (pointer: fine)';
const assinarMQ = (cb: () => void) => {
  const m = window.matchMedia(MQ);
  m.addEventListener('change', cb);
  return () => m.removeEventListener('change', cb);
};
const useTemMouse = () => useSyncExternalStore(assinarMQ, () => window.matchMedia(MQ).matches, () => false);

function Lista({ phone, mes, categoria, total, fmt }: {
  phone: string; mes: string; categoria: string; total: number; fmt: (v: number) => string;
}) {
  const { data, error, isLoading } = useLancamentos(phone, mes, categoria, true);
  if (error) return <p className="text-xs text-red-500 py-2">Não consegui carregar os lançamentos agora.</p>;
  if (isLoading || !data) {
    return (
      <div className="space-y-2 py-1" role="status" aria-label="Carregando lançamentos">
        {[0, 1, 2].map((i) => <div key={i} className="h-9 rounded-lg bg-muted/50 animate-pulse" />)}
      </div>
    );
  }
  if (!data.length) return <p className="text-xs text-muted-foreground py-2">Nenhum lançamento encontrado.</p>;

  const soma = data.reduce((s, t) => s + Math.abs(t.valor), 0);
  const resto = data.length - MAX_LINHAS;
  return (
    <div>
      <ul className="divide-y divide-border/40">
        {data.slice(0, MAX_LINHAS).map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{t.observacao || 'Sem descrição'}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {fmtDataBR(t.data)}{t.carteira_nome ? ` · ${t.carteira_nome}` : ''}
              </p>
            </div>
            <span className="text-xs font-semibold tabular text-foreground flex-shrink-0">{fmt(Math.abs(t.valor))}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-muted-foreground pt-2 flex items-center justify-between gap-2">
        <span>
          {data.length} {data.length === 1 ? 'lançamento' : 'lançamentos'}
          {resto > 0 && <> · mostrando os {MAX_LINHAS} maiores</>}
        </span>
        {/* Só quando a lista NÃO fecha com o total (ex.: mais de 300 no mês) —
            aí é honesto dizer, em vez de deixar a soma errada sem aviso. */}
        {Math.abs(soma - total) > 0.01 && <span>soma {fmt(soma)}</span>}
      </p>
    </div>
  );
}

/**
 * Envolve a linha da categoria. `aberta`/`onToggle` controlam a expansão (uma
 * por vez, decidida por quem renderiza a lista).
 */
export default function CategoriaDetalhe({
  phone, mes, categoria, nome, total, fmt, aberta, onToggle, children,
}: {
  phone: string; mes: string; categoria: string; nome: string; total: number;
  fmt: (v: number) => string; aberta: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  const mouse = useTemMouse();
  const linhaRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const abrirT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fecharT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limpar = () => {
    if (abrirT.current) clearTimeout(abrirT.current);
    if (fecharT.current) clearTimeout(fecharT.current);
  };

  // Rolar com o painel aberto o deixaria solto na tela.
  useEffect(() => {
    if (!pos) return;
    const fechar = () => setPos(null);
    window.addEventListener('scroll', fechar, { passive: true });
    window.addEventListener('resize', fechar);
    return () => { window.removeEventListener('scroll', fechar); window.removeEventListener('resize', fechar); };
  }, [pos]);
  useEffect(() => () => limpar(), []);

  const LARG = 340;
  function entrar() {
    if (!mouse || aberta) return;
    limpar();
    abrirT.current = setTimeout(() => {
      const r = linhaRef.current?.getBoundingClientRect();
      if (!r) return;
      // Ao lado da linha, pro lado que tiver espaço; sem espaço, embaixo dela.
      const cabeDireita = window.innerWidth - r.right >= LARG + 24;
      const cabeEsquerda = r.left >= LARG + 24;
      const left = cabeDireita ? r.right + 12 : cabeEsquerda ? r.left - LARG - 12 : Math.max(8, r.left);
      const topBase = cabeDireita || cabeEsquerda ? r.top - 8 : r.bottom + 8;
      setPos({ top: Math.max(8, Math.min(topBase, window.innerHeight - 420)), left });
    }, 280);
  }
  function sair() {
    if (abrirT.current) clearTimeout(abrirT.current);
    fecharT.current = setTimeout(() => setPos(null), 160);
  }

  return (
    <div>
      <button
        ref={linhaRef}
        type="button"
        onClick={() => { limpar(); setPos(null); onToggle(); }}
        onMouseEnter={entrar}
        onMouseLeave={sair}
        aria-expanded={aberta}
        aria-label={`${nome}: ${fmt(total)}. ${aberta ? 'Esconder' : 'Ver'} os lançamentos`}
        className="w-full text-left rounded-xl -mx-2 px-2 py-1 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors group/cat"
      >
        {children}
      </button>

      {/* Expansão inline — o caminho do toque (e do clique no desktop). */}
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: aberta ? '1fr' : '0fr', opacity: aberta ? 1 : 0 }}
      >
        <div className="overflow-hidden">
          {aberta && (
            <div className="mt-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
              <Lista phone={phone} mes={mes} categoria={categoria} total={total} fmt={fmt} />
            </div>
          )}
        </div>
      </div>

      {/* Painel do hover — portal: o card tem backdrop/overflow que prenderia
          um `fixed` (memória feedback-modal-portal-backdrop-blur). */}
      {pos && !aberta && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-label={`Lançamentos de ${nome}`}
          onMouseEnter={() => { if (fecharT.current) clearTimeout(fecharT.current); }}
          onMouseLeave={sair}
          style={{ top: pos.top, left: pos.left, width: LARG }}
          className="fixed z-50 card rounded-2xl p-4 shadow-xl animate-fade-in max-h-[400px] overflow-y-auto"
        >
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="text-sm font-bold text-foreground truncate">{nome}</p>
            <p className="text-sm font-bold tabular text-foreground">{fmt(total)}</p>
          </div>
          <Lista phone={phone} mes={mes} categoria={categoria} total={total} fmt={fmt} />
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <ChevronDown size={11} /> Clique na categoria pra fixar a lista
          </p>
        </div>,
        document.body,
      )}
    </div>
  );
}
