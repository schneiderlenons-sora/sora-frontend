# App Android (TWA) — como publicar

A Sora na Play Store é uma **TWA**: o `.aab` é uma casca que abre
`www.forsora.com` em tela cheia. **O conteúdo não vive dentro do pacote.**

## ⚠️ Mudança no app NÃO exige pacote novo

Todo `git push` no `master` → deploy na Vercel → o app Android está atualizado
na próxima abertura. O service worker colabora: `skipWaiting()` +
`clients.claim()`, caches antigos apagados no activate, e navegação sempre pela
rede (o `offline.html` só entra em falha real de conexão).

**Medido em 08/10/2026:** 96 commits entre o build de 14/09 e aquela data, e
**nenhum** tocou em `public/manifest.json`, nos ícones ou no `sw.js`. Nenhuma
das 96 mudanças precisava de upload.

| Precisa de build novo | Não precisa |
|---|---|
| Nome do pacote, ícone do launcher, splash | Qualquer tela, rota ou regra de negócio |
| Permissões (notificações, Play Billing) | Textos, cores, layout, tema |
| `startUrl`, orientação, `minSdkVersion` | Feature nova inteira |
| Subir `versionCode` pra uma faixa nova | Correção de bug |

## Onde o build mora

```
C:\Users\jenif\sora-android\
```

**FORA deste repositório, e o caminho é ASCII de propósito:** o Android Gradle
Plugin quebra no Windows com acento no caminho, e o repo vive em
`...\OneDrive\Área de Trabalho\...`. O `.gitignore` ignora o projeto Gradle que
`bubblewrap init` deixa cair aqui.

⚠️ **Existe UM só `twa-manifest.json` que vale: o da pasta de build.** O
`.gitignore` tem `/twa-manifest.json` justamente porque `bubblewrap init` já
rodou na pasta do Next.js por engano e largou uma cópia lá. Essa cópia nunca
esteve no git, ninguém a lia, e ela **chegou a divergir** (repo em
`versionCode 1` enquanto o build estava em `3`) — foi apagada em 08/10/2026.
Se aparecer de novo, apague: não sincronize.

## Como publicar uma versão nova

1. Edite `C:\Users\jenif\sora-android\twa-manifest.json` e **suba o
   `appVersionCode`**.
2. ```bash
   cd C:\Users\jenif\sora-android
   bubblewrap update    # regenera o projeto Android a partir do manifesto
   bubblewrap build     # gera o .aab assinado
   ```
3. Suba `app-release-bundle.aab` no Play Console (**Enviar**, não "Adicionar da
   biblioteca" — essa é só pra promover um pacote já enviado).
4. Copie a cópia do repo: `cp twa-manifest.json <repo>/twa-manifest.json`.

⚠️ **`appVersionCode` nunca pode repetir**, nem se o envio for excluído ou
reprovado. Em 08/10/2026 o 3 já estava usado; o próximo é o 4.

## ⚠️ A keystore

```
C:\Users\jenif\OneDrive\Área de Trabalho\Sora\android.keystore   (alias: android)
```

**Perder esse arquivo = não dá mais pra atualizar o app**, nunca, sem abrir
processo de reset de chave com o Google. Ele está dentro do OneDrive, então
corre o risco de virar "somente na nuvem", dar conflito de sincronização ou
sumir numa troca de máquina. **Mantenha uma cópia (e a senha) fora do OneDrive.**

Build novo assinado com outra chave é recusado no envio.

## Digital Asset Links — o que impede a barra do Chrome

Sem o `assetlinks.json` certo, a TWA abre numa Custom Tab: barra verde no topo
com o domínio e três pontinhos. Parece um navegador disfarçado, e é motivo
clássico de reprovação por "funcionalidade mínima".

Servido por `app/api/assetlinks/route.ts` (rota, não arquivo estático — a
impressão digital vem de variável de ambiente na Vercel):
`ANDROID_PACKAGE_NAME` e `ANDROID_SHA256_FINGERPRINT`.

Conferido em 08/10/2026 — `https://www.forsora.com/.well-known/assetlinks.json`
responde 200 com **as duas** impressões:

```
CE:38:9C:4F:…:BA:B2:11   chave de UPLOAD      (a keystore local, CN=Sora)
32:DA:85:2D:…:1A:F0:51   PLAY APP SIGNING     (a do Google)
```

⚠️ **Quem vale pro Android é a do Play App Signing.** Publicar só a de upload
falha exatamente igual a não ter arquivo nenhum — e sem mensagem de erro em
lugar nenhum. O host tem de ser **www** (o apex redireciona).

⚠️ Publicar numa faixa **aberta** TRAVA a escolha de chave de assinatura
permanentemente.

## Decisões gravadas no manifesto

- **`backgroundColor: #44AC74`** — ⚠️ **não é o fundo do tema, é o PRIMEIRO
  QUADRO do vídeo de abertura** (`public/abertura/sora-intro.mp4`). A splash
  nativa do Android é verde → a webview carrega → o vídeo começa no mesmo
  verde, sem piscada. Trocar pelo `#09090B` do tema faria a abertura piscar
  preto→verde. Se o vídeo mudar, remedir o quadro 0 e trocar nos **três**
  lugares: aqui, o `background` de `#sora-abertura` no `globals.css` e o
  `poster` em `app/layout.tsx`.
- **`playBilling: false`** — o app **não vende nada por dentro**: o
  `CardPlanos` no modo android esconde preço e botão de assinar, e as rotas de
  compra convertem pra `gratis`. É o que mantém a Sora fora da exigência de
  Play Billing (o Google proíbe vender assinatura por fora, e proíbe até link
  ou texto persuasivo levando a outro meio de pagamento; o Brasil não está na
  lista de billing alternativo). Ligado, ele põe `com.android.vending.BILLING`
  no pacote e briga com a declaração "Compras no app: Não".
- **`startUrl: /dashboard?fonte=android`** — o `?fonte=android` é a segunda
  fonte de detecção do `lib/origem-app.ts`. A primeira é o
  `document.referrer` (`android-app://`), que só existe na PRIMEIRA navegação.
- **`packageId: com.forsora.app`** — permanente, não existe renomear.
