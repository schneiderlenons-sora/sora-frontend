// =============================================================================
// EVAL: QUEM TEM O KIT PAGA SÓ A DIFERENÇA — POR QUALQUER PORTA.
//
// O upgrade de R$ 50 existia em `?tier=upgrade`, mas o botão do WhatsApp levava
// pra landing /kit, que abre `?tier=completa`: a conta Kit pagava R$ 97.
//
// O que este eval trava (a MESMA função decide a tela e o servidor):
//   1. conta Kit pedindo a Completa → upgrade (R$ 50);
//   2. upgrade sem Kit → Completa cheia (ninguém leva a Completa por R$ 50);
//   3. o resto fica como era.
//
// Rodar:  npm run eval:vitalicio-tier
// =============================================================================
import { tierEfetivo, normalizarTier } from './vitalicio-tier.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

console.log('── 1. conta Kit: sempre a diferença ──');
eq(tierEfetivo('completa', 'kit'), 'upgrade', 'Kit abrindo ?tier=completa (a landing /kit) paga o upgrade');
eq(tierEfetivo(null, 'kit'), 'upgrade', 'Kit abrindo o checkout sem tier (que vale Completa) paga o upgrade');
eq(tierEfetivo('qualquer', 'kit'), 'upgrade', 'tier desconhecido é Completa → upgrade pro Kit');
eq(tierEfetivo('upgrade', 'kit'), 'upgrade', 'Kit pelo link de upgrade segue no upgrade');
console.log('  ok');

console.log('── 2. ⚠️ upgrade sem Kit cobra a Completa cheia ──');
for (const plano of ['inativo', 'gratis', 'basico', 'premium', 'platinum', null, undefined]) {
  eq(tierEfetivo('upgrade', plano), 'completa', `upgrade com plano ${plano} → Completa`);
}
console.log('  ok');

console.log('── 3. o resto não muda ──');
eq(tierEfetivo('completa', 'inativo'), 'completa', 'sem plano compra a Completa');
eq(tierEfetivo('kit', 'inativo'), 'kit', 'sem plano compra o Kit');
eq(tierEfetivo('kit', 'gratis'), 'kit', 'grátis compra o Kit');
eq(tierEfetivo('completa', 'basico'), 'completa', 'assinante Básico compra a Completa cheia');
eq(normalizarTier('upgrade'), 'upgrade', 'normaliza upgrade');
eq(normalizarTier('KIT'), 'completa', 'caixa diferente não é kit (igual ao servidor antes)');
eq(normalizarTier(undefined), 'completa', 'sem tier = Completa');
console.log('  ok');

console.log(`\n${falhas.length ? `${falhas.length} FALHA(S) ❌` : 'tudo passou ✅'}`);
if (falhas.length) { falhas.forEach((f) => console.log('  · ' + f)); process.exit(1); }
