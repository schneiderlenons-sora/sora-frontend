import { NextResponse } from 'next/server';

// Digital Asset Links — é este arquivo que prova ao Android que o app da Play
// Store e o site www.forsora.com são da mesma dona.
//
// ⚠️ SEM ELE, A TWA ABRE NUMA CHROME CUSTOM TAB: barra verde no topo com o
// domínio, X, compartilhar e três pontinhos. O app parece um navegador
// disfarçado — e foi exatamente o que a primeira testadora mandou no print.
// Também é motivo clássico de reprovação por "funcionalidade mínima".
//
// ⚠️ É ROTA, NÃO ARQUIVO ESTÁTICO, e a razão é prática: a impressão digital só
// existe depois de criar a chave de publicação no Play Console. Como rota, ela
// vem de variável de ambiente — dá pra colar o valor na Vercel e o arquivo fica
// no ar sem tocar em código.
//
// Servido em /.well-known/assetlinks.json por um rewrite no next.config.ts.
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

  // ⚠️ ACEITA VÁRIAS IMPRESSÕES, separadas por vírgula / espaço / quebra de linha.
  //
  // Existem DUAS chaves e confundi-las é o erro mais comum aqui: a de UPLOAD
  // (sua keystore, com que você assina o .aab) e a do PLAY APP SIGNING (a do
  // Google, com que o app chega no celular). Quem vale pro Android é a SEGUNDA
  // — e o sintoma de usar a errada é a barra continuar aparecendo, sem nenhuma
  // mensagem de erro em lugar nenhum.
  //
  // O campo `sha256_cert_fingerprints` é uma LISTA, então declarar as duas é
  // válido, é o que o próprio Bubblewrap gera, e faz a verificação funcionar
  // tanto no app da loja quanto num APK instalado direto pra teste. Na dúvida,
  // cole as duas: não há downside.
  const impressoes = sha
    .split(/[,;\s]+/)
    .map((s) => s.trim().toUpperCase().replace(/[^0-9A-F]/g, ''))
    // Uma SHA-256 tem 32 bytes = 64 caracteres hex. O filtro descarta lixo de
    // copiar-e-colar (rótulo "SHA256:", linha cortada) em vez de publicar uma
    // impressão truncada, que falharia igual e calada.
    .filter((s) => s.length === 64)
    .map((s) => s.replace(/(.{2})(?=.)/g, '$1:'));

  if (impressoes.length === 0) {
    return NextResponse.json(
      { erro: 'ANDROID_SHA256_FINGERPRINT não tem nenhuma impressão SHA-256 válida (64 dígitos hex).' },
      { status: 404 },
    );
  }

  return NextResponse.json(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pacote.trim(),
          sha256_cert_fingerprints: impressoes,
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
