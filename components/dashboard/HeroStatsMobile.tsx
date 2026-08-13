'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, Wallet } from 'lucide-react';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { marcaDe } from '@/components/ui/IconeMarca';

// =============================================================================
// Stats do hero — versão MOBILE (2 cards por linha).
//
// Substituem os 3 chips espremidos em `grid-cols-3` que existiam antes: com 3
// colunas num celular de 375px cada chip ficava com ~105px e TODO valor era
// truncado, o que já tinha gerado a regra do CLAUDE.md de "mini-card de stat
// que trunca = sempre expansível". Com 2 colunas o valor cabe inteiro.
//
// LAYOUT (fiel ao painel de referência que o usuário mandou):
//   Linha 1 (ALTA)  → Saldo em contas · Gastos do mês
//   Linha 2 (BAIXA) → VS mês anterior · Maior gasto
// A diferença de altura é intencional: os dois de cima carregam ícones, barra
// e gráfico; os de baixo são frases curtas e ficam finos pra não sobrar vazio.
//
// DECISÕES QUE NÃO PODEM REGREDIR:
// · ⚠️ O SPARKLINE É SVG PURO, ESCRITO À MÃO — nunca recharts. O CLAUDE.md
//   proíbe recharts em página do dashboard (~288 KB + d3 no bundle inicial, e
//   o prefetch da sidebar chegava a baixar 3 cópias). Um gráfico de 40 pontos
//   sem eixo/tooltip não justifica uma lib.
// · Altura FIXA no gráfico e na barra → sem CLS quando o dado chega.
// · Continuam sendo BOTÕES que expandem o valor completo abaixo (regra do
//   CLAUDE.md), e o painel abre logo após a LINHA do card tocado — via
//   `order`, mesmo truque do ResumoCards. Painel no fim de tudo faz o usuário
//   não perceber que expandiu.
// · Cor "cítrica" pedida pelo usuário: lime-600 no claro / lime-400 no escuro.
//   Não é o mesmo tom nos dois temas de propósito — lime claro sobre fundo
//   branco fica em ~1.7:1 e some (regra de contraste de dado, ≥3:1).
// =============================================================================

// Rampa das contas na barra de proporção. Tons 500/600: são os únicos que
// mantêm contraste nos DOIS temas (os 400 somem no claro, os 700 no escuro).
const CORES_CONTA = ['#65A30D', '#22C55E', '#14B8A6', '#0EA5E9', '#8B5CF6', '#F59E0B'];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

type Conta = { nome: string; saldo: number };

interface Props {
  contas: Conta[];
  saldoTotal: number;
  gastosMes: number;
  /** Gasto por dia do mês (não acumulado) — vira linha acumulada no sparkline. */
  dadosDiarios: { dia: string; valor: number }[];
  monthName: string;
  monthNameAnt: string;
  varGastos: number;
  gastosAnt: number;
  maiorCat: { categoria: string; total: number } | null;
  totalGastos: number;
}

type Aberto = 'saldo' | 'gastos' | 'vs' | 'maior' | null;

function parseCategoria(cat: string) {
  const parts = (cat || '').split(' ');
  const hasEmoji = /\p{Emoji}/u.test(parts[0] || '');
  return { emoji: hasEmoji ? parts[0] : '📦', nome: hasEmoji ? parts.slice(1).join(' ') : cat };
}

