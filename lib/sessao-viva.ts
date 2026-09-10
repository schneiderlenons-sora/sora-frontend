import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────────────────────
// "A sessão morreu MESMO?" — a pergunta que faltava ser feita antes de mandar
// alguém pra tela de login.
//
// ⚠️ `user === null` NÃO SIGNIFICA "deslogado". O refresh token do Supabase é de
// uso único, e o navegador e o middleware renovam a MESMA sessão. Quando os dois
// disparam juntos, o perdedor recebe 400 ("Invalid Refresh Token: Already
// Used"); o supabase-js trata erro que não é de rede como definitivo, chama
// `_removeSession()` e emite `SIGNED_OUT` — com a sessão do lado vencedor viva.
// (Conferido no auth-js 2.105.4: `GoTrueClient._callRefreshToken`.)
//
// Quem redirecionava direto nesse instante transformava uma disputa de
// milissegundos em "fui deslogado no meio do menu". Daí este confirmador.
//
// A espera existe porque a resposta VENCEDORA pode ainda estar a caminho: é ela
// que traz o par novo no `Set-Cookie`. Reperguntar depois dela chegar é o que
// distingue os dois casos — e é barato, porque `getSession()` lê cookie, sem
// ida de rede quando o token está válido.
//
// ⚠️ NA DÚVIDA, NÃO DESLOGA. Se a checagem falhar (offline, storage bloqueado),
// devolve `false`. O custo de errar pra cá é a pessoa continuar na tela que já
// estava — e o middleware ainda protege a rota no servidor. O custo de errar
// pro outro lado é o bug que trouxe quatro relatos.
// ─────────────────────────────────────────────────────────────────────────────

const ESPERA_PADRAO_MS = 1200;

export async function sessaoRealmenteMorreu(esperaMs = ESPERA_PADRAO_MS): Promise<boolean> {
  await new Promise((r) => setTimeout(r, esperaMs));
  try {
    const { data } = await supabase.auth.getSession();
    return !data.session;
  } catch {
    return false;
  }
}
