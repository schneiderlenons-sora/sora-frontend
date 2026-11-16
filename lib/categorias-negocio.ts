// =============================================================================
// Categorias do Sora Negócios: as PADRÃO (lib/lancamentos.ts) + as PRÓPRIAS da
// empresa (migration 196, backend `services/categoriasNegocio.js`).
//
// ⚠️ O lançamento guarda o NOME da categoria própria (não um id) — então o
// rótulo dela é o próprio valor, e `labelCategoria` já a mostra sem mudança.
// O que esta lib acrescenta é a LISTA pra escolher e o ÍCONE.
//
// Espelho do backend em `chave()` e na lista de ícones; `eval:categorias-negocio`
// compara os dois.
// =============================================================================

import { categoriasDe, type TipoLancamento } from './lancamentos';

export interface CategoriaPropria {
  tipo: TipoLancamento;
  nome: string;
  chave: string;
  icone: string | null;
  natureza: 'fixa' | 'variavel' | null;
  oculta: boolean;
  /** Guardada na tabela (tem ícone/natureza) ou só digitada em lançamentos. */
  registrada: boolean;
  /** Quantos lançamentos usam. */
  usos: number;
  grafias: string[];
}

export interface OpcaoCategoria {
  v: string;
  label: string;
  icone: string | null;
  propria: boolean;
}

/** Mesma chave do backend: sem acento, sem caixa, espaço/underline únicos. */
export function chaveCategoria(s?: string | null): string {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[_\s]+/g, ' ').trim();
}

/**
 * O que o seletor mostra: as padrão e, depois, as próprias que não foram
 * tiradas da lista (em ordem alfabética). A categoria ATUAL do lançamento entra
 * mesmo se estiver oculta — senão ele abriria sem a sua categoria marcada.
 */
export function opcoesCategoria(
  tipo: TipoLancamento, proprias: CategoriaPropria[] = [], atual?: string | null,
): OpcaoCategoria[] {
  const fixas: OpcaoCategoria[] = categoriasDe(tipo).map((c) => ({ v: c.v, label: c.label, icone: c.icone, propria: false }));
  const kAtual = chaveCategoria(atual);
  const minhas = proprias
    .filter((c) => c.tipo === tipo && (!c.oculta || (kAtual && c.chave === kAtual)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c) => ({ v: c.nome, label: c.nome, icone: c.icone, propria: true }));
  return [...fixas, ...minhas];
}

/**
 * O nome digitado no "Outra" já existe? Devolve o valor a gravar: o da padrão
 * ("aluguel"), o nome da própria guardada ("Conveniência") ou `null` (é nova).
 * Evita criar "Aluguel" ao lado do "Aluguel" padrão, ou uma 4ª grafia.
 */
export function categoriaExistente(
  tipo: TipoLancamento, digitado: string, proprias: CategoriaPropria[] = [],
): string | null {
  const k = chaveCategoria(digitado);
  if (!k) return null;
  const fixa = categoriasDe(tipo).find((c) => chaveCategoria(c.v) === k || chaveCategoria(c.label) === k);
  if (fixa) return fixa.v;
  const propria = proprias.find((c) => c.tipo === tipo && c.chave === k);
  return propria ? propria.nome : null;
}

/** Ícone da categoria de um lançamento (padrão ou própria). `null` = sem ícone. */
export function iconeDaCategoria(
  tipo: TipoLancamento, valor?: string | null, proprias: CategoriaPropria[] = [],
): string | null {
  if (!valor) return null;
  const fixa = categoriasDe(tipo).find((c) => c.v === valor);
  if (fixa) return fixa.icone;
  const k = chaveCategoria(valor);
  return proprias.find((c) => c.tipo === tipo && c.chave === k)?.icone || null;
}

export const NOME_MAX_CATEGORIA = 30;
