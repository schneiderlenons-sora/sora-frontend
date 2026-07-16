// =====================================================================
// Allowlist do Open Finance — recurso liberado só pra usuários específicos
// (rollout fechado). Para liberar pra mais alguém, é só adicionar aqui.
// Critério: e-mail de login (principal) ou número de WhatsApp (reforço).
// =====================================================================
// TESTE FECHADO (Polp): só o dono, enquanto valida a integração de banco real.
// Os dois e-mails são a mesma pessoa (login pode ser por qualquer um).
// Pra reabrir depois, é só voltar a adicionar os e-mails/telefones aqui.
const EMAILS = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
];
const PHONES: string[] = [];

const normEmail = (e?: string | null) => (e || '').trim().toLowerCase();
const normPhone = (p?: string | null) => (p || '').replace(/\D/g, '');

export function podeVerOpenFinance(email?: string | null, phone?: string | null): boolean {
  const e = normEmail(email);
  const p = normPhone(phone);
  return (!!e && EMAILS.includes(e)) || (!!p && PHONES.includes(p));
}
