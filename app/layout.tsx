import type { Metadata, Viewport } from 'next';
import { Inter, Pacifico } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { HTML_LANG, normalizeLocale, type Locale } from '@/i18n/request';
import './globals.css';
import Providers from '@/components/providers';
import InstallPwa from '@/components/pwa/InstallPwa';
import MetaPixel from '@/components/analytics/MetaPixel';
import TikTokPixel from '@/components/analytics/TikTokPixel';
import UtmifyPixel from '@/components/analytics/UtmifyPixel';

// `variable` (e não só className) porque o globals.css referencia a família por
// var(--font-inter). Antes o CSS pedia 'Inter' pelo NOME, que só existia via
// @import do Google Fonts — ou seja, o next/font estava ali sem efeito e a
// fonte vinha de uma requisição que bloqueava o render.
const inter    = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
// Pacifico — script cursivo encorpado, estilo wordmark de marca (Pierre, Disney+, etc)
const pacifico = Pacifico({ subsets: ['latin'], weight: ['400'], variable: '--font-brand', display: 'swap' });

// Metadata locale-aware: título/descrição, og:locale e os alternates hreflang
// (pt-BR na raiz, es-MX em /es) mudam conforme o idioma resolvido no middleware.
export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale(await getLocale()) as Locale;
  const es = locale === 'es';

  const title = es ? 'Sora — Asistente Financiera' : 'Sora — Assistente Financeira';
  const description = es
    ? 'Organiza tu vida financiera desde WhatsApp. Controla gastos, inversiones y metas en un solo lugar.'
    : 'Organize sua vida financeira pelo WhatsApp. Controle gastos, investimentos e metas em um só lugar.';
  const ogTitle = es ? 'Sora — Tu vida financiera desde WhatsApp' : 'Sora — Sua vida financeira pelo WhatsApp';
  const ogDesc = es
    ? 'Controla gastos, inversiones y metas — solo mandándole un mensaje a Sora.'
    : 'Controle gastos, investimentos e metas — só mandando mensagem pra Sora.';

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://forsora.com'),
    title,
    description,
    manifest: '/manifest.json',
    applicationName: 'Sora',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'Sora',
    },
    formatDetection: {
      telephone: false,
    },
    alternates: {
      canonical: es ? '/es' : '/',
      languages: {
        'pt-BR': '/',
        'es-MX': '/es',
        'x-default': '/',
      },
    },
    icons: {
      icon: '/brands/sora.png',
      // apple-touch-icon (ícone da PWA no iOS) precisa ser FULL-BLEED — o verde
      // cobre o quadrado todo. O /brands/sora.png é um círculo com fundo
      // transparente → o iOS mostrava os cantos como borda branca.
      apple: '/sora-icon.png',
      shortcut: '/brands/sora.png',
    },
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      type: 'website',
      locale: es ? 'es_MX' : 'pt_BR',
      alternateLocale: es ? 'pt_BR' : 'es_MX',
      siteName: 'Sora',
      // images é auto-injetado pelo Next a partir de app/opengraph-image.tsx
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDesc,
      // images é auto-injetado pelo Next a partir de app/twitter-image.tsx
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Painel estático no mobile (pedido do usuário): sem pinch-zoom nem auto-zoom
  // ao focar campo. Trade-off de acessibilidade assumido conscientemente.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)',  color: '#09090B' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = normalizeLocale(await getLocale()) as Locale;
  const messages = await getMessages();

  return (
    <html lang={HTML_LANG[locale]} suppressHydrationWarning className={`${pacifico.variable} ${inter.variable}`}>
      <head>
        {/* Abre a conexão com o backend (DNS + TLS) enquanto o JS ainda carrega.
            A chamada que o LCP espera só sai depois da hidratação (~1,4s) e
            pagava o handshake inteiro ali, com a rede já congestionada. */}
        {process.env.NEXT_PUBLIC_API_URL && (
          <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL} crossOrigin="anonymous" />
        )}

        {/* ═══ ABERTURA DA SORA — a DECISÃO, antes do primeiro paint ═══
            ⚠️ ISTO PRECISA RODAR NO <head>, e não num efeito do React. Montar o
            overlay depois da hidratação faz o painel aparecer ANTES da
            animação — que foi exatamente o defeito da primeira versão. Aqui o
            atributo já está no <html> quando o <body> começa a pintar, então a
            primeira coisa desenhada na tela é a abertura.
            Mesmo padrão do script de cor do tema, logo abaixo. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
var p=location.pathname,pub=['/','/login','/signup','/recuperar-senha','/redefinir-senha','/oferta','/kit','/checkout-vitalicio','/es'];
for(var i=0;i<pub.length;i++){if(p===pub[i]||p.indexOf(pub[i]+'/')===0)return;}
if(sessionStorage.getItem('sora-abertura-vista')==='1')return;
if(!matchMedia('(max-width:767px)').matches)return;
if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
if(!document.createElement('video').canPlayType('video/webm; codecs="vp9"'))return;
sessionStorage.setItem('sora-abertura-vista','1');
document.documentElement.setAttribute('data-abertura','on');
}catch(e){}})();` }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* ═══ ABERTURA DA SORA — o overlay ═══
            PRIMEIRO filho do <body>: é o primeiro pixel que o navegador pinta.
            Fica invisível por CSS até `html[data-abertura="on"]` existir, e o
            script do <head> já decidiu isso — então nunca há um quadro sequer
            de painel antes da animação.
            ⚠️ O <video> NÃO está no HTML: ele é criado pelo script abaixo, e só
            quando a abertura vai mesmo acontecer. No HTML, `preload` baixaria
            os 242 KB até em desktop, onde a animação nem toca. */}
        <div id="sora-abertura" aria-hidden="true" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
