import { redirect } from 'next/navigation';

// A Central de Avisos virou a aba AGENTES (/agentes): as mesmas preferências,
// agora com rosto, voz e vídeo. A rota antiga fica viva como redirect porque
// há link salvo, atalho na tela inicial do celular e mensagem antiga apontando
// pra cá — apagar daria 404 pra quem já usava.
export default function AvisosRedirect() {
  redirect('/agentes');
}
