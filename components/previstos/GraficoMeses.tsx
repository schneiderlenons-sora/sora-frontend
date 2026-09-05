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
 */

export type BarraMes = {
  ym: string;
  /** Parte comprometida (contrato, parcela, fixo). */
  firme: number;
  /** Parte estimada (valor variável) — desenhada com listra, não só cor. */
  estimado?: number;
  /** Mês que já aconteceu (passado ou corrente). */
  realizado?: boolean;
};

const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function rotulo(ym: string) {
  const [ano, mes] = ym.split('-').map(Number);
  return { mes: MES_CURTO[mes - 1] || '', ano: `'${String(ano).slice(2)}` };
}

/**
 * Cor da barra conforme a confiança do dado.
 *
 * ⚠️ MISTURA DE COR, NÃO `opacity`. A entrada usa `slide-up`, cujo keyframe
 * TERMINA em `opacity: 1` — e com `animation-fill-mode: both` esse valor final
 * vence o estilo inline. Medido na bancada: todas as barras saíam opacas, e o
 * mês projetado ficava com o mesmo peso visual do mês que já aconteceu.
 */
const tom = (cor: string, pct: number) =>
  `color-mix(in srgb, ${cor} ${pct}%, transparent)`;

const fmtCurto = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(abs >= 10000 ? 0 : 1).replace('.', ',')}k`;
  return String(Math.round(v));
};

export default function GraficoMeses({
  barras,
  cor,
  selecionado,
  onSelecionar,
  rotuloAcessivel,
}: {
  barras: BarraMes[];
  /** Cor da série. Recebe token ou hex — o componente não decide semântica. */
  cor: string;
  selecionado: string | null;
  onSelecionar: (ym: string) => void;
  rotuloAcessivel: string;
}) {
  const trilhoRef = useRef<HTMLDivElement>(null);

  const max = useMemo(
    () => Math.max(1, ...barras.map((b) => b.firme + (b.estimado || 0))),
    [barras],
  );

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
      <div className="h-40 flex items-center justify-center rounded-2xl border border-dashed border-border/60">
        <p className="text-sm text-muted-foreground">Sem dados no período</p>
      </div>
    );
  }

  return (
    <div
      ref={trilhoRef}
      className={`relative ${rolavel ? 'overflow-x-auto scrollbar-none -mx-1 px-1' : ''}`}
      // Resumo pro leitor de tela: um gráfico sem isto é uma caixa vazia.
      role="img"
      aria-label={rotuloAcessivel}
    >
      {/* Linhas de grade discretas — não competem com o dado. */}
      <div className="absolute inset-x-0 top-0 h-32 pointer-events-none" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-x-0 border-t border-border/40"
            style={{ top: `${i * 50}%` }}
          />
        ))}
      </div>

      <div className={`flex items-end gap-1.5 h-32 ${rolavel ? 'w-max' : ''}`}>
        {barras.map((b, i) => {
          const total = b.firme + (b.estimado || 0);
          const ativo = selecionado === b.ym;
          const { mes, ano } = rotulo(b.ym);
          const alturaFirme = (b.firme / max) * 100;
          const alturaEst = ((b.estimado || 0) / max) * 100;

          return (
            <button
              key={b.ym}
              type="button"
              data-ym={b.ym}
              onClick={() => onSelecionar(b.ym)}
              aria-pressed={ativo}
              aria-label={`${mes} ${ano}: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
              className={`group relative flex flex-col justify-end h-full rounded-lg transition-colors ${
                rolavel ? 'w-[42px]' : 'flex-1 min-w-[24px]'
              } ${ativo ? 'bg-muted/40' : 'hover:bg-muted/25'}`}
              // Alvo de toque: a barra é estreita, mas o BOTÃO ocupa a altura
              // toda da área do gráfico — 128px, bem acima dos 44 exigidos.
              style={{ minHeight: 44 }}
            >
              <span className="relative w-full flex flex-col justify-end" style={{ height: '100%' }}>
                {/* Estimado por cima, com listra: a diferença não é só a cor. */}
                {alturaEst > 0 && (
                  <span
                    className="w-full rounded-t-lg motion-safe:animate-[slide-up_450ms_ease-out_both]"
                    style={{
                      height: `${alturaEst}%`,
                      animationDelay: `${i * 35}ms`,
                      background: `repeating-linear-gradient(135deg, ${tom(cor, b.realizado ? 90 : 40)}, ${tom(cor, b.realizado ? 90 : 40)} 3px, transparent 3px, transparent 6px)`,
                    }}
                  />
                )}
                <span
                  className={`w-full motion-safe:animate-[slide-up_450ms_ease-out_both] ${
                    alturaEst > 0 ? 'rounded-b-lg' : 'rounded-lg'
                  }`}
                  style={{
                    height: `${Math.max(alturaFirme, total > 0 ? 3 : 0)}%`,
                    animationDelay: `${i * 35}ms`,
                    background: tom(cor, b.realizado ? 100 : 45),
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>

      {/* Rótulos do eixo, fora do trilho das barras pra não apertar a altura. */}
      <div className={`flex gap-1.5 mt-2 ${rolavel ? 'w-max' : ''}`}>
        {barras.map((b) => {
          const { mes, ano } = rotulo(b.ym);
          const ativo = selecionado === b.ym;
          return (
            <span
              key={b.ym}
              className={`text-center leading-tight ${rolavel ? 'w-[42px]' : 'flex-1 min-w-[24px]'}`}
            >
              <span className={`block text-[10px] font-bold uppercase ${ativo ? 'text-foreground' : 'text-muted-foreground'}`}>
                {mes}
              </span>
              {/* O ano só aparece quando muda — repetir '26 em seis barras é ruído. */}
              <span className="block text-[9px] text-muted-foreground/70">
                {b.ym.endsWith('-01') || barras[0].ym === b.ym ? ano : ''}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export { fmtCurto };
