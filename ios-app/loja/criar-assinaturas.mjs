// =============================================================================
// Cria (ou confere) as 6 assinaturas do app de iPhone no App Store Connect,
// pela API oficial — grupo, nomes em português, disponibilidade e preço.
//
// Por padrão SÓ MOSTRA o que faria (e lista os preços que a Apple aceita).
// Grava de verdade só com --aplicar. Rodar de novo é seguro: o que já existe
// é reconhecido pelo ID do produto e não é recriado.
//
// Chave: App Store Connect → Usuários e acesso → Integrações → App Store
// Connect API → Chaves de equipe (acesso "Gerente de apps"). O .p8 fica no
// computador; NUNCA no repositório nem no chat.
//
//   APPLE_API_KEY_ID=XXXX APPLE_API_ISSUER_ID=yyyy-… \
//   APPLE_API_KEY_PATH=C:/Users/jenif/chaves-apple/AuthKey_XXXX.p8 \
//   node ios-app/loja/criar-assinaturas.mjs [--aplicar]
//
// Detalhes e o resto da configuração: docs/APPLE-COMPRAS.md
// =============================================================================
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const jwt = createRequire(path.join(raiz, 'package.json'))('jsonwebtoken');

const APP_ID = '6827597771';
const APLICAR = process.argv.includes('--aplicar');
const TERRITORIO = 'BRA';

// ⚠️ IDs iguais aos da Google Play e aos de lib/apple-billing.ts. Mudou aqui,
// mude lá — produto fora do catálogo não libera plano.
// `alvo` = preço desejado (cobre os 15% da Apple sobre o preço do site); o
// script escolhe o MENOR preço da tabela da Apple que seja >= alvo.
// `nivel`: 1 = o plano mais alto do grupo (a Apple usa pra saber se é upgrade).
const PRODUTOS = [
  { id: 'sora_platinum_mensal', ref: 'Platinum mensal', periodo: 'ONE_MONTH', nivel: 1, alvo: 58.71, nome: 'ForSora Platinum', desc: 'Tudo do Premium + gestão do seu negócio' },
  { id: 'sora_platinum_anual',  ref: 'Platinum anual',  periodo: 'ONE_YEAR',  nivel: 1, alvo: 563.53, nome: 'ForSora Platinum', desc: 'Tudo do Premium + gestão do seu negócio' },
  { id: 'sora_premium_mensal',  ref: 'Premium mensal',  periodo: 'ONE_MONTH', nivel: 2, alvo: 35.18, nome: 'ForSora Premium', desc: 'Contas ilimitadas, investimentos e mais' },
  { id: 'sora_premium_anual',   ref: 'Premium anual',   periodo: 'ONE_YEAR',  nivel: 2, alvo: 337.69, nome: 'ForSora Premium', desc: 'Contas ilimitadas, investimentos e mais' },
  { id: 'sora_basico_mensal',   ref: 'Básico mensal',   periodo: 'ONE_MONTH', nivel: 3, alvo: 23.41, nome: 'ForSora Básico', desc: 'Controle financeiro pelo app e WhatsApp' },
  { id: 'sora_basico_anual',    ref: 'Básico anual',    periodo: 'ONE_YEAR',  nivel: 3, alvo: 172.82, nome: 'ForSora Básico', desc: 'Controle financeiro pelo app e WhatsApp' },
];

const { APPLE_API_KEY_ID: KID, APPLE_API_ISSUER_ID: ISS, APPLE_API_KEY_PATH: P8 } = process.env;
if (!KID || !ISS || !P8) {
  console.error('Faltam APPLE_API_KEY_ID, APPLE_API_ISSUER_ID e APPLE_API_KEY_PATH.');
  process.exit(1);
}
const chave = fs.readFileSync(P8, 'utf8');
const token = () => jwt.sign({ iss: ISS, aud: 'appstoreconnect-v1' }, chave, {
  algorithm: 'ES256', keyid: KID, expiresIn: '15m',
});

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

