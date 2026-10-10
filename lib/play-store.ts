// ─────────────────────────────────────────────────────────────────────────────
// Links da Sora na Play Store — fonte única.
//
// O app saiu do teste fechado e está PÚBLICO na loja (out/2026). O link certo
// agora é a página da loja (`store/apps/details`), que abre pra qualquer conta
// Google e instala direto — não mais o link de "participar do teste", que só
// valia pra quem estava na lista de testadores.
//
// O link pode ser trocado sem mexer em código: `NEXT_PUBLIC_PLAY_URL` na Vercel.
// (A env antiga `NEXT_PUBLIC_PLAY_TESTE_URL` ainda é lida como fallback pra não
// quebrar nada que a tenha setado — mas o padrão já é a página pública.)
// ─────────────────────────────────────────────────────────────────────────────

export const PACOTE_ANDROID = 'com.forsora.app';

export const LINK_PLAY_STORE: string =
  process.env.NEXT_PUBLIC_PLAY_URL
  || process.env.NEXT_PUBLIC_PLAY_TESTE_URL
  || `https://play.google.com/store/apps/details?id=${PACOTE_ANDROID}`;
