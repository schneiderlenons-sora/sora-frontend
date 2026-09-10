// ─────────────────────────────────────────────────────────────────────────────
// "De que dispositivo esta sessão está acessando?" — SÓ pra estatística do
// /admin (o pedido foi literalmente "não sei quem é usuário Android e quem é
// Apple"). NUNCA usar isto pra gate de feature ou de Play Billing: aquele
// sinal já existe, é mais estreito e já foi testado — `lib/origem-app.ts`
// (`ehAndroid`). Misturar os dois arriscaria os dois propósitos por engano.
// ─────────────────────────────────────────────────────────────────────────────

import { ehAndroid } from './origem-app';

export type Plataforma = 'android_app' | 'android_web' | 'ios_pwa' | 'ios_web' | 'desktop' | 'outro';

export function detectarPlataforma(): Plataforma {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'outro';

  const ua = navigator.userAgent || '';

  // ⚠️ iPadOS 13+ se disfarça de "Macintosh" no User-Agent (modo desktop por
  // padrão) — só o toque multiponto denuncia que é um iPad. Sem isso, todo
  // iPad recente cairia em 'desktop'.
  const ehIOS = /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints! > 1);

  if (ehIOS) {
    // `navigator.standalone` só existe no Safari/iOS: true quando a pessoa
    // usa via "Adicionar à Tela de Início" (o equivalente iOS de instalar).
    const standalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    return standalone ? 'ios_pwa' : 'ios_web';
  }

  if (/Android/.test(ua)) return ehAndroid() ? 'android_app' : 'android_web';

  // Outro celular/tablet (raríssimo na base) não vira 'desktop' por engano.
  if (/Mobi|Tablet/.test(ua)) return 'outro';

  return 'desktop';
}
