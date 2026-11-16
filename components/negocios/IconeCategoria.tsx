// Ícone de uma categoria do Sora Negócios (padrão ou própria).
//
// ⚠️ ICONES_CATEGORIA é a lista que a pessoa pode ESCOLHER e é espelho de
// `ICONES` em sora-backend/src/services/categoriasNegocio.js — o backend
// recusa nome fora dela. `eval:categorias-negocio` compara as duas.
// Import nomeado de cada ícone (não `import *`), pra não levar a biblioteca
// inteira pro pacote.

import type { CSSProperties } from 'react';
import {
  ShoppingBag, ShoppingCart, Store, Package, Boxes, Truck, Tag, Receipt,
  Home, Building2, Factory, Zap, Droplets, Flame, Wifi, Phone,
  Users, UserRound, Briefcase, Wrench, Hammer, Scissors, Sparkles, Paintbrush,
  Landmark, Banknote, CreditCard, Wallet, PiggyBank, HandCoins, TrendingUp, Calculator,
  Utensils, Coffee, Pizza, Croissant, Beer, Car, Fuel, Bike,
  Plane, Laptop, Code, Cloud, Megaphone, Printer, FileText, Shirt,
  HeartPulse, Pill, GraduationCap, Gift, Dog, Leaf, Shield, Dumbbell,
  Plus, ArrowLeftRight, type LucideIcon,
} from 'lucide-react';

const MAPA: Record<string, LucideIcon> = {
  ShoppingBag, ShoppingCart, Store, Package, Boxes, Truck, Tag, Receipt,
  Home, Building2, Factory, Zap, Droplets, Flame, Wifi, Phone,
  Users, UserRound, Briefcase, Wrench, Hammer, Scissors, Sparkles, Paintbrush,
  Landmark, Banknote, CreditCard, Wallet, PiggyBank, HandCoins, TrendingUp, Calculator,
  Utensils, Coffee, Pizza, Croissant, Beer, Car, Fuel, Bike,
  Plane, Laptop, Code, Cloud, Megaphone, Printer, FileText, Shirt,
  HeartPulse, Pill, GraduationCap, Gift, Dog, Leaf, Shield, Dumbbell,
  // Só das categorias padrão (não aparecem pra escolha).
  Plus, ArrowLeftRight,
};

/** Os que a pessoa pode escolher, na ordem da grade. */
export const ICONES_CATEGORIA = [
  'ShoppingBag', 'ShoppingCart', 'Store', 'Package', 'Boxes', 'Truck', 'Tag', 'Receipt',
  'Home', 'Building2', 'Factory', 'Zap', 'Droplets', 'Flame', 'Wifi', 'Phone',
  'Users', 'UserRound', 'Briefcase', 'Wrench', 'Hammer', 'Scissors', 'Sparkles', 'Paintbrush',
  'Landmark', 'Banknote', 'CreditCard', 'Wallet', 'PiggyBank', 'HandCoins', 'TrendingUp', 'Calculator',
  'Utensils', 'Coffee', 'Pizza', 'Croissant', 'Beer', 'Car', 'Fuel', 'Bike',
  'Plane', 'Laptop', 'Code', 'Cloud', 'Megaphone', 'Printer', 'FileText', 'Shirt',
  'HeartPulse', 'Pill', 'GraduationCap', 'Gift', 'Dog', 'Leaf', 'Shield', 'Dumbbell',
] as const;

/** Nome em português de cada ícone (leitor de tela e dica ao passar o mouse). */
export const ROTULO_ICONE: Record<(typeof ICONES_CATEGORIA)[number], string> = {
  ShoppingBag: 'Sacola', ShoppingCart: 'Carrinho', Store: 'Loja', Package: 'Caixa',
  Boxes: 'Estoque', Truck: 'Caminhão', Tag: 'Etiqueta', Receipt: 'Nota',
  Home: 'Casa', Building2: 'Prédio', Factory: 'Fábrica', Zap: 'Energia',
  Droplets: 'Água', Flame: 'Gás', Wifi: 'Internet', Phone: 'Telefone',
  Users: 'Equipe', UserRound: 'Pessoa', Briefcase: 'Maleta', Wrench: 'Ferramenta',
  Hammer: 'Martelo', Scissors: 'Tesoura', Sparkles: 'Limpeza', Paintbrush: 'Pincel',
  Landmark: 'Banco', Banknote: 'Dinheiro', CreditCard: 'Cartão', Wallet: 'Carteira',
  PiggyBank: 'Cofrinho', HandCoins: 'Pagamento', TrendingUp: 'Crescimento', Calculator: 'Calculadora',
  Utensils: 'Talheres', Coffee: 'Café', Pizza: 'Pizza', Croissant: 'Padaria',
  Beer: 'Bebida', Car: 'Carro', Fuel: 'Combustível', Bike: 'Bicicleta',
  Plane: 'Viagem', Laptop: 'Computador', Code: 'Sistema', Cloud: 'Nuvem',
  Megaphone: 'Divulgação', Printer: 'Impressora', FileText: 'Documento', Shirt: 'Roupa',
  HeartPulse: 'Saúde', Pill: 'Remédio', GraduationCap: 'Curso', Gift: 'Presente',
  Dog: 'Pet', Leaf: 'Planta', Shield: 'Seguro', Dumbbell: 'Academia',
};

/** Desenha o ícone pelo nome; sem nome (ou nome desconhecido) usa a etiqueta. */
export default function IconeCategoria({ nome, size = 14, className, style }: {
  nome?: string | null; size?: number; className?: string; style?: CSSProperties;
}) {
  const Icon = (nome && MAPA[nome]) || Tag;
  return <Icon size={size} className={className} style={style} aria-hidden />;
}

/** Existe componente pra este nome? (o eval confere padrão + escolhíveis). */
export const temIcone = (nome: string) => !!MAPA[nome];
