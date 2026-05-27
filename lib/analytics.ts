// Helpers pra disparar eventos do Meta Pixel nos pontos-chave.
// Uso: import { trackLead } from '@/lib/analytics'; trackLead();

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function fbq(...args: unknown[]) {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq(...args);
  }
}

export function trackPageView() {
  fbq('track', 'PageView');
}

export function trackLead() {
  fbq('track', 'Lead');
}

export function trackInitiateCheckout(params?: { value?: number; currency?: string }) {
  fbq('track', 'InitiateCheckout', {
    value: params?.value,
    currency: params?.currency || 'BRL',
  });
}

export function trackPurchase(params: { value: number; currency?: string }) {
  fbq('track', 'Purchase', {
    value: params.value,
    currency: params.currency || 'BRL',
  });
}

export function trackSignUp() {
  fbq('track', 'CompleteRegistration');
}

export function trackCustom(event: string, data?: Record<string, unknown>) {
  fbq('trackCustom', event, data);
}
