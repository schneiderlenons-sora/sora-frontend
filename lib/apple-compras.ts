// ─────────────────────────────────────────────────────────────────────────────
// A PONTE COM A COMPRA DA APPLE, do lado do site. Irmã de `lib/digital-goods.ts`
// (Google Play).
//
// O app de iPhone é uma casca Capacitor que abre www.forsora.com; ela injeta
// `window.Capacitor` na página. O plugin nativo `SoraCompras`
// (ios-app/ios/App/App/SoraComprasPlugin.swift) é chamado por
// `Capacitor.nativePromise` — o site NÃO empacota o @capacitor/core.
//
// Fora do app (navegador) ou no app antigo, sem o plugin, tudo aqui responde
// "indisponível" e nada é vendido.
// ─────────────────────────────────────────────────────────────────────────────

type PonteCapacitor = {
  nativePromise?: (plugin: string, metodo: string, opcoes?: Record<string, unknown>) => Promise<unknown>;
  getPlatform?: () => string;
  isPluginAvailable?: (nome: string) => boolean;
};

function ponte(): PonteCapacitor | null {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as { Capacitor?: PonteCapacitor }).Capacitor) ?? null;
}

const PLUGIN = 'SoraCompras';

/** Dá pra chamar a compra da Apple nesta tela? */
export function compraAppleDisponivel(): boolean {
  const c = ponte();
  return !!c && typeof c.nativePromise === 'function' && c.getPlatform?.() === 'ios';
}

async function chamar<T>(metodo: string, opcoes: Record<string, unknown> = {}): Promise<T> {
  const c = ponte();
  if (!c?.nativePromise) throw new Error('A compra pela App Store não está disponível nesta versão do app.');
  return (await c.nativePromise(PLUGIN, metodo, opcoes)) as T;
}

export type ProdutoApple = { id: string; preco: string; valor: number; moeda: string; periodo?: string };
export type DireitoApple = { jws: string; produto: string; original: string };
export type CompraApple =
  | { status: 'sucesso'; jws: string; produto: string; original: string }
  | { status: 'cancelada' | 'pendente' | 'desconhecido' }
  | { status: 'nao_verificada'; erro?: string };

export async function produtosApple(ids: string[]): Promise<ProdutoApple[]> {
  const r = await chamar<{ produtos?: ProdutoApple[] }>('produtos', { ids });
  return r.produtos || [];
}

/** `conta` = id da conta Sora: a Apple o carimba no comprovante (appAccountToken). */
export function comprarApple(id: string, conta: string): Promise<CompraApple> {
  return chamar<CompraApple>('comprar', { id, conta });
}

/** Assinaturas vigentes deste Apple ID, sem pedir senha. */
export async function direitosApple(): Promise<DireitoApple[]> {
  if (!compraAppleDisponivel()) return [];
  try {
    const r = await chamar<{ itens?: DireitoApple[] }>('direitos');
    return r.itens || [];
  } catch {
    return [];
  }
}

/** "Restaurar compras" (pode pedir a senha do Apple ID). */
export async function restaurarApple(): Promise<DireitoApple[]> {
  const r = await chamar<{ itens?: DireitoApple[] }>('restaurar');
  return r.itens || [];
}

/** Tela de assinaturas da Apple (trocar de plano, cancelar). */
export function gerenciarApple(): Promise<void> {
  return chamar<void>('gerenciar');
}

/** Texto curto do erro do plugin, pra mostrar na tela. */
export function mensagemErroApple(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return 'Não foi possível falar com a App Store agora.';
}
