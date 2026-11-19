// =============================================================================
// EVAL: lib/ia-conectada.ts é ESPELHO de sora-backend/src/config/iaConectada.js?
//
// O backend autoriza; o painel só decide se a aba aparece. Se as listas
// divergirem, a pessoa vê a aba e leva "fora do teste" (ou o contrário: tem
// acesso e não acha a aba). E cada ferramenta do backend tem de ter nome
// amigável aqui, senão a lista "o que o ChatGPT consultou" mostra o nome cru.
//
// Rodar:  npm run eval:ia-conectada
// =============================================================================
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const req = createRequire(import.meta.url);
const BACK = req('../../sora-backend/src/config/iaConectada.js');
const FRONT = await import('./ia-conectada.ts');
const { podeUsar } = await import('./plans.ts');

const falhas = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     backend ${JSON.stringify(a)}\n     painel  ${JSON.stringify(b)}`); };

eq([...BACK.EMAILS_TESTE].sort(), [...FRONT.EMAILS_TESTE_IA].sort(), 'lista do teste fechado');
eq([...BACK.PLANOS].sort(), [...FRONT.PLANOS_IA].sort(), 'planos que incluem');

// O gate da aba (lib/plans) tem de dizer o mesmo que o backend, plano a plano.
for (const plano of ['inativo', 'gratis', 'basico', 'kit', 'premium', 'platinum']) {
  eq(BACK.PLANOS.includes(plano), podeUsar(plano, 'ia_conectada'), `gate 'ia_conectada' do plano ${plano}`);
}

const fonte = readFileSync(new URL('../../sora-backend/src/services/ferramentasIa.js', import.meta.url), 'utf8');
const nomes = [...fonte.matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map((m) => m[1]);
if (nomes.length < 5) falhas.push(`não achei as ferramentas no backend (${nomes.length})`);
for (const n of nomes) if (!FRONT.NOME_FERRAMENTA[n]) falhas.push(`ferramenta sem nome amigável no painel: ${n}`);
for (const n of Object.keys(FRONT.NOME_FERRAMENTA)) if (!nomes.includes(n)) falhas.push(`nome amigável de ferramenta que não existe: ${n}`);

if (!FRONT.podeVerIaConectada(' ComercialSora@gmail.com ')) falhas.push('caixa/espaço no e-mail deveria ver a aba');
if (FRONT.podeVerIaConectada('cliente@x.com')) falhas.push('fora do teste não deveria ver a aba');
if (FRONT.podeVerIaConectada(null)) falhas.push('sem e-mail não deveria ver a aba');

if (falhas.length) {
  console.log(`✗ ${falhas.length} divergência(s):\n - ` + falhas.join('\n - '));
  process.exit(1);
}
console.log(`✓ Sora no ChatGPT/Claude: painel = backend (lista, planos e ${nomes.length} ferramentas)`);
