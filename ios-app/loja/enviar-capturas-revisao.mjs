// =============================================================================
// Envia a CAPTURA DE REVISÃO de cada assinatura do app de iPhone (e a nota
// para o revisor) pelo App Store Connect API. Sem ela a assinatura fica em
// "Metadados ausentes" e não vai para revisão.
//
// A pasta tem um PNG por assinatura: final-<plano>-<ciclo>.png
// (ex.: final-premium-anual.png → sora_premium_anual). Assinatura que já tem
// captura é pulada; --substituir apaga a atual e envia a nova.
//
//   APPLE_API_KEY_ID=… APPLE_API_ISSUER_ID=… APPLE_API_KEY_PATH=…/AuthKey_….p8 \
//   node ios-app/loja/enviar-capturas-revisao.mjs <pasta> [--substituir]
//
// Mesma chave de criar-assinaturas.mjs. Detalhes: docs/APPLE-COMPRAS.md
// =============================================================================
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const jwt = createRequire(path.join(raiz, 'package.json'))('jsonwebtoken');

const APP_ID = '6827597771';
const pasta = process.argv.slice(2).find((a) => !a.startsWith('--'));
const SUBSTITUIR = process.argv.includes('--substituir');

// Nota para o revisor (em inglês, como as notas da versão).
const NOTA = [
  'Where to find it: tap any locked tab in the side menu (for example "Investimentos") — the subscription screen opens with the plans, monthly and annual.',
  'All three plans (Básico, Premium, Platinum) are also in Configurações → Plano.',
  'The demo account is already on Platinum, so to see the purchase buttons please create a new account inside the app (it starts on the free plan).',
].join(' ');

const { APPLE_API_KEY_ID: KID, APPLE_API_ISSUER_ID: ISS, APPLE_API_KEY_PATH: P8 } = process.env;
if (!KID || !ISS || !P8 || !pasta) {
  console.error('Uso: APPLE_API_KEY_ID=… APPLE_API_ISSUER_ID=… APPLE_API_KEY_PATH=… node ios-app/loja/enviar-capturas-revisao.mjs <pasta> [--substituir]');
  process.exit(1);
}
const chave = fs.readFileSync(P8, 'utf8');
const token = () => jwt.sign({ iss: ISS, aud: 'appstoreconnect-v1' }, chave, { algorithm: 'ES256', keyid: KID, expiresIn: '15m' });

async function api(metodo, caminho, corpo) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${token()}`, 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  const json = texto ? JSON.parse(texto) : {};
  if (!r.ok) {
    const det = (json.errors || []).map((e) => `${e.code}: ${e.detail || e.title}`).join(' | ');
    throw new Error(`${metodo} ${caminho} → ${r.status} ${det}`);
  }
  return json;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const grupos = (await api('GET', `/v1/apps/${APP_ID}/subscriptionGroups?limit=50`)).data || [];
const assinaturas = [];
for (const g of grupos) assinaturas.push(...((await api('GET', `/v1/subscriptionGroups/${g.id}/subscriptions?limit=50`)).data || []));

for (const arquivo of fs.readdirSync(pasta).filter((f) => /^final-[a-z]+-(mensal|anual)\.png$/.test(f)).sort()) {
  const productId = 'sora_' + arquivo.slice('final-'.length, -'.png'.length).replace('-', '_');
  const sub = assinaturas.find((s) => s.attributes.productId === productId);
  console.log(`\n${productId} ← ${arquivo}`);
  if (!sub) { console.log('   ⚠️ assinatura não encontrada no App Store Connect'); continue; }

  await api('PATCH', `/v1/subscriptions/${sub.id}`, { data: { type: 'subscriptions', id: sub.id, attributes: { reviewNote: NOTA } } });
  console.log('   ✓ nota para o revisor');

  const atual = (await api('GET', `/v1/subscriptions/${sub.id}/appStoreReviewScreenshot`)).data;
  if (atual && !SUBSTITUIR) { console.log('   já tem captura (use --substituir para trocar)'); continue; }
  if (atual) { await api('DELETE', `/v1/subscriptionAppStoreReviewScreenshots/${atual.id}`); console.log('   ✓ captura antiga apagada'); }

  const bytes = fs.readFileSync(path.join(pasta, arquivo));
  const reserva = (await api('POST', '/v1/subscriptionAppStoreReviewScreenshots', {
    data: {
      type: 'subscriptionAppStoreReviewScreenshots',
      attributes: { fileName: `${productId}.png`, fileSize: bytes.length },
      relationships: { subscription: { data: { type: 'subscriptions', id: sub.id } } },
    },
  })).data;
  for (const op of reserva.attributes.uploadOperations || []) {
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
    if (!r.ok) throw new Error(`envio da parte ${op.offset} → ${r.status}`);
  }
  const md5 = crypto.createHash('md5').update(bytes).digest('hex');
  await api('PATCH', `/v1/subscriptionAppStoreReviewScreenshots/${reserva.id}`, {
    data: { type: 'subscriptionAppStoreReviewScreenshots', id: reserva.id, attributes: { uploaded: true, sourceFileChecksum: md5 } },
  });

  let estado = '';
  for (let i = 0; i < 20; i++) {
    const s = (await api('GET', `/v1/subscriptionAppStoreReviewScreenshots/${reserva.id}`)).data;
    estado = s.attributes.assetDeliveryState?.state || '';
    if (estado === 'COMPLETE' || estado === 'FAILED') break;
    await esperar(1500);
  }
  console.log(estado === 'COMPLETE' ? '   ✓ captura enviada' : `   ⚠️ captura em estado ${estado || 'desconhecido'}`);
}

const depois = [];
for (const g of grupos) depois.push(...((await api('GET', `/v1/subscriptionGroups/${g.id}/subscriptions?limit=50`)).data || []));
console.log('\nEstado das assinaturas:');
for (const s of depois) console.log(`   ${s.attributes.productId}: ${s.attributes.state}`);
