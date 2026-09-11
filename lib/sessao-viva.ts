import { supabase } from './supabase';
import { temSessaoNoCookie } from './renovacao-sessao';

// ─────────────────────────────────────────────────────────────────────────────
// "A sessão morreu MESMO?" — a pergunta que faltava ser feita antes de mandar
// alguém pra tela de login.
//
// ⚠️ user === null NÃO SIGNIFICA "deslogado". O refresh token do Supabase é de
// uso único, e o navegador e o middleware renovam a MESMA sessão. Quando os dois
// disparam juntos, o perdedor recebe erro; o supabase-js trata erro que não é de
// rede como definitivo, chama _removeSession() e emite SIGNED_OUT — com a sessão
// do lado vencedor viva. (Conferido no auth-js 2.105.4.)
//
// ⚠️ E AGORA EXISTE UM SEGUNDO CASO — o que fechou o bug dos 6 relatos.
// Desde a correção em lib/supabase.ts, uma renovação que falha por
// INFRAESTRUTURA (429 do rate limit, 500, timeout) vira erro retryable: o cookie
// é PRESERVADO de propósito e o auto-refresh tenta de novo depois.
//
// Só que o getSession() devolve session: null nesse instante — lido no auth-js,
// __loadSession:
//
//     const { data: session, error } = await this._callRefreshToken(...)
//     if (error) return this._returnResult({ data: { session: null }, error })
//
// Ou seja: perguntar só ao getSession() responderia "morreu" para a sessão que
// acabamos de salvar, e a pessoa cairia no login do mesmo jeito. **As duas
// metades da correção só funcionam juntas.**
//
// A PROVA QUE FALTAVA É O COOKIE — o mesmo critério que o middleware usa no
// servidor (tinhaSessao). Se ele ainda está no navegador, a sessão não foi
// encerrada; quando morre de verdade, o _removeSession() o apaga.
//
// ⚠️ NA DÚVIDA, NÃO DESLOGA. Se a checagem falhar (offline, storage bloqueado),
// devolve false. O custo de errar pra cá é a pessoa continuar na tela em que já
// estava — e o middleware ainda protege a rota no servidor. O custo de errar pro
// outro lado é o bug que trouxe seis relatos.
// ─────────────────────────────────────────────────────────────────────────────

const ESPERA_PADRAO_MS = 1200;

export async function sessaoRealmenteMorreu(esperaMs = ESPERA_PADRAO_MS): Promise<boolean> {
  // A espera existe porque a resposta VENCEDORA pode ainda estar a caminho: é
  // ela que traz o par novo no Set-Cookie.
  await new Promise((r) => setTimeout(r, esperaMs));
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) return false;

    // Sem sessão em memória mas COM cookie: renovação adiada por infraestrutura
    // (ver o bloco no topo). Não é logout.
    const cookies = typeof document === 'undefined' ? '' : document.cookie;
    if (temSessaoNoCookie(cookies, process.env.NEXT_PUBLIC_SUPABASE_URL || '')) return false;

    return true;
  } catch {
    return false;
  }
}
