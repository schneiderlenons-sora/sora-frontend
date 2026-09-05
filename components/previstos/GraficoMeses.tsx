'use client';

import { useMemo, useRef, useEffect } from 'react';

/**
 * Barras por mês — em CSS puro.
 *
 * ⚠️ SEM RECHARTS, E ISSO É DECISÃO DE PERFORMANCE, NÃO PREGUIÇA. A lib pesa
 * ~289 KB + d3 e o CLAUDE.md a proíbe no bundle inicial; mesmo via `next/dynamic`
 * o custo que sobra é o PARSE, na main thread — e já está registrado que isso
 * travou a rolagem do dashboard no celular. Um gráfico de barras é `div` com
 * altura: sai crisp em qualquer densidade, pesa zero e anima só transform.
 *
 * ⚠️ TOQUE, NÃO HOVER. No celular não existe hover: tocar uma barra seleciona,
 * e o valor exato aparece no cabeçalho, acima do gráfico. Tooltip flutuante em
 * tela pequena fica sob o dedo justamente no ponto que a pessoa quer ler.
 *
 * ⚠️ A BARRA TEM DOIS SEGMENTOS, E ISSO É A INFORMAÇÃO PRINCIPAL: embaixo, no
 * tom cheio, o que JÁ aconteceu; em cima, no tom claro, o que ainda vai
 * acontecer. Uma barra única de R$ 53,70 no mês corrente não distingue "já saiu"
 * de "vai sair" — e é essa distinção que decide se dá pra gastar hoje.
 */

export type BarraMes = {
  ym: string;
  /** O que JÁ aconteceu no mês. Segmento de baixo, tom cheio. */
  realizado?: number;
  /** O que ainda vai acontecer. Segmento de cima, tom claro. */
  previsto?: number;
  /** Parte do `previsto` que é ESTIMATIVA (conta de valor variável) — listrada. */
  estimado?: number;
};

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function rotulo(ym: string) {
  const [ano, mes] = ym.split('-').map(Number);
  return { mes: MES_CURTO[mes - 1] || '', ano: `'${String(ano).slice(2)}` };
}

/**
 * Tom da cor.
 *
 * ⚠️ MISTURA DE COR, NÃO `opacity`. A entrada usa `slide-up`, cujo keyframe
 * TERMINA em `opacity: 1` — e com `animation-fill-mode: both` esse valor final
 * vence o estilo inline. Medido na bancada: todas as barras saíam opacas, e o
 * mês projetado ficava com o mesmo peso visual do mês que já aconteceu.
 */
const tom = (cor: string, pct: number) =>
  `color-mix(in srgb, ${cor} ${pct}%, transparent)`;

/**
 * Gradiente vertical: mais claro em cima, cheio embaixo.
 *
 * O degradê não é enfeite — ele ancora a barra na linha do zero e evita o
 * "bloco chapado" que faz seis barras iguais parecerem uma parede só.
 */
const degrade = (cor: string, topo: number, base: number) =>
  `linear-gradient(180deg, ${tom(cor, topo)} 0%, ${tom(cor, base)} 100%)`;

/** Escala do eixo: passo "redondo" (1, 2, 2,5 ou 5 × potência de 10). */
export function escala(max: number, divisoes = 4): { topo: number; passo: number; ticks: number[] } {
  if (!(max > 0)) return { topo: 1, passo: 1, ticks: [0] };
  const bruto = max / divisoes;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const norm = bruto / mag;
  const passo = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const topo = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = 0; v <= topo + passo / 2; v += passo) ticks.push(Number(v.toFixed(6)));
  return { topo, passo, ticks };
}

/** Rótulo do eixo: 0,25 · 60 · 500 · 1,5k · 2,0k · 1,2M. */
export function fmtEixo(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (abs >= 1000) return `${(v / 1000).toFixed(1).replace('.', ',')}k`;
  // ⚠️ Passo FRACIONÁRIO precisa da casa decimal. Com `Math.round` sozinho,
  // uma escala de centavos (R$ 0,40 de conta fixa, passo de 0,10) escrevia
  // "0" nos CINCO rótulos do eixo. O eval pegou isso.
  if (!Number.isInteger(v)) return v.toFixed(abs < 1 ? 2 : 1).replace('.', ',');
  return String(v);
}


