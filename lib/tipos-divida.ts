// =============================================================================
// TIPOS DE DÍVIDA — fonte única do rótulo, cor, ícone e descrição de cada tipo.
//
// Relato de cliente (Fábio, nov/2026): "classifico a dívida como Parcelamento,
// mas depois de salvar ela aparece como Outros". O dado estava CERTO no banco
// (tipo = 'parcelamento'); quem errava era o card. O formulário
// (NovaDividaModal) e o card (DividasClient) tinham cada um a SUA lista, e a do
// card não tinha 'parcelamento' — o tipo desconhecido caía no "Outro", com o
// ícone e a cor do Outro. Medido: 28 dívidas de parcelamento, em 13 grupos,
// apareciam como "OUTRO".
//
// ⚠️ Tipo NOVO de dívida entra AQUI e no CHECK `dividas_tipo_check` do banco
// (sora-backend/sql — hoje a 125). O `eval:tipos-divida` lê o CHECK da migration
// mais recente e falha se algum tipo aceito pelo banco não estiver nesta lista.
//
// `rotulo` é o do formulário; `curto` é o do selo do card, onde cabe menos
// ("FIES / Crédito edu." → "FIES").
//
// Rodar: npm run eval:tipos-divida
// =============================================================================
import {
  AlertTriangle, Briefcase, Building2, CreditCard, FileText, GraduationCap,
  Home, ShoppingCart, Ticket, Users, type LucideIcon,
} from 'lucide-react';

export type TipoDivida = {
  v: string;
  rotulo: string;
  curto: string;
  cor: string;
  icon: LucideIcon;
  desc: string;
};

/** Na ordem em que o formulário mostra. */
export const TIPOS_DIVIDA: readonly TipoDivida[] = [
  { v: 'emprestimo',      rotulo: 'Empréstimo',          curto: 'Empréstimo',      cor: '#3b82f6', icon: Briefcase,     desc: 'Pessoal, consignado livre, etc.' },
  { v: 'financiamento',   rotulo: 'Financiamento',       curto: 'Financiamento',   cor: '#8b5cf6', icon: Home,          desc: 'Imóvel, veículo, equipamento' },
  { v: 'consorcio',       rotulo: 'Consórcio',           curto: 'Consórcio',       cor: '#0ea5e9', icon: Ticket,        desc: 'Carta de crédito, com ou sem contemplação' },
  { v: 'crediario',       rotulo: 'Crediário',           curto: 'Crediário',       cor: '#f59e0b', icon: ShoppingCart,  desc: 'Loja de departamento, eletro' },
  { v: 'parcelamento',    rotulo: 'Parcelamento',        curto: 'Parcelamento',    cor: '#10b981', icon: Users,         desc: 'Parcelei com alguém, sem cartão' },
  { v: 'cartao_rotativo', rotulo: 'Cartão rotativo',     curto: 'Cartão rotativo', cor: '#ef4444', icon: CreditCard,    desc: 'Saldo não pago da fatura' },
  { v: 'cheque_especial', rotulo: 'Cheque especial',     curto: 'Cheque especial', cor: '#f97316', icon: AlertTriangle, desc: 'Limite do banco usado' },
  { v: 'consignado',      rotulo: 'Consignado',          curto: 'Consignado',      cor: '#06b6d4', icon: Building2,     desc: 'Descontado em folha' },
  { v: 'fies',            rotulo: 'FIES / Crédito edu.', curto: 'FIES',            cor: '#14b8a6', icon: GraduationCap, desc: 'Financiamento estudantil' },
  { v: 'outro',           rotulo: 'Outro',               curto: 'Outro',           cor: '#64748b', icon: FileText,      desc: 'Outra modalidade' },
];

const POR_TIPO = new Map(TIPOS_DIVIDA.map((t) => [t.v, t]));
const OUTRO = POR_TIPO.get('outro') as TipoDivida;

/**
 * O tipo de uma dívida, para exibir. Tipo desconhecido (ou vazio) mostra
 * "Outro" — só o que o banco realmente não conhece pode cair aqui.
 */
export function tipoDaDivida(tipo: string | null | undefined): TipoDivida {
  return POR_TIPO.get(String(tipo || '')) || OUTRO;
}
