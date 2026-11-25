// =============================================================================
// EVAL: o interruptor "Transferência entre minhas contas" do front concorda com
// o servidor (sora-backend/src/services/marcaTransferencia.js), caso a caso.
//
// O front decide QUANDO MOSTRAR e o que AVISAR antes de salvar; o servidor
// decide de verdade. Se divergirem, a pessoa vê o interruptor e leva erro ao
// salvar — ou nem vê o interruptor num caso que o servidor aceitaria.
//
// Rodar:  npm run eval:marca-transferencia
// =============================================================================
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';
import { mostraMarcaTransferencia, erroMarcaTransferencia } from './marca-transferencia.ts';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { validarMarcaTransferencia } = require(path.resolve(aqui, '../../sora-backend/src/services/marcaTransferencia.js'));

const falhas = [];
let total = 0;
const CATS = ['Financiamento', 'Transferências', 'Pix enviado', 'Fatura', 'Cartão de Credito', 'Ajuste', 'Ajuste recebido', 'Outros', '', null];
const TIPOS = ['Corrente', 'Poupança', 'Crédito', 'Cartão de crédito', 'Dinheiro', null];

for (const deBanco of [true, false]) {
  for (const tipo of TIPOS) {
    for (const catAntes of CATS) {
      for (const antesT of [true, false]) {
        for (const quer of [true, false]) {
          if (quer === antesT) continue;   // só a TROCA passa pela regra (a rota ignora o resto)
          for (const catFinal of CATS) {
            total++;
            const antes = { of_tx_id: deBanco ? 'OF1' : null, categoria: catAntes, transferencia: antesT };
            const servidor = validarMarcaTransferencia({ antes, carteira: tipo ? { tipo } : null, transferencia: quer, categoriaFinal: catFinal }).ok;
            const front = mostraMarcaTransferencia(antes, tipo) && erroMarcaTransferencia({ quer, categoriaFinal: catFinal }) === null;
            if (servidor !== front) {
              falhas.push(`banco=${deBanco} tipo=${tipo} cat=${catAntes}→${catFinal} ${antesT}→${quer}: servidor ${servidor}, front ${front}`);
            }
          }
        }
      }
    }
  }
}

// Casos nomeados (o relato).
const chk = (c, m) => { total++; if (!c) falhas.push(m); };
chk(mostraMarcaTransferencia({ of_tx_id: 'X', categoria: 'Financiamento' }, 'Corrente'), 'o financiamento do Breno mostra o interruptor');
chk(!mostraMarcaTransferencia({ of_tx_id: null, categoria: 'Financiamento' }, 'Corrente'), 'lançamento manual não mostra');
chk(!mostraMarcaTransferencia({ of_tx_id: 'X', categoria: 'Outros' }, 'Crédito'), 'cartão não mostra');
chk(erroMarcaTransferencia({ quer: false, categoriaFinal: 'Transferências' }) !== null, 'tirar a marca mantendo "Transferências" avisa');
chk(erroMarcaTransferencia({ quer: false, categoriaFinal: 'Financiamento' }) === null, 'com a categoria certa, salva');

console.log(`${total - falhas.length}/${total} verificações passaram`);
if (falhas.length) { console.error('✗ DIVERGÊNCIAS:\n  ' + falhas.slice(0, 20).join('\n  ')); process.exit(1); }
console.log('✓ eval:marca-transferencia (front = servidor) ok');