const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function GraficoMeses({
  barras,
  cor,
  selecionado,
  onSelecionar,
  rotuloAcessivel,
  divisorApos,
  linhaReferencia,
  rotuloRealizado = 'realizado',
  rotuloPrevisto = 'previsto',
  titulo,
}: {
  barras: BarraMes[];
  /** Cor da série. Recebe token ou hex — o componente não decide semântica. */
  cor: string;
  selecionado: string | null;
  onSelecionar: (ym: string) => void;
  rotuloAcessivel: string;
  /** `ym` depois do qual entra a linha vertical tracejada do "daqui pra frente". */
  divisorApos?: string;
  /** Valor da linha horizontal tracejada de referência (ex.: o saldo de hoje). */
  linhaReferencia?: number;
  rotuloRealizado?: string;
  rotuloPrevisto?: string;
  /** Legenda do gráfico, à esquerda da amostra de cores. */
  titulo?: string;
}) {
  const trilhoRef = useRef<HTMLDivElement>(null);

  const totais = useMemo(
    () => barras.map((b) => (b.realizado || 0) + (b.previsto || 0)),
    [barras],
  );

  // ⚠️ O EIXO SOBE ATÉ UM NÚMERO REDONDO, não até o maior valor. Uma barra que
  // encosta no topo do quadro não deixa ler "quanto falta"; e um eixo em
  // "53,70" pede conta de cabeça a cada leitura.
  const { topo, ticks } = useMemo(() => escala(Math.max(...totais, 0)), [totais]);

  const temPrevisto = useMemo(() => barras.some((b) => (b.previsto || 0) > 0), [barras]);
  const temRealizado = useMemo(() => barras.some((b) => (b.realizado || 0) > 0), [barras]);

  // Com muitos meses a barra fica fina demais pra tocar. A partir de 8 o trilho
  // rola na horizontal DENTRO do próprio container — a página nunca rola de
  // lado, que é a regra.
  const rolavel = barras.length > 8;

  // Traz o mês selecionado pra vista quando ele muda por fora (troca de período).
  useEffect(() => {
    if (!rolavel || !selecionado || !trilhoRef.current) return;
    const alvo = trilhoRef.current.querySelector<HTMLElement>(`[data-ym="${selecionado}"]`);
    alvo?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [selecionado, rolavel]);

  if (!barras.length) {
    return (
      <div className="h-44 flex items-center justify-center rounded-2xl border border-dashed border-border/60">
        <p className="text-sm text-muted-foreground">Sem dados no período</p>
      </div>
    );
  }

  const ALTURA = 176;   // px — o mesmo valor no quadro e nas linhas de grade.

  return (
    <div>
      {/* ── Legenda ───────────────────────────────────────────────────────
          ⚠️ Ponto colorido + PALAVRA. As duas séries só se distinguem por tom
          da mesma cor, e tom sozinho não é informação acessível. */}
      {(titulo || temPrevisto) && (
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          {titulo && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {titulo}
            </p>
          )}
          {temPrevisto && (
            <div className="flex items-center gap-3 ml-auto">
              {temRealizado && (
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: cor }} aria-hidden />
                  {rotuloRealizado}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: tom(cor, 38) }} aria-hidden />
                {rotuloPrevisto}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {/* ── Eixo Y ────────────────────────────────────────────────────────
            Os rótulos ficam FORA do trilho rolável: se rolassem junto, sumiriam
            da tela justo quando a pessoa está comparando barras distantes. */}
        <div
          className="relative flex-shrink-0 w-9 sm:w-12"
          style={{ height: ALTURA }}
          aria-hidden
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 text-[10px] font-medium text-muted-foreground/70 tabular-nums leading-none"
              style={{ bottom: `${(t / topo) * 100}%`, transform: 'translateY(50%)' }}
            >
              {fmtEixo(t)}
            </span>
          ))}
        </div>

        <div className="relative flex-1 min-w-0" role="img" aria-label={rotuloAcessivel}>
          {/* ── Grade tracejada ───────────────────────────────────────────
              Tracejada de propósito: linha cheia compete com a barra e o olho
              lê duas séries onde só existe uma. */}
          <div className="absolute inset-x-0 top-0 pointer-events-none" style={{ height: ALTURA }} aria-hidden>
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0"
                style={{
                  bottom: `${(t / topo) * 100}%`,
                  borderTop: `1px dashed ${t === 0 ? 'hsl(var(--border))' : 'hsl(var(--border) / 0.75)'}`,
                }}
              />
            ))}

            {/* Linha de referência (ex.: o saldo de hoje) — na cor da série,
                pra se ler como "este é o seu nível atual", não como grade. */}
            {linhaReferencia !== undefined && linhaReferencia > 0 && linhaReferencia <= topo && (
              <div
                className="absolute inset-x-0"
                style={{
                  bottom: `${(linhaReferencia / topo) * 100}%`,
                  borderTop: `1.5px dashed ${tom(cor, 70)}`,
                }}
              />
            )}
          </div>

          {/* O trilho das barras é o ÚNICO que rola. */}
          <div
            ref={trilhoRef}
            className={rolavel ? 'overflow-x-auto scrollbar-none' : undefined}
          >
          <div className={`relative flex items-end gap-1.5 sm:gap-2 ${rolavel ? 'w-max' : ''}`} style={{ height: ALTURA }}>
            {barras.map((b, i) => {
              const realizado = Math.max(0, b.realizado || 0);
              const previsto = Math.max(0, b.previsto || 0);
              const estimado = Math.min(previsto, Math.max(0, b.estimado || 0));
              const firmePrevisto = previsto - estimado;
              const total = realizado + previsto;
              const ativo = selecionado === b.ym;
              const { mes, ano } = rotulo(b.ym);

              const pct = (v: number) => (v / topo) * 100;
              // ⚠️ Dentro da barra a fatia é percentual DO TOTAL DELA, não do
              // eixo: quem já resolveu a escala foi a altura do invólucro.
              const temVao = realizado > 0 && previsto > 0;
              const VAO = 3;
              const fatia = (v: number) => (total > 0
                ? `calc(${(v / total) * 100}% - ${temVao ? VAO / 2 : 0}px)`
                : '0%');

              const legenda = [
                realizado > 0 ? `${rotuloRealizado} ${brl(realizado)}` : '',
                previsto > 0 ? `${rotuloPrevisto} ${brl(previsto)}` : '',
              ].filter(Boolean).join(', ');

              return (
                <button
                  key={b.ym}
                  type="button"
                  data-ym={b.ym}
                  onClick={() => onSelecionar(b.ym)}
                  aria-pressed={ativo}
                  aria-label={`${mes} ${ano}: ${brl(total)}${legenda ? ` — ${legenda}` : ''}`}
                  className={`group relative flex flex-col justify-end h-full rounded-xl transition-colors ${
                    rolavel ? 'w-[46px]' : 'flex-1 min-w-[26px] max-w-[72px]'
                  }`}
                  // Alvo de toque: a barra é estreita, mas o BOTÃO ocupa a
                  // altura toda do quadro — bem acima dos 44px exigidos.
                  style={{ minHeight: 44 }}
                >
                  {/* Divisor vertical do "daqui pra frente". Fica DENTRO da
                      fatia, encostado na borda direita, pra cair exatamente
                      entre dois meses em qualquer largura. */}
                  {divisorApos === b.ym && (
                    <span
                      className="absolute top-0 bottom-0 pointer-events-none"
                      style={{
                        right: 'calc(-0.25rem - 0.5px)',
                        borderLeft: '1px dashed hsl(var(--border))',
                      }}
                      aria-hidden
                    />
                  )}

                  {/* ── A BARRA ────────────────────────────────────────────
                      ⚠️ DOIS INVÓLUCROS, e o de fora é obrigatório: as alturas
                      dos segmentos são percentuais, e percentual precisa de um
                      pai com altura conhecida. O de dentro é o que RECEBE o
                      arredondamento e o anel de seleção — botei os dois no de
                      fora numa primeira versão e o anel saiu desenhado em volta
                      da coluna inteira, do chão ao topo do quadro, virando uma
                      cápsula fantasma de 176px sobre uma barra de 8%. */}
                  <span className="w-full flex flex-col justify-end" style={{ height: '100%' }}>
                    <span
                      className="relative w-full flex flex-col justify-end rounded-full transition-shadow duration-200"
                      style={{
                        height: `${Math.max(pct(total), total > 0 ? 2 : 0)}%`,
                        boxShadow: ativo ? `0 0 0 1.5px ${tom(cor, 26)}` : undefined,
                      }}
                    >
                      {/* ── PREVISTO (em cima, tom claro) ──────────────────
                          A parte estimada vem por cima da firme e leva LISTRA:
                          a diferença entre "vai sair isto" e "deve sair mais ou
                          menos isto" não pode depender só do tom. */}
                      {estimado > 0 && (
                        <span
                          className="w-full rounded-t-full motion-safe:animate-[slide-up_500ms_cubic-bezier(0.22,1,0.36,1)_both]"
                          style={{
                            height: fatia(estimado),
                            animationDelay: `${i * 40}ms`,
                            background: `repeating-linear-gradient(135deg, ${tom(cor, 46)}, ${tom(cor, 46)} 3px, ${tom(cor, 15)} 3px, ${tom(cor, 15)} 6px)`,
                          }}
                        />
                      )}
                      {firmePrevisto > 0 && (
                        <span
                          className={`w-full rounded-b-full motion-safe:animate-[slide-up_500ms_cubic-bezier(0.22,1,0.36,1)_both] ${
                            estimado > 0 ? '' : 'rounded-t-full'
                          }`}
                          style={{
                            height: fatia(firmePrevisto),
                            animationDelay: `${i * 40}ms`,
                            background: degrade(cor, 22, 42),
                          }}
                        />
                      )}

                      {/* ⚠️ A SEPARAÇÃO É UM VÃO DE VERDADE, não uma borda: borda
                          clara some no tema escuro e borda escura some no claro.
                          Um vão transparente deixa o fundo do card aparecer e
                          funciona nos dois. O `calc` desconta a folga das duas
                          fatias — sem isso a barra passa 3px do próprio total e
                          o mês fica alto demais em relação ao vizinho. */}
                      {temVao && <span className="w-full flex-shrink-0" style={{ height: VAO }} aria-hidden />}

                      {/* ── REALIZADO (embaixo, tom cheio) ─────────────────── */}
                      {realizado > 0 && (
                        <span
                          className="w-full rounded-full motion-safe:animate-[slide-up_500ms_cubic-bezier(0.22,1,0.36,1)_both]"
                          style={{
                            height: fatia(realizado),
                            animationDelay: `${i * 40}ms`,
                            background: degrade(cor, 74, 100),
                          }}
                        />
                      )}
                    </span>

                    {/* Mês sem nada: um traço no chão. Fatia vazia lê como falha
                        de carregamento; um traço lê como "foi zero". */}
                    {total <= 0 && (
                      <span
                        className="w-full rounded-full"
                        style={{ height: 3, background: tom(cor, 20) }}
                        aria-hidden
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Rótulos do eixo X, fora do quadro pra não roubar altura das barras. */}
          <div className={`flex gap-1.5 sm:gap-2 mt-2.5 ${rolavel ? 'w-max' : ''}`}>
            {barras.map((b, i) => {
              const { mes, ano } = rotulo(b.ym);
              const ativo = selecionado === b.ym;
              // O ano só aparece quando MUDA (e no primeiro): repetir '26 em
              // seis rótulos é ruído que empurra o olho pra baixo.
              const mostraAno = i === 0 || b.ym.slice(0, 4) !== barras[i - 1].ym.slice(0, 4);
              return (
                <span
                  key={b.ym}
                  className={`text-center leading-tight ${rolavel ? 'w-[46px]' : 'flex-1 min-w-[26px] max-w-[72px]'}`}
                >
                  <span className={`block text-[11px] capitalize ${
                    ativo ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'
                  }`}>
                    {mes}
                  </span>
                  <span className={`block text-[9.5px] tabular-nums ${
                    ativo ? 'text-muted-foreground' : 'text-muted-foreground/60'
                  }`}>
                    {mostraAno ? ano : ''}
                  </span>
                </span>
              );
            })}
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A MESMA leitura da barra do gráfico, em uma linha: quanto já aconteceu e
 * quanto ainda vem.
 *
 * ⚠️ Repetir o desenho aqui é o ponto. O número embaixo do gráfico ("R$ 23,80
 * já saiu · R$ 29,90 previsto") é a mesma divisão que o segmento da barra
 * mostra — usar dois desenhos diferentes pra dizer a mesma coisa faz a pessoa
 * conferir se são a mesma conta.
 */
export function BarraDividida({
  realizado, previsto, cor, rotuloRealizado, rotuloPrevisto,
}: {
  realizado: number;
  previsto: number;
  cor: string;
  rotuloRealizado: string;
  rotuloPrevisto: string;
}) {
  const total = Math.max(0, realizado) + Math.max(0, previsto);
  const pct = total > 0 ? (Math.max(0, realizado) / total) * 100 : 0;

  return (
    <div>
      <div className="flex h-2 rounded-full overflow-hidden" style={{ background: tom(cor, 14) }}>
        <span
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: degrade(cor, 100, 74) }}
          aria-hidden
        />
        <span
          className="h-full transition-[width] duration-500 ease-out"
          style={{ width: `${100 - pct}%`, background: degrade(cor, 40, 26) }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between gap-3 mt-2">
        <span className="text-[11.5px] text-muted-foreground">
          <strong className="font-bold text-foreground tabular-nums">{brl(realizado)}</strong> {rotuloRealizado}
        </span>
        <span className="text-[11.5px] text-muted-foreground text-right">
          <strong className="font-bold tabular-nums" style={{ color: cor }}>{brl(previsto)}</strong> {rotuloPrevisto}
        </span>
      </div>
    </div>
  );
}
