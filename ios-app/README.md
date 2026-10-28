# Sora para iPhone (App Store)

Casca nativa feita com **Capacitor 8**: o app abre `https://www.forsora.com/login` (logado → painel)
num WKWebView em tela cheia, como a TWA do Android (`docs/ANDROID-TWA.md`).
Todo push no `master` do site já chega no app — **não precisa de build novo**
pra mudança de tela. Build novo só pra ícone, permissões, `capacitor.config.json`
ou versão.

- App Store Connect: app id `6827597771`, bundle `com.forsora.app`, Team `V4P649QY95`.
- **Monta no Codemagic** (`codemagic.yaml` na raiz do repo): o Xcode só existe
  em Mac. Clicar "Start new build" → o .ipa vai pro TestFlight sozinho.
- O `cap add ios` funciona no Windows (Capacitor 8 usa Swift Package Manager,
  sem CocoaPods), então dá pra editar o projeto daqui; só a montagem precisa de Mac.

## Como o site sabe que está dentro do app

`ios.appendUserAgent: "SoraApp-iOS"` no `capacitor.config.json`. O site lê isso
em `lib/origem-app.ts` (`ehAppIos`). ⚠️ Mudou a marca aqui, mude lá — sem ela o
app volta a mostrar venda pelo Stripe (a Apple reprova: 3.1.1) e a carregar o
Pixel do Facebook (declaramos "não rastreia" na Privacidade do app).

## O que foi ajustado no projeto gerado

- Só iPhone (`TARGETED_DEVICE_FAMILY = 1`) e só retrato — sem iPad a Apple não
  exige capturas de tela de iPad.
- `App/App.entitlements`: `applinks:` e `webcredentials:www.forsora.com`. O site
  responde o par em `/.well-known/apple-app-site-association`.
- Info.plist: textos de câmera/fotos (sem eles o app FECHA ao anexar imagem e a
  Apple reprova), `ITSAppUsesNonExemptEncryption = false` (só HTTPS) e idioma pt-BR.
- Ícone 1024×1024 sem transparência (a Apple recusa ícone com alfa) e tela de
  abertura verde `#44AC74` — o 1º quadro do vídeo de abertura, igual ao Android.

⚠️ Rodar `npx cap sync ios` de novo NÃO desfaz esses ajustes (ele só copia
`www/` e o config). Já `cap add ios` do zero desfaz tudo.
