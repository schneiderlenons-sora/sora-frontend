import { ImageResponse } from 'next/og';

// Convenção do Next.js App Router: este arquivo gera a OG image automaticamente em /opengraph-image
export const alt     = 'Sora — Sua assistente financeira pelo WhatsApp';
export const size    = { width: 1200, height: 630 };
export const contentType = 'image/png';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://forsora.com';

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #050d07 0%, #0e2a17 45%, #1a5e2b 100%)',
          position: 'relative',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Halo verde grande no canto superior-direito */}
        <div
          style={{
            position: 'absolute',
            top: -260,
            right: -260,
            width: 760,
            height: 760,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(97, 209, 123, 0.55) 0%, transparent 70%)',
            display: 'flex',
          }}
        />
        {/* Halo verde menor no canto inferior-esquerdo */}
        <div
          style={{
            position: 'absolute',
            bottom: -200,
            left: -200,
            width: 560,
            height: 560,
            borderRadius: 999,
            background: 'radial-gradient(circle, rgba(97, 209, 123, 0.28) 0%, transparent 70%)',
            display: 'flex',
          }}
        />

        {/* Conteúdo principal — duas colunas */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 70,
            padding: '0 90px',
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Avatar da orca (quadrado com cantos arredondados) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 300,
              height: 300,
              borderRadius: 66,
              background: 'linear-gradient(135deg, #5BC571 0%, #3DAA5C 100%)',
              boxShadow:
                '0 30px 80px rgba(97, 209, 123, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset',
              flexShrink: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${SITE_URL}/sora-icon.png`}
              alt="Sora"
              width={280}
              height={280}
              style={{ borderRadius: 56, display: 'flex' }}
            />
          </div>

          {/* Texto à direita */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
            }}
          >
            {/* Mini badge "ASSISTENTE FINANCEIRA" */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                color: '#61D17B',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                marginBottom: 18,
              }}
            >
              <span
                style={{
                  display: 'flex',
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: '#61D17B',
                  boxShadow: '0 0 16px #61D17B',
                }}
              />
              Sora
            </div>

            {/* Headline em 2 linhas */}
            <div
              style={{
                color: 'white',
                fontSize: 78,
                fontWeight: 800,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <span style={{ display: 'flex' }}>Sua vida financeira</span>
              <span style={{ display: 'flex', color: '#61D17B' }}>pelo WhatsApp.</span>
            </div>

            {/* Tagline */}
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 26,
                lineHeight: 1.4,
                marginTop: 22,
                maxWidth: 620,
                display: 'flex',
              }}
            >
              Controle gastos, investimentos e metas — só mandando mensagem.
            </div>

            {/* Pills de features */}
            <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
              {[
                '💬 WhatsApp Bot',
                '📊 Painel Web',
                '📱 App Mobile',
              ].map(label => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px 20px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.14)',
                    borderRadius: 99,
                    color: 'rgba(255, 255, 255, 0.92)',
                    fontSize: 20,
                    fontWeight: 600,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            left: 90,
            right: 90,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: 'rgba(255, 255, 255, 0.45)',
            fontSize: 18,
            fontWeight: 500,
          }}
        >
          <span style={{ display: 'flex' }}>sora.app</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'flex',
                width: 6,
                height: 6,
                borderRadius: 99,
                background: '#61D17B',
              }}
            />
            Grátis pra começar
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
