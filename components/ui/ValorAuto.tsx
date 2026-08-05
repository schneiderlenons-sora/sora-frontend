// =============================================================================
// Valor monetário que ENCOLHE A FONTE sozinho pra caber em UMA linha.
//
// Problema que resolve: `Intl.NumberFormat('pt-BR', {currency})` devolve
// "-R$ 2.529,92", e o navegador tem permissão de quebrar a linha DEPOIS do
// hífen — num card estreito (grid de 2 colunas no mobile) o "-" ficava sozinho
// numa linha e o valor caía na de baixo. Só pôr `whitespace-nowrap` conserta a
// quebra mas estoura a borda do card.
//
// Solução: container query + clamp, SEM JavaScript.
//   - `container-type: inline-size` faz o wrapper virar unidade de medida;
//   - `100cqi` é a largura real do card, seja qual for a tela;
//   - a fonte vira `largura do card ÷ largura estimada do texto`, limitada
//     entre um piso e o tamanho de projeto.
//
// Ou seja: em card largo (desktop) o valor fica no tamanho normal e NADA muda;
// em card estreito ele diminui só o necessário pra não quebrar nem vazar.
// Zero JS, zero medição de DOM, zero reflow — não pesa nada.
//
// Se o navegador não suportar `cqi`, a declaração inteira é descartada e vale
// o tamanho que veio na className (degradação limpa).
// =============================================================================

/** Largura média por caractere de um valor em BRL, em `em`, na Inter bold com
 *  tabular-nums. Medido em "-R$ 2.529,92": 5,96em em 12 caracteres = 0,497em
 *  por caractere. Uso 0,53 pra sobrar ~7% de folga (e `tracking-tight`, que os
 *  cards usam, ainda aperta mais um pouco). */
const EM_POR_CHAR = 0.53;

export default function ValorAuto({
  children,
  max = '1.5rem',
  min = '0.8rem',
  className = '',
  style,
}: {
  /** O valor JÁ formatado (ex.: fmt(saldo)). */
  children: string;
  /** Tamanho de projeto — o valor nunca passa disso. Default 1.5rem (text-2xl). */
  max?: string;
  /** Piso de legibilidade. Default 0.8rem. */
  min?: string;
  className?: string;
  /** Estilo extra do texto (cor, etc.). `fontSize` é sempre calculado aqui. */
  style?: React.CSSProperties;
}) {
  const larguraEm = (children.length * EM_POR_CHAR).toFixed(2);
  return (
    <span style={{ display: 'block', containerType: 'inline-size' }}>
      <span
        className={`block whitespace-nowrap tabular ${className}`}
        style={{ ...style, fontSize: `clamp(${min}, calc(100cqi / ${larguraEm}), ${max})` }}
      >
        {children}
      </span>
    </span>
  );
}
