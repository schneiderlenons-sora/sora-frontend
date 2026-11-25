import {
  AppStoreServerAPIClient, SignedDataVerifier, Environment, APIException, VerificationException, VerificationStatus,
} from '@apple/app-store-server-library';
import { RAIZES_APPLE } from './apple-raiz';
import type { TransacaoApple, RenovacaoApple } from './apple-billing';

// ─────────────────────────────────────────────────────────────────────────────
// A CONVERSA COM A APPLE — irmão de `lib/google-play.ts`.
//
// Pela biblioteca OFICIAL (@apple/app-store-server-library): ela confere a
// assinatura dos comprovantes até a raiz da Apple (lib/apple-raiz.ts) e fala
// com o App Store Server API com a chave de compras no app (.p8).
//
// Variáveis na Vercel:
//   APPLE_IAP_KEY_ID       ID da chave de "Compras no app"
//   APPLE_IAP_ISSUER_ID    ID do emissor (Usuários e acesso → Integrações)
//   APPLE_IAP_PRIVATE_KEY  conteúdo do .p8 (com as quebras de linha, ou \n)
//
// ⚠️ PRODUÇÃO E SANDBOX CONVIVEM. A revisão da Apple compra com conta de
// sandbox NO APP DE PRODUÇÃO, e o TestFlight também é sandbox. Todo comprovante
// é conferido primeiro como produção e, se a Apple disser que é de outro
// ambiente, como sandbox. Quem passou pelo sandbox fica marcado (`ambiente`).
// ─────────────────────────────────────────────────────────────────────────────

export const BUNDLE_ID = 'com.forsora.app';
export const APP_APPLE_ID = 6827597771;

/** Erro da Apple. `definitivo` = não adianta tentar de novo (comprovante inválido/inexistente). */
export class ErroApple extends Error {
  definitivo: boolean;
  constructor(msg: string, definitivo: boolean) {
    super(msg);
    this.definitivo = definitivo;
  }
}

export function appleConfigurado(): boolean {
  return !!(process.env.APPLE_IAP_KEY_ID && process.env.APPLE_IAP_ISSUER_ID && process.env.APPLE_IAP_PRIVATE_KEY);
}

function chavePrivada(): string {
  return String(process.env.APPLE_IAP_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
}

const AMBIENTES = [Environment.PRODUCTION, Environment.SANDBOX] as const;
type Ambiente = (typeof AMBIENTES)[number];

const clientes = new Map<Ambiente, AppStoreServerAPIClient>();
function cliente(amb: Ambiente): AppStoreServerAPIClient {
  let c = clientes.get(amb);
  if (!c) {
    if (!appleConfigurado()) throw new ErroApple('Compra pela Apple não configurada no servidor (APPLE_IAP_*).', false);
    c = new AppStoreServerAPIClient(chavePrivada(), process.env.APPLE_IAP_KEY_ID!, process.env.APPLE_IAP_ISSUER_ID!, BUNDLE_ID, amb);
    clientes.set(amb, c);
  }
  return c;
}

const verificadores = new Map<Ambiente, SignedDataVerifier>();
function verificador(amb: Ambiente): SignedDataVerifier {
  let v = verificadores.get(amb);
  if (!v) {
    // `true` = confere também se a Apple revogou o certificado (OCSP).
    // O ID do app só é exigido (e conferido) em produção.
    v = new SignedDataVerifier(RAIZES_APPLE, true, amb, BUNDLE_ID, amb === Environment.PRODUCTION ? APP_APPLE_ID : undefined);
    verificadores.set(amb, v);
  }
  return v;
}

export function ambienteDe(s: string | null | undefined): Ambiente {
  return s === Environment.SANDBOX ? Environment.SANDBOX : Environment.PRODUCTION;
}

/**
 * Confere um comprovante assinado vindo de quem quer que seja, nos dois
 * ambientes. Devolve o primeiro que validar.
 */
async function emQualquerAmbiente<T>(conferir: (v: SignedDataVerifier) => Promise<T>): Promise<{ valor: T; ambiente: Ambiente }> {
  let ultimo: unknown = null;
  for (const amb of AMBIENTES) {
    try {
      return { valor: await conferir(verificador(amb)), ambiente: amb };
    } catch (e) {
      ultimo = e;
      // Ambiente errado → tenta o outro. Qualquer outra falha é a resposta.
      if (!(e instanceof VerificationException && e.status === VerificationStatus.INVALID_ENVIRONMENT)) break;
    }
  }
  if (ultimo instanceof VerificationException) {
    const temporaria = ultimo.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;
    throw new ErroApple(`comprovante não confere (${VerificationStatus[ultimo.status] ?? ultimo.status})`, !temporaria);
  }
  throw new ErroApple(`comprovante não confere (${ultimo instanceof Error ? ultimo.message : 'erro'})`, false);
}

/** O JWS que o app recebeu da Apple (`jwsRepresentation`) → transação conferida. */
export async function conferirTransacao(jws: string): Promise<{ tx: TransacaoApple; ambiente: Ambiente }> {
  const { valor, ambiente } = await emQualquerAmbiente((v) => v.verifyAndDecodeTransaction(jws));
  return { tx: valor as TransacaoApple, ambiente };
}

/** O aviso automático da App Store (Server Notifications V2) → conteúdo conferido. */
export async function conferirAviso(signedPayload: string) {
  const { valor, ambiente } = await emQualquerAmbiente((v) => v.verifyAndDecodeNotification(signedPayload));
  return { aviso: valor, ambiente };
}

export type StatusLido = { status: number | null; tx: TransacaoApple; renov: RenovacaoApple | null };

/**
 * O estado ATUAL das assinaturas ligadas a esta transação, lido na Apple.
 *
 * ⚠️ É ESTA leitura que decide o plano — nunca o comprovante do app nem o
 * aviso sozinhos. Eles só dizem "olhe esta assinatura".
 */
export async function statusDasAssinaturas(transacaoId: string, ambiente: Ambiente): Promise<StatusLido[]> {
  let resp;
  try {
    resp = await cliente(ambiente).getAllSubscriptionStatuses(transacaoId);
  } catch (e) {
    if (e instanceof APIException) {
      // 4xx = comprovante que não existe nesse ambiente/app: não adianta repetir.
      const definitivo = e.httpStatusCode >= 400 && e.httpStatusCode < 500 && e.httpStatusCode !== 429 && e.httpStatusCode !== 401;
      throw new ErroApple(`App Store ${e.httpStatusCode}${e.apiError ? ` (${e.apiError})` : ''}: ${e.errorMessage || ''}`.trim(), definitivo);
    }
    throw new ErroApple(e instanceof Error ? e.message : 'erro ao falar com a App Store', false);
  }
  const v = verificador(ambiente);
  const saida: StatusLido[] = [];
  for (const grupo of resp.data || []) {
    for (const ult of grupo.lastTransactions || []) {
      if (!ult.signedTransactionInfo) continue;
      const tx = (await v.verifyAndDecodeTransaction(ult.signedTransactionInfo)) as TransacaoApple;
      const renov = ult.signedRenewalInfo ? (await v.verifyAndDecodeRenewalInfo(ult.signedRenewalInfo)) as RenovacaoApple : null;
      saida.push({ status: ult.status ?? null, tx, renov });
    }
  }
  return saida;
}
