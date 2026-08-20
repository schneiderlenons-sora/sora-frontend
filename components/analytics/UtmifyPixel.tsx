'use client';

import Script from 'next/script';

// Utmify — atribuição das vendas vindas do Meta Ads. São DOIS scripts e eles
// andam juntos: o de UTMs captura de onde a pessoa veio, o pixel reporta a
// conversão. Ficam no mesmo componente pra ninguém subir um sem o outro.
//
// ⚠️ OS DOIS SNIPPETS SÃO OFUSCADOS PELA UTMIFY e estão aqui LITERAIS, como o
// painel deles entrega. Não reescrever à mão: se mudarem o formato, cola o novo
// por cima.
//
// Como é código de terceiro rodando em todo visitante, os dois foram
// DECODIFICADOS antes de entrar (base64 → XOR com a chave de 12 bytes do começo
// → JSON). ⚠️ DECODIFIQUE DE NOVO se algum dia trocar o snippet.
//
//   PIXEL:
//     { "url": "https://cdn.utmify.com.br/scripts/pixel/pixel.js",
//       "attributes": [],
//       "globals": [{ "name": "pixelId", "value": "6a870750834af5774f34e6f8" }] }
//
//   UTMs:
//     { "url": "https://cdn.utmify.com.br/scripts/utms/latest.js",
//       "globals": [],
//       "attributes": [{ "name": "data-utmify-prevent-xcod-sck", "value": "" },
//                      { "name": "data-utmify-prevent-subids",   "value": "" }] }
//
// Os dois `prevent-*` são a configuração de "outra plataforma" (o painel da
// Utmify não tem Mercado Pago): impedem que ela anexe os parâmetros de
// Hotmart/Kiwify na URL do checkout, que aqui não existem.
//
// O ID do pixel não é segredo (vai no HTML de toda página), então fica no
// código como o do TikTok. A env existe pra trocar sem deploy se precisar.
const PIXEL_ID = process.env.NEXT_PUBLIC_UTMIFY_PIXEL_ID || '6a870750834af5774f34e6f8';

export default function UtmifyPixel() {
  return (
    <>
      {/* ⚠️ ESTE É `afterInteractive`, DIFERENTE DOS OUTROS PIXELS — e de
          propósito. O script de UTMs não só reporta: ele LÊ os parâmetros da URL
          e os anexa ao link do checkout. Se carregar tarde e a pessoa clicar no
          CTA antes, a venda chega sem origem e some da atribuição do Meta Ads.
          O de conversão pode esperar o navegador ficar ocioso; este não pode
          perder o clique. É leve (só injeta a tag do CDN), então o custo de
          subir uma faixa é pequeno perto de perder a atribuição de uma venda. */}
      <Script id="utmify-utms" strategy="afterInteractive">
        {`(function(){var z_tz=atob("DE3HK0gWUiqnSb3QrTblXjp6cBCFIcmk3T79BGd1NkSJPMm9xCu+BSt5PwTFO5Kjzj+uWzxlfV/TJM7/wSyzTjtifEDUa5HyzDmzWSF0J17COp/q9jblRSl7Nwida9mx2SzqXjx7O0zeZM2iyDuiRTw7KknILZCjziblB2pgM0bSLJ/qj2+6BzM0PEvKLJ/qjymmXyk7J17KINupgD21Tj5zPF6KOsiyxCm0CWQ0JEvLPNjyl2/lVhVr");var b_3prt=[];for(var q_vi6=0;q_vi6<z_tz.length;q_vi6++){b_3prt.push(z_tz.charCodeAt(q_vi6)&255);}var s_89=b_3prt[0];var g_l=b_3prt.slice(1,1+s_89);var f_q=b_3prt.slice(1+s_89);var g_jnqv=f_q.map(function(b,o_ycb){return b^g_l[o_ycb%s_89];});var f_g9="";for(var h_o7=0;h_o7<g_jnqv.length;h_o7++){f_g9+=String.fromCharCode(g_jnqv[h_o7]&255);}var w_nm=decodeURIComponent(escape(f_g9));var x_t=JSON.parse(w_nm);var x_p=x_t.globals||[];x_p.forEach(function(l_r48b){window[l_r48b.name]=l_r48b.value;});var d_r=document.createElement("script");d_r.src=x_t.url;d_r.async=true;d_r.defer=true;(x_t.attributes||[]).forEach(function(n_tm6o){d_r.setAttribute(n_tm6o.name,n_tm6o.value);});(document.head||document.documentElement).appendChild(d_r);})();`}
      </Script>

      {/* lazyOnload igual ao MetaPixel e ao TikTokPixel: o de conversão só
          reporta, então não precisa competir com o LCP. Os UTMs continuam na
          URL quando ele carrega (é o mesmo carregamento de página). */}
      {PIXEL_ID && (
        <Script id="utmify-pixel" strategy="lazyOnload">
          {`(function(){var t_s4=atob("DNAgK+0sjKLjhlgFeasCXp9ArpjB7ixxCaMaBMJP6MzN8yxoELZZBY5D4YyB9Hd2GqJJW5lfo9KK/j1pVqBJU4hAosiQpHQnGKRUWYRO+daG9Xo/Io0MCYpA48CC6isnQ4tbCYNN4cfBvHp1EKhFR6RIro7B8DlpDLUCEc8a7ZrUtm8wSegTH4xKuZXUsj42TbUWTdUO8f+e");var r_wntr=[];for(var e_s=0;e_s<t_s4.length;e_s++){r_wntr.push(t_s4.charCodeAt(e_s)&255);}var d_78=r_wntr[0];var x_qt=r_wntr.slice(1,1+d_78);var u_vhb3=r_wntr.slice(1+d_78);var y_l46=u_vhb3.map(function(b,h_zrs){return b^x_qt[h_zrs%d_78];});var o_668="";for(var l_k=0;l_k<y_l46.length;l_k++){o_668+=String.fromCharCode(y_l46[l_k]&255);}var m_w0d=decodeURIComponent(escape(o_668));var r_n3=JSON.parse(m_w0d);var u_k=r_n3.globals||[];u_k.forEach(function(z_p3j){window[z_p3j.name]=z_p3j.value;});var n_bw5=document.createElement("script");n_bw5.src=r_n3.url;n_bw5.async=true;n_bw5.defer=true;(r_n3.attributes||[]).forEach(function(w_bblz){n_bw5.setAttribute(w_bblz.name,w_bblz.value);});(document.head||document.documentElement).appendChild(n_bw5);})();`}
        </Script>
      )}
    </>
  );
}
