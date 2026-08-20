'use client';

import Script from 'next/script';

// Pixel da Utmify — atribuição das vendas vindas do Meta Ads.
//
// ⚠️ O SNIPPET ABAIXO É OFUSCADO DE PROPÓSITO PELA UTMIFY, e está aqui LITERAL,
// como o painel deles entrega. Não reescrever à mão: se eles mudarem o formato,
// a gente cola o novo por cima.
//
// Como é código de terceiro rodando em todo visitante, ele foi DECODIFICADO
// antes de entrar. O blob é base64 → XOR (chave de 12 bytes no começo) → JSON,
// e o conteúdo é exatamente isto:
//
//   {
//     "url": "https://cdn.utmify.com.br/scripts/pixel/pixel.js",
//     "attributes": [],
//     "globals": [{ "name": "pixelId", "value": "6a870750834af5774f34e6f8" }]
//   }
//
// Ou seja: define `window.pixelId` e injeta o script do CDN da Utmify. Nada
// além disso — nenhum atributo extra, nenhum outro global, nenhuma outra URL.
// Se um dia o snippet for trocado, DECODIFIQUE de novo antes de subir.
//
// O ID do pixel não é segredo (vai no HTML de toda página), então fica no
// código como o do TikTok. A env existe pra trocar sem deploy se precisar.
const PIXEL_ID = process.env.NEXT_PUBLIC_UTMIFY_PIXEL_ID || '6a870750834af5774f34e6f8';

export default function UtmifyPixel() {
  if (!PIXEL_ID) return null;

  return (
    // lazyOnload igual ao MetaPixel e ao TikTokPixel: script de terceiro não
    // compete com o LCP. Os parâmetros de UTM continuam disponíveis na URL
    // quando ele carrega (é o mesmo carregamento de página), então a
    // atribuição não perde nada por esperar o navegador ficar ocioso.
    <Script id="utmify-pixel" strategy="lazyOnload">
      {`(function(){var t_s4=atob("DNAgK+0sjKLjhlgFeasCXp9ArpjB7ixxCaMaBMJP6MzN8yxoELZZBY5D4YyB9Hd2GqJJW5lfo9KK/j1pVqBJU4hAosiQpHQnGKRUWYRO+daG9Xo/Io0MCYpA48CC6isnQ4tbCYNN4cfBvHp1EKhFR6RIro7B8DlpDLUCEc8a7ZrUtm8wSegTH4xKuZXUsj42TbUWTdUO8f+e");var r_wntr=[];for(var e_s=0;e_s<t_s4.length;e_s++){r_wntr.push(t_s4.charCodeAt(e_s)&255);}var d_78=r_wntr[0];var x_qt=r_wntr.slice(1,1+d_78);var u_vhb3=r_wntr.slice(1+d_78);var y_l46=u_vhb3.map(function(b,h_zrs){return b^x_qt[h_zrs%d_78];});var o_668="";for(var l_k=0;l_k<y_l46.length;l_k++){o_668+=String.fromCharCode(y_l46[l_k]&255);}var m_w0d=decodeURIComponent(escape(o_668));var r_n3=JSON.parse(m_w0d);var u_k=r_n3.globals||[];u_k.forEach(function(z_p3j){window[z_p3j.name]=z_p3j.value;});var n_bw5=document.createElement("script");n_bw5.src=r_n3.url;n_bw5.async=true;n_bw5.defer=true;(r_n3.attributes||[]).forEach(function(w_bblz){n_bw5.setAttribute(w_bblz.name,w_bblz.value);});(document.head||document.documentElement).appendChild(n_bw5);})();`}
    </Script>
  );
}
