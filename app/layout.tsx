import type { Metadata, Viewport } from 'next';
import { Inter, Pacifico } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { HTML_LANG, normalizeLocale, type Locale } from '@/i18n/request';
import './globals.css';
import Providers from '@/components/providers';
import InstallPwa from '@/components/pwa/InstallPwa';
import { NAV_CORES } from '@/lib/nav-cores';
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
  // ⚠️ ESTA É A COR DA BARRA INFERIOR, e não é coincidência: no PWA do iOS é o
  // `theme-color` que pinta a faixa do home-indicator — a "área de segurança"
  // logo abaixo da barra. Enquanto ele era #FAFAFA/#09090B e a barra virou
  // branca/preta, aparecia um DEGRAU DE COR ali.
  //
  // ⚠️ E É UM VALOR SÓ, SEM `media`. A variante por `prefers-color-scheme`
  // seguiria o tema do SISTEMA — mas o tema aqui é ESCOLHA DO USUÁRIO
  // (`sora-theme`). Quem usasse o app no claro com o celular no escuro ganharia
  // faixa preta embaixo de barra branca: a mesma divergência, por outra porta.
  // Este é só o padrão (tema claro); quem acerta a cor de verdade é o
  // `ThemeColorSync`, que a reescreve a partir do tema real.
  themeColor: NAV_CORES.light.superficie,
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
            animação — que foi o defeito da primeira versão. Aqui o atributo já
            está no <html> quando o <body> começa a pintar.
            ?abertura=1 na URL força a abertura (ignora sessão, largura e
            reduced-motion) — é como se testa sem depender do estado do
            aparelho. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
if(location.search.indexOf('abertura=1')<0){
  var p=location.pathname,pub=['/','/login','/signup','/recuperar-senha','/redefinir-senha','/oferta','/kit','/checkout-vitalicio','/es'];
  for(var i=0;i<pub.length;i++){if(p===pub[i]||p.indexOf(pub[i]+'/')===0)return;}
  try{if(sessionStorage.getItem('sora-abertura-v3')==='1')return;}catch(e){}
  if(!matchMedia('(max-width:767px)').matches)return;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
}
document.documentElement.setAttribute('data-abertura','on');
}catch(e){}})();` }} />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* ═══ ABERTURA DA SORA — o overlay ═══
            PRIMEIRO filho do <body>: é o primeiro pixel que o navegador pinta.
            Fica invisível por CSS até html[data-abertura="on"] existir, e o
            script do <head> já decidiu isso — então nunca há um quadro sequer
            de painel antes da animação.

            ⚠️ O <video> VEM NO HTML DO SERVIDOR, E ISSO É O CONSERTO. Antes ele
            era criado por script DENTRO desta div — e a div é renderizada pelo
            React. Na hidratação o React compara os filhos deste elemento com o
            que ele próprio desenhou (nenhum) e REMOVE o nó extra: o vídeo era
            apagado antes de começar a tocar. Era o "aparece um frame e pula".
            Com dangerouslySetInnerHTML o React não inspeciona os filhos —
            confia no HTML do servidor e não encosta neles.

            ⚠️ MP4 PRIMEIRO. O navegador toca a PRIMEIRA fonte que sabe tocar, e
            H.264 toca em absolutamente todo lugar. O webm economizaria 470 KB
            no Android, mas depois de tantas idas e vindas a ordem aqui é por
            garantia, não por bytes.

            ⚠️ preload="none" e SEM autoplay no HTML: assim o desktop (onde a
            abertura nem roda) não baixa nada. Quem liga os dois é o script
            abaixo, e só quando a abertura vai mesmo acontecer.

            ⚠️ muted+playsinline JÁ NO HTML — são eles que autorizam o play sem
            gesto do usuário no iOS. Precisam existir antes da fonte ser
            escolhida, e por isso vêm escritos no atributo, não por JS. */}
        <div
          id="sora-abertura"
          aria-hidden="true"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: '<video muted playsinline webkit-playsinline preload="none" disablepictureinpicture><source src="/abertura/sora-intro.mp4" type="video/mp4"><source src="/abertura/sora-intro.webm" type="video/webm"></video>' }}
        />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
if(document.documentElement.getAttribute('data-abertura')!=='on')return;
var box=document.getElementById('sora-abertura');if(!box)return;
var v=box.querySelector('video');
if(!v){document.documentElement.removeAttribute('data-abertura');return;}
v.muted=true;v.defaultMuted=true;v.playsInline=true;
v.setAttribute('autoplay','');v.autoplay=true;
v.preload='auto';v.setAttribute('preload','auto');
v.load();

var comecou=false,saiu=false;
function fim(){
  if(saiu)return;saiu=true;
  /* ⚠️ A MARCA DE SESSÃO É GRAVADA NO FIM, não na decisão. Antes eu a gravava
     antes de tocar: uma tentativa QUE FALHOU queimava a sessão e a animação
     não voltava nem depois de consertada. */
  try{sessionStorage.setItem('sora-abertura-v3','1');}catch(e){}
  /* ⚠️ SOLTA O TOQUE ANTES DE COMEÇAR A SUMIR. O atributo só cai 420ms depois
     (é o tempo do fade), e até lá o overlay continua fixed/inset-0 com o maior
     z-index do app. Sem esta linha ele fica INVISÍVEL E AINDA ENGOLINDO TOQUE:
     o usuário toca, não acontece nada, e ele toca de novo achando que travou. */
  box.style.pointerEvents='none';
  box.style.opacity='0';
  setTimeout(function(){document.documentElement.removeAttribute('data-abertura');},420);
}

/* ⚠️ TOQUE NA ABERTURA PULA A ABERTURA. Enquanto o vídeo roda, o overlay cobre
   a tela inteira e engole tudo — quem tocou pra abrir uma aba não recebe nem
   resposta visual. Tocar aqui é intenção de entrar no app, então encerra na
   hora em vez de descartar o toque. Só dispara se o usuário TOCAR: quem não
   toca continua vendo a animação inteira. */
box.addEventListener('pointerdown',fim,{once:true});
v.addEventListener('playing',function(){
  comecou=true;
  try{sessionStorage.setItem('sora-abertura-v3','1');}catch(e){}
});
v.addEventListener('ended',fim);
v.addEventListener('error',fim);

/* ⚠️ NÃO ENCERRAR NO CATCH DO play(). Com autoplay no elemento esta chamada é
   redundante e o navegador rejeita a promessa com AbortError JUSTAMENTE QUANDO
   O VÍDEO COMEÇOU. Só desiste se o vídeo estiver DE FATO parado. */
var pr=v.play();
if(pr&&pr.catch)pr.catch(function(){if(v.paused&&!comecou)fim();});

/* Não começou em 3s? Não segura a tela. */
setTimeout(function(){if(!comecou)fim();},3000);

/* ⚠️ TETO ABSOLUTO. 'ended' nunca dispara se o arquivo travar no meio, e rede
   ruim no celular é regra. A abertura JAMAIS pode virar um app que não abre. */
setTimeout(fim,9000);
}catch(e){try{document.documentElement.removeAttribute('data-abertura');}catch(_){}}})();` }} />

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
