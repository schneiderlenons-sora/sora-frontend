// =============================================================================
// QUAIS CONTAS PODEM PAGAR UMA PARCELA / FATURA
//
// ⚠️ EXISTE POR CAUSA DE UM BUG DE FORMATO, não por elegância. O campo "Conta
// de pagamento" da dívida (migration 182) lia `resposta.wallets`, e
// `api.wallets.listar` devolve um **ARRAY**. O resultado era `undefined → []`:
// o seletor ficava com a opção "—" e mais nada, para TODOS os usuários.
//
// Medido na base em 08/10/2026: **1 de 170 dívidas ativas** tinha conta
// vinculada — e essa única veio pelo outro caminho (tocar na linha do Extrato).
// O campo nasceu morto e ninguém conseguiu usá-lo.
//
// É a mesma família do `Array.isArray(fatData) ? fatData : []` que manteve as
// FATURAS fora do Extrato desde a criação da aba, só que ao contrário: lá o
// código esperava array e vinha objeto; aqui esperava objeto e vem array.
//
// A regra mora aqui pra poder ser TESTADA. Dentro do componente ela só seria
// exercitada por quem abrisse o modal.
// =============================================================================

export type ContaPagadora = { id: string; nome: string; tipo?: string | null; arquivada?: boolean | null };

/**
 * Normaliza a resposta de `api.wallets.listar` e devolve só as contas que
 * podem PAGAR — cartão de crédito não paga parcela, ele a gera.
 *
 * ⚠️ ACEITA OS DOIS FORMATOS de propósito. Hoje a rota devolve array; se algum
 * dia ela passar a embrulhar em `{ wallets }` (como várias outras rotas desta
 * API fazem), o seletor não volta a esvaziar em silêncio — que é o modo de
 * falha caro aqui: o campo PARECE funcionar, só não tem o que escolher.
 */
export function contasQuePagam(resposta: unknown): ContaPagadora[] {
  const lista = Array.isArray(resposta)
    ? resposta
    : Array.isArray((resposta as { wallets?: unknown } | null)?.wallets)
      ? ((resposta as { wallets: unknown[] }).wallets)
      : [];

  return (lista as ContaPagadora[]).filter((w) => {
    if (!w || typeof w !== 'object') return false;
    if (!w.id) return false;                 // sem id não dá pra vincular
    if (w.tipo === 'Crédito') return false;  // cartão não paga, ele cobra
    if (w.arquivada) return false;           // conta arquivada não recebe vínculo novo
    return true;
  });
}
