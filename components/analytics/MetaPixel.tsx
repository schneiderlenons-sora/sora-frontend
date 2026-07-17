'use client';

import Script from 'next/script';

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

export default function MetaPixel() {
  if (!PIXEL_ID) return null;

  return (
    <>
      {/* lazyOnload (e não afterInteractive): medido no dashboard, o
          fbevents.js (103 KB de terceiro) começava a baixar em 755ms — ANTES da
          /api/dashboard (1395ms), que é quem o LCP espera. Analytics não pode
          competir com o conteúdo. Com lazyOnload o PageView continua disparando,
          só que quando o navegador fica ocioso. */}
      <Script id="fb-pixel" strategy="lazyOnload">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window, document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
