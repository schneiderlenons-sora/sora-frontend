'use client';

import { Wallet } from 'lucide-react';
import CategoriaIcon from '@/components/ui/CategoriaIcon';
import { marcaDe } from '@/components/ui/IconeMarca';
import { ehPagamentoFatura } from '@/lib/categorizar';

// =============================================================================
// Visuais compartilhados dos cards de stat do dashboard.
//
// ⚠️ POR QUE ESTE ARQUIVO EXISTE: os ícones das contas, a barra de proporção e
// o sparkline nasceram DENTRO do `HeroStatsMobile`. Quando o desktop passou a
// usar os mesmos cards (Saldo em contas / Gastos do mês no `ResumoCards`), a
// alternativa seria copiar — e aí a cor de uma conta, a altura da barra ou o
// respiro do gráfico passariam a divergir entre telas com o tempo. Fonte única.
//
// ⚠️ TUDO É `<span>`, NUNCA `<div>`. Estes blocos renderizam dentro de um
// `<button>` (o card do mobile é um botão inteiro) e elemento de fluxo dentro
// de button é HTML inválido — o browser reordena o DOM e quebra o card.
// =============================================================================

// Rampa das contas na barra de proporção.
//
// ⚠️ A ORDEM É O QUE IMPORTA, não a lista. A rampa antiga começava com
// lime-600 e green-500 — dois verdes quase iguais — e como quase todo mundo
// tem 2 ou 3 contas, era exatamente aí que a barra ficava ilegível: as fatias
// mais comuns eram as indistinguíveis. Agora os três primeiros são de famílias
// de matiz bem separadas (lima 80° → hortelã 175° → tangerina 21°), então o
// caso comum já sai diferenciado.
//
// O "cítrico" é mantido nas posições que aparecem de verdade (lima, hortelã,
// tangerina); da 4ª em diante — conta rara — vale mais a separação do que a
// paleta.
//
// Tons 600: são os que mantêm contraste nos DOIS temas. Os 500 quentes
// (amber/orange-500) ficam abaixo de 3:1 sobre card claro e a fatia some.
export const CORES_CONTA = [
  '#65A30D', // lima       · lime-600
  '#0D9488', // hortelã    · teal-600
  '#EA580C', // tangerina  · orange-600
  '#7C3AED', // uva        · violet-600
  '#E11D48', // toranja    · rose-600
  '#CA8A04', // limão      · yellow-600
];

export type Conta = { nome: string; saldo: number };
export type Fatia = { nome: string; saldo: number; pct: number; cor: string };

/**
 * Fatias da barra de proporção. Só contas com saldo POSITIVO entram: uma conta
 * negativa não "ocupa" espaço do saldo, e largura negativa não existe.
 */
export function fatiasDeContas(contas: Conta[]): Fatia[] {
  const positivas = contas.filter((c) => c.saldo > 0).sort((a, b) => b.saldo - a.saldo);
  const soma = positivas.reduce((s, c) => s + c.saldo, 0);
  if (!soma) return [];
  return positivas.map((c, i) => ({
    nome: c.nome,
    saldo: c.saldo,
    pct: (c.saldo / soma) * 100,
    cor: CORES_CONTA[i % CORES_CONTA.length],
  }));
}

/**
 * Saldo de TODAS as contas, maior primeiro.
 *
 * ⚠️ Diferente de `fatiasDeContas`: aqui entram as zeradas e as NEGATIVAS. A
 * barra é composição (negativo não compõe), mas a lista expandida é extrato —
 * esconder uma conta no vermelho é justamente esconder o que o usuário precisa
 * ver.
 */
export function saldoPorContaDe(contas: Conta[]): Conta[] {
  return [...contas].sort((a, b) => b.saldo - a.saldo);
}

/**
 * Gasto por conta no mês. Exclui transferência e pagamento de fatura — igual ao
 * total do resumo, senão a soma das linhas não bate com o número do card.
 */
export function gastoPorContaDe(txsMes: any[]): { nome: string; total: number }[] {
  const map = new Map<string, number>();
  for (const t of txsMes || []) {
    if (t.tipo !== 'Gasto') continue;
    // ⚠️ "Nao considerar" (146) sai daqui pelo mesmo motivo do resumo.
    if (t.ignorar_em) continue;
    if (t.transferencia || ehPagamentoFatura(t.categoria) || t.categoria === 'Transferências') continue;
    const k = t.carteira_nome || 'Sem conta';
    map.set(k, (map.get(k) || 0) + (t.valor || 0));
  }
  return [...map.entries()]
    .map(([nome, total]) => ({ nome, total }))
    .sort((a, b) => b.total - a.total);
}

/** Gasto acumulado do mês — é o que sobe no sparkline. O dado de origem é gasto
 *  POR DIA (não acumulado), que oscila e não mostra evolução nenhuma. */
export function acumuladoDe(dadosDiarios: { valor: number }[]): number[] {
  let soma = 0;
  return (dadosDiarios || []).map((d) => (soma += d.valor || 0));
}

