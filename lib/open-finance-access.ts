// =====================================================================
// Quem enxerga o Open Finance no painel.
//
// Era uma allowlist de e-mails (teste fechado com a Polp). Agora o recurso está
// ABERTO, mas só pra quem tem ASSINATURA RECORRENTE — Básico (1 conexão) e
// Premium (3). Vitalício fica de fora: pagou uma vez e cada conexão nos custa
// mensalidade no agregador. A regra em si mora em `temOpenFinance` (lib/plans),
// que o backend espelha em config/openFinanceAccess.js.
//
// A allowlist continua existindo como ATALHO de teste (dono + convidados), pra
// validar banco novo sem depender do plano da conta.
// =====================================================================
import { temOpenFinance, type Plano } from './plans';

const EMAILS = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
  'anamarinalima891@gmail.com',
];
const PHONES: string[] = [];

const normEmail = (e?: string | null) => (e || '').trim().toLowerCase();
const normPhone = (p?: string | null) => (p || '').replace(/\D/g, '');

/** Atalho de teste — independe do plano. */
export function naAllowlistOpenFinance(email?: string | null, phone?: string | null): boolean {
  const e = normEmail(email);
  const p = normPhone(phone);
  return (!!e && EMAILS.includes(e)) || (!!p && PHONES.includes(p));
}

/**
 * A aba do Open Finance aparece pra este usuário?
 * `perfil` traz plano e vitalício; sem ele cai só na allowlist — assim a aba não
 * pisca "liberada" enquanto o perfil ainda está carregando.
 */
export function podeVerOpenFinance(
  email?: string | null,
  phone?: string | null,
  perfil?: { plano?: string | null; vitalicio?: boolean | null } | null,
): boolean {
  if (naAllowlistOpenFinance(email, phone)) return true;
  if (!perfil) return false;
  return temOpenFinance((perfil.plano || 'inativo') as Plano, { vitalicio: perfil.vitalicio });
}
