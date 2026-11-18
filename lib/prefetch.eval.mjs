// =============================================================================
// EVAL: aquecimento das abas no ocioso (lib/prefetch.ts → itensDoAquecimento).
//
// O aquecimento só serve se a CHAVE for idêntica à que a tela pede ao abrir.
// Este eval trava duas coisas:
//   §1 as chaves geradas = as que cada tela monta no estado inicial;
//   §2 o CONTRATO com as telas: se alguém mudar a chave/estado inicial de
//      Previstos, Cartões ou Relatórios, o eval falha — senão o aquecimento
//      ficaria inútil sem ninguém perceber (e a baleia voltaria).
//
// Rodar:  npm run eval:prefetch
// =============================================================================
import fs from 'fs';
// `lib/api.ts` cria o cliente do Supabase ao ser importado — valores falsos
// bastam (nada aqui chama a rede). Import dinâmico pra rodar DEPOIS disto.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://falso.local';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'falso';
const { itensDoAquecimento, aquecerChave } = await import('./prefetch.ts');
const { chave } = await import('./chaves-swr.ts');

const falhas = [];
let total = 0;
const eq = (a, b, m) => { total++; if (JSON.stringify(a) !== JSON.stringify(b)) falhas.push(`${m}\n     esperado ${JSON.stringify(b)}\n     veio     ${JSON.stringify(a)}`); };
const P = '5511999999999';
const chaves = (opts) => itensDoAquecimento(P, opts).map((i) => i.key);

console.log('── 1. CHAVES = AS DAS TELAS ──');
{
  // 17/11/2026 15:00 em SP.
  const agora = new Date('2026-11-17T18:00:00Z');
  const k = chaves({ agora });
  // Relatórios (tab "graficos", mês/ano locais, sem filtro de membro)
  eq(k.includes(chave.anual(P, 2026)), true, '§1 Relatórios: anual do ano');
  eq(k.includes(chave.limites(P, '2026-11')), true, '§1 Relatórios: limites do mês');
  // Cartões
  eq(k.includes(chave.faturas(P, 0)) && k.includes(chave.faturas(P, 1)), true, '§1 Cartões: faturas atual e seguinte');
  // Previstos (aba "projecao", offset 0, período 6)
  for (const [nome, key] of [
    ['recorrências', chave.recorrencias(P)], ['dívidas', chave.dividas(P)], ['contas', chave.wallets(P)],
    ['resumo', chave.resumo(P, '2026-11')], ['transações do mês', chave.transacoes(P, { mes: '2026-11', limit: 500 })],
  ]) eq(k.includes(key), true, `§1 Previstos: ${nome}`);
  eq(k.includes(chave.anual(P, 2025)), false, '§1 em novembro o período padrão (6) não pede o ano anterior');
  eq(k.some((x) => x.startsWith('inv:')), false, '§1 sem acesso a Investimentos, nada de investimento');
  eq(k.some((x) => /grow|metas:|dividas:/.test(x)), false, '§1 nada de Grow nem das abas que já vêm do servidor');
  eq(new Set(k).size, k.length, '§1 sem chave repetida');
  eq(k.includes(chave.transacoes(P, { mes: '2026-11', limit: 500, arquivadas: false })), true, '§1 transações = chave da lista normal (não arquivadas)');

  // Janeiro: período 6 > mês 1 → Previstos pede o ano anterior.
  const jan = chaves({ agora: new Date('2027-01-10T15:00:00Z') });
  eq(jan.includes(chave.anual(P, 2026)) && jan.includes(chave.anual(P, 2027)), true, '§1 janeiro: ano atual E anterior');

  // Com Investimentos.
  eq(chaves({ agora, investimentos: true }).includes('inv:movimentos:' + P), true, '§1 com acesso: movimentos de investimento');

  // Virada do mês: 01/12 às 01:00 UTC = 30/11 22:00 em SP → Previstos ainda é novembro.
  const virada = chaves({ agora: new Date('2026-12-01T01:00:00Z') });
  eq(virada.includes(chave.resumo(P, '2026-11')), true, '§1 Previstos segue o mês de SÃO PAULO na virada');
}
console.log('  ok');