// ── Pilha de ícones das contas ───────────────────────────────────────────
// No máximo 4 + "+N", senão estoura a largura. `-space-x-2` sobrepõe como
// pilha de cartões. Altura fixa reservada mesmo sem conta → sem pulo de layout.
export function IconesContas({ contas, size = 28 }: { contas: Conta[]; size?: number }) {
  const n = contas.length;
  const px = { width: size, height: size };
  return (
    <span className="flex items-center justify-center -space-x-2 h-8">
      {contas.slice(0, 4).map((c) => (
        <span key={c.nome} className="rounded-full ring-2 ring-card overflow-hidden flex-shrink-0">
          {marcaDe(c.nome) ? (
            <CategoriaIcon nome={c.nome} size={size} rounded="rounded-full" />
          ) : (
            <span className="rounded-full bg-muted flex items-center justify-center" style={px}>
              <Wallet size={Math.round(size * 0.46)} className="text-muted-foreground" />
            </span>
          )}
        </span>
      ))}
      {n > 4 && (
        <span className="rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[10px] font-bold text-muted-foreground tabular flex-shrink-0"
              style={px}>
          +{n - 4}
        </span>
      )}
      {n === 0 && (
        <span className="rounded-full bg-muted flex items-center justify-center" style={px}>
          <Wallet size={Math.round(size * 0.46)} className="text-muted-foreground" />
        </span>
      )}
    </span>
  );
}

// ── Barra de proporção do saldo ──────────────────────────────────────────
//
// Cada conta é uma PÍLULA SEPARADA, não uma fatia de uma barra contínua: com
// as fatias coladas, a leitura dependia só da troca de cor e a barra virava um
// borrão num card estreito. Separadas, cada conta se lê sozinha — e o
// arredondamento total em todas as pontas (não só nas extremidades) é o que dá
// o aspecto limpo.
//
// O gradiente + glow suave são os mesmos das barras dos relatórios
// (`RelatoriosClient`), pra a linguagem visual de "proporção" ser uma só no
// painel inteiro.
//
// ⚠️ `role="img"` + aria-label: a composição não pode existir só na cor (regra
// de acessibilidade) — o leitor de tela recebe a lista.
export function BarraContas({ fatias, className = '' }: { fatias: Fatia[]; className?: string }) {
  return (
    <span
      role="img"
      aria-label={
        fatias.length
          ? `Composição do saldo: ${fatias.map((f) => `${f.nome} ${Math.round(f.pct)}%`).join(', ')}`
          : 'Sem saldo positivo para compor a barra'
      }
      // Sem trilho de fundo: com pílulas separadas ele apareceria nos vãos e
      // reintroduziria a barra contínua que estamos justamente tirando.
      // ⚠️ Mais alta SÓ no desktop (`lg:`): a versão do hero é `md:hidden`, ou
      // seja nunca chega ao lg — então o mesmo componente serve às duas telas
      // sem prop de tamanho.
      className={`h-1.5 lg:h-2.5 w-full flex gap-1 ${className}`}
    >
      {fatias.length ? (
        fatias.map((f) => (
          <span
            key={f.nome}
            // ⚠️ `min-w` + shrink padrão do flex: uma conta com 0,4% do saldo
            // viraria uma pílula de meio pixel — invisível, e com o vão do lado
            // parecendo defeito. O piso dá corpo à fatia mínima; o estouro que
            // ele causa (junto com os vãos) é absorvido pelas fatias grandes,
            // que encolhem proporcionalmente.
            className="h-full rounded-full min-w-[6px] transition-[width] duration-700"
            style={{
              width: `${f.pct}%`,
              background: `linear-gradient(90deg, ${f.cor}, color-mix(in srgb, ${f.cor} 82%, transparent))`,
              boxShadow: `0 0 10px color-mix(in srgb, ${f.cor} 22%, transparent)`,
            }}
          />
        ))
      ) : (
        <span className="h-full w-full rounded-full bg-muted-foreground/15" />
      )}
    </span>
  );
}

// ── Sparkline do acumulado ───────────────────────────────────────────────
// ⚠️ SVG PURO, ESCRITO À MÃO — nunca recharts. O CLAUDE.md proíbe recharts em
// página do dashboard (~288 KB + d3 no bundle inicial, e o prefetch da sidebar
// chegava a baixar 3 cópias). Um gráfico de 40 pontos sem eixo nem tooltip não
// justifica uma lib. `preserveAspectRatio="none"` deixa o traço esticar na
// largura do card sem precisar medir o container em JS.
export function Sparkline({ valores }: { valores: number[] }) {
  const W = 100, H = 40;

  const max = valores.length >= 2 ? Math.max(...valores) : 0;
  const pontos = max > 0
    // Respiro de 3px no topo/base pra a linha e o ponto final não encostarem na
    // borda (o ponto tem raio e sairia cortado).
    ? valores.map((v, i) => ({
        x: (i / (valores.length - 1)) * W,
        y: H - 3 - (v / max) * (H - 6),
      }))
    : null;

  // Sem dado suficiente: linha de base tracejada em vez de card vazio — diz
  // "ainda não há série", não "quebrou".
  if (!pontos) {
    return (
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
