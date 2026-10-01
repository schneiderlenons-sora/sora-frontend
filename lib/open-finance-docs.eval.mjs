// =============================================================================
// EVAL — documentos do consentimento do Open Finance (CPF / CNPJ).
//
// A mesma regra já falhou DUAS vezes, em sentidos opostos:
//
//  1. set/2026 → `422 O campo cpf é obrigatório para esta instituição`
//     (a tela escondia o CPF quando o usuário marcava Empresa)
//  2. 01/10/2026 → `422 O campo cnpj é obrigatório para esta instituição`
//     Relato: "não estou conseguindo conectar XP empresa no Open Finance.
//     Estou colocando corretamente o CPF do representante e o CNPJ da empresa."
//     Ele estava mesmo: em instituição BUSINESS o seletor PF/PJ não aparece,
//     `ehPj` ficava false, a TELA mostrava o campo CNPJ (`soEmpresa || ehPj`)
//     e o ENVIO o descartava (só `ehPj`). O valor digitado morria antes do POST.
//
// §2 é o caso do relato e §4 é a divergência que o causou.
//
// Rodar:  npm run eval:of-docs
// =============================================================================
import {
  docsDaInstituicao, conexaoEmpresarial, documentosDoConsentimento, textoDoQueFalta,
} from './open-finance-docs.ts';

const falhas = [];
const eq = (a, b, m) => { if (a !== b) falhas.push(`${m} (esperado ${JSON.stringify(b)}, veio ${JSON.stringify(a)})`); };

const PESSOAL  = { type: 'PERSONAL', credentials: ['cpf'] };
const EMPRESA  = { type: 'BUSINESS', credentials: ['cpf', 'cnpj'] };
const AMBOS    = { type: 'BOTH',     credentials: ['cpf', 'cnpj'] };

const CPF  = '123.456.789-00';
const CNPJ = '12.345.678/0001-90';

console.log('── 1. o perfil de cada tipo de instituição ──');
{
  eq(docsDaInstituicao(PESSOAL).aceitaCnpj, false, '§1 PERSONAL não aceita CNPJ');
  eq(docsDaInstituicao(PESSOAL).podeEscolher, false, '§1 PERSONAL não mostra seletor');
  eq(docsDaInstituicao(EMPRESA).soEmpresa, true, '§1 BUSINESS é só empresa');
  eq(docsDaInstituicao(EMPRESA).podeEscolher, false, '⚠️ §1 BUSINESS NÃO mostra seletor (não há conta pessoal)');
  eq(docsDaInstituicao(AMBOS).podeEscolher, true, '§1 BOTH mostra o seletor');
  eq(docsDaInstituicao(AMBOS).soEmpresa, false, '§1 BOTH não é só empresa');
}
console.log('  ok');

console.log('── 2. ⚠️ O CASO DO RELATO (XP empresa, BUSINESS) ──');
{
  // O seletor não existe nesta instituição, então `ehPj` é false — e mesmo
  // assim a conexão É empresarial.
  eq(conexaoEmpresarial(EMPRESA, false), true,
    '⚠️ §2 BUSINESS é empresarial mesmo com ehPj=false (o seletor nem aparece)');

  const d = documentosDoConsentimento({ inst: EMPRESA, ehPj: false, cpf: CPF, cnpj: CNPJ });
  eq(d.cnpj, '12345678000190', '⚠️ §2 O CNPJ DIGITADO TEM DE IR NO PAYLOAD');
  eq(d.cpf, '12345678900', '§2 e o CPF do representante vai junto');
  eq(d.falta, null, '§2 nada falta — a conexão deve seguir');
  eq(d.empresarial, true, '§2 marcada como empresarial');
}
console.log('  ok');

console.log('── 3. ⚠️ O PRIMEIRO BUG (set/2026): o CPF vai SEMPRE ──');
{
  // Em PJ o CPF identifica quem autoriza. Mandar só o CNPJ devolvia 422.
  for (const [nome, inst, ehPj] of [['BUSINESS', EMPRESA, false], ['BOTH+PJ', AMBOS, true]]) {
    const d = documentosDoConsentimento({ inst, ehPj, cpf: '', cnpj: CNPJ });
    eq(d.falta, 'cpf', `§3 ${nome}: sem CPF, barra antes de chamar a API`);
    eq(textoDoQueFalta(d.falta, d.empresarial).includes('responde pela empresa'), true,
      `§3 ${nome}: o texto explica QUAL CPF`);
  }
  const d = documentosDoConsentimento({ inst: EMPRESA, ehPj: false, cpf: CPF, cnpj: CNPJ });
  eq(d.cpf, '12345678900', '§3 com os dois preenchidos, o CPF acompanha o CNPJ');
}
console.log('  ok');

