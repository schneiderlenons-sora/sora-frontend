// =============================================================================
// EVAL: que oferta de plano cada conta vê (/planos e Configurações).
//
// Caso real: conta Kit via só as assinaturas mensais em Configurações, sem o
// upgrade pra Completa. Regra do usuário: Kit vê SÓ o upgrade; a Completa
// vitalícia não aparece pra assinante; no app Android nada é vendido.
//
// Rodar:  npm run eval:ofertas-plano
// =============================================================================
import { ofertasDoPlano } from './ofertas-plano.ts';

const falhas = [];
const igual = (o, esp, m) => {
  for (const k of Object.keys(esp)) {
    if (o[k] !== esp[k]) falhas.push(`${m}: ${k} esperado ${esp[k]}, veio ${o[k]}`);
  }
};

console.log('── 1. Kit: só o upgrade ──');
igual(ofertasDoPlano({ plano: 'kit', vitalicio: true, android: false }),
  { assinaturas: false, upgradeKit: true, completaVitalicia: false }, '⚠️ Kit (caso real) vê só o upgrade');
igual(ofertasDoPlano({ plano: 'kit', vitalicio: false, android: false }),
  { assinaturas: false, upgradeKit: true, completaVitalicia: false }, 'Kit sem a flag vitalicio também');
console.log('  ok');

console.log('── 2. assinante: sem Completa vitalícia ──');
for (const plano of ['basico', 'premium', 'platinum']) {
  igual(ofertasDoPlano({ plano, vitalicio: false, android: false }),
    { assinaturas: true, upgradeKit: false, completaVitalicia: false }, `assinante ${plano}`);
}
console.log('  ok');

console.log('── 3. sem plano pago: assinaturas e Completa ──');
for (const plano of ['inativo', 'gratis']) {
  igual(ofertasDoPlano({ plano, vitalicio: false, android: false }),
    { assinaturas: true, upgradeKit: false, completaVitalicia: true }, `sem plano pago (${plano})`);
}
console.log('  ok');

console.log('── 4. vitalício completo: nada ──');
igual(ofertasDoPlano({ plano: 'premium', vitalicio: true, android: false }),
  { assinaturas: false, upgradeKit: false, completaVitalicia: false }, 'Completa vitalícia não vê oferta nenhuma');
console.log('  ok');

console.log('── 5. ⚠️ app Android: nada à venda, pra ninguém ──');
for (const [plano, vitalicio] of [['kit', true], ['basico', false], ['gratis', false], ['inativo', false], ['premium', true]]) {
  igual(ofertasDoPlano({ plano, vitalicio, android: true }),
    { assinaturas: false, upgradeKit: false, completaVitalicia: false }, `Android ${plano}`);
}
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }
