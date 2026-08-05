'use client';

import Script from 'next/script';

const PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID;

export default function TikTokPixel() {
  if (!PIXEL_ID) return null;

  return (
    // lazyOnload igual o MetaPixel (components/analytics/MetaPixel.tsx): o
    // script de terceiro não pode competir com o LCP da página. `ttq.page()`
    // dispara o PageView sozinho quando o script carrega — igual o
    // fbq('track','PageView') do Meta.
    <Script id="tiktok-pixel" strategy="lazyOnload">
      {`
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<e.methods.length;n++)ttq.setAndDefer(e,e.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=i+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};

          ttq.load('${PIXEL_ID}');
          ttq.page();
        }(window, document, 'ttq');

        // Ao contrário do fbclid (que o próprio fbevents.js grava no cookie
        // _fbc sozinho), o TikTok NÃO persiste o ttclid da URL — é preciso
        // guardar na mão pra usar depois no Events API (server-side).
        // Válido 7 dias (mesma janela de clique que o TikTok usa pra atribuir).
        (function () {
          var m = window.location.search.match(/[?&]ttclid=([^&]+)/);
          if (m) {
            document.cookie = 'ttclid=' + m[1] + ';max-age=' + (7 * 24 * 60 * 60) + ';path=/;SameSite=Lax';
          }
        })();
      `}
    </Script>
  );
}
