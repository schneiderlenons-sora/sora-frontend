'use client';

import { useEffect, useRef, useState } from 'react';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || '';
export const MP_SDK_SRC = 'https://sdk.mercadopago.com/js/v2';
export const MP_SDK_ID = 'mp-sdk';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare global { interface Window { MercadoPago?: any; MP_DEVICE_SESSION_ID?: string } }

// O SDK V2 já é injetado cedo pelo <Script> da página de checkout (ver
// checkout-vitalicio/page.tsx). Aqui só ESPERAMOS ele ficar pronto — e ainda
// injetamos como plano B se o componente for usado fora daquela página.
//
// ⚠️ A versão antiga fazia `existente.addEventListener('load')` quando a tag já
// existia: se o script JÁ tivesse carregado, o evento nunca mais dispara e a
// promise ficava pendurada pra sempre — checkout preso em "Carregando…".
// Por isso agora é poll no `window.MercadoPago`, que é a única prova real.
function carregarSdk(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MercadoPago) return resolve();

    if (!document.getElementById(MP_SDK_ID)) {
      const s = document.createElement('script');
      s.id = MP_SDK_ID;
      s.src = MP_SDK_SRC;
      s.async = true;
      document.body.appendChild(s);
    }

    const inicio = Date.now();
    const tick = () => {
      if (window.MercadoPago) return resolve();
      if (Date.now() - inicio > timeoutMs) return reject(new Error('Falha ao carregar o Mercado Pago'));
      setTimeout(tick, 60);
    };
    tick();
  });
}

// Fingerprint do dispositivo. O SDK V2 gera `MP_DEVICE_SESSION_ID` sozinho, mas
// leva um instante — e ele é o sinal nº 1 do antifraude do MP no Checkout
// Transparente: sem ele a recusa vem como "não passou nos controles de
// segurança" (cc_rejected_high_risk). Esperar até ~4s antes de enviar custa
// nada e evita recusa boba. Se não vier, segue mesmo assim (melhor tentar
// cobrar sem o device id do que travar a venda).
function esperarDeviceId(timeoutMs = 4000): Promise<string | undefined> {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const tick = () => {
      if (window.MP_DEVICE_SESSION_ID) return resolve(window.MP_DEVICE_SESSION_ID);
      if (Date.now() - inicio > timeoutMs) return resolve(undefined);
      setTimeout(tick, 80);
    };
    tick();
  });
}

// Checkout Transparente do Mercado Pago (Payment Brick): cartão com parcelamento
// (até 12x, o MP já mostra "12x de R$X") + Pix, tudo dentro da página.
export default function MercadoPagoBrick({
  amount = 97, tier = 'completa', cupom, email, onApproved,
}: {
  amount?: number; tier?: string; cupom?: string | null; email?: string | null; onApproved: () => void;
}) {
  const [erro, setErro] = useState('');
  const [pix, setPix] = useState<{ qr_code: string; qr_code_base64?: string } | null>(null);
  const [carregando, setCarregando] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controllerRef = useRef<any>(null);
  const onApprovedRef = useRef(onApproved);
  useEffect(() => { onApprovedRef.current = onApproved; }, [onApproved]);
  // cupom lido por ref no onSubmit — sempre o atual, sem recriar o brick.
  const cupomRef = useRef(cupom);
  useEffect(() => { cupomRef.current = cupom; }, [cupom]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if (!PUBLIC_KEY) { setErro('Mercado Pago não configurado (NEXT_PUBLIC_MP_PUBLIC_KEY).'); setCarregando(false); return; }
        await carregarSdk();
        if (cancel) return;
        const mp = new window.MercadoPago(PUBLIC_KEY, { locale: 'pt-BR' });
        controllerRef.current = await mp.bricks().create('payment', 'mp-brick', {
          initialization: {
            amount,
            // Prefill do pagador: menos campo pra digitar e mais dado pro
            // antifraude. Só entra se a gente já souber o e-mail.
            ...(email ? { payer: { email } } : {}),
          },
          customization: {
            paymentMethods: { creditCard: 'all', debitCard: 'all', bankTransfer: 'all', maxInstallments: 12 },
          },
          callbacks: {
            onReady: () => { if (!cancel) setCarregando(false); },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onError: (e: any) => { console.error('[mp-brick]', e); if (!cancel) setErro('Erro no formulário de pagamento.'); },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSubmit: async ({ formData }: any) => {
              // Garante o fingerprint ANTES de mandar (ver esperarDeviceId).
              const deviceId = await esperarDeviceId();
              try {
                const res = await fetch('/api/mercadopago/process', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...formData, tier, cupom: cupomRef.current, deviceId }),
                }).then((r) => r.json());

                if (res.erro) { setErro(res.erro); return; }
                if (res.status === 'approved') { onApprovedRef.current(); return; }
                if (res.pix) { setPix(res.pix); return; }
                if (res.status === 'pending' || res.status === 'in_process') {
                  setErro('Pagamento em processamento. Assim que confirmar, seu acesso é liberado.');
                  return;
                }
                setErro('Pagamento não aprovado. Tente outro cartão ou método.');
              } catch {
                setErro('Falha de conexão ao processar o pagamento.');
              }
            },
          },
        });
      } catch (e) {
        if (!cancel) { setErro(e instanceof Error ? e.message : 'Erro ao iniciar o checkout.'); setCarregando(false); }
      }
    })();
    return () => { cancel = true; try { controllerRef.current?.unmount?.(); } catch { /* noop */ } };
  }, [amount, tier, email]);

  if (pix) {
    return (
      <div className="text-center space-y-3">
        <p className="font-semibold text-foreground">Pague com Pix pra liberar na hora</p>
        {pix.qr_code_base64 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/png;base64,${pix.qr_code_base64}`} alt="QR Code Pix" className="mx-auto w-56 h-56 rounded-lg" />
        )}
        <textarea readOnly value={pix.qr_code} rows={3}
          className="w-full text-xs p-2 rounded-lg border border-border bg-muted/50 font-mono"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
        <p className="text-xs text-muted-foreground">Copie o código ou escaneie o QR. Assim que o Pix for confirmado, seu acesso vitalício é ativado automaticamente.</p>
      </div>
    );
  }

  return (
    <div>
      {carregando && <p className="text-sm text-muted-foreground mb-3">Carregando o checkout seguro…</p>}
      <div id="mp-brick" />
      {erro && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}
