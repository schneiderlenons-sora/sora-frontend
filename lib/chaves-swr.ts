// ─────────────────────────────────────────────────────────────────────────────
// AS CHAVES DO SWR — nomeiam o DADO, nunca a PÁGINA.
//
// ⚠️ ESTE ARQUIVO EXISTE POR CAUSA DE UM PROBLEMA MEDIDO. Cada aba batizava a
// própria chave com o prefixo dela (`tx:`, `rel:`, `cat:`, `lim:`, `prev:`,
// `cart:`, `contas:`), então a MESMA requisição tinha um nome diferente em cada
// tela. O SWR deduplica por chave — logo, ele não tinha como saber que eram a
// mesma coisa:
//
//   api.wallets.listar(phone)          → 5 chaves diferentes
//   api.transacoes.resumo(phone, mes)  → 6 chaves diferentes
//   api.categorias.listar(phone)       → 3 chaves diferentes
//   api.limites.listar(phone, mes)     → 3 chaves diferentes
//   api.wallets.faturas(phone, 0)      → 4 chaves diferentes
//
// Duas consequências, as duas medidas num celular emulado (CPU 4×):
//
//   1. Abrir o dashboard fazia 14 chamadas ao Render das quais **9 eram
//      duplicatas exatas** (64%) — `resumo?mes` saía 3×, `transacoes?limit=500`
//      saía 2×, `wallets` 2×, `categorias` 2×. Só o aquecimento das "3 abas
//      mais usadas" já disparava a mesma URL três vezes com nomes diferentes.
//
//   2. Nenhuma aba reaproveitava o cache da outra. Ir de /transacoes pra
//      /categorias refazia o resumo do mês que acabara de chegar. Era esta a
//      causa do relato "toda vez que clico em outra aba tem que carregar".
//
// A REGRA: a chave é formada pelo que muda a RESPOSTA (telefone, mês, filtro,
// limite) e por nada mais. Duas telas que pedem o mesmo dado passam a compartilhar
// a mesma linha do cache — a segunda abre instantânea, sem rede.
//
// ⚠️ AO CRIAR UM useApi NOVO, USE DAQUI. Inventar uma chave com o prefixo da
// página traz o problema de volta, e ele é invisível: tudo funciona, só fica
// lento. Se o dado ainda não tem entrada aqui, adicione uma.
//
// ⚠️ PARÂMETRO QUE MUDA A RESPOSTA TEM DE ENTRAR NA CHAVE. O contrário deste
// bug é igualmente ruim: duas telas compartilharem uma chave enquanto pedem
// dados diferentes faz uma exibir o dado da outra. Por isso `mes`, `criadoPor`,
// `limit`, `arquivadas` e `offset` são explícitos nas assinaturas.
// ─────────────────────────────────────────────────────────────────────────────

const T = 'todos';

export const chave = {
  /** `api.wallets.listar(phone)` */
  wallets: (p: string) => `d:wallets:${p}`,

  /** `api.categorias.listar(phone)` */
  categorias: (p: string) => `d:cats:${p}`,

  /** `api.recorrencias.listar(phone)` */
  recorrencias: (p: string) => `d:rec:${p}`,

  /** `api.dividas.listar(phone)` */
  dividas: (p: string) => `d:div:${p}`,

  /** `api.grupos.membros(grupoId)` — por GRUPO, não por telefone. */
  membros: (grupoId: string) => `d:membros:${grupoId}`,

  /** `api.wallets.faturas(phone, offset)` — offset navega FATURAS, não meses. */
  faturas: (p: string, offset = 0) => `d:faturas:${p}:${offset}`,

  /** `api.limites.listar(phone, mes)` */
  limites: (p: string, mes: string) => `d:limites:${p}:${mes}`,

  /** `api.transacoes.resumo(phone, mes, { criado_por })` */
  resumo: (p: string, mes: string, criadoPor?: string) =>
    `d:resumo:${p}:${mes}:${criadoPor || T}`,

  /** `api.transacoes.anual(phone, ano, { criado_por })` */
  anual: (p: string, ano: number | string, criadoPor?: string) =>
    `d:anual:${p}:${ano}:${criadoPor || T}`,

  /** `api.transacoes.listar(phone, { mes, limit, criado_por, arquivadas })` */
  transacoes: (
    p: string,
    o: { mes?: string; limit: number; criadoPor?: string; arquivadas?: boolean },
  ) => `d:tx:${p}:${o.mes || 'tudo'}:${o.limit}:${o.criadoPor || T}:${o.arquivadas ? 'arq' : 'nrm'}`,
};
