import { NextResponse } from 'next/server';
import { linkSora } from '@/lib/sora-whatsapp';

// GET /lancar/<acao> — os botões do widget "Lançar rápido" do iPhone.
//
// No iPhone um widget não abre outro app direto: o botão abre este link da
// ForSora, e o app (SceneDelegate, `AtalhoLancar`) o troca pela conversa com a
// Sora no WhatsApp sem nem carregar a página. Esta rota é a REDE DE SEGURANÇA:
// se o link abrir no navegador (app não instalado, link copiado), cai no mesmo
// lugar. Pública no middleware — não pede login, como o próprio widget.
const TEXTOS: Record<string, string | undefined> = {
  gasto: 'gastei ',
  receita: 'recebi ',
  audio: undefined,
  foto: undefined,
};

export async function GET(req: Request, { params }: { params: Promise<{ acao: string }> }) {
  const { acao } = await params;
  if (!(acao in TEXTOS)) {
    return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.redirect(linkSora(TEXTOS[acao]));
}
