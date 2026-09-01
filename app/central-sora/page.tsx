import { redirect } from 'next/navigation';

// A aba virou "Ajuda" e mudou de rota. Este redirect fica: /central-sora está
// em link de WhatsApp já enviado, em e-mail e no histórico de quem usa o app —
// devolver 404 pra quem clicasse seria quebrar o passado sem ganho nenhum.
// Os comandos continuam lá dentro, na seção "Comandos WhatsApp".
export default function CentralSoraRedirect() {
  redirect('/ajuda');
}
