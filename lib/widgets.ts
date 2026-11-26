// =============================================================================
// WIDGETS DO CELULAR — o lado do site (fase 2, nov/2026).
//
// Os widgets moram no app (iPhone: alvo SoraWidgets; Android: android-widgets/).
// O site só CONECTA o aparelho à conta: pede ao servidor um código de uso único
// (`POST /api/widget/codigo`) e o entrega ao app, que o troca pela chave do
// widget e a guarda no aparelho.
//   · iPhone: plugin nativo `SoraWidget` pela ponte do Capacitor (sem pacote JS,
//     como lib/apple-compras.ts).
//   · Android: link `intent://` que abre a tela nativa de conexão do app (o app
//     é uma TWA e não tem ponte JS).
//
// ⚠️ ESPELHO de sora-backend/src/config/widgets.js (lista de teste e "aberto").
// Abrir pra todos = `WIDGETS_ABERTO = true` aqui + `WIDGETS_ABERTOS=1` no Render.
// =============================================================================

export const EMAILS_TESTE_WIDGETS = [
  'schneider.lenon.s@gmail.com',
  'schineiderlenon@gmail.com',
  'comercialsora@gmail.com',
];

export const WIDGETS_ABERTO = false;

/** O item "Widgets" aparece no menu desta pessoa? (o plano é conferido pelo servidor) */
export function podeVerWidgets(email?: string | null): boolean {
  if (WIDGETS_ABERTO) return true;
  return EMAILS_TESTE_WIDGETS.includes((email || '').trim().toLowerCase());
}

export type AcessoWidget = { ok: boolean; motivo?: 'desligado' | 'teste' | 'plano' };
export type AparelhoWidget = {
  id: string; plataforma: 'ios' | 'android'; aparelho: string | null;
  criado_em: string; ultimo_uso_em: string | null;
};
export type EstadoWidgets = { acesso: AcessoWidget; aparelhos: AparelhoWidget[]; liberando?: boolean };

// ── iPhone: plugin SoraWidget ───────────────────────────────────────────────
type PonteCapacitor = {
  nativePromise?: (plugin: string, metodo: string, opcoes?: Record<string, unknown>) => Promise<unknown>;
  getPlatform?: () => string;
  isPluginAvailable?: (nome: string) => boolean;
};
function ponte(): PonteCapacitor | null {
  if (typeof window === 'undefined') return null;
  return ((window as unknown as { Capacitor?: PonteCapacitor }).Capacitor) ?? null;
}

/** Este app de iPhone já tem o plugin dos widgets? (o 1.2.0 sem ele não tem) */
export function widgetIosDisponivel(): boolean {
  const c = ponte();
  return !!c && typeof c.nativePromise === 'function' && c.getPlatform?.() === 'ios'
    && (c.isPluginAvailable ? c.isPluginAvailable('SoraWidget') : false);
}

/** Entrega o código ao app; ele troca pela chave, guarda e atualiza os widgets. */
export async function conectarNoIphone(codigo: string, api: string): Promise<void> {
  const c = ponte();
  if (!c?.nativePromise) throw new Error('Atualize o app ForSora para conectar os widgets.');
  await c.nativePromise('SoraWidget', 'conectar', { codigo, api });
}

// ── Android: tela nativa de conexão, aberta por intent:// ───────────────────
/**
 * Link que abre a `WidgetConexaoActivity` do app (android-widgets/). O
 * `package` garante que só o NOSSO app abre — nunca outro que diga entender
 * `forsora://`.
 */
export function linkConexaoAndroid(codigo: string, api: string): string {
  const q = `codigo=${encodeURIComponent(codigo)}&api=${encodeURIComponent(api)}`;
  return `intent://widget/conectar?${q}#Intent;scheme=forsora;package=com.forsora.app;end`;
}
