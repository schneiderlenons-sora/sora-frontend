// =============================================================================
// EVAL: FALHA DE INFRAESTRUTURA NÃO PODE APAGAR A SESSÃO DE NINGUÉM.
//
// POR QUE EXISTE: sexto relato do mesmo bug ("clico no menu e volta pro login"),
// depois de CINCO rodadas de correção no middleware — o lugar errado.
//
// O que entregou a causa foi a instrumentação da 163 estar VAZIA depois de o
// cliente reproduzir o bug, com o instrumento comprovadamente funcionando
// (testado em produção com cookie falso: gravou). Vazio = a requisição chegou
// SEM cookie = o cookie foi apagado ANTES, no navegador.
//
// Quem apaga é o auth-js, quando a renovação volta com um status fora da lista
// curta dele de erros temporários — e **429 e 500 estão fora dessa lista**.
//
// Este arquivo trava as DUAS metades da correção, importando as funções REAIS
// (não uma cópia em texto, que poderia divergir sem ninguém notar).
//
// Rodar:  npm run eval:renovacao-sessao
// =============================================================================
import { devePreservarSessao, ehInfraestrutura, temSessaoNoCookie } from './renovacao-sessao.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${b}, veio ${a})`); };

const REFRESH = 'https://xyz.supabase.co/auth/v1/token?grant_type=refresh_token';
const LOGIN   = 'https://xyz.supabase.co/auth/v1/token?grant_type=password';
const URL_SB  = 'https://xyz.supabase.co';

// ── 1. Infraestrutura NUNCA mata sessão ─────────────────────────────────────
//
// ⚠️ 429 é o suspeito nº 1: é por IP, e no celular a operadora põe muita gente
// atrás do mesmo IP (CGNAT). 500 é erro interno do Auth. Nenhum dos dois diz
// nada sobre a sessão da pessoa.
console.log('── 1. status de infraestrutura preservam a sessão ──');
for (const s of [408, 429, 500, 502, 503, 504, 520, 522, 530, 599]) {
  eq(devePreservarSessao(REFRESH, s, false), true, `HTTP ${s} na renovação tem de preservar`);
  eq(ehInfraestrutura(s), true, `HTTP ${s} é infraestrutura`);
}
console.log('  ok');

// ── 2. Sessão morta DE VERDADE continua deslogando ──────────────────────────
//
// ⚠️ ESTE É O LADO QUE NÃO PODE SER ESQUECIDO. "Invalid Refresh Token" (400) é
// sessão revogada — trocou a senha, saiu em outro aparelho. Engolir isso
// prenderia a pessoa numa sessão que não existe mais, que é o erro OPOSTO e
// igualmente grave.
console.log('── 2. erro de sessão continua encerrando ──');
for (const s of [400, 401, 403, 404, 422]) {
  eq(devePreservarSessao(REFRESH, s, false), false, `HTTP ${s} NÃO pode ser engolido`);
  eq(ehInfraestrutura(s), false, `HTTP ${s} não é infraestrutura`);
}
console.log('  ok');

// ── 3. O LOGIN não entra na proteção ────────────────────────────────────────
//
// ⚠️ Um 429 no login tem de chegar na tela como "muitas tentativas". Virar erro
// de rede esconderia do usuário o que está acontecendo.
console.log('── 3. login fica de fora ──');
eq(devePreservarSessao(LOGIN, 429, false), false, '429 no login não é engolido');
eq(devePreservarSessao(LOGIN, 500, false), false, '500 no login não é engolido');
eq(devePreservarSessao('https://xyz.supabase.co/rest/v1/transacoes', 429, false), false,
  '429 numa query de dados não é engolido');
console.log('  ok');

// ── 4. Resposta OK nunca vira erro ──────────────────────────────────────────
console.log('── 4. caminho feliz intocado ──');
eq(devePreservarSessao(REFRESH, 200, true), false, '200 passa direto');
eq(devePreservarSessao(REFRESH, 204, true), false, '204 passa direto');
console.log('  ok');

// ── 5. O cookie é a prova de que a sessão não acabou ────────────────────────
//
// ⚠️ SEM ESTA METADE A OUTRA NÃO SERVE DE NADA: com o cookie preservado, o
// getSession() ainda devolve `session: null` no instante da falha, e quem
// perguntasse só a ele mandaria a pessoa pro login do mesmo jeito.
console.log('── 5. leitura do cookie ──');
eq(temSessaoNoCookie('sb-xyz-auth-token=base64-abc', URL_SB), true,
  'cookie simples conta como sessão');
// ⚠️ Acima de ~4 KB o @supabase/ssr FATIA o cookie. Procurar nome EXATO daria
// "não tem sessão" justamente pra quem usa o app de verdade.
eq(temSessaoNoCookie('sb-xyz-auth-token.0=aa; sb-xyz-auth-token.1=bb', URL_SB), true,
  'cookie FATIADO conta como sessão');
eq(temSessaoNoCookie('outro=1; sb-xyz-auth-token=abc; mais=2', URL_SB), true,
  'acha no meio de outros cookies');
// ⚠️ Cookie recém-apagado reaparece VAZIO por um instante. Contá-lo prenderia a
// pessoa numa sessão morta.
eq(temSessaoNoCookie('sb-xyz-auth-token=', URL_SB), false,
  'cookie VAZIO não conta como sessão');
eq(temSessaoNoCookie('', URL_SB), false, 'sem cookie nenhum');
eq(temSessaoNoCookie('sb-OUTROPROJETO-auth-token=abc', URL_SB), false,
  'cookie de outro projeto não conta');
eq(temSessaoNoCookie('sb-xyz-auth-token=abc', ''), false,
  'sem URL do Supabase, não inventa sessão');
console.log('  ok');

// ── Resultado ───────────────────────────────────────────────────────────────
if (falhas.length) {
  console.error(`\n❌ ${falhas.length} falha(s):`);
  for (const f of falhas) console.error('  - ' + f);
  process.exit(1);
}
console.log('\n✅ todos os casos passaram');
