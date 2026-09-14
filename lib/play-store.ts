// ─────────────────────────────────────────────────────────────────────────────
// Links da Sora na Play Store — fonte única.
//
// ⚠️ ENQUANTO O APP ESTÁ EM TESTE FECHADO o link certo é o de PARTICIPAR DO
// TESTE, não o da página da loja. A página da loja (`store/apps/details`) diz
// "app não disponível" pra quem ainda não entrou no teste; é o link de teste
// que mostra o botão "Tornar-se testador" e, dali, leva à instalação.
//
// ⚠️ SÓ FUNCIONA PRA QUEM ESTÁ NA LISTA DE TESTADORES, e a lista é de CONTAS
// GOOGLE. Um e-mail @hotmail que não é conta Google não consegue entrar.
//
// O link pode ser trocado sem mexer em código: `NEXT_PUBLIC_PLAY_TESTE_URL` na
// Vercel (útil quando o app sair do teste fechado e o link virar o da loja).
// ─────────────────────────────────────────────────────────────────────────────

export const PACOTE_ANDROID = 'com.forsora.app';

export const LINK_TESTE_PLAY: string =
  process.env.NEXT_PUBLIC_PLAY_TESTE_URL
  || `https://play.google.com/apps/testing/${PACOTE_ANDROID}`;
