import { createBrowserClient } from '@supabase/ssr';
import { devePreservarSessao } from './renovacao-sessao';

// ─────────────────────────────────────────────────────────────────────────────
// O CLIENTE DO NAVEGADOR — e a linha que impede ele de deslogar a pessoa sozinho.
//
// ⚠️ CAUSA RAIZ DO "CLICO NO MENU E VOLTA PRO LOGIN" (6 relatos, 5 rodadas de
// correção no lugar errado). As cinco anteriores mexeram no middleware. O
// middleware NÃO É O CULPADO — provado com a instrumentação da migration 163:
// ela grava toda requisição que chega COM cookie de sessão e falha a validação,
// funciona de ponta a ponta em produção (conferido mandando um cookie falso pro
// site: gravou a linha), e estava com ZERO linhas depois de o cliente
// reproduzir o bug.
//
// Zero linha só tem uma explicação: a requisição chegou SEM cookie nenhum. Quer
// dizer que o cookie já tinha sido apagado ANTES, aqui no navegador.
//
// QUEM APAGA. GoTrueClient._callRefreshToken (auth-js 2.105.4, lido no
// node_modules deste projeto):
//
//     catch (error) {
//       if (isAuthError(error)) {
//         if (!isAuthRetryableFetchError(error)) {
//           await this._removeSession();        // <- APAGA O COOKIE
//         }
//
// E o que conta como "retryable" e uma lista CURTA (auth-js/lib/fetch.js):
//
//     const NETWORK_ERROR_CODES = [502, 503, 504, 520, 521, 522, 523, 524, 530];
//
// **429 NÃO ESTÁ NA LISTA. 500 NÃO ESTÁ NA LISTA.** Ou seja: o Supabase Auth
// responder "calma aí" (429) ou ter um erro interno (500) por UM instante faz o
// navegador APAGAR uma sessão que está perfeitamente viva no servidor. Depois
// disso a próxima navegação sai sem cookie, o middleware não tem o que validar,
// manda pro /login — e não grava incidente, porque não chegou cookie nenhum.
//
// ⚠️ POR QUE JUSTO ELE, E JUSTO NO CELULAR. O 429 é por IP, e operadora de
// celular põe MUITOS clientes atrás do mesmo IP (CGNAT). O limite do endpoint de
// token acaba sendo compartilhado com desconhecidos. Isso explica o que nenhuma
// teoria anterior explicava: por que atinge uns usuários e não outros, por que é
// intermitente, e por que "até ontem estava normal".
//
// A CORREÇÃO. Um fetch próprio que, quando a RENOVAÇÃO volta com status de
// infraestrutura, LANÇA em vez de devolver a resposta. Não é gambiarra — é o
// canal que o próprio auth-js oferece (auth-js/lib/fetch.js):
//
//     try { result = await fetcher(url, ...); }
//     catch (e) { throw new AuthRetryableFetchError(...); }   // <- sessão VIVE
//     if (!result.ok) { await handleError(result); }          // <- sessão MORRE
//
// Lançar cai no ramo de cima: vira erro retryable, a sessão é PRESERVADA e o
// auto-refresh tenta de novo no próximo tick. Nada do caminho feliz muda.
//
// ⚠️ ESTA CORREÇÃO TEM DUAS METADES E SÓ FUNCIONA INTEIRA. Preservar o cookie
// não basta: nesse instante o getSession() devolve session: null mesmo assim
// (auth-js __loadSession), e quem perguntasse só por ele concluiria "morreu" e
// mandaria a pessoa pro login do mesmo jeito. A outra metade está em
// lib/sessao-viva.ts, que passou a exigir TAMBÉM a ausência do cookie.
//
// As regras puras moram em lib/renovacao-sessao.ts e são travadas por
// npm run eval:renovacao-sessao.
// ─────────────────────────────────────────────────────────────────────────────

function urlDe(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/**
 * Avisa o servidor que uma renovação foi adiada. É TELEMETRIA — fire and forget,
 * nunca lança, nunca atrasa. É ela que vai dizer QUAL status atinge o cliente,
 * em vez de esperarmos mais um e-mail pra descobrir.
 */
function reportar(status: number): void {
  try {
    void fetch('/api/auth-incidente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        rota: typeof location !== 'undefined' ? location.pathname : null,
      }),
      // Sobrevive se a navegação acontecer no mesmo instante.
      keepalive: true,
    }).catch(() => {});
  } catch { /* telemetria nunca atrapalha quem está usando o app */ }
}

const fetchQuePreservaSessao: typeof fetch = async (input, init) => {
  const resposta = await fetch(input, init);

  if (devePreservarSessao(urlDe(input), resposta.status, resposta.ok)) {
    reportar(resposta.status);
    // ⚠️ LANÇAR AQUI É A CORREÇÃO. Devolver a resposta faria o auth-js chamar
    // _removeSession() e apagar o cookie de uma sessão viva.
    throw new Error(`sora: renovacao adiada (HTTP ${resposta.status})`);
  }

  return resposta;
};

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { global: { fetch: fetchQuePreservaSessao } },
);
