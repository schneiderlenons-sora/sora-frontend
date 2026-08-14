// =====================================================================
// "Vou conectar pelo Open Finance" — escolha feita no onboarding (step 5).
//
// Guardada em localStorage, por usuário, em vez de coluna nova no Supabase:
// é uma dica de NAVEGAÇÃO com vida curta (vale do step 5 até o fim do
// wizard), não um dado do usuário. Coluna nova exigiria migration e viraria
// estado permanente pra uma decisão que morre em 5 minutos.
//
// Mesmo padrão do `lib/plan-intent.ts`.
// =====================================================================

const KEY = 'sora-of-onboarding';
const TTL_MS = 7 * 24 * 3600 * 1000;   // 7 dias — onboarding abandonado expira

type Registro = { userId: string; em: number };

function ler(): Registro | null {
  if (typeof window === 'undefined') return null;
  try {
    const cru = window.localStorage.getItem(KEY);
    if (!cru) return null;
    const r = JSON.parse(cru) as Registro;
    if (!r?.userId || Date.now() - (r.em || 0) > TTL_MS) return null;
    return r;
  } catch { return null; }
}

/** Marca (ou desmarca) que este usuário vai conectar o banco em vez de digitar. */
export function salvarIntencaoOF(userId: string | undefined, vai: boolean) {
  if (typeof window === 'undefined' || !userId) return;
  try {
    if (vai) window.localStorage.setItem(KEY, JSON.stringify({ userId, em: Date.now() }));
    else window.localStorage.removeItem(KEY);
  } catch { /* modo privado / storage cheio */ }
}

/**
 * Este usuário escolheu conectar pelo Open Finance?
 *
 * ⚠️ Confere o `userId`: em PC compartilhado o próximo usuário não pode herdar
 * a escolha do anterior e ser mandado pra uma aba que ele nem tem.
 */
export function querOpenFinance(userId: string | undefined): boolean {
  if (!userId) return false;
  const r = ler();
  return !!r && r.userId === userId;
}

/** Consumida ao fim do onboarding — a dica não sobrevive ao wizard. */
export function limparIntencaoOF() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
}
