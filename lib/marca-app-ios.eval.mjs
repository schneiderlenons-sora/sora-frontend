// npm run eval:marca-app-ios — a troca "Sora" → "ForSora" do app de iPhone.
import { trocarMarca } from './marca-app-ios.ts';

let falhas = 0;
const caso = (entrada, esperado) => {
  const saiu = trocarMarca(entrada);
  if (saiu !== esperado) { falhas++; console.log('✗', JSON.stringify(entrada), '→', JSON.stringify(saiu), '(esperado', JSON.stringify(esperado) + ')'); }
  else console.log('✓', JSON.stringify(entrada), '→', JSON.stringify(saiu));
};

// troca
caso('Sora', 'ForSora');
caso('Central da Sora', 'Central da ForSora');
caso('Sora Grow', 'ForSora Grow');
caso('A Sora lança. A Sora pergunta.', 'A ForSora lança. A ForSora pergunta.');
caso('(Sora)', '(ForSora)');
caso('Sora, tenho reunião', 'ForSora, tenho reunião');
caso('Fale com a Sora no WhatsApp', 'Fale com a ForSora no WhatsApp');
caso('SORA FINANCE', 'FORSORA FINANCE');
caso('Olá!Sora', 'Olá!ForSora');

// NÃO troca (idempotência e o que não é a marca)
caso('ForSora', 'ForSora');
caso(trocarMarca('Central da Sora'), 'Central da ForSora');
caso('www.forsora.com', 'www.forsora.com');
caso('SoraApp-iOS', 'SoraApp-iOS');
caso('sora-theme', 'sora-theme');
caso('Soraya', 'Soraya');
caso('Isora', 'Isora');
caso('ÁSora', 'ÁSora');
caso('Soraé', 'Soraé');
caso('Sora_1', 'Sora_1');
caso('', '');
caso('nada aqui', 'nada aqui');

console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo');
process.exit(falhas ? 1 : 0);