async function todos(caminho) {
  const itens = [];
  let prox = caminho;
  while (prox) {
    const j = await api('GET', prox);
    itens.push(...(j.data || []));
    prox = j.links?.next ? j.links.next.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return itens;
}

const rel = (tipo, id) => ({ data: { type: tipo, id } });
const fazer = async (descricao, fn) => {
  if (!APLICAR) { console.log(`   [simulação] ${descricao}`); return null; }
  const r = await fn();
  console.log(`   ✓ ${descricao}`);
  return r;
};

// ── 1. o app ────────────────────────────────────────────────────────────────
const app = await api('GET', `/v1/apps/${APP_ID}`);
console.log(`App: ${app.data.attributes.name} (${app.data.attributes.bundleId})`);
console.log(APLICAR ? 'Modo: GRAVANDO no App Store Connect\n' : 'Modo: simulação (nada é gravado; use --aplicar)\n');

// ── 2. o grupo ──────────────────────────────────────────────────────────────
let grupos = await todos(`/v1/apps/${APP_ID}/subscriptionGroups?limit=50`);
let grupo = grupos.find((g) => g.attributes.referenceName === 'ForSora') || grupos[0];
if (grupo) {
  console.log(`Grupo: ${grupo.attributes.referenceName} (${grupo.id})`);
} else {
  const g = await fazer('criar o grupo "ForSora"', () => api('POST', '/v1/subscriptionGroups', {
    data: { type: 'subscriptionGroups', attributes: { referenceName: 'ForSora' }, relationships: { app: rel('apps', APP_ID) } },
  }));
  grupo = g?.data;
  if (grupo) {
    await fazer('nome do grupo em português', () => api('POST', '/v1/subscriptionGroupLocalizations', {
      data: { type: 'subscriptionGroupLocalizations', attributes: { name: 'ForSora', locale: 'pt-BR' }, relationships: { subscriptionGroup: rel('subscriptionGroups', grupo.id) } },
    }));
  }
}

const existentes = grupo ? await todos(`/v1/subscriptionGroups/${grupo.id}/subscriptions?limit=50`) : [];

// Prévia de preço na simulação: sem a assinatura criada não dá pra ler a
// tabela DELA, então usa a do app (mesma grade de valores pro cliente no
// Brasil). O valor gravado no --aplicar sai da tabela da própria assinatura.
// Preço escolhido: o menor terminado em ,90 (o padrão dos preços do site) que
// cubra o alvo; sem nenhum ,90 acima do alvo, o menor que cubra.
const centavos90 = (v) => Math.round(v * 100) % 100 === 90;
const escolher = (lista, alvo, valorDe) =>
  lista.find((x) => valorDe(x) >= alvo && centavos90(valorDe(x))) || lista.find((x) => valorDe(x) >= alvo);

let gradeApp = null;
async function previaDePreco(alvo) {
  if (!gradeApp) {
    const pts = await todos(`/v1/apps/${APP_ID}/appPricePoints?filter[territory]=${TERRITORIO}&limit=200`);
    gradeApp = pts.map((pp) => Number(pp.attributes.customerPrice)).filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  }
  const escolhido = escolher(gradeApp, alvo, (v) => v);
  const vizinhos = gradeApp.filter((v) => Math.abs(v - alvo) <= alvo * 0.08).map((v) => v.toFixed(2)).join(' · ');
  console.log(`   preços da Apple perto de R$ ${alvo.toFixed(2)}: ${vizinhos || '(nenhum)'}`);
  console.log(escolhido ? `   → prévia: R$ ${escolhido.toFixed(2)}` : '   ⚠️ nenhum preço da tabela cobre o alvo');
}

// ── 3. as assinaturas ───────────────────────────────────────────────────────
for (const p of PRODUTOS) {
  console.log(`\n${p.ref} (${p.id})`);
  let sub = existentes.find((s) => s.attributes.productId === p.id);
  if (sub) {
    console.log(`   já existe (${sub.attributes.state})`);
  } else if (grupo) {
    const r = await fazer('criar a assinatura', () => api('POST', '/v1/subscriptions', {
      data: {
        type: 'subscriptions',
        attributes: { name: p.ref, productId: p.id, subscriptionPeriod: p.periodo, groupLevel: p.nivel, familySharable: false },
        relationships: { group: rel('subscriptionGroups', grupo.id) },
      },
    }));
    sub = r?.data;
    if (sub) {
      await fazer(`nome "${p.nome}" e descrição em português`, () => api('POST', '/v1/subscriptionLocalizations', {
        data: { type: 'subscriptionLocalizations', attributes: { name: p.nome, description: p.desc, locale: 'pt-BR' }, relationships: { subscription: rel('subscriptions', sub.id) } },
      }));
      await fazer('disponível só no Brasil', () => api('POST', '/v1/subscriptionAvailabilities', {
        data: {
          type: 'subscriptionAvailabilities',
          attributes: { availableInNewTerritories: false },
          relationships: { subscription: rel('subscriptions', sub.id), availableTerritories: { data: [{ type: 'territories', id: TERRITORIO }] } },
        },
      }));
    }
  }
  if (!sub) { await previaDePreco(p.alvo); continue; }

  // Preço: o menor da tabela da Apple que cubra o alvo.
  const pontos = await todos(`/v1/subscriptions/${sub.id}/pricePoints?filter[territory]=${TERRITORIO}&limit=200`);
  const ordenados = pontos.map((pp) => ({ id: pp.id, valor: Number(pp.attributes.customerPrice), liquido: Number(pp.attributes.proceeds) }))
    .filter((x) => Number.isFinite(x.valor)).sort((a, b) => a.valor - b.valor);
  const escolhido = escolher(ordenados, p.alvo, (x) => x.valor);
  const vizinhos = ordenados.filter((x) => Math.abs(x.valor - p.alvo) <= p.alvo * 0.08).map((x) => x.valor.toFixed(2)).join(' · ');
  console.log(`   preços da Apple perto de R$ ${p.alvo.toFixed(2)}: ${vizinhos || '(nenhum)'}`);
  if (!escolhido) { console.log('   ⚠️ nenhum preço da tabela cobre o alvo'); continue; }
  console.log(`   → R$ ${escolhido.valor.toFixed(2)} (você recebe ~R$ ${escolhido.liquido.toFixed(2)})`);
  await fazer(`preço R$ ${escolhido.valor.toFixed(2)}`, () => api('POST', '/v1/subscriptionPrices', {
    data: {
      type: 'subscriptionPrices',
      attributes: { preserveCurrentPrice: false },
      relationships: { subscription: rel('subscriptions', sub.id), subscriptionPricePoint: rel('subscriptionPricePoints', escolhido.id) },
    },
  }));
}

console.log(APLICAR ? '\nPronto. Falta só a captura de tela de revisão de cada assinatura (docs/APPLE-COMPRAS.md).' : '\nNada foi gravado. Confira e rode de novo com --aplicar.');
