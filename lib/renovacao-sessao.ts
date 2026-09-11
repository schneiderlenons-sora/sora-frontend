// ─────────────────────────────────────────────────────────────────────────────
// AS DUAS DECISÕES QUE IMPEDEM O APP DE DESLOGAR SOZINHO — puras, testáveis,
// sem rede e sem DOM. Vivem aqui separadas de propósito: é o que permite o
// `npm run eval:renovacao-sessao` exercitar A MESMA função que roda em
// produção, em vez de uma cópia que pode divergir sem ninguém notar.
//
// Contexto completo do bug em `lib/supabase.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Este status é problema de INFRAESTRUTURA (passageiro) ou de SESSÃO (definitivo)?
 *
 * ⚠️ É A REGRA QUE FECHA O BUG DOS 6 RELATOS. O auth-js só considera
 * "temporário" a lista `[502,503,504,520,521,522,523,524,530]` — **429 e 500
 * ficam de fora**, e por isso um rate limit de um instante fazia ele APAGAR o
 * cookie de uma sessão viva.
 *
 * ⚠️ 400/401/403 TÊM DE DEVOLVER `false`. "Invalid Refresh Token" é sessão morta
 * de verdade (trocou a senha, revogou o acesso) e aí deslogar é o certo. Engolir
 * esses prenderia a pessoa numa sessão que não existe mais — o erro oposto, e
 * igualmente grave.
 */
export function ehInfraestrutura(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * A requisição é a RENOVAÇÃO de token?
 *
 * ⚠️ Só ela pode apagar sessão por falha, e só ela entra na proteção. No login
 * (`grant_type=password`) um 429 tem de continuar chegando na tela como "muitas
 * tentativas": transformá-lo em erro de rede esconderia do usuário o que está
 * acontecendo.
 */
export function ehRenovacao(url: string): boolean {
  return url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token');
}

/** Junta as duas: esta resposta deve virar erro *retryable* (preservando a sessão)? */
export function devePreservarSessao(url: string, status: number, ok: boolean): boolean {
  if (ok) return false;
  return ehRenovacao(url) && ehInfraestrutura(status);
}

/**
 * Ainda existe cookie de sessão no navegador?
 *
 * ⚠️ É a MESMA prova que o middleware usa no servidor (`tinhaSessao`). Se o
 * cookie está lá, a sessão não foi encerrada — no máximo está temporariamente
 * sem renovar. Quando morre de verdade, o `_removeSession()` o apaga e ele some
 * daqui também.
 *
 * ⚠️ Busca por PREFIXO: acima de ~4 KB o `@supabase/ssr` FATIA o cookie em
 * `.0`, `.1`… Procurar o nome exato daria "não existe" justamente nas sessões
 * grandes — as de quem usa o app de verdade.
 *
 * ⚠️ Valor VAZIO não conta. Cookie recém-apagado costuma continuar aparecendo
 * por um instante com valor vazio; tratá-lo como sessão prenderia a pessoa numa
 * sessão morta.
 */
export function temSessaoNoCookie(documentCookie: string, supabaseUrl: string): boolean {
  try {
    const ref = (supabaseUrl || '').replace('https://', '').split('.')[0];
    if (!ref) return false;
    const prefixo = `sb-${ref}-auth-token`;
    return (documentCookie || '').split(';').some((c) => {
      const i = c.indexOf('=');
      if (i < 0) return false;
      const nome = c.slice(0, i).trim();
      const valor = c.slice(i + 1).trim();
      return nome.startsWith(prefixo) && valor.length > 0;
    });
  } catch {
    return false;
  }
}
