// =============================================================================
// O NÚMERO DA SORA NO WHATSAPP — fonte única.
//
// POR QUE EXISTE (02/10/2026). Relato de cliente, e no mesmo dia outro igual:
// "o site fala que posso fazer coisas pelo WhatsApp. Mas cadê esse WhatsApp?
// Qual o número? Os atalhos que tem remetem para o número do usuário."
//
// ⚠️ ELE ESTAVA CERTO, E AS BOAS-VINDAS NÃO ERAM O PROBLEMA: a conta dele
// recebeu a mensagem 7 minutos depois do cadastro. O buraco era outro — o
// painel INTEIRO nunca dizia o número em lugar nenhum.
//
// E os botões "Testar no WhatsApp" da Central da Sora eram piores que nada:
// o `ComandoCard` monta o link a partir de um `phoneSora` que NENHUMA tela
// jamais passou. Sempre `undefined`, o link virava `https://wa.me/?text=...`
// — WhatsApp aberto SEM destinatário, com o comando pronto e nenhuma conversa
// pra enviar. Daí a leitura dele de que o atalho "remete pro próprio número".
//
// ⚠️ NÃO INVENTAR ESTE NÚMERO. Ele foi confirmado com o dono do produto; um
// dígito errado manda a base inteira conversar com um desconhecido. Se mudar,
// muda AQUI e em lugar nenhum mais.
// =============================================================================

/** Número oficial da Sora, em E.164 sem o `+` (como o wa.me espera). */
export const SORA_WHATSAPP = '5532985096225';

/** Como o número é mostrado para quem vai salvá-lo na agenda. */
export const SORA_WHATSAPP_EXIBICAO = '+55 32 98509-6225';

/**
 * Link que abre a conversa COM A SORA.
 *
 * @param texto mensagem já preenchida (um comando de exemplo, em geral).
 */
export function linkSora(texto?: string): string {
  const base = `https://wa.me/${SORA_WHATSAPP}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
