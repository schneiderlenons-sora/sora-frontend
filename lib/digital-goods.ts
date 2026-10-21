'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Ponte com a cobrança da Google Play DENTRO do app (TWA).
//
// Duas APIs do Chrome, que só existem quando a página roda dentro de um app da
// Play Store com `playBilling: true` no pacote:
//   · Digital Goods API — preços e compras que o aparelho já tem;
//   · Payment Request API — abre a janela de pagamento do Google.
//
// ⚠️ NO NAVEGADOR COMUM E NA VERSÃO 3 DO APP NADA DISSO EXISTE. Por isso tudo
// aqui devolve "indisponível" em vez de quebrar: o código pode ir pra produção
// antes do pacote novo, e o app antigo só mostra "atualize o app".
//
// ⚠️ O PREÇO EXIBIDO É O QUE O GOOGLE DEVOLVE, nunca o do `lib/stripe`. É o
// valor que a janela de pagamento vai cobrar — e o Google pode ajustá-lo (imposto,
// arredondamento, promoção) sem passar por nós.
// ─────────────────────────────────────────────────────────────────────────────

const METODO = 'https://play.google.com/billing';

export type DetalheItem = {
  itemId: string;
  title: string;
  price: { currency: string; value: string };
  subscriptionPeriod?: string;
};
type ServicoDG = {
  getDetails(ids: string[]): Promise<DetalheItem[]>;
  listPurchases(): Promise<{ itemId: string; purchaseToken: string }[]>;
};

let servico: Promise<ServicoDG | null> | null = null;
/** Por que o serviço não veio — mostrado na tela como "detalhe técnico". */
let motivoSemServico = '';

/**
 * ⚠️ TODA chamada ao Google tem PRAZO. Sem ele, um app que não responde (versão
 * sem a cobrança, ou o serviço da Play travado) deixava o paywall carregando
 * pra sempre — e, sem preço, o botão de assinar nunca liberava. Foi o relato do
 * primeiro teste no aparelho.
 */
function comPrazo<T>(p: Promise<T>, ms: number, rotulo: string): Promise<T> {
  return new Promise((ok, falha) => {
    const t = setTimeout(() => falha(new Error(`${rotulo}: sem resposta em ${ms / 1000}s`)), ms);
    p.then((v) => { clearTimeout(t); ok(v); }, (e) => { clearTimeout(t); falha(e); });
  });
}

const mensagem = (e: unknown) => (e instanceof Error ? `${e.name !== 'Error' ? e.name + ': ' : ''}${e.message}` : String(e));

/** O serviço de cobrança do Google, ou `null` fora do app / em app sem cobrança. */
export function servicoPlay(): Promise<ServicoDG | null> {
  if (servico) return servico;
  servico = (async () => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { getDigitalGoodsService?: (m: string) => Promise<ServicoDG> };
    if (typeof w.getDigitalGoodsService !== 'function') { motivoSemServico = 'navegador sem a API de compras do Google'; return null; }
    if (typeof window.PaymentRequest !== 'function') { motivoSemServico = 'navegador sem PaymentRequest'; return null; }
    try {
      return await comPrazo(w.getDigitalGoodsService(METODO), 6000, 'serviço da Play');
    } catch (e) {
      // "unsupported context": Chrome comum, app instalado fora da Play Store,
      // ou versão do app sem a cobrança do Google.
      motivoSemServico = mensagem(e);
      return null;
    }
  })();
  return servico;
}

export function motivoServicoIndisponivel(): string {
  return motivoSemServico;
}

export async function detalhesPlay(ids: string[]): Promise<Record<string, DetalheItem>> {
  const s = await servicoPlay();
  if (!s) return {};
  const lista = await comPrazo(s.getDetails(ids), 8000, 'preços da Play');
  return Object.fromEntries(lista.map((d) => [d.itemId, d]));
}

export { mensagem as mensagemDeErro };

/** Comprovantes de compra que o aparelho tem (restauração). */
export async function comprasDoAparelho(): Promise<string[]> {
  const s = await servicoPlay();
  if (!s) return [];
  try {
    return (await s.listPurchases()).map((p) => p.purchaseToken).filter(Boolean);
  } catch {
    return [];
  }
}

export type Troca = { oldSku: string; purchaseToken: string; replacementMode: string };

export type ResultadoCompra =
  | { ok: true; purchaseToken: string; concluir: (sucesso: boolean) => Promise<void> }
  | { ok: false; cancelada: boolean; erro?: string };

/**
 * Abre a janela de pagamento do Google.
 *
 * ⚠️ A JANELA SÓ FECHA COM `concluir()`. Quem chama tem de confirmar a compra
 * no servidor PRIMEIRO e depois concluir — fechar antes deixaria a pessoa
 * achando que terminou enquanto o plano ainda não foi liberado.
 */
export async function comprarPlay(sku: string, troca?: Troca): Promise<ResultadoCompra> {
  const data: Record<string, string> = { sku };
  if (troca) Object.assign(data, troca);
  try {
    const req = new PaymentRequest(
      [{ supportedMethods: METODO, data }],
      // Obrigatório pela API; o valor real vem do Google, não daqui.
      { total: { label: 'Total', amount: { currency: 'BRL', value: '0' } } },
    );
    const resp = await req.show();
    const token = (resp.details as { purchaseToken?: string } | undefined)?.purchaseToken;
    if (!token) {
      await resp.complete('fail');
      return { ok: false, cancelada: false, erro: 'O Google não devolveu o comprovante da compra.' };
    }
    return { ok: true, purchaseToken: token, concluir: (sucesso) => resp.complete(sucesso ? 'success' : 'fail') };
  } catch (e) {
    const nome = e instanceof Error ? e.name : '';
    if (nome === 'AbortError') return { ok: false, cancelada: true };
    return { ok: false, cancelada: false, erro: e instanceof Error ? e.message : 'Falha ao abrir o pagamento.' };
  }
}

/** Página da própria Play Store pra gerenciar/cancelar a assinatura. */
export function linkGerenciarPlay(produto?: string | null): string {
  const q = new URLSearchParams({ package: 'com.forsora.app' });
  if (produto) q.set('sku', produto);
  return `https://play.google.com/store/account/subscriptions?${q}`;
}
