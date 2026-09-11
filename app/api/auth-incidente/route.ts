import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────────────────────
// Recebe o aviso de "a renovação de sessão foi adiada" que o navegador manda em
// `lib/supabase.ts`. É a METADE QUE FALTAVA da instrumentação da migration 163.
//
// ⚠️ POR QUE A 163 SOZINHA NÃO BASTAVA. Ela só enxerga requisição que chega COM
// cookie de sessão e falha a validação — tudo no servidor. O bug dos 6 relatos
// acontece ANTES disso, no navegador: o cookie é apagado pelo próprio
// supabase-js e a navegação seguinte sai limpa. Do lado do servidor isso é
// indistinguível de alguém que nunca logou. Daí este aviso, que é a única
// testemunha do instante real.
//
// ⚠️ ESTA ROTA NÃO CRIA CLIENT DO SUPABASE. Nenhum. `/api/*` está FORA do
// matcher do middleware, e `getUser()` numa Route Handler pode disparar
// renovação, perder a corrida e escrever cookie de sessão VAZIO — que em Route
// Handler funciona de verdade e mata a sessão. Uma rota que existe pra
// diagnosticar o logout não pode ter como causá-lo: ela só LÊ o cookie.
// ─────────────────────────────────────────────────────────────────────────────

/** Espelha `donoDoCookie` do middleware: só lê e decodifica, não valida nada. */
function donoDoCookie(lista: { name: string; value: string }[]): { id?: string; email?: string } {
  try {
    // Sessão acima de ~4 KB vem FATIADA (`.0`, `.1`): junta na ordem.
    const partes = [...lista].sort((a, b) => a.name.localeCompare(b.name));
    let bruto = partes.map((c) => c.value).join('');
    if (!bruto) return {};
    if (bruto.startsWith('base64-')) bruto = atob(bruto.slice(7));
    const j = JSON.parse(bruto);
    return { id: j?.user?.id, email: j?.user?.email };
  } catch { return {}; }
}

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) return NextResponse.json({ ok: true });

    const corpo = await request.json().catch(() => ({}));
    const status = Number(corpo?.status) || null;
    const rota = typeof corpo?.rota === 'string' ? corpo.rota.slice(0, 200) : null;

    const jar = await cookies();
    const sessao = jar.getAll().filter((c) => c.name.includes('-auth-token'));
    const dono = donoDoCookie(sessao);

    const base = {
      user_id: dono.id || null,
      email: dono.email || null,
      rota,
      palpite: false,
      user_agent: (request.headers.get('user-agent') || '').slice(0, 400),
      cookies: sessao.length,
    };

    const gravar = async (linha: Record<string, unknown>) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      try {
        return await fetch(`${url}/rest/v1/auth_incidentes`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(linha),
          signal: ctrl.signal,
        });
      } catch { return null; } finally { clearTimeout(t); }
    };

    // ⚠️ TOLERANTE À MIGRATION 164 NÃO TER RODADO. `origem`/`detalhe` são
    // colunas novas e o usuário roda as migrations à mão, então entre o deploy e
    // o SQL existe uma janela em que elas não existem. Coluna desconhecida faz o
    // PostgREST devolver 400 e a linha se PERDERIA em silêncio — justo a linha
    // que queremos capturar. Na falha, grava sem elas: melhor um incidente sem o
    // status do que incidente nenhum.
    const r = await gravar({
      ...base,
      origem: 'navegador',
      detalhe: status ? `renovacao adiada HTTP ${status}` : 'renovacao adiada',
    });
    if (r && !r.ok) await gravar(base);
  } catch { /* instrumentação nunca derruba o que está medindo */ }

  // Sempre 200: o cliente não deve nem saber se a gravação deu certo.
  return NextResponse.json({ ok: true });
}
