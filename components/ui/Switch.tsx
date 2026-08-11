'use client';

// =============================================================================
// Interruptor (switch) — UMA implementação pro painel inteiro.
//
// ⚠️ AS MEDIDAS SÃO INLINE DE PROPÓSITO, não classes do Tailwind.
// A versão com `w-11 h-6` + knob `absolute` quebrava: dentro de um flex o pill
// era comprimido, mas o knob — posicionado por `translateX` fixo — continuava
// no mesmo lugar e VAZAVA pra fora da pílula (foi o que apareceu na aba
// Agentes). Com `minWidth` inline o pill não tem como encolher, e o knob é um
// filho normal do flex, então ele acompanha o pill em vez de flutuar sobre ele.
//
// Este é o desenho que já rodava em produção na antiga Central de Avisos;
// virou componente pra não ser reescrito (e requebrado) a cada tela nova.
// =============================================================================

interface Props {
  on: boolean;
  onToggle: () => void;
  /** Lido por leitor de tela — descreve O QUE o interruptor liga. */
  label: string;
  /** Cor de "ligado". Default: verde da marca. */
  cor?: string;
  /** `md` (48×28, padrão) ou `sm` (44×26) pra listas mais densas. */
  tamanho?: 'sm' | 'md';
  disabled?: boolean;
}

export default function Switch({ on, onToggle, label, cor, tamanho = 'md', disabled }: Props) {
  const L = tamanho === 'sm'
    ? { w: 44, h: 26, k: 20, on: 21, off: 3 }
    : { w: 48, h: 28, k: 22, on: 23, off: 3 };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="relative inline-flex items-center flex-shrink-0 rounded-full transition-colors duration-200
                 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                 focus-visible:ring-offset-background"
      style={{
        width: L.w, height: L.h, minWidth: L.w,
        background: on ? (cor || 'hsl(var(--primary))') : 'hsl(var(--bg-muted))',
        ['--tw-ring-color' as string]: cor || 'hsl(var(--primary))',
      }}
    >
      <span
        className="inline-block bg-white rounded-full shadow transition-transform duration-200"
        style={{ width: L.k, height: L.k, transform: `translateX(${on ? L.on : L.off}px)` }}
      />
    </button>
  );
}
