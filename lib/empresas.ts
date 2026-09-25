// =============================================================================
// Catálogo central das EMPRESAS (Negócios 2.0 — multi-empresa).
//
// `tipo` é o que faz a aba SE ADAPTAR: digital mostra integrações/DRE, físico
// mostra caixa/contas/equipe, híbrido mostra os dois. Não existe tela morta.
// =============================================================================

export type TipoEmpresa = 'digital' | 'fisico' | 'hibrido';

/**
 * Papel da pessoa DENTRO da empresa (migration 173).
 *   admin    → convida/remove membro, renomeia, configura
 *   operador → lança, paga, dá baixa, cadastra cliente/produto
 *   leitura  → só vê (DRE, caixa, relatórios) — é o papel do contador
 */
export type PapelEmpresa = 'admin' | 'operador' | 'leitura';

export interface Empresa {
  id:         string;
  user_id?:   string;
  grupo_id?:  string;
  nome:       string;
  tipo:       TipoEmpresa;
  logo_url?:  string | null;
  icone?:     string | null;
  cor?:       string | null;
  cnpj?:      string | null;
  ativa?:     boolean;
  created_at?: string;
  /** Vem do GET /empresas. Opcionais porque a resposta de um backend antigo
   *  não os traz — e aí a tela cai no comportamento de dono, que é o de hoje. */
  papel?:     PapelEmpresa;
  dono?:      boolean;
}

const ORDEM_PAPEL: PapelEmpresa[] = ['leitura', 'operador', 'admin'];

/**
 * O papel da pessoa cobre o mínimo exigido? Espelha `papelPermite` do backend
 * (services/acessoEmpresa.js) — mexeu num, mexa no outro.
 *
 * ⚠️ SEM `papel` A RESPOSTA É `true`, DE PROPÓSITO. Quem responde de verdade é
 * o servidor; aqui a checagem só existe pra não OFERECER um botão que vai
 * falhar. Backend antigo (ou resposta sem o campo) tem de continuar mostrando
 * a aba como sempre mostrou, em vez de esconder tudo de um dono legítimo.
 */
export function podeNaEmpresa(e?: Empresa | null, minimo: PapelEmpresa = 'operador'): boolean {
  if (!e?.papel) return true;
  return ORDEM_PAPEL.indexOf(e.papel) >= ORDEM_PAPEL.indexOf(minimo);
}

/** Arquivar a empresa é só do DONO — nem do admin convidado (some com o
 *  histórico da equipe inteira e não tem desfazer). Espelha a rota DELETE. */
export function podeArquivar(e?: Empresa | null): boolean {
  return e?.dono !== false;
}

/** Opções do seletor de tipo — cada uma explica o que muda na prática. */
export const TIPOS_EMPRESA: {
  v: TipoEmpresa; label: string; desc: string; icone: string;
}[] = [
  { v: 'fisico',  label: 'Loja física',  desc: 'Caixa do dia, contas a pagar e equipe',       icone: 'Store' },
  { v: 'digital', label: 'Digital',      desc: 'Infoprodutos, integrações e DRE automático',  icone: 'Laptop' },
  { v: 'hibrido', label: 'Os dois',      desc: 'Loja física + vendas online no mesmo lugar',  icone: 'Building2' },
];

/** Paleta de destaque — as MESMAS cores já usadas no painel (dívidas/Grow),
 *  pra empresa nova nunca destoar da aparência do app. */
export const CORES_EMPRESA = [
  '#61D17B', // Sora green (padrão)
  '#3b82f6', // azul
  '#8b5cf6', // violeta
  '#06b6d4', // ciano
  '#14b8a6', // teal
  '#f59e0b', // âmbar
  '#f97316', // laranja
  '#ef4444', // vermelho
  '#db2777', // rosa
  '#64748b', // grafite
];

export const COR_PADRAO = CORES_EMPRESA[0];

/** Cor efetiva da empresa (com fallback), pronta pra usar em style. */
export function corEmpresa(e?: Empresa | null): string {
  return e?.cor || COR_PADRAO;
}

/** Iniciais pro avatar quando a empresa não tem logo. Ex.: "Padaria do Zé" → "PZ" */
export function iniciaisEmpresa(nome?: string): string {
  const partes = (nome || '').trim().split(/\s+/).filter(p => p.length > 2 || /^[A-ZÀ-Ú]/.test(p));
  const base = partes.length ? partes : (nome || '').trim().split(/\s+/);
  return base.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

export function labelTipo(tipo?: TipoEmpresa): string {
  return TIPOS_EMPRESA.find(t => t.v === tipo)?.label || 'Digital';
}

/** Gates de UI por tipo — a fonte única de "o que essa empresa mostra". */
export const mostraCaixa       = (t?: TipoEmpresa) => t === 'fisico'  || t === 'hibrido';
export const mostraIntegracoes = (t?: TipoEmpresa) => t === 'digital' || t === 'hibrido';

/** Empresa ativa fica no localStorage POR USUÁRIO (não vaza entre contas e
 *  sobrevive ao F5). Limpo no logout junto dos outros caches. */
const KEY = 'sora-empresa-ativa';
export function lerEmpresaAtiva(userId?: string): string | null {
  if (typeof window === 'undefined' || !userId) return null;
  try { return localStorage.getItem(`${KEY}:${userId}`); } catch { return null; }
}
export function salvarEmpresaAtiva(userId?: string, empresaId?: string): void {
  if (typeof window === 'undefined' || !userId) return;
  try {
    if (empresaId) localStorage.setItem(`${KEY}:${userId}`, empresaId);
    else localStorage.removeItem(`${KEY}:${userId}`);
  } catch { /* best-effort */ }
}
