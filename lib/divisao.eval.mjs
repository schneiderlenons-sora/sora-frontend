// =============================================================================
// EVAL: compra dividida — o lado do painel (lib/divisao.ts).
// `parteDoOutro`/`chavePessoa`/`pedidoDoFormulario` comparados caso a caso com
// o backend (services/divisaoCompra.js): a prévia da tela tem de dar o mesmo
// número que o servidor grava.
// Rodar:  npm run eval:divisao
// =============================================================================
import { createRequire } from 'module';
import {
  chavePessoa, parteDoOutro, divisaoDaLinha, pessoasDaFatura, mensagemCobranca, linkWhatsApp, pedidoDoFormulario,
} from './divisao.ts';

const require = createRequire(import.meta.url);
const B = require('../../sora-backend/src/services/divisaoCompra.js');

const falhas = [];
let total = 0;
const eq = (a, b, m) => {
  total++;
  if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`);
};

// ── 1. espelho do backend ────────────────────────────────────────────────────
let difs = 0, casos = 0;
const valores = [];
for (let c = 0; c <= 2000; c += 7) valores.push(c / 100);
valores.push(300, 300.01, 1500, 0.01, 0.02, 99999.99, -5, NaN);
const divs = [{ modo: 'metade' }, { modo: 'valor', valor: 1 }, { modo: 'valor', valor: 7.5 }, { modo: 'valor', valor: 150 }, { modo: 'valor', valor: 0 }, { modo: 'valor', valor: 20.004 }, null];
for (const v of valores) for (const d of divs) {
  casos++;
  if (parteDoOutro(v, d) !== B.parteDoOutro(v, d)) difs++;
}
eq(difs, 0, `parteDoOutro igual ao backend em ${casos} casos`);
const nomes = ['Esposa', '  ESPÔSA ', 'João-Pedro', 'maria  da silva', '', null, 'Zé', 'Ana (irmã)'];
eq(nomes.map(chavePessoa), nomes.map(B.chavePessoa), 'chavePessoa igual ao backend');
const forms = [
  { ativo: true, com: 'Esposa', modo: 'metade', valor: 0 },
  { ativo: true, com: '  Minha   esposa ', modo: 'valor', valor: 150.004 },
  { ativo: true, com: '', modo: 'metade', valor: 0 },
  { ativo: true, com: 'Esposa', modo: 'valor', valor: 0 },
  { ativo: true, com: 'x'.repeat(61), modo: 'metade', valor: 0 },
];
eq(forms.map((f) => pedidoDoFormulario(f).ok), forms.map((f) => B.validarDivisao({ com: f.com, modo: f.modo, valor: f.valor }).ok),
  'o formulário aceita e recusa o mesmo que o servidor');
eq(pedidoDoFormulario(forms[1]), { ok: true, divisao: { com: 'Minha esposa', modo: 'valor', valor: 150 } }, 'pedido limpo (nome e centavos)');
eq(pedidoDoFormulario({ ativo: false, com: 'x', modo: 'metade', valor: 0 }), { ok: true, divisao: null }, 'sem dividir: pedido nulo');

// ── 2. ler a divisão gravada ─────────────────────────────────────────────────
eq(divisaoDaLinha({ valor: 300, dividida_com: 'Esposa', parte_outro: 150 }), { com: 'Esposa', modo: 'metade' }, 'metade gravada volta como metade');
eq(divisaoDaLinha({ valor: 300.01, dividida_com: 'Esposa', parte_outro: 150 }), { com: 'Esposa', modo: 'metade' }, 'metade com centavo ímpar também');
eq(divisaoDaLinha({ valor: 300, dividida_com: 'Esposa', parte_outro: 100 }), { com: 'Esposa', modo: 'valor', valor: 100 }, 'valor fixo volta como valor');
eq(divisaoDaLinha({ valor: 300 }), null, 'sem divisão: null');

// ── 3. quem deve quanto nesta fatura ─────────────────────────────────────────
const linhas = [
  { id: 'g3', tipo: 'Gasto', valor: 300, data: '2026-11-20', observacao: 'Geladeira', dividida_com: 'Esposa', parte_outro: 150, parcela_num: 3, parcela_total: 10 },
  { id: 'm', tipo: 'Gasto', valor: 80, data: '2026-11-10', observacao: 'Mercado', dividida_com: 'ESPOSA', parte_outro: 40 },
  { id: 'c', tipo: 'Gasto', valor: 60, data: '2026-11-12', observacao: 'Cinema', dividida_com: 'Pedro', parte_outro: 30 },
  { id: 'sem', tipo: 'Gasto', valor: 99, data: '2026-11-13', observacao: 'Só meu' },
  { id: 'est', tipo: 'Recebimento', valor: 50, data: '2026-11-14', observacao: 'Estorno', dividida_com: 'Esposa', parte_outro: 25 },
];
const acertos = [
  { id: 'a1', pessoa: 'esposa', valor: 100, forma: 'registro' },
  { id: 'a2', pessoa: 'Ana', valor: 20, forma: 'registro' },
];
const ps = pessoasDaFatura(linhas, acertos);
eq(ps.map((p) => [p.nome, p.devido, p.recebido, p.aReceber]),
  [['Esposa', 190, 100, 90], ['Pedro', 30, 0, 30], ['Ana', 0, 20, 0]],
  'soma por pessoa (mesma pessoa com grafias diferentes), desconta o acertado; quem mais deve primeiro');
eq(ps[0].compras.map((c) => [c.id, c.parte, c.parcela]), [['m', 40, null], ['g3', 150, '3/10']], 'compras dela, por data, com a parcela');
eq(ps.find((p) => p.nome === 'Ana').acertos.length, 1, 'acerto de quem não tem compra na fatura continua aparecendo');
eq(pessoasDaFatura([{ id: 'x', tipo: 'Gasto', valor: 10, dividida_com: 'E', parte_outro: 10 }], [{ id: 'a', pessoa: 'E', valor: 50, forma: 'registro' }])[0].aReceber, 0,
  'pagou a mais: a receber não fica negativo');
eq(pessoasDaFatura([{ id: 'x', tipo: 'Gasto', valor: 10, dividida_com: 'Bia', parte_outro: 5 }, { id: 'y', tipo: 'Gasto', valor: 10, dividida_com: 'BIA', parte_outro: 5 }, { id: 'z', tipo: 'Gasto', valor: 10, dividida_com: 'BIA', parte_outro: 5 }])[0].nome,
  'BIA', 'nome exibido = grafia mais usada');

// ── 4. a mensagem ────────────────────────────────────────────────────────────
const fmt = (v) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const msg = mensagemCobranca({ nome: 'Esposa', cartao: 'Itaú Platinum', fatura: 'dezembro', aReceber: 90, recebido: 100, compras: ps[0].compras, fmt });
eq(msg, 'Oi, Esposa! Sua parte na fatura do Itaú Platinum (dezembro) deu R$ 90,00.\n\n• Mercado: R$ 40,00\n• Geladeira (3/10): R$ 150,00\n\nJá descontei os R$ 100,00 que você pagou.',
  'mensagem com as compras e o que já foi pago');
const muitas = Array.from({ length: 15 }, (_, i) => ({ id: `${i}`, descricao: `C${i}`, data: '2026-11-01', valor: 2, parte: 1, parcela: null }));
const m2 = mensagemCobranca({ nome: 'P', cartao: 'C', fatura: 'nov', aReceber: 15, recebido: 0, compras: muitas, fmt });
eq([m2.split('\n').filter((l) => l.startsWith('•')).length, m2.includes('e mais 3 compras'), m2.includes('descontei')], [13, true, false], 'muitas compras: 12 + "e mais"');
eq(mensagemCobranca({ nome: 'P', cartao: 'C', fatura: 'nov', aReceber: 5, recebido: 0, compras: [{ id: '1', descricao: 'TV 3/10', data: '', valor: 10, parte: 5, parcela: '3/10' }], fmt }).includes('TV 3/10: R$ 5,00'),
  true, 'parcela que já está no nome não repete');
eq(linkWhatsApp('Oi, Ana! R$ 5,00 & mais'), 'https://wa.me/?text=Oi%2C%20Ana!%20R%24%205%2C00%20%26%20mais', 'link do WhatsApp com o texto codificado');

console.log(`${total} verificações · ${falhas.length ? `${falhas.length} FALHAS` : 'todas ok'}`);
if (falhas.length) { for (const f of falhas) console.log('  ✘ ' + f); process.exit(1); }
