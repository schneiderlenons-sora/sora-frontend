// Armazena a intenção de plano selecionada na landing/signup para
// redirecionar o usuário direto pro checkout após o primeiro login.
// TTL curto pra evitar redirects "fantasma" semanas depois.

import type { PlanoId, Intervalo } from '@/lib/stripe';

const KEY = 'sora_intent_plano';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

type Stored = { plano: PlanoId; ciclo: Intervalo; at: number };

const PLANOS_VALIDOS: PlanoId[] = ['basico', 'premium', 'black'];

export function salvarIntencaoPlano(
  plano: string | null | undefined,
  ciclo?: string | null | undefined,
): void {
  if (typeof window === 'undefined') return;
  if (!plano || !PLANOS_VALIDOS.includes(plano as PlanoId)) return;
  try {
    const payload: Stored = {
      plano: plano as PlanoId,
      ciclo: ciclo === 'anual' ? 'anual' : 'mensal',
      at: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // localStorage pode estar bloqueado (modo privado, cookies off)
  }
}

export function lerIntencaoPlano(): { plano: PlanoId; ciclo: Intervalo } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.plano || !PLANOS_VALIDOS.includes(parsed.plano)) return null;
    if (Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return { plano: parsed.plano, ciclo: parsed.ciclo === 'anual' ? 'anual' : 'mensal' };
  } catch {
    return null;
  }
}

export function limparIntencaoPlano(): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
