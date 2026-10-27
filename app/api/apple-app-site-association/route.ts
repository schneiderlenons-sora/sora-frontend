import { NextResponse } from 'next/server';

// Apple App Site Association — o equivalente do assetlinks pro iPhone: prova à
// Apple que o app `com.forsora.app` e o site www.forsora.com são da mesma dona.
// Sem ele, link do forsora.com (e-mail, WhatsApp) abre no Safari em vez do app,
// e o preenchimento automático de senha não reconhece o site dentro do app.
//
// ⚠️ A Apple exige o arquivo em /.well-known/apple-app-site-association, SEM
// extensão, com Content-Type application/json e SEM redirect. Arquivo estático
// em /public sairia como octet-stream — daí rota + rewrite no next.config.ts.
//
// ⚠️ O host é www: o app declara `applinks:www.forsora.com`, e o apex
// redireciona pra www (a Apple não segue redirect neste arquivo).
//
// O ID da equipe (Team ID) não é segredo — está em todo app assinado. Vem
// cravado, com env pra trocar sem deploy.
export const dynamic = 'force-dynamic';

export async function GET() {
  const equipe = (process.env.APPLE_TEAM_ID || 'V4P649QY95').trim();
  const pacote = (process.env.IOS_BUNDLE_ID || 'com.forsora.app').trim();
  const appId  = `${equipe}.${pacote}`;

  return NextResponse.json(
    {
      applinks: {
        details: [{ appIDs: [appId], components: [{ '/': '*' }] }],
      },
      webcredentials: { apps: [appId] },
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
