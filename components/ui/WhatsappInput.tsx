'use client';

import { forwardRef } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Input de WhatsApp (Brasil) — máscara (DD) 9XXXX-XXXX, limite de dígitos e
// validação. É puramente cosmético: o `value`/`onChange` trabalham com DÍGITOS
// LOCAIS (sem o 55). Quem consome adiciona o '55' na hora de enviar, igual hoje.
//
// Quando formos pra outros países, este componente vira o ponto único de troca
// (seletor de país + libphonenumber-js) — o resto do app não muda.
// ─────────────────────────────────────────────────────────────────────────────

/** Formata dígitos locais (até 11) em (DD) 9XXXX-XXXX, parcial enquanto digita. */
export function formatWhatsappBR(digits: string): string {
  const d = (digits || '').replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Extrai só os dígitos locais (sem 55), tolerando colagem com código do país. */
export function soDigitosLocaisBR(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  // Coloução com o 55 na frente (ex.: copiou "5532999167475") → remove o país.
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  return d.slice(0, 11);
}

/** Celular BR válido: 11 dígitos = DDD (não começa com 0) + 9 + 8 dígitos. */
export function whatsappBRValido(localDigits: string): boolean {
  return /^[1-9][0-9]9\d{8}$/.test((localDigits || '').replace(/\D/g, ''));
}

type Props = {
  /** Dígitos locais (sem 55). Ex.: "32999167475". */
  value: string;
  onChange: (digitosLocais: string) => void;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  required?: boolean;
  id?: string;
  placeholder?: string;
  'aria-invalid'?: boolean;
};

const WhatsappInput = forwardRef<HTMLInputElement, Props>(function WhatsappInput(
  { value, onChange, className, disabled, autoFocus, required, id, placeholder = '(11) 99999-9999', ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      id={id}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={16} // "(DD) 9XXXX-XXXX" = 15-16 chars; o filtro de dígitos é o limite real
      placeholder={placeholder}
      value={formatWhatsappBR(value)}
      onChange={(e) => onChange(soDigitosLocaisBR(e.target.value))}
      disabled={disabled}
      autoFocus={autoFocus}
      required={required}
      className={className}
      {...rest}
    />
  );
});

export default WhatsappInput;
