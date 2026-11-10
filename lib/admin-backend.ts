// Chamada do painel admin (Route Handler do Next) pro backend Express, com o
// segredo interno. Junta o que cada rota repetia: as duas variáveis de ambiente,
// o cold start do Render (que vira mensagem legível) e o corpo de erro.
//
// ⚠️ Só em código de SERVIDOR: `ADMIN_SECRET` não tem NEXT_PUBLIC de propósito.
export async function chamarBackendAdmin(
  caminho: string,
  init: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; body: any }> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  const secret = process.env.ADMIN_SECRET;
  if (!base || !secret) {
    return { ok: false, status: 503, body: { erro: 'Falta NEXT_PUBLIC_API_URL ou ADMIN_SECRET na Vercel.' } };
  }
  try {
    const r = await fetch(`${base}${caminho}`, {
      method: init.method || 'GET',
      headers: { 'x-admin-secret': secret, 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: 'no-store',
    });
    const body = await r.json().catch(() => ({ erro: `resposta inválida (${r.status})` }));
    return { ok: r.ok, status: r.status, body };
  } catch (e: unknown) {
    return {
      ok: false, status: 502,
      body: { erro: `O servidor não respondeu (${e instanceof Error ? e.message : 'erro'}). Costuma ser o Render acordando — tente de novo.` },
    };
  }
}
