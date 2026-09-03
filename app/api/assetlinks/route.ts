import { NextResponse } from 'next/server';

// Digital Asset Links — é este arquivo que prova ao Android que o app da Play
// Store e o site www.forsora.com são da mesma dona.
//
// ⚠️ SEM ELE, A TWA ABRE COM A BARRA DE ENDEREÇO DO CHROME À MOSTRA. O app
// parece um navegador disfarçado, e é motivo clássico de reprovação por
// "funcionalidade mínima".
//
// ⚠️ É ROTA, NÃO ARQUIVO ESTÁTICO, e a razão é prática: a impressão digital só
// existe depois de criar a chave de publicação no Play Console. Como rota, ela
// vem de variável de ambiente — dá pra colar o valor na Vercel e o arquivo fica
// no ar sem tocar em código nem esperar um deploy de alguém.
//
// Servido em /.well-known/assetlinks.json por um rewrite no next.config.ts.
//
// ⚠️ A IMPRESSÃO É A DO *PLAY APP SIGNING*, não a da sua keystore de upload.
// Trocar as duas é o erro mais comum aqui, e o sintoma é justamente a barra de
// endereço continuar aparecendo, sem nenhuma mensagem de erro. O valor está no
// Play Console → Versão → Configuração → Assinatura de apps.
export const dynamic = 'force-dynamic';

export async function GET() {
  const pacote = process.env.ANDROID_PACKAGE_NAME;
  const sha    = process.env.ANDROID_SHA256_FINGERPRINT;

  // ⚠️ 404 enquanto não estiver configurado, em vez de servir um arquivo com
  // placeholder. Um assetlinks com impressão errada falha exatamente igual a um
  // ausente — mas dá a impressão de estar pronto, e aí a busca pelo defeito
  // começa no lugar errado.
  if (!pacote || !sha) {
    return NextResponse.json(
      { erro: 'Defina ANDROID_PACKAGE_NAME e ANDROID_SHA256_FINGERPRINT na Vercel.' },
      { status: 404 },
    );
  }

  // Aceita a impressão com ou sem os dois-pontos, em qualquer caixa — é comum
  // copiar do Play Console num formato e do keytool no outro.
  const impressao = sha.trim().toUpperCase().replace(/[^0-9A-F]/g, '')
    .replace(/(.{2})(?=.)/g, '$1:');

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pacote.trim(),
          sha256_cert_fingerprints: [impressao],
        },
      },
    ],
    {
      headers: {
        'Content-Type': 'application/json',
        // O Android relê isto de tempos em tempos; cache curto pra uma correção
        // de impressão digital valer em minutos, não em horas.
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}
