// =============================================================================
// Quadro de pessoal do negócio (fase 4).
//
// Escopo SIMPLES por decisão de produto: registro de pagamento, SEM cálculo de
// encargos CLT. "Pagar" gera um lançamento de saída na categoria 'folha' —
// a folha nasce dentro do caixa, não numa ilha separada.
// =============================================================================

export type VinculoFuncionario = 'clt' | 'pj' | 'diarista' | 'estagio' | 'outro';

export interface Funcionario {
  id:             string;
  empresa_id:     string;
  nome:           string;
  foto_url?:      string | null;
  cargo?:         string | null;
  vinculo:        VinculoFuncionario;
  salario:        number;            // CENTAVOS
  dia_pagamento?: number | null;     // 1..31
  pix?:           string | null;
  ativo?:         boolean;
  observacao?:    string | null;
}

export const VINCULOS: { v: VinculoFuncionario; label: string }[] = [
  { v: 'clt',      label: 'CLT' },
  { v: 'pj',       label: 'PJ' },
  { v: 'diarista', label: 'Diarista' },
  { v: 'estagio',  label: 'Estágio' },
  { v: 'outro',    label: 'Outro' },
];

export const labelVinculo = (v?: VinculoFuncionario) =>
  VINCULOS.find(x => x.v === v)?.label || 'Outro';

/** Iniciais pro avatar quando não há foto. */
export function iniciais(nome?: string): string {
  const p = (nome || '').trim().split(/\s+/);
  return (p.slice(0, 2).map(x => x[0]?.toUpperCase() || '').join('')) || '?';
}

/** Dia do mês → rótulo curto ("todo dia 5"). */
export const labelDiaPagamento = (d?: number | null) =>
  d ? `Todo dia ${d}` : 'Sem dia fixo';