console.log('── 4. ⚠️ A DIVERGÊNCIA QUE CAUSOU O BUG ──');
{
  // A tela decidia por `soEmpresa || ehPj` e o envio por `ehPj` sozinho.
  // Aqui os dois perguntam para a MESMA função: se o campo aparece, o valor vai.
  for (const [nome, inst, ehPj] of [
    ['BUSINESS sem seletor', EMPRESA, false],
    ['BUSINESS com ehPj',    EMPRESA, true],
    ['BOTH marcado PJ',      AMBOS,   true],
  ]) {
    const mostraCampo = conexaoEmpresarial(inst, ehPj);
    const d = documentosDoConsentimento({ inst, ehPj, cpf: CPF, cnpj: CNPJ });
    eq(mostraCampo, true, `§4 ${nome}: a tela mostra o campo CNPJ`);
    eq(!!d.cnpj, true, `⚠️ §4 ${nome}: …e o envio MANDA o CNPJ (era aqui que sumia)`);
  }
  // E o contrário: campo escondido → valor não vai, nem que esteja no estado.
  const esc = documentosDoConsentimento({ inst: AMBOS, ehPj: false, cpf: CPF, cnpj: CNPJ });
  eq(conexaoEmpresarial(AMBOS, false), false, '§4 BOTH em PF: campo escondido');
  eq(esc.cnpj, undefined, '§4 …e o CNPJ não vai (sobra de digitação não vaza)');
}
console.log('  ok');

console.log('── 5. ⚠️ PERSONAL NUNCA RECEBE CNPJ ──');
{
  // Mandar CNPJ numa instituição pessoal é erro do outro lado.
  const d = documentosDoConsentimento({ inst: PESSOAL, ehPj: true, cpf: CPF, cnpj: CNPJ });
  eq(d.cnpj, undefined, '⚠️ §5 PERSONAL não manda CNPJ nem com ehPj=true');
  eq(d.empresarial, false, '§5 não é empresarial');
  eq(d.falta, null, '§5 com CPF, está completo');
}
console.log('  ok');

console.log('── 6. falta de CNPJ é barrada com texto próprio ──');
{
  const d = documentosDoConsentimento({ inst: EMPRESA, ehPj: false, cpf: CPF, cnpj: '' });
  eq(d.falta, 'cnpj', '§6 BUSINESS sem CNPJ não deve nem tentar');
  eq(textoDoQueFalta('cnpj', true).includes('CNPJ da empresa'), true, '§6 o texto diz o que falta');
  // Em conta pessoal, CNPJ vazio é normal — não é falta.
  eq(documentosDoConsentimento({ inst: PESSOAL, ehPj: false, cpf: CPF, cnpj: '' }).falta, null,
    '§6 PERSONAL sem CNPJ está correto');
}
console.log('  ok');

console.log('── 7. formatação e bordas ──');
{
  const d = documentosDoConsentimento({ inst: EMPRESA, ehPj: false, cpf: ' 123.456.789-00 ', cnpj: '12.345.678/0001-90' });
  eq(d.cpf, '12345678900', '§7 máscara do CPF é removida');
  eq(d.cnpj, '12345678000190', '§7 máscara do CNPJ é removida');

  // Payload antigo, sem `type`: cai no credentials.
  const legado = { credentials: ['cpf', 'cnpj'] };
  eq(docsDaInstituicao(legado).aceitaCnpj, true, '§7 sem type, credentials decide');
  eq(docsDaInstituicao(legado).podeEscolher, true, '§7 …e mostra o seletor');
  eq(docsDaInstituicao({ credentials: ['cpf'] }).aceitaCnpj, false, '§7 legado só com cpf');

  eq(docsDaInstituicao(null).aceitaCnpj, false, '§7 null não quebra');
  eq(conexaoEmpresarial(null, true), false, '§7 sem instituição não é empresarial');
  eq(documentosDoConsentimento({ inst: null, ehPj: false, cpf: '', cnpj: '' }).falta, 'cpf', '§7 sem nada, falta CPF');
  eq(docsDaInstituicao({ type: 'business' }).soEmpresa, true, '§7 type em minúscula também vale');
}
console.log('  ok');

console.log('');
if (falhas.length) {
  console.error(`✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.error('  ·', f));
  process.exit(1);
}
console.log('✓ open-finance-docs: todos os casos passaram');
