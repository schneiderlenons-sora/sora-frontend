// =====================================================================
// Allowlist do Open Finance — recurso liberado só pra usuários específicos
// (rollout fechado). Para liberar pra mais alguém, é só adicionar aqui.
// Critério: e-mail de login (principal) ou número de WhatsApp (reforço).
// =====================================================================
// TESTE FECHADO (Polp): dono + convidados, enquanto valida a integração de
// banco real. Quem não está aqui continua vendo a aba "em atualização".
// Os dois primeiros e-mails são a mesma pessoa (login por qualquer um).
// Pra reabrir depois, é só voltar a adicionar os e-mails/telefones aqui.
const EMAILS = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
  'anamarinalima891@gmail.com',
];
const PHONES: string[] = [];

const normEmail = (e?: string | null) => (e || '').trim().toLowerCase();
const normPhone = (p?: string | null) => (p || '').replace(/\D/g, '');

export function podeVerOpenFinance(email?: string | null, phone?: string | null): boolean {
  const e = normEmail(email);
  const p = normPhone(phone);
  return (!!e && EMAILS.includes(e)) || (!!p && PHONES.includes(p));
}
