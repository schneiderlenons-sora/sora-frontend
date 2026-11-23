// =============================================================================
// EVAL: lib/tipos-divida.ts — todo tipo que o banco aceita tem rótulo próprio.
// Rodar: npm run eval:tipos-divida
//
// Relato (Fábio, nov/2026): "Parcelamento" virava "Outro" no card depois de
// salvo — o card tinha uma lista própria sem esse tipo.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';

const { TIPOS_DIVIDA, tipoDaDivida } = await import('./tipos-divida.ts');

const falhas = [];
let casos = 0;
const ok = (cond, msg) => { casos++; if (!cond) falhas.push(msg); };

// ── 1. O caso do relato: parcelamento aparece como Parcelamento, não Outro.
ok(tipoDaDivida('parcelamento').curto === 'Parcelamento', '1. parcelamento → "Parcelamento" no card');
ok(tipoDaDivida('parcelamento').rotulo === 'Parcelamento', '1. parcelamento → "Parcelamento" no formulário');
ok(tipoDaDivida('parcelamento').cor !== tipoDaDivida('outro').cor, '1. parcelamento não usa a cor do Outro');
ok(tipoDaDivida('parcelamento').icon !== tipoDaDivida('outro').icon, '1. parcelamento não usa o ícone do Outro');

// ── 2. Os tipos que já eram exibidos continuam IGUAIS (rótulo e cor do card antigo).
const CARD_ANTIGO = {
  emprestimo:      ['Empréstimo', '#3b82f6'],
  financiamento:   ['Financiamento', '#8b5cf6'],
  consorcio:       ['Consórcio', '#0ea5e9'],
  crediario:       ['Crediário', '#f59e0b'],
  cartao_rotativo: ['Cartão rotativo', '#ef4444'],
  cheque_especial: ['Cheque especial', '#f97316'],
  consignado:      ['Consignado', '#06b6d4'],
  fies:            ['FIES', '#14b8a6'],
  outro:           ['Outro', '#64748b'],
};
for (const [v, [label, cor]] of Object.entries(CARD_ANTIGO)) {
  ok(tipoDaDivida(v).curto === label, `2. ${v}: rótulo do card continua "${label}" (veio "${tipoDaDivida(v).curto}")`);
  ok(tipoDaDivida(v).cor === cor, `2. ${v}: cor continua ${cor}`);
}

// ── 3. O formulário continua com os mesmos 10 tipos, na mesma ordem e rótulos.
const FORM_ANTIGO = [
  ['emprestimo', 'Empréstimo'], ['financiamento', 'Financiamento'], ['consorcio', 'Consórcio'],
  ['crediario', 'Crediário'], ['parcelamento', 'Parcelamento'], ['cartao_rotativo', 'Cartão rotativo'],
  ['cheque_especial', 'Cheque especial'], ['consignado', 'Consignado'], ['fies', 'FIES / Crédito edu.'],
  ['outro', 'Outro'],
];
ok(JSON.stringify(TIPOS_DIVIDA.map((t) => [t.v, t.rotulo])) === JSON.stringify(FORM_ANTIGO), '3. formulário: mesmos tipos, ordem e rótulos');

// ── 4. Desconhecido, vazio ou nulo → Outro (sem quebrar).
ok(tipoDaDivida('inventado').v === 'outro', '4. tipo desconhecido → Outro');
ok(tipoDaDivida(null).v === 'outro', '4. null → Outro');
ok(tipoDaDivida(undefined).v === 'outro', '4. undefined → Outro');
ok(tipoDaDivida('').v === 'outro', '4. vazio → Outro');

// ── 5. A lista bate com o CHECK do banco: TODO tipo que o banco aceita tem
// entrada própria aqui (senão cairia em "Outro" — o bug do relato). Lê o
// CHECK da migration mais recente que o define.
const sqlDir = path.resolve(process.cwd(), '../sora-backend/sql');
if (!fs.existsSync(sqlDir)) {
  console.warn('⚠️  sora-backend/sql não encontrado — conferência com o CHECK do banco pulada');
} else {
  const comCheck = fs.readdirSync(sqlDir)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => /add\s+constraint\s+dividas_tipo_check/i.test(fs.readFileSync(path.join(sqlDir, f), 'utf8')))
    .sort();
  ok(comCheck.length > 0, '5. achou a migration do CHECK dividas_tipo_check');
  const ultima = comCheck[comCheck.length - 1];
  const sql = fs.readFileSync(path.join(sqlDir, ultima), 'utf8').replace(/--[^\n]*/g, '');
  const m = sql.match(/add\s+constraint\s+dividas_tipo_check\s+check\s*\(\s*tipo\s+in\s*\(([\s\S]*?)\)\s*\)/i);
  ok(!!m, `5. leu a lista do CHECK em ${ultima}`);
  const doBanco = m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
  ok(doBanco.length >= 10, `5. CHECK com ${doBanco.length} tipos (${ultima})`);
  const daLista = new Set(TIPOS_DIVIDA.map((t) => t.v));
  for (const v of doBanco) ok(daLista.has(v), `5. tipo "${v}" aceito pelo banco (${ultima}) não está em lib/tipos-divida.ts — cairia em "Outro"`);
  for (const v of daLista) ok(doBanco.includes(v), `5. tipo "${v}" do formulário não é aceito pelo CHECK do banco (${ultima})`);
}

// ── 6. Sanidade: valores únicos, todo tipo com rótulo, cor e ícone.
ok(new Set(TIPOS_DIVIDA.map((t) => t.v)).size === TIPOS_DIVIDA.length, '6. tipos sem repetição');
for (const t of TIPOS_DIVIDA) {
  ok(!!t.rotulo && !!t.curto && /^#[0-9a-f]{6}$/i.test(t.cor) && !!t.icon && !!t.desc, `6. ${t.v} completo`);
}

if (falhas.length) {
  console.error(`\n❌ ${falhas.length} de ${casos} falharam:`);
  for (const f of falhas) console.error('  ·', f);
  process.exit(1);
}
console.log(`✅ tipos de dívida: ${casos} verificações ok`);
