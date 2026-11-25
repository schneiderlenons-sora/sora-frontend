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

## Widgets (desde a 1.2.0)

Alvo `SoraWidgets` (extensão WidgetKit, `com.forsora.app.widgets`, iOS 18+),
código em `ios/App/SoraWidgets/`. Fase 1: só o "Lançar rápido".

- ⚠️ **O alvo foi acrescentado À MÃO no `project.pbxproj`** (não há Mac): IDs
  `5A1D9E77…`. O app embute a extensão ("Embed Foundation Extensions") e
  depende dela. A extensão TEM de ter a mesma versão do app
  (`MARKETING_VERSION` nos dois alvos), senão a Apple recusa o envio. O passo
  "Numerar a build" do Codemagic troca o `CURRENT_PROJECT_VERSION` dos dois.
- **Assinatura:** o identificador e o perfil "ForSora Widgets App Store" foram
  criados pela API da Apple (25/11/2026). O `ios_signing` do Codemagic acha
  sozinho perfis `com.forsora.app.*`, mas o perfil precisa estar em Team
  settings → Code signing identities → iOS provisioning profiles (botão
  "Fetch profiles").
- ⚠️ **No iPhone um widget não abre outro app direto.** Os botões rodam a
  `AbrirLancamentoIntent` (`SoraWidgets/AbrirLancamentoIntent.swift`), que
  entra nos DOIS alvos e tem `openAppWhenRun`: o iPhone abre a ForSora e roda o
  `perform()` dentro do app, que abre o WhatsApp (`AtalhoLancar`, no
  `SceneDelegate`). O corpo só existe no app pela condição `MAIN_APP` (ligada só
  no alvo App). Num widget PEQUENO, `Link` não funciona (só do médio pra cima).
  - ⚠️ A 1ª versão (build 6) usava `Button(intent: OpenURLIntent(url))` direto
    e o toque não fazia nada. Não voltar a ela.
  - ⚠️ O app ainda roda no iOS 15 e o AppIntents é do 16: o alvo App liga o
    framework como opcional (`OTHER_LDFLAGS -weak_framework AppIntents`). Sem
    isso o app não abriria em iPhone com iOS 15.
  - Os links `https://www.forsora.com/lancar/<acao>` seguem tratados pelo
    `SceneDelegate`, e no navegador `app/lancar/[acao]` redireciona.