export default function HeroStatsMobile({
  contas, saldoTotal, gastosMes, dadosDiarios, monthName, monthNameAnt,
  varGastos, gastosAnt, maiorCat, totalGastos,
}: Props) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const toggle = (k: Exclude<Aberto, null>) => setAberto((p) => (p === k ? null : k));

  // Fatias da barra de proporção. Só contas com saldo POSITIVO entram: uma
  // conta negativa não "ocupa" espaço do saldo, e largura negativa não existe.
  const fatias = useMemo(() => {
    const positivas = contas.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);
    const soma = positivas.reduce((s, c) => s + c.saldo, 0);
    if (!soma) return [];
    return positivas.map((c, i) => ({
      nome: c.nome,
      saldo: c.saldo,
      pct: (c.saldo / soma) * 100,
      cor: CORES_CONTA[i % CORES_CONTA.length],
    }));
  }, [contas]);

  // Acumulado do mês — é o que sobe igual ao gráfico da referência. O dado de
  // origem é gasto POR DIA (não acumulado), que oscila e não mostra evolução.
  const acumulado = useMemo(() => {
    let soma = 0;
    return dadosDiarios.map((d) => (soma += d.valor));
  }, [dadosDiarios]);

  const nContas = contas.length;

  return (
    <div className="grid grid-cols-2 gap-2.5 md:hidden">

      {/* ══ Linha 1 · Saldo em contas ══════════════════════════════════ */}
      <CardBase
        aberto={aberto === 'saldo'}
        onToggle={() => toggle('saldo')}
        label="Saldo em contas"
        aria={`Saldo em contas: ${fmt(saldoTotal)}, ${nContas} conta${nContas === 1 ? '' : 's'}`}
        className="order-1"
        topo={
          /* Ícones das contas — no máximo 4 + "+N", senão estoura a largura.
             `-space-x-2` sobrepõe como pilha de cartões (padrão do referencial).
             Altura fixa h-8 reservada mesmo sem conta → sem pulo de layout. */
          <span className="flex items-center justify-center -space-x-2 mb-2.5 h-8">
            {contas.slice(0, 4).map((c) => (
              <span key={c.nome} className="rounded-full ring-2 ring-card overflow-hidden flex-shrink-0">
                {marcaDe(c.nome) ? (
                  <CategoriaIcon nome={c.nome} size={28} rounded="rounded-full" />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <Wallet size={13} className="text-muted-foreground" />
                  </span>
                )}
              </span>
            ))}
            {nContas > 4 && (
              <span className="w-7 h-7 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[10px] font-bold text-muted-foreground tabular flex-shrink-0">
                +{nContas - 4}
              </span>
            )}
            {nContas === 0 && (
              <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <Wallet size={13} className="text-muted-foreground" />
              </span>
            )}
          </span>
        }
      >
        <span className="block text-[19px] font-bold text-foreground tabular tracking-tight leading-none truncate">
          {fmt(saldoTotal)}
        </span>

        {/* Barra de proporção. Uma conta só → barra cheia na cor cítrica.
            ⚠️ `role="img"` + aria-label: a composição não pode existir só na
            cor (regra de acessibilidade) — o leitor de tela recebe a lista. */}
        <span
          role="img"
          aria-label={
            fatias.length
              ? `Composição do saldo: ${fatias.map((f) => `${f.nome} ${Math.round(f.pct)}%`).join(', ')}`
              : 'Sem saldo positivo para compor a barra'
          }
          className="mt-2.5 h-1.5 w-full rounded-full bg-muted overflow-hidden flex gap-px"
        >
          {fatias.length ? (
            fatias.map((f) => (
              <span key={f.nome} className="h-full first:rounded-l-full last:rounded-r-full"
                    style={{ width: `${f.pct}%`, background: f.cor }} />
            ))
          ) : (
            <span className="h-full w-full rounded-full bg-muted-foreground/15" />
          )}
        </span>

        <span className="block mt-2 text-[11px] text-muted-foreground leading-tight">
          {nContas === 0
            ? 'Nenhuma conta ainda'
            : `${nContas} conta${nContas === 1 ? '' : 's'} conectada${nContas === 1 ? '' : 's'}`}
        </span>
      </CardBase>

      {/* ══ Linha 1 · Gastos do mês ════════════════════════════════════ */}
      <CardBase
        aberto={aberto === 'gastos'}
        onToggle={() => toggle('gastos')}
        label="Gastos do mês"
        aria={`Gastos do mês: ${fmt(gastosMes)}`}
        className="order-2"
        topo={
          /* Mesma altura do bloco de ícones do card ao lado (h-8) + o respiro,
             pra os dois rótulos ficarem na MESMA linha de base. Reservada mesmo
             sem dado → o card não muda de tamanho quando o gráfico chega. */
          <span className="block h-8 mb-2.5">
            <Sparkline valores={acumulado} />
          </span>
        }
      >
        <span className="block text-[19px] font-bold text-foreground tabular tracking-tight leading-none truncate">
          {fmt(gastosMes)}
        </span>
        <span className="block mt-2 text-[11px] text-muted-foreground leading-tight capitalize">
          {monthName}
        </span>
      </CardBase>

      {/* Painel da linha 1 — order-3 o coloca logo DEPOIS dela. */}
      {(aberto === 'saldo' || aberto === 'gastos') && (
        <Painel className="order-3">
          {aberto === 'saldo' ? (
            fatias.length ? (
              <ul className="space-y-1.5">
                {fatias.map((f) => (
                  <li key={f.nome} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.cor }} />
                    <span className="text-foreground truncate flex-1">{f.nome}</span>
                    <span className="text-muted-foreground tabular flex-shrink-0">{fmt(f.saldo)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhuma conta com saldo positivo ainda.</p>
            )
          ) : (
            <>
              <p className="text-foreground font-bold text-2xl tabular tracking-tight">{fmt(gastosMes)}</p>
              <p className="text-muted-foreground text-sm mt-1 capitalize">
                Total gasto em {monthName}
              </p>
            </>
          )}
        </Painel>
      )}

      {/* ══ Linha 2 · VS mês anterior (fino) ═══════════════════════════ */}
      <CardBase
        compacto
        aberto={aberto === 'vs'}
        onToggle={() => toggle('vs')}
        label="VS mês anterior"
        aria={`Comparado ao mês anterior: ${gastosAnt ? `${varGastos}%` : 'sem dados'}`}
        className="order-4"
      >
        {/* 14px (não 19px como os cards altos): stat secundário. A hierarquia
            fica 19 → 14 → 10, e "Facebook Ads" no card ao lado só cabe inteiro
            nesse tamanho — os dois iguais pra a linha não ficar desalinhada. */}
        <span className={`block text-[14px] font-bold tabular tracking-tight leading-none truncate ${
          !gastosAnt ? 'text-muted-foreground'
            : varGastos > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        }`}>
          {gastosAnt ? `${varGastos > 0 ? '+' : ''}${varGastos}%` : '—'}
        </span>
      </CardBase>

      {/* ══ Linha 2 · Maior gasto (fino) ═══════════════════════════════ */}
      <CardBase
        compacto
        aberto={aberto === 'maior'}
        onToggle={() => toggle('maior')}
        label="Maior gasto"
        aria={`Maior gasto: ${maiorCat ? parseCategoria(maiorCat.categoria).nome : 'nenhum'}`}
        className="order-5"
      >
        <span className="block text-[14px] font-bold text-foreground tracking-tight leading-none truncate">
          {maiorCat ? parseCategoria(maiorCat.categoria).nome : '—'}
        </span>
      </CardBase>

      {/* Painel da linha 2 — order-6, logo depois dela. */}
      {(aberto === 'vs' || aberto === 'maior') && (
        <Painel className="order-6">
          {aberto === 'vs' ? (
            gastosAnt ? (
              <>
                <p className={`font-bold text-2xl tabular tracking-tight ${
                  varGastos > 0 ? 'text-red-500 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {(varGastos > 0 ? '+' : '') + varGastos}% {varGastos > 0 ? 'a mais' : varGastos < 0 ? 'a menos' : 'igual'}
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  De {fmt(gastosAnt)} ({monthNameAnt}) para {fmt(gastosMes)} ({monthName})
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Sem dados de {monthNameAnt} pra comparar ainda.</p>
            )
          ) : maiorCat ? (
            <>
              <p className="text-foreground font-bold text-2xl tracking-tight">
                {parseCategoria(maiorCat.categoria).nome}
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                {fmt(maiorCat.total)}
                {totalGastos ? ` · ${Math.round((maiorCat.total / totalGastos) * 100)}% do total de ${monthName}` : ''}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum gasto registrado em {monthName} ainda.</p>
          )}
        </Painel>
      )}
    </div>
  );
}

// ── Casca comum dos 4 cards ──────────────────────────────────────────────
// Botão (não div): o card inteiro expande o valor completo — vale a semântica
// e o foco de teclado que vêm de graça.
function CardBase({
  label, aria, aberto, onToggle, children, topo, className = '', compacto = false,
}: {
  label: string; aria: string; aberto: boolean; onToggle: () => void;
  children: React.ReactNode;
  /** Conteúdo ANTES do rótulo (ícones das contas, sparkline) — é a ordem do
   *  painel de referência: visual no topo, depois rótulo, depois número. */
  topo?: React.ReactNode;
  className?: string; compacto?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={aberto}
      aria-label={`${aria}. Toque para ${aberto ? 'recolher' : 'ver detalhes'}`}
      // ⚠️ No escuro o fundo é PRETO translúcido, não branco a 5%: com o vídeo
      // agora fixo, o card sobe por cima da parte vívida da imagem ao rolar, e
      // um véu branco de 5% deixava texto branco sobre imagem clara —
      // ilegível. Preto + blur devolve o contraste em qualquer frame.
      // ⚠️ No escuro o fundo é PRETO translúcido, não branco a 5%: com o vídeo
      // agora fixo, o card sobe por cima da parte vívida da imagem ao rolar, e
      // um véu branco de 5% deixava texto branco sobre imagem clara —
      // ilegível. Preto + blur devolve o contraste em qualquer frame.
      // O `backdrop-blur-lg` é o que segura a leitura com alfa baixo.
      className={`relative min-w-0 text-center rounded-2xl backdrop-blur-lg border transition-all active:scale-[0.98] ${
        compacto ? 'p-3' : 'p-3.5'
      } ${
        aberto
          ? 'bg-white/85 dark:bg-black/60 border-[#61D17B]/60 ring-1 ring-[#61D17B]/40'
          : 'bg-white/55 dark:bg-black/40 border-border/30 dark:border-white/10'
      } ${className}`}
    >
      {/* ⚠️ Chevron ABSOLUTO no canto, fora do fluxo. Quando ele participava da
          linha, o conteúdo centralizava no espaço que SOBRAVA dele — ficava
          sempre alguns pixels à esquerda do centro real do card. */}
      <ChevronRight
        size={13}
        aria-hidden
        className={`absolute top-2.5 right-2.5 text-muted-foreground/60 transition-transform ${aberto ? 'rotate-90' : ''}`}
      />
      {topo}
      {/* Folga pro chevron SÓ nos cards sem `topo`. Nos altos, o bloco visual
          (ícones/gráfico, h-8) já empurra o rótulo pra baixo da altura do
          chevron — não há colisão, e reservar espaço ali era o que fazia
          "Saldo em contas" sair cortado. Quando precisa, o padding é
          SIMÉTRICO: só à direita resolveria a colisão mas tiraria do centro. */}
      <span className={`block text-muted-foreground/70 dark:text-muted-foreground text-[10px] uppercase tracking-wider font-medium leading-tight truncate mb-1 ${
        topo ? '' : 'px-4'
      }`}>
        {label}
      </span>
      {children}
    </button>
  );
}

// ── Painel de detalhe (full-width dentro do grid) ────────────────────────
function Painel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`col-span-2 rounded-2xl p-4 backdrop-blur-lg bg-white/55 dark:bg-black/40 border border-border/30 dark:border-white/10 animate-fade-in ${className}`}>
      {children}
    </div>
  );
}

// ── Sparkline do acumulado ───────────────────────────────────────────────
// SVG à mão de propósito (ver o cabeçalho do arquivo: recharts é proibido
// aqui). `preserveAspectRatio="none"` deixa o traço esticar na largura do
// card sem eu precisar medir o container em JS.
function Sparkline({ valores }: { valores: number[] }) {
  const W = 100, H = 40;

  const pontos = useMemo(() => {
    if (valores.length < 2) return null;
    const max = Math.max(...valores);
    if (max <= 0) return null;
    // Respiro de 3px no topo/base pra a linha e o ponto final não encostarem
    // na borda (o ponto tem raio e sairia cortado).
    return valores.map((v, i) => ({
      x: (i / (valores.length - 1)) * W,
      y: H - 3 - (v / max) * (H - 6),
    }));
  }, [valores]);

  // Sem dado suficiente: linha de base tracejada em vez de card vazio — diz
  // "ainda não há série", não "quebrou".
  if (!pontos) {
    return (
      // `span`, não `div`: isto renderiza DENTRO de um <button> (o card), e
      // elemento de fluxo dentro de button é HTML inválido — o browser pode
      // reordenar o DOM e quebrar o card.
      <span className="w-full h-full flex items-end" aria-hidden>
        <span className="w-full border-b-2 border-dashed border-muted-foreground/20" />
      </span>
    );
  }

  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${linha} L${W},${H} L0,${H} Z`;
  const fim = pontos[pontos.length - 1];
  const idGrad = 'spark-grad';

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="w-full h-full overflow-visible text-lime-600 dark:text-lime-400"
      role="img"
      aria-label="Evolução dos gastos acumulados no mês"
    >
      <defs>
        <linearGradient id={idGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${idGrad})`} />
      <path
        d={linha}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        // `vectorEffect` mantém a espessura constante mesmo com o viewBox
        // esticado por preserveAspectRatio="none" (senão a linha entorta).
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={fim.x} cy={fim.y} r={3} fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