console.log('── 2. CONTRATO COM AS TELAS ──');
{
  const ler = (f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
  const prev = ler('app/(app)/previstos/PrevistosClient.tsx');
  eq(prev.includes("useState<Aba>('projecao')"), true, '§2 Previstos abre na aba "projecao"');
  eq(prev.includes('useState<number>(6)'), true, '§2 Previstos: período padrão 6');
  for (const trecho of [
    'chave.recorrencias(phone)', 'chave.dividas(phone)', 'chave.faturas(phone, 0)', 'chave.wallets(phone)',
    'chave.resumo(phone, ymRef)', 'chave.anual(phone, anoRef)', 'chave.transacoes(phone, { mes: ymHoje, limit: 500 })',
  ]) eq(prev.includes(trecho), true, `§2 Previstos ainda pede ${trecho}`);

  const cart = ler('app/(app)/cartao-de-credito/CartaoClient.tsx');
  eq(cart.includes('chave.faturas(phone, 0)') && cart.includes('chave.faturas(phone, 1)'), true, '§2 Cartões ainda pede as faturas 0 e 1');

  const rel = ler('app/(app)/relatorios/RelatoriosClient.tsx');
  eq(rel.includes("useState<Tab>('graficos')"), true, '§2 Relatórios abre em "graficos"');
  eq(rel.includes('chave.anual(phone, ano, criadoPorParam)'), true, '§2 Relatórios ainda pede o anual');
  eq(rel.includes('chave.limites(phone, mesRef)'), true, '§2 Relatórios ainda pede os limites do mês');
  eq(rel.includes('useState(hoje.getFullYear())') && rel.includes('useState(hoje.getMonth())'), true, '§2 Relatórios usa mês/ano LOCAIS');

  const inv = ler('app/(app)/investimentos/InvestimentosClient.tsx');
  eq(inv.includes('`inv:movimentos:${phone}`'), true, '§2 Investimentos ainda pede os movimentos');
}
console.log('  ok');

console.log('── 3. AQUECER: nunca em dobro, nunca por cima ──');
{
  // Imita o SWR: `mutate` MESCLA só `{ data, error }` com o que já está lá.
  const cacheFalso = (inicial = {}) => {
    const m = new Map(Object.entries(inicial));
    const gravados = [];
    return {
      c: {
        cache: { get: (k) => m.get(k), set: (k, v) => m.set(k, v) },
        mutate: (k, d) => { gravados.push(k); m.set(k, { ...(m.get(k) || {}), data: d, error: undefined }); return Promise.resolve(); },
      },
      m, gravados,
    };
  };
  let buscas = 0;
  const buscar = () => { buscas++; return Promise.resolve({ ok: 1 }); };
  const tick = () => new Promise((r) => setTimeout(r, 0));

  const a = cacheFalso({ k1: { data: [1] } });
  aquecerChave(a.c, 'k1', buscar); await tick();
  eq(buscas, 0, '§3 com dado no cache, não busca');

  const b = cacheFalso({ k2: { isValidating: true } });
  aquecerChave(b.c, 'k2', buscar); await tick();
  eq(buscas, 0, '⚠️ §3 a TELA já está buscando a chave: não pede em dobro (rota de faturas, ~4 s)');

  const c = cacheFalso();
  aquecerChave(c.c, 'k3', buscar); await tick(); await tick();
  eq([buscas, c.gravados], [1, ['k3']], '§3 cache vazio: busca uma vez e grava');
  // ⚠️ O ponto que fazia a baleia aparecer COM o dado na mão: sem `isLoading`
  // gravado, o SWR monta a tela como "carregando".
  eq(c.m.get('k3').isLoading, false, '⚠️ §3 grava isLoading:false junto do dado');
  eq(c.m.get('k3').data, { ok: 1 }, '§3 e o dado');

  // A tela COMEÇOU a buscar enquanto o aquecimento estava no ar: não grava.
  let soltar2;
  const f = cacheFalso();
  aquecerChave(f.c, 'k6', () => new Promise((r) => { soltar2 = r; }));
  f.m.set('k6', { isValidating: true });
  soltar2('do aquecimento'); await tick(); await tick();
  eq([f.gravados, f.m.get('k6').isValidating], [[], true], '§3 tela buscando na chegada: não grava nem mexe no estado dela');

  // A tela buscou e gravou ENQUANTO o aquecimento estava no ar: não sobrescreve.
  let soltar;
  const d = cacheFalso();
  aquecerChave(d.c, 'k4', () => new Promise((r) => { soltar = r; }));
  d.m.set('k4', { data: 'da tela' });
  soltar('velho'); await tick(); await tick();
  eq(d.m.get('k4').data, 'da tela', '§3 resposta do aquecimento não passa por cima da da tela');

  // Duas chamadas seguidas da mesma chave: uma busca só.
  let n = 0;
  const e = cacheFalso();
  aquecerChave(e.c, 'k5', () => { n++; return new Promise(() => {}); });
  aquecerChave(e.c, 'k5', () => { n++; return new Promise(() => {}); });
  eq(n, 1, '§3 a mesma chave em voo não sai duas vezes');
}
console.log('  ok');

console.log(`\n${total - falhas.length}/${total} ok`);
if (falhas.length) { console.log('\nFALHAS:\n - ' + falhas.join('\n - ')); process.exit(1); }
