// ─────────────────────────────────────────────────────────────────────────────
// CONTA "SÓ DA EMPRESA" NO PAINEL PESSOAL — fonte única (nov/2026)
//
// Relato do Robert: a conta PJ, ligada ao Sora Negócios com "só da empresa",
// seguia somando no "Saldo em contas" e listando os lançamentos dela nas
// Transações — "mostra um dinheiro que não é meu".
//
// O backend marca a carteira com `da_empresa` (`/api/wallets` e
// `/api/dashboard`, via services/contaDaEmpresa.js; o SSR em lib/ssr-data.ts).
// Toda tela que soma o SALDO PESSOAL passa por `contasDoPessoal` — nunca um
// filtro próprio, senão uma tela mostra um saldo e a outra, outro.
//
// As TRANSAÇÕES da conta saem dos totais por outra alavanca, que já existia:
// `ignorar_em = 'empresa'` (o "não considerar"). `ehLancamentoDaEmpresa` é só
// pra lista de Transações esconder essas linhas por padrão.
//
// ⚠️ Sem a marca (backend antigo, leitura que falhou) a conta é PESSOAL — o
// lado seguro é mostrar dinheiro, nunca escondê-lo.
// ─────────────────────────────────────────────────────────────────────────────

export type DaEmpresa = { conta_id?: string; empresa_id?: string; empresa_nome?: string | null } | null | undefined;

/** A carteira é "só da empresa"? */
export function ehContaDaEmpresa(w: unknown): boolean {
  return !!(w && (w as { da_empresa?: DaEmpresa }).da_empresa);
}

/** Só as carteiras que são da pessoa (as que entram no saldo pessoal). */
export function contasDoPessoal<W>(ws: W[] | null | undefined): W[] {
  return (ws || []).filter((w) => !ehContaDaEmpresa(w));
}

/** Só as carteiras "só da empresa". */
export function contasDaEmpresa<W>(ws: W[] | null | undefined): W[] {
  return (ws || []).filter((w) => ehContaDaEmpresa(w));
}

/** O lançamento é da conta da empresa (marcado pelo Sora Negócios)? */
export function ehLancamentoDaEmpresa(t: { ignorar_em?: string | null } | null | undefined): boolean {
  return !!t && t.ignorar_em === 'empresa';
}
