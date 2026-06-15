// Quem é admin. Client-safe (função pura). A segurança REAL é server-side
// (lib/admin-server.ts checa isso em todo endpoint /api/admin); aqui é só pra
// decidir se mostra o item no menu.
//
// Configure via env NEXT_PUBLIC_ADMIN_EMAILS (lista separada por vírgula) pra
// valer no client e no server. ADMIN_EMAILS (sem NEXT_PUBLIC) vale só no server.
const FALLBACK_ADMINS = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
];

export function adminEmails(): string[] {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || process.env.ADMIN_EMAILS || '';
  const list = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return list.length ? list : FALLBACK_ADMINS;
}

export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}
