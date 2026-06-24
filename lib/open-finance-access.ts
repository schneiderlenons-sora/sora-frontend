// =====================================================================
// Allowlist do Open Finance — recurso liberado só pra usuários específicos
// (rollout fechado). Para liberar pra mais alguém, é só adicionar aqui.
// Critério: e-mail de login (principal) ou número de WhatsApp (reforço).
// =====================================================================
const EMAILS = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
  'cassiopellegrim@gmail.com',
];
const PHONES = [
  '5511991774537',
];

const normEmail = (e?: string | null) => (e || '').trim().toLowerCase();
const normPhone = (p?: string | null) => (p || '').replace(/\D/g, '');

export function podeVerOpenFinance(email?: string | null, phone?: string | null): boolean {
  const e = normEmail(email);
  const p = normPhone(phone);
  return (!!e && EMAILS.includes(e)) || (!!p && PHONES.includes(p));
}