if(document.documentElement.getAttribute('data-abertura')!=='on')return;
var box=document.getElementById('sora-abertura');if(!box)return;
var v=document.createElement('video');
/* ⚠️ A ORDEM AQUI É O QUE FAZ O AUTOPLAY FUNCIONAR. O navegador avalia a
   política de autoplay quando a FONTE é atribuída — se 'muted' e 'playsinline'
   ainda não estiverem no elemento nesse instante, ele bloqueia. Por isso o
   'src' vem POR ÚLTIMO. (Na 1ª versão ele vinha primeiro: o vídeo era barrado,
   o play() rejeitava e a tela sumia depois de um frame.) */
v.muted=true;v.defaultMuted=true;v.setAttribute('muted','');
v.playsInline=true;v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');
v.setAttribute('autoplay','');v.autoplay=true;
v.preload='auto';
v.src='/abertura/sora-intro.webm';
box.appendChild(v);

var comecou=false,fim=function(){
  if(!box||box.dataset.saindo)return;box.dataset.saindo='1';
  box.style.opacity='0';
  setTimeout(function(){document.documentElement.removeAttribute('data-abertura');},420);
};
v.addEventListener('playing',function(){comecou=true;});
v.addEventListener('ended',fim);
v.addEventListener('error',fim);

/* ⚠️ NÃO ENCERRAR NO CATCH DO play(). Com 'autoplay' já no elemento, esta
   chamada é redundante e o navegador rejeita a promessa com AbortError ("play()
   request was interrupted") JUSTAMENTE QUANDO O VÍDEO COMEÇOU A TOCAR. Ligar
   'fim' nela matava a animação no primeiro frame — era o bug relatado. Só
   desiste se o vídeo estiver DE FATO parado. */
var pr=v.play();
if(pr&&pr.catch)pr.catch(function(){if(v.paused&&!comecou)fim();});

/* Não começou em 2s? Então não vai começar — não segura a tela. */
setTimeout(function(){if(!comecou)fim();},2000);

/* ⚠️ TETO ABSOLUTO. 'ended' nunca dispara se o arquivo travar no meio, e rede
   ruim no celular é regra, não exceção. A abertura JAMAIS pode virar um app que
   não abre. 5,02s de vídeo + margem. */
setTimeout(fim,8000);
}catch(e){try{document.documentElement.removeAttribute('data-abertura');}catch(_){}}}
)();` }} />

        {/* Cor temática escolhida — aplica --primary antes do paint (anti-flash) */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var m={verde:'134 55% 60%',azul:'217 91% 60%',roxo:'262 83% 58%',laranja:'25 95% 53%',rosa:'330 81% 60%',vermelho:'0 72% 55%'};var id=localStorage.getItem('sora-brand')||'verde';document.documentElement.style.setProperty('--primary',m[id]||m.verde);}catch(e){}})();` }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <MetaPixel />
            <TikTokPixel />
            <UtmifyPixel />
            <InstallPwa>
              {children}
            </InstallPwa>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
